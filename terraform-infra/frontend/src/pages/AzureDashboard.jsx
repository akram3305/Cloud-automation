import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { azureHealth, listAzureVMs, listAzureRGs } from "../api/api"

const KEYFRAMES = `
@keyframes fadeUp {
  from { opacity:0; transform:translateY(16px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
@keyframes spin {
  from { transform: rotate(0deg);  }
  to   { transform: rotate(360deg);}
}
@keyframes pulse-azure {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,120,212,0.2); }
  50%       { box-shadow: 0 0 0 8px rgba(0,120,212,0); }
}
`

function Skeleton({ w = "100%", h = "16px", r = "6px", dark }) {
  const base  = dark ? "#1e293b" : "#e2e8f0"
  const shine = dark ? "#263347" : "#f1f5f9"
  return (
    <div style={{ width:w, height:h, borderRadius:r, background:`linear-gradient(90deg, ${base} 25%, ${shine} 50%, ${base} 75%)`, backgroundSize:"600px 100%", animation:"shimmer 1.4s infinite linear" }} />
  )
}

const SUB_CONFIG = {
  prod:         { label:"Production",    color:"#f59e0b", badgeBg:"rgba(245,158,11,0.12)",  badgeBorder:"rgba(245,158,11,0.3)"  },
  nonprod:      { label:"Non-Production",color:"#10b981", badgeBg:"rgba(16,185,129,0.12)", badgeBorder:"rgba(16,185,129,0.3)" },
  connectivity: { label:"Connectivity",  color:"#0078D4", badgeBg:"rgba(0,120,212,0.12)",  badgeBorder:"rgba(0,120,212,0.3)"  },
}

const NAV_CARDS = [
  { label:"Virtual Machines", desc:"Create and manage VMs", path:"/azure/compute", color:"#0078D4", active:true,
    icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
  { label:"Blob Storage", desc:"Storage accounts & containers", path:"/azure/storage", color:"#50e6ff", active:true,
    icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { label:"VNet & Subnets", desc:"Virtual networking & peering", path:"/azure/network", color:"#7fba00", active:true,
    icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { label:"AKS Clusters", desc:"Kubernetes Service", path:"/azure/aks", color:"#a78bfa", active:false,
    icon:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
]

const QUICK_ACTIONS = [
  { label:"Create Virtual Machine", desc:"Launch the VM wizard", path:"/azure/compute/create", color:"#0078D4", icon:"M12 4v16m8-8H4" },
  { label:"Manage VMs",             desc:"View all virtual machines", path:"/azure/compute",        color:"#50e6ff", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
  { label:"Storage Accounts",       desc:"Blobs, queues, tables",     path:"/azure/storage",        color:"#7fba00", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { label:"Virtual Networks",       desc:"VNets, subnets & peering",  path:"/azure/network",        color:"#f59e0b", icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064" },
]

function statusInfo(status) {
  if (status === "connected")     return { label:"Connected",     dot:"#10b981", glow:"#10b981" }
  if (status === "not_configured") return { label:"Not Configured", dot:"#f59e0b", glow:"#f59e0b" }
  return { label:"Error", dot:"#ef4444", glow:"#ef4444" }
}

function vmStatusColor(state) {
  if (!state) return "#475569"
  const s = state.toLowerCase()
  if (s === "running" || s === "succeeded") return "#10b981"
  if (s === "stopped" || s === "deallocated") return "#f59e0b"
  if (s === "failed") return "#ef4444"
  return "#a78bfa"
}

export default function AzureDashboard() {
  const { dark }  = useTheme()
  const navigate  = useNavigate()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"

  const [subFilter,  setSubFilter]  = useState("all")   // "all" | "nonprod" | "prod"
  const [health,     setHealth]     = useState(null)
  const [nonprodVMs, setNonprodVMs] = useState([])
  const [prodVMs,    setProdVMs]    = useState([])
  const [rgs,        setRgs]        = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchData(manual = false) {
    if (manual) setRefreshing(true)
    try {
      await Promise.allSettled([
        azureHealth().then(r => setHealth(r.data)).catch(() => setHealth(null)),
        listAzureVMs("nonprod").then(r => setNonprodVMs(r.data?.vms || [])).catch(() => setNonprodVMs([])),
        listAzureVMs("prod").then(r => setProdVMs(r.data?.vms || [])).catch(() => setProdVMs([])),
        listAzureRGs("nonprod").then(r => setRgs(r.data || [])).catch(() => setRgs([])),
      ])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const allVMs    = subFilter === "nonprod" ? nonprodVMs
                  : subFilter === "prod"    ? prodVMs
                  : [...nonprodVMs, ...prodVMs]
  const running   = allVMs.filter(v => v.power_state === "running" || v.power_state === "VM running").length
  const stopped   = allVMs.filter(v => v.power_state !== "running" && v.power_state !== "VM running").length
  const recentVMs = allVMs.slice(0, 8)

  return (
    <div style={{ background:bg, minHeight:"100vh", padding:0 }}>
      <style>{KEYFRAMES}</style>

      {/* Top accent bar */}
      <div style={{ position:"fixed", top:0, left:0, right:0, height:"4px", background:"linear-gradient(135deg,#0078D4 0%,#50e6ff 100%)", zIndex:1000 }} />

      {/* ── Header ── */}
      <div style={{ background:surface, borderBottom:`1px solid ${border}`, padding:"20px 32px", animation:"fadeUp 0.4s ease both" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            {/* Azure logo */}
            <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#0078D4,#50e6ff)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 20px rgba(0,120,212,0.35)", animation:"pulse-azure 3s ease-in-out infinite" }}>
              <span style={{ fontSize:15, fontWeight:800, color:"#fff", letterSpacing:"-0.5px" }}>Az</span>
            </div>
            <div>
              <h1 style={{ fontSize:22, fontWeight:700, color:text, margin:0, letterSpacing:"-0.3px" }}>Microsoft Azure</h1>
              <p style={{ fontSize:12, color:muted, margin:0, marginTop:2 }}>Hub-and-Spoke Landing Zone — 3 subscriptions</p>
            </div>
          </div>

          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            {/* Subscription filter */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
              <span style={{ fontSize:10, color:muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Subscription</span>
              <div style={{ display:"flex", background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", border:`1px solid ${border}`, borderRadius:8, padding:3, gap:3 }}>
                {[
                  { id:"all",     label:"All",         color:"#0078D4" },
                  { id:"nonprod", label:"Non-Prod",    color:"#10b981" },
                  { id:"prod",    label:"Production",  color:"#f59e0b" },
                ].map(s => (
                  <button key={s.id} onClick={() => setSubFilter(s.id)} style={{
                    padding:"5px 12px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer", border:"none",
                    background: subFilter === s.id ? s.color : "transparent",
                    color: subFilter === s.id ? "#fff" : muted,
                    transition:"all 0.15s",
                  }}>{s.label}</button>
                ))}
              </div>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, background:surface, border:`1px solid ${border}`, color:text, fontSize:12, fontWeight:500, cursor:refreshing?"not-allowed":"pointer", opacity:refreshing?0.7:1, transition:"all 0.2s" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={refreshing?"#0078D4":muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation:refreshing?"spin 0.8s linear infinite":"none" }}>
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={() => navigate("/azure/compute/create")}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 20px", borderRadius:10, background:"linear-gradient(135deg,#0078D4,#50e6ff)", border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(0,120,212,0.4)", transition:"all 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,120,212,0.5)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)";   e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,120,212,0.4)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16m8-8H4"/></svg>
              Launch VM
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding:"28px 32px", maxWidth:1400, margin:"0 auto" }}>

        {/* ── Subscription Status Cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24, animation:"fadeUp 0.4s ease 0.1s both" }}>
          {["prod","nonprod","connectivity"].map(sub => {
            const cfg    = SUB_CONFIG[sub]
            const status = health?.[sub]
            const si     = statusInfo(status?.status)
            return (
              <div key={sub} style={{ background:surface, border:`1px solid ${cfg.badgeBorder}`, borderRadius:12, padding:"16px 20px", transition:"transform 0.18s ease" }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:si.dot, boxShadow:`0 0 8px ${si.glow}` }} />
                    <span style={{ fontSize:13, fontWeight:700, color:cfg.color }}>{cfg.label}</span>
                  </div>
                  <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:20, background:cfg.badgeBg, border:`1px solid ${cfg.badgeBorder}`, color:cfg.color, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                    {sub.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize:12, color:muted, marginBottom:4 }}>
                  {loading ? "Checking..." : si.label}
                </div>
                {status?.subscription_id && (
                  <div style={{ fontSize:10, color:muted, fontFamily:"monospace", display:"flex", alignItems:"center", gap:4 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                    {status.subscription_id.slice(0, 8)}...{status.subscription_id.slice(-4)}
                  </div>
                )}
                {!status?.subscription_id && !loading && (
                  <div style={{ fontSize:10, color:muted }}>No subscription ID</div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Metric Cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24, animation:"fadeUp 0.4s ease 0.2s both" }}>
          {[
            { label:"Total VMs",       value:allVMs.length,  color:"#0078D4", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
            { label:"Running",         value:running,         color:"#10b981", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
            { label:"Stopped",         value:stopped,         color:"#f59e0b", icon:"M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" },
            { label:"Resource Groups", value:rgs.length,      color:"#a78bfa", icon:"M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
          ].map((m, i) => (
            <div key={m.label} style={{ background:surface, border:`1px solid ${border}`, borderRadius:12, padding:"18px 20px", position:"relative", overflow:"hidden", transition:"transform 0.18s ease, box-shadow 0.18s ease" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${m.color}22` }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)";   e.currentTarget.style.boxShadow = "none" }}
            >
              <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${m.color}60,${m.color})` }} />
              <div style={{ width:36, height:36, borderRadius:9, background:`${m.color}18`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon}/></svg>
              </div>
              <div style={{ fontSize:11, fontWeight:600, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>{m.label}</div>
              {loading
                ? <Skeleton w="50%" h="28px" r="6px" dark={dark} />
                : <div style={{ fontSize:28, fontWeight:700, color:text, letterSpacing:"-0.5px", lineHeight:1 }}>{m.value}</div>
              }
            </div>
          ))}
        </div>

        {/* ── Two-column: VMs table + Quick Actions ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:20, marginBottom:24, animation:"fadeUp 0.4s ease 0.3s both" }}>
          {/* Recent VMs */}
          <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:"20px 0", overflow:"hidden" }}>
            <div style={{ padding:"0 20px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${border}` }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:text }}>Recent Virtual Machines</div>
                <div style={{ fontSize:11, color:muted, marginTop:2 }}>Prod + Non-Prod combined</div>
              </div>
              <button onClick={() => navigate("/azure/compute")} style={{ fontSize:12, color:"#0078D4", background:"transparent", border:"none", cursor:"pointer", fontWeight:500 }}>
                View all →
              </button>
            </div>
            {loading ? (
              <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
                {Array.from({ length:5 }).map((_, i) => (
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <Skeleton w="32px" h="32px" r="8px" dark={dark}/>
                    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:5 }}>
                      <Skeleton w="60%" h="12px" dark={dark}/>
                      <Skeleton w="40%" h="10px" dark={dark}/>
                    </div>
                    <Skeleton w="60px" h="20px" r="6px" dark={dark}/>
                  </div>
                ))}
              </div>
            ) : recentVMs.length === 0 ? (
              <div style={{ padding:32, textAlign:"center", color:muted, fontSize:13 }}>
                No virtual machines found. Launch one to get started.
              </div>
            ) : (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", padding:"8px 20px", borderBottom:`1px solid ${border}` }}>
                  {["Name","Size","Location","Status"].map(h => (
                    <div key={h} style={{ fontSize:10, fontWeight:600, color:muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>
                  ))}
                </div>
                {recentVMs.map((vm, i) => {
                  const sc = vmStatusColor(vm.power_state)
                  return (
                    <div key={vm.name || i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", alignItems:"center", padding:"10px 20px", borderBottom:`1px solid ${border}`, transition:"background 0.15s ease", cursor:"default" }}
                      onMouseEnter={e => e.currentTarget.style.background = dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:sc, flexShrink:0 }} />
                        <div style={{ fontSize:12, fontWeight:600, color:text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{vm.name || "—"}</div>
                      </div>
                      <div style={{ fontSize:11, color:muted, fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{vm.vm_size || vm.size || "—"}</div>
                      <div style={{ fontSize:11, color:muted }}>{vm.location || "—"}</div>
                      <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:6, background:`${sc}18`, color:sc, border:`1px solid ${sc}40`, whiteSpace:"nowrap" }}>
                        {vm.power_state || "Unknown"}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:600, color:text, marginBottom:4 }}>Quick Actions</div>
            <div style={{ fontSize:11, color:muted, marginBottom:16 }}>Common Azure operations</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {QUICK_ACTIONS.map(qa => (
                <button key={qa.path} onClick={() => navigate(qa.path)}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:10, cursor:"pointer", textAlign:"left", background:"transparent", border:`1px solid ${border}`, transition:"all 0.18s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${qa.color}0d`; e.currentTarget.style.borderColor = `${qa.color}40`; e.currentTarget.style.transform = "translateX(3px)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = "translateX(0)" }}
                >
                  <div style={{ width:34, height:34, borderRadius:9, background:`${qa.color}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={qa.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={qa.icon}/></svg>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:text }}>{qa.label}</div>
                    <div style={{ fontSize:11, color:muted }}>{qa.desc}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Navigation Service Cards ── */}
        <div style={{ animation:"fadeUp 0.4s ease 0.4s both" }}>
          <div style={{ fontSize:13, fontWeight:600, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>Azure Services</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
            {NAV_CARDS.map(card => (
              <button key={card.path}
                onClick={() => card.active && navigate(card.path)}
                style={{
                  background: card.active ? `linear-gradient(135deg,${card.color}12,${card.color}06)` : dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)",
                  border:`1px solid ${card.active?card.color+"33":border}`,
                  borderRadius:14, padding:"22px 18px",
                  cursor:card.active?"pointer":"default",
                  textAlign:"left", transition:"all 0.2s ease",
                  opacity:card.active?1:0.55,
                }}
                onMouseEnter={e => { if (card.active) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${card.color}22` } }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
              >
                <div style={{ width:42, height:42, borderRadius:11, background:`${card.color}20`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={card.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={card.icon}/></svg>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:text }}>{card.label}</div>
                  {!card.active && (
                    <span style={{ fontSize:9, padding:"2px 7px", borderRadius:10, background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)", color:muted, fontWeight:700, letterSpacing:"0.06em" }}>SOON</span>
                  )}
                </div>
                <div style={{ fontSize:12, color:muted }}>{card.desc}</div>
                {card.active && (
                  <div style={{ fontSize:11, color:card.color, marginTop:10, fontWeight:600 }}>Manage →</div>
                )}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
