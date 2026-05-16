import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { gcpHealth, listGCPInstances, getGCPCost } from "../api/api"

function SvgIcon({ d, size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  compute:  "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
  cost:     "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  storage:  "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  network:  "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  gke:      "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
  launch:   "M12 4v16m8-8H4",
  zone:     "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
  activity: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
}

const STATUS_COLORS = {
  RUNNING:      { bg:"rgba(34,197,94,0.15)",   color:"#22c55e",  dot:"#22c55e"  },
  TERMINATED:   { bg:"rgba(100,116,139,0.15)", color:"#94a3b8",  dot:"#94a3b8"  },
  STOPPED:      { bg:"rgba(245,158,11,0.15)",  color:"#f59e0b",  dot:"#f59e0b"  },
  STAGING:      { bg:"rgba(66,133,244,0.15)",  color:"#4285F4",  dot:"#4285F4"  },
  STOPPING:     { bg:"rgba(245,158,11,0.12)",  color:"#f59e0b",  dot:"#f59e0b"  },
  PROVISIONING: { bg:"rgba(66,133,244,0.12)",  color:"#4285F4",  dot:"#4285F4"  },
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.TERMINATED
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"2px 8px",
      borderRadius:20, background:s.bg, color:s.color, fontSize:10, fontWeight:700 }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:s.dot, flexShrink:0,
        boxShadow: status==="RUNNING" ? `0 0 4px ${s.dot}` : "none" }} />
      {status}
    </span>
  )
}

export default function GCPDashboard() {
  const { dark } = useTheme()
  const navigate  = useNavigate()

  const selectedProject = (() => {
    try { return JSON.parse(localStorage.getItem("gcp_selected_project") || "null") } catch { return null }
  })()

  const [health,     setHealth]     = useState(null)
  const [instances,  setInstances]  = useState([])
  const [costData,   setCostData]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [lastRefresh,setLastRefresh]= useState(null)

  // ── theme tokens ─────────────────────────────────────────────────────────
  const bg      = dark ? "#070c18" : "#f0f4f8"
  const card    = dark ? "rgba(255,255,255,0.03)" : "#ffffff"
  const border  = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const txt     = dark ? "#e2e8f0" : "#1e293b"
  const muted   = dark ? "#64748b" : "#94a3b8"
  const GCP     = { blue:"#4285F4", green:"#34A853", yellow:"#FBBC04", red:"#EA4335" }

  const load = () => {
    setLoading(true)
    Promise.all([
      gcpHealth().catch(() => ({ data:{ status:"error" } })),
      listGCPInstances().catch(() => ({ data:{ instances:[] } })),
      getGCPCost().catch(() => ({ data: null })),
    ]).then(([h, inst, cost]) => {
      setHealth(h.data)
      setInstances(inst.data?.instances || [])
      setCostData(cost.data)
      setLastRefresh(new Date())
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // ── derived metrics ───────────────────────────────────────────────────────
  const totalVMs   = instances.length
  const running    = instances.filter(i => i.status === "RUNNING").length
  const stopped    = instances.filter(i => ["STOPPED","TERMINATED"].includes(i.status)).length
  const zones      = [...new Set(instances.map(i => i.zone))].length
  const grandTotal = costData?.grand_total ?? 0
  const connected  = health?.status === "connected"

  // zone breakdown from instances
  const zoneBreakdown = instances.reduce((acc, i) => {
    acc[i.zone] = acc[i.zone] || { zone:i.zone, total:0, running:0 }
    acc[i.zone].total++
    if (i.status === "RUNNING") acc[i.zone].running++
    return acc
  }, {})
  const zoneList = Object.values(zoneBreakdown).sort((a,b) => b.total - a.total).slice(0, 5)

  // cost by zone from costData
  const costZones = costData?.zones || []

  const recentInstances = [...instances].slice(0, 8)

  return (
    <div style={{ minHeight:"100vh", background:bg, color:txt, fontFamily:"system-ui,sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ padding:"24px 28px 0", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:13,
            background:"linear-gradient(135deg,#4285F4,#34A853)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 16px rgba(66,133,244,0.4)" }}>
            <span style={{ fontSize:11, fontWeight:800, color:"#fff", letterSpacing:"-0.5px" }}>GCP</span>
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, letterSpacing:"-0.3px" }}>Google Cloud Platform</h1>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3 }}>
              <span style={{ fontSize:12, color:muted }}>Project:</span>
              <span style={{ fontSize:12, fontWeight:600, color:GCP.blue }}>{health?.project || "—"}</span>
              {connected ? (
                <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:700,
                  color:"#22c55e", background:"rgba(34,197,94,0.1)", padding:"2px 8px", borderRadius:20 }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 4px #22c55e" }} />
                  CONNECTED
                </span>
              ) : (
                <span style={{ fontSize:10, fontWeight:700, color:"#ef4444",
                  background:"rgba(239,68,68,0.1)", padding:"2px 8px", borderRadius:20 }}>
                  NOT CONFIGURED
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {lastRefresh && <span style={{ fontSize:11, color:muted }}>Updated {lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={load} disabled={loading}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9,
              background:card, border:`1px solid ${border}`, color:txt, fontSize:12, cursor:"pointer",
              opacity:loading?0.6:1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ animation:loading?"spin 0.8s linear infinite":"none" }}>
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button onClick={() => navigate("/gcp/compute/create")}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9,
              background:"linear-gradient(135deg,#4285F4,#34A853)", border:"none",
              color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer",
              boxShadow:"0 4px 12px rgba(66,133,244,0.4)" }}>
            <SvgIcon d={ICONS.launch} size={13} color="#fff" />
            Launch Instance
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Project selector banner ── */}
      <div style={{ margin:"16px 28px 0", padding:"11px 16px", borderRadius:10,
        background: selectedProject ? "rgba(52,168,83,0.07)" : "rgba(66,133,244,0.07)",
        border: `1px solid ${selectedProject ? "rgba(52,168,83,0.25)" : "rgba(66,133,244,0.25)"}`,
        display:"flex", alignItems:"center", gap:10, fontSize:12 }}>
        <span style={{ color: selectedProject ? "#34A853" : "#4285F4", fontWeight:600 }}>
          {selectedProject ? `Project: ${selectedProject.name} (${selectedProject.id})` : "Using default project from credentials"}
        </span>
        <button onClick={() => navigate("/gcp/projects")}
          style={{ marginLeft:"auto", padding:"4px 12px", borderRadius:7, fontSize:11, fontWeight:600,
            background: selectedProject ? "rgba(52,168,83,0.15)" : "rgba(66,133,244,0.15)",
            border: `1px solid ${selectedProject ? "rgba(52,168,83,0.3)" : "rgba(66,133,244,0.3)"}`,
            color: selectedProject ? "#34A853" : "#4285F4", cursor:"pointer" }}>
          {selectedProject ? "Switch Project" : "Browse All Projects"}
        </button>
        {selectedProject && (
          <button onClick={() => { localStorage.removeItem("gcp_selected_project"); window.location.reload() }}
            style={{ padding:"4px 10px", borderRadius:7, fontSize:11, fontWeight:600,
              background:"rgba(244,63,94,0.08)", border:"1px solid rgba(244,63,94,0.2)",
              color:"#f43f5e", cursor:"pointer" }}>
            Clear
          </button>
        )}
      </div>

      {/* ── Not configured banner ── */}
      {!connected && !loading && (
        <div style={{ margin:"16px 28px 0", padding:"14px 18px", borderRadius:12,
          background:"rgba(66,133,244,0.07)", border:"1px solid rgba(66,133,244,0.25)" }}>
          <div style={{ fontSize:13, fontWeight:600, color:GCP.blue, marginBottom:4 }}>GCP Configuration Required</div>
          <div style={{ fontSize:12, color:muted, lineHeight:1.7 }}>
            Add <code style={{ background:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)", padding:"1px 5px", borderRadius:3 }}>GCP_PROJECT_ID</code> and{" "}
            <code style={{ background:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)", padding:"1px 5px", borderRadius:3 }}>GCP_CREDENTIALS_FILE</code> to your <code>.env</code> file.
          </div>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, padding:"20px 28px 0" }}>
        {[
          { label:"Total Instances", value: loading ? "—" : totalVMs,          sub:"across all zones",      accent:GCP.blue,   icon:ICONS.compute },
          { label:"Running",         value: loading ? "—" : running,            sub:"currently active",      accent:"#22c55e",  icon:ICONS.compute },
          { label:"Stopped / Off",   value: loading ? "—" : stopped,            sub:"not incurring cost",    accent:"#f59e0b",  icon:ICONS.compute },
          { label:"Zones Active",    value: loading ? "—" : zones,              sub:"with compute instances",accent:GCP.green,  icon:ICONS.zone },
          { label:"Est. Monthly",    value: loading ? "—" : `$${grandTotal.toFixed(2)}`,sub:"running VMs only", accent:GCP.yellow,icon:ICONS.cost },
        ].map(c => (
          <div key={c.label} style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:"16px 18px",
            position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:12, right:14, opacity:0.15 }}>
              <SvgIcon d={c.icon} size={28} color={c.accent} />
            </div>
            <div style={{ fontSize:10, color:muted, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8, fontWeight:600 }}>{c.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:c.accent }}>{c.value}</div>
            <div style={{ fontSize:11, color:muted, marginTop:4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:16, padding:"16px 28px" }}>

        {/* LEFT — instances table + zone breakdown */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Instances table */}
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${border}`,
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:13, fontWeight:700 }}>Compute Instances</div>
              <button onClick={() => navigate("/gcp/compute")}
                style={{ fontSize:11, color:GCP.blue, background:"transparent", border:"none", cursor:"pointer", fontWeight:600 }}>
                View All →
              </button>
            </div>

            {loading ? (
              <div style={{ padding:32, textAlign:"center", color:muted, fontSize:13 }}>
                <div style={{ width:24, height:24, border:`2px solid ${GCP.blue}`, borderTopColor:"transparent",
                  borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 10px" }} />
                Loading instances…
              </div>
            ) : recentInstances.length === 0 ? (
              <div style={{ padding:40, textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🖥️</div>
                <div style={{ fontSize:13, color:muted, marginBottom:16 }}>No instances found in this project.</div>
                <button onClick={() => navigate("/gcp/compute/create")}
                  style={{ padding:"8px 20px", borderRadius:9, background:"linear-gradient(135deg,#4285F4,#34A853)",
                    border:"none", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  Launch First Instance
                </button>
              </div>
            ) : (
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }}>
                    {["Name","Status","Machine Type","Zone","Est. Cost/mo"].map(h => (
                      <th key={h} style={{ padding:"8px 16px", fontSize:10, fontWeight:700, color:muted,
                        textAlign:"left", borderBottom:`1px solid ${border}`, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentInstances.map((inst, idx) => {
                    const zoneData = costZones.find(z => z.zone === inst.zone)
                    const vmCost = zoneData?.vms?.find(v => v.name === inst.name)
                    return (
                      <tr key={inst.name + idx}
                        style={{ borderBottom:`1px solid ${border}`, transition:"background 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.background = dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding:"10px 16px" }}>
                          <div style={{ fontSize:13, fontWeight:600, color:txt }}>{inst.name}</div>
                          <div style={{ fontSize:10, color:muted }}>{inst.project}</div>
                        </td>
                        <td style={{ padding:"10px 16px" }}><StatusBadge status={inst.status} /></td>
                        <td style={{ padding:"10px 16px", fontSize:12, color:txt, fontFamily:"monospace" }}>{inst.machine_type}</td>
                        <td style={{ padding:"10px 16px", fontSize:12, color:muted }}>{inst.zone}</td>
                        <td style={{ padding:"10px 16px" }}>
                          {vmCost ? (
                            inst.status === "RUNNING" ? (
                              <span style={{ fontSize:12, fontWeight:700, color:GCP.yellow }}>
                                ${vmCost.monthly_cost.toFixed(2)}
                              </span>
                            ) : (
                              <div>
                                <span style={{ fontSize:12, fontWeight:700, color:muted }}>$0.00</span>
                                {vmCost.list_price_monthly > 0 && (
                                  <div style={{ fontSize:10, color:dark?"#334155":"#cbd5e1", marginTop:1 }}>
                                    ${vmCost.list_price_monthly.toFixed(2)} if on
                                  </div>
                                )}
                              </div>
                            )
                          ) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Cost by zone bar chart */}
          {costZones.length > 0 && (
            <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>Cost by Zone</div>
                <button onClick={() => navigate("/gcp/cost")}
                  style={{ fontSize:11, color:GCP.blue, background:"transparent", border:"none", cursor:"pointer", fontWeight:600 }}>
                  Full Cost Report →
                </button>
              </div>
              {costZones.map(z => {
                const pct = grandTotal > 0 ? (z.total_monthly / grandTotal) * 100 : 0
                const col = z.total_monthly < 50 ? "#22c55e" : z.total_monthly < 200 ? "#f59e0b" : "#ef4444"
                return (
                  <div key={z.zone} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                    <div style={{ width:150, fontSize:11, color:muted, textAlign:"right", flexShrink:0,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={z.zone}>
                      {z.zone}
                    </div>
                    <div style={{ flex:1, height:18, background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", borderRadius:5, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.max(pct,0.5)}%`,
                        background:`linear-gradient(90deg,${col}99,${col})`,
                        borderRadius:5, transition:"width 0.6s ease" }} />
                    </div>
                    <div style={{ width:60, fontSize:11, fontWeight:700, color:col, textAlign:"right", flexShrink:0 }}>${z.total_monthly.toFixed(2)}</div>
                    <div style={{ width:32, fontSize:10, color:muted, textAlign:"right", flexShrink:0 }}>{pct.toFixed(0)}%</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT — services + cost summary */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Quick services */}
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:18 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Services</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { label:"Compute Engine",  sub:"Virtual Machines",      icon:ICONS.compute, color:GCP.blue,   path:"/gcp/compute",        live:true  },
                { label:"Launch Instance", sub:"Create new VM",          icon:ICONS.launch,  color:GCP.green,  path:"/gcp/compute/create", live:true  },
                { label:"Cost by Zone",    sub:"Spend analytics",        icon:ICONS.cost,    color:GCP.yellow, path:"/gcp/cost",           live:true  },
                { label:"GKE Clusters",    sub:"Kubernetes",             icon:ICONS.gke,     color:GCP.green,  path:null,                  soon:true  },
                { label:"Cloud Storage",   sub:"Object storage",         icon:ICONS.storage, color:GCP.yellow, path:null,                  soon:true  },
                { label:"VPC Networks",    sub:"Networking",             icon:ICONS.network, color:GCP.blue,   path:null,                  soon:true  },
              ].map(s => (
                <button key={s.label}
                  onClick={() => s.path && navigate(s.path)}
                  disabled={!s.path}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10,
                    background:"transparent", border:`1px solid ${border}`, cursor:s.path?"pointer":"default",
                    textAlign:"left", transition:"all 0.15s", opacity:s.soon?0.5:1 }}
                  onMouseEnter={e => { if(s.path) e.currentTarget.style.background=dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)" }}
                  onMouseLeave={e => { e.currentTarget.style.background="transparent" }}>
                  <div style={{ width:32, height:32, borderRadius:8, flexShrink:0,
                    background:`${s.color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <SvgIcon d={s.icon} size={15} color={s.color} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:txt }}>{s.label}</div>
                    <div style={{ fontSize:10, color:muted }}>{s.sub}</div>
                  </div>
                  {s.soon ? (
                    <span style={{ fontSize:9, fontWeight:700, color:muted,
                      background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",
                      padding:"2px 6px", borderRadius:4 }}>SOON</span>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Cost summary card */}
          <div style={{ background:`linear-gradient(135deg,rgba(66,133,244,0.1),rgba(52,168,83,0.06))`,
            border:`1px solid rgba(66,133,244,0.25)`, borderRadius:14, padding:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <SvgIcon d={ICONS.cost} size={16} color={GCP.yellow} />
              <div style={{ fontSize:13, fontWeight:700 }}>Cost Overview</div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { l:"Monthly Estimate",  v:`$${grandTotal.toFixed(2)}`,  c:GCP.yellow },
                { l:"Running VMs",       v:running,                       c:"#22c55e"  },
                { l:"Active Zones",      v:zones,                         c:GCP.blue   },
                { l:"Stopped / Free",    v:stopped,                       c:muted      },
              ].map(m => (
                <div key={m.l} style={{ background:dark?"rgba(0,0,0,0.2)":"rgba(255,255,255,0.6)",
                  borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:muted, marginBottom:4 }}>{m.l}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:m.c }}>{loading?"—":m.v}</div>
                </div>
              ))}
            </div>

            <button onClick={() => navigate("/gcp/cost")}
              style={{ width:"100%", padding:"9px", borderRadius:9, border:"none", cursor:"pointer",
                background:"linear-gradient(135deg,#4285F4,#34A853)", color:"#fff", fontSize:12, fontWeight:700 }}>
              Full Cost Report →
            </button>

            <div style={{ marginTop:10, fontSize:10, color:muted, lineHeight:1.5 }}>
              Estimates based on on-demand pricing. Stopped / deallocated VMs = $0 compute cost.
            </div>
          </div>

          {/* Zone distribution */}
          {zoneList.length > 0 && (
            <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:18 }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Zone Distribution</div>
              {zoneList.map(z => (
                <div key={z.zone} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <SvgIcon d={ICONS.zone} size={12} color={muted} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, color:txt, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{z.zone}</div>
                    <div style={{ fontSize:10, color:muted }}>{z.total} VM{z.total!==1?"s":""} · {z.running} running</div>
                  </div>
                  <div style={{ flexShrink:0 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:"#22c55e" }}>{z.running}</span>
                    <span style={{ fontSize:10, color:muted }}> / {z.total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
