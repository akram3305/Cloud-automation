import { useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import { getGCPCost } from "../api/api"

const COST_ICON = "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"

function SvgIcon({ d, size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function barColor(monthly) {
  if (monthly < 100)  return "#22c55e"
  if (monthly < 500)  return "#f59e0b"
  return "#ef4444"
}

export default function GCPCost() {
  const { dark } = useTheme()
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState("")
  const [expanded,  setExpanded]  = useState({})

  useEffect(() => {
    setLoading(true)
    getGCPCost()
      .then(r => { setData(r.data); setError("") })
      .catch(e => setError(e.response?.data?.detail || e.message || "Failed to load GCP cost data"))
      .finally(() => setLoading(false))
  }, [])

  // ── theme tokens ──────────────────────────────────────────────────────────
  const bg       = dark ? "#070c18" : "#f0f4f8"
  const card     = dark ? "rgba(255,255,255,0.03)" : "#ffffff"
  const border   = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const txt      = dark ? "#e2e8f0" : "#1e293b"
  const muted    = dark ? "#64748b" : "#94a3b8"
  const GCP      = { color:"#4285F4", bg:"rgba(66,133,244,0.12)", border:"rgba(66,133,244,0.3)" }

  const maxMonthly = data ? Math.max(...data.zones.map(z => z.total_monthly), 1) : 1

  if (loading) return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:40, height:40, border:`3px solid ${GCP.color}`, borderTopColor:"transparent",
          borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
        <p style={{ color:muted, fontSize:13 }}>Loading GCP cost data…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:card, border:`1px solid rgba(239,68,68,0.3)`, borderRadius:14, padding:32,
        textAlign:"center", maxWidth:480 }}>
        <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
        <div style={{ color:"#ef4444", fontWeight:600, marginBottom:8 }}>Failed to load GCP cost data</div>
        <div style={{ color:muted, fontSize:13 }}>{error}</div>
        <div style={{ marginTop:16, color:muted, fontSize:12 }}>
          Ensure GCP_PROJECT_ID and GCP_CREDENTIALS_JSON are configured in your .env
        </div>
      </div>
    </div>
  )

  const { zones = [], grand_total = 0, total_vms = 0, running_vms = 0, project = "" } = data || {}

  return (
    <div style={{ minHeight:"100vh", background:bg, color:txt, fontFamily:"system-ui,sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ padding:"28px 28px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:6 }}>
          <div style={{ width:42, height:42, borderRadius:12,
            background:"linear-gradient(135deg,#4285F4,#34A853)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 16px rgba(66,133,244,0.35)" }}>
            <SvgIcon d={COST_ICON} size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>GCP Cost by Zone</h1>
            <p style={{ margin:0, fontSize:12, color:muted }}>
              Project: <span style={{ color:GCP.color, fontWeight:600 }}>{project || "default"}</span>
              {" · "}On-demand list prices · 730 hrs/month
            </p>
          </div>
        </div>

        {/* info banner */}
        <div style={{ marginTop:16, padding:"10px 16px", borderRadius:10,
          background:GCP.bg, border:`1px solid ${GCP.border}`, fontSize:12, color:muted }}>
          💡 Estimates use GCP on-demand list pricing for the selected machine type.
          Only <strong style={{ color:txt }}>RUNNING</strong> instances incur compute cost.
          TERMINATED / STOPPED instances are $0.
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, padding:"20px 28px 0" }}>
        {[
          { label:"Est. Monthly Spend", value:`$${grand_total.toFixed(2)}`, sub:"running instances only",  accent:"#4285F4" },
          { label:"Zones Active",       value:zones.length,                 sub:"with compute instances",  accent:"#34A853" },
          { label:"Total Instances",    value:total_vms,                    sub:"across all zones",        accent:"#FBBC05" },
          { label:"Running Now",        value:running_vms,                  sub:"currently incurring cost",accent:"#EA4335" },
        ].map(c => (
          <div key={c.label} style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:"18px 20px" }}>
            <div style={{ fontSize:11, color:muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>{c.label}</div>
            <div style={{ fontSize:26, fontWeight:700, color:c.accent }}>{c.value}</div>
            <div style={{ fontSize:11, color:muted, marginTop:4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Bar chart ── */}
      <div style={{ margin:"20px 28px 0", background:card, border:`1px solid ${border}`, borderRadius:14, padding:20 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:16 }}>Monthly Spend by Zone</div>
        {zones.length === 0 ? (
          <div style={{ textAlign:"center", color:muted, padding:24, fontSize:13 }}>No instances found.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {zones.map(z => {
              const pct = maxMonthly > 0 ? (z.total_monthly / maxMonthly) * 100 : 0
              const col = barColor(z.total_monthly)
              return (
                <div key={z.zone} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:160, fontSize:12, color:muted, textAlign:"right", flexShrink:0,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={z.zone}>
                    {z.zone}
                  </div>
                  <div style={{ flex:1, height:22, background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)",
                    borderRadius:6, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${Math.max(pct,0.5)}%`,
                      background:`linear-gradient(90deg,${col}cc,${col})`,
                      borderRadius:6, transition:"width 0.6s ease" }} />
                  </div>
                  <div style={{ width:80, fontSize:12, fontWeight:600, color:col, textAlign:"right", flexShrink:0 }}>
                    ${z.total_monthly.toFixed(2)}
                  </div>
                  <div style={{ width:60, fontSize:11, color:muted, textAlign:"right", flexShrink:0 }}>
                    {grand_total > 0 ? ((z.total_monthly / grand_total) * 100).toFixed(1) : "0.0"}%
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Zone table ── */}
      <div style={{ margin:"20px 28px 28px", background:card, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:13, fontWeight:600 }}>Zone Breakdown</div>
          <div style={{ fontSize:11, color:muted }}>Click a zone to see individual instances</div>
        </div>

        {zones.length === 0 ? (
          <div style={{ textAlign:"center", color:muted, padding:40, fontSize:13 }}>No instances found in this project.</div>
        ) : (
          <div>
            {/* header row */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
              padding:"8px 20px", fontSize:11, color:muted, textTransform:"uppercase",
              letterSpacing:"0.06em", borderBottom:`1px solid ${border}` }}>
              <span>Zone</span>
              <span style={{ textAlign:"right" }}>VMs</span>
              <span style={{ textAlign:"right" }}>Running</span>
              <span style={{ textAlign:"right" }}>Est. Monthly</span>
              <span style={{ textAlign:"right" }}>% of Total</span>
            </div>

            {zones.map(z => (
              <div key={z.zone}>
                {/* zone row */}
                <div
                  onClick={() => setExpanded(p => ({ ...p, [z.zone]: !p[z.zone] }))}
                  style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
                    padding:"12px 20px", cursor:"pointer", transition:"background 0.15s",
                    borderBottom:`1px solid ${border}`,
                    background: expanded[z.zone]
                      ? (dark?"rgba(66,133,244,0.08)":"rgba(66,133,244,0.04)")
                      : "transparent",
                  }}
                  onMouseEnter={e => { if (!expanded[z.zone]) e.currentTarget.style.background = dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)" }}
                  onMouseLeave={e => { if (!expanded[z.zone]) e.currentTarget.style.background = "transparent" }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke={muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transition:"transform 0.2s", transform: expanded[z.zone]?"rotate(90deg)":"rotate(0deg)", flexShrink:0 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                    <span style={{ fontSize:13, fontWeight:500 }}>{z.zone}</span>
                  </div>
                  <div style={{ textAlign:"right", fontSize:13 }}>{z.total_count}</div>
                  <div style={{ textAlign:"right", fontSize:13, color:"#22c55e" }}>{z.running_count}</div>
                  <div style={{ textAlign:"right", fontSize:13, fontWeight:600,
                    color: barColor(z.total_monthly) }}>${z.total_monthly.toFixed(2)}</div>
                  <div style={{ textAlign:"right", fontSize:12, color:muted }}>
                    {grand_total > 0 ? ((z.total_monthly / grand_total) * 100).toFixed(1) : "0.0"}%
                  </div>
                </div>

                {/* expanded VM rows */}
                {expanded[z.zone] && z.vms.map(vm => (
                  <div key={vm.name}
                    style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
                      padding:"9px 20px 9px 44px", borderBottom:`1px solid ${border}`,
                      background: dark?"rgba(66,133,244,0.04)":"rgba(66,133,244,0.02)",
                      fontSize:12 }}>
                    <div style={{ color:txt, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {vm.name}
                      <span style={{ marginLeft:8, fontSize:10, color:muted }}>{vm.machine_type}</span>
                    </div>
                    <div />
                    <div style={{ textAlign:"right" }}>
                      <span style={{ display:"inline-block", padding:"2px 7px", borderRadius:20, fontSize:10,
                        fontWeight:600,
                        background: vm.status === "RUNNING"
                          ? "rgba(34,197,94,0.15)" : "rgba(100,116,139,0.15)",
                        color: vm.status === "RUNNING" ? "#22c55e" : muted }}>
                        {vm.status}
                      </span>
                    </div>
                    <div style={{ textAlign:"right", color: vm.monthly_cost > 0 ? txt : muted }}>
                      {vm.monthly_cost > 0 ? `$${vm.monthly_cost.toFixed(2)}` : "$0.00"}
                    </div>
                    <div />
                  </div>
                ))}
              </div>
            ))}

            {/* total row */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
              padding:"12px 20px", borderTop:`2px solid ${border}`,
              background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize:13, fontWeight:700 }}>Total</div>
              <div style={{ textAlign:"right", fontSize:13, fontWeight:700 }}>{total_vms}</div>
              <div style={{ textAlign:"right", fontSize:13, fontWeight:700, color:"#22c55e" }}>{running_vms}</div>
              <div style={{ textAlign:"right", fontSize:14, fontWeight:700, color:"#4285F4" }}>${grand_total.toFixed(2)}</div>
              <div style={{ textAlign:"right", fontSize:12, color:muted }}>100%</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Optimization tips ── */}
      <div style={{ margin:"0 28px 28px", background:card, border:`1px solid ${border}`, borderRadius:14, padding:20 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Cost Optimization Tips</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { icon:"🕐", title:"Use Committed Use Discounts", desc:"1- or 3-year commitments on stable workloads save 37–55% vs on-demand." },
            { icon:"⚡", title:"Use Spot / Preemptible VMs", desc:"For fault-tolerant batch jobs, Spot VMs cost up to 90% less. Enable via launch wizard." },
            { icon:"📦", title:"Right-size Underutilised Instances", desc:"Check GCP Recommender for machine type recommendations. e2 shapes often cost less than n1." },
          ].map(t => (
            <div key={t.title} style={{ display:"flex", gap:12, padding:"12px 14px", borderRadius:10,
              background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)",
              border:`1px solid ${border}` }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:3 }}>{t.title}</div>
                <div style={{ fontSize:11, color:muted, lineHeight:1.5 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
