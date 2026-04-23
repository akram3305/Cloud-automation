import { useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import { getAzureCostByRG } from "../api/api"

export default function AzureCostByRG() {
  const { dark } = useTheme()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#64748b" : "#64748b"
  const panel   = dark ? "rgba(255,255,255,0.03)" : "#f8fafc"

  const [sub,        setSub]       = useState("nonprod")
  const [data,       setData]      = useState(null)
  const [loading,    setLoading]   = useState(false)
  const [error,      setError]     = useState("")
  const [expandedRG, setExpandedRG]= useState(null)

  const fetch = (s = sub) => {
    setLoading(true); setError("")
    getAzureCostByRG(s)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || "Failed to load cost data"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [sub])

  const rgs      = data?.resource_groups || []
  const total    = data?.total_monthly_usd || 0
  const maxCost  = Math.max(...rgs.map(r => r.monthly_cost_usd), 1)

  // ── Helpers ────────────────────────────────────────────────────────────────
  const pct = (cost) => Math.round((cost / maxCost) * 100)

  function costColor(cost) {
    if (cost === 0) return "#64748b"
    if (cost < 100) return "#10b981"
    if (cost < 500) return "#f59e0b"
    return "#ef4444"
  }

  const thS = { padding:"9px 14px", fontSize:11, fontWeight:600, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", textAlign:"left", borderBottom:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }
  const tdS = { padding:"11px 14px", fontSize:13, color:text, borderBottom:`1px solid ${border}` }

  return (
    <div style={{ background:bg, minHeight:"100vh" }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      {/* ── Header ── */}
      <div style={{ background:surface, borderBottom:`1px solid ${border}`, padding:"16px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:"linear-gradient(135deg,#10b981,#0078D4)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 12px rgba(16,185,129,0.35)" }}>
            <span style={{ fontSize:18 }}>💰</span>
          </div>
          <div>
            <h1 style={{ fontSize:18, fontWeight:700, color:text, margin:0 }}>Cost by Resource Group</h1>
            <p style={{ fontSize:12, color:muted, margin:"2px 0 0" }}>Estimated monthly spend · Pay-As-You-Go · Running VMs only</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {/* Subscription toggle */}
          <div style={{ display:"flex", background:panel, border:`1px solid ${border}`, borderRadius:8, padding:3, gap:3 }}>
            {[
              { id:"nonprod", label:"Non-Production", color:"#10b981" },
              { id:"prod",    label:"Production",     color:"#f59e0b" },
            ].map(s => (
              <button key={s.id} onClick={() => setSub(s.id)} style={{
                padding:"5px 14px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer", border:"none",
                background: sub === s.id ? s.color : "transparent",
                color:      sub === s.id ? "#fff" : muted,
                transition:"all 0.15s",
              }}>{s.label}</button>
            ))}
          </div>
          <button onClick={() => fetch()} style={{ background:panel, border:`1px solid ${border}`, borderRadius:8, color:text, padding:"8px 14px", fontSize:13, cursor:"pointer" }}>↻ Refresh</button>
        </div>
      </div>

      {error && (
        <div style={{ margin:"16px 28px 0", padding:"10px 14px", borderRadius:8, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", color:"#fca5a5", fontSize:13 }}>{error}</div>
      )}

      <div style={{ padding:"24px 28px" }}>

        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:80, gap:12, color:muted }}>
            <div style={{ width:36, height:36, borderRadius:"50%", border:"3px solid rgba(16,185,129,0.2)", borderTopColor:"#10b981", animation:"spin 0.8s linear infinite" }} />
            <div style={{ fontSize:13 }}>Scanning VMs across resource groups…</div>
            <div style={{ fontSize:11 }}>This may take a moment as we check power state for each VM.</div>
          </div>
        ) : !data ? null : (
          <>
            {/* ── Summary cards ── */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28, animation:"fadeUp 0.3s ease both" }}>
              {[
                { label:"Total Est. Monthly", value:`$${total.toLocaleString()}`, color:"#0078D4", sub:`${sub === "prod" ? "Production" : "Non-Production"} subscription` },
                { label:"Resource Groups",    value:rgs.length,                   color:"#a78bfa", sub:"with VMs" },
                { label:"Total VMs",          value:rgs.reduce((a,r)=>a+r.vm_count,0),   color:"#50e6ff", sub:"across all RGs" },
                { label:"Running VMs",        value:rgs.reduce((a,r)=>a+r.running,0),    color:"#10b981", sub:"currently billed" },
              ].map(m => (
                <div key={m.label} style={{ background:surface, border:`1px solid ${border}`, borderRadius:12, padding:"16px 20px", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${m.color}60,${m.color})` }} />
                  <div style={{ fontSize:11, fontWeight:600, color:muted, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>{m.label}</div>
                  <div style={{ fontSize:26, fontWeight:800, color:m.color, lineHeight:1, marginBottom:3 }}>{m.value}</div>
                  <div style={{ fontSize:11, color:muted }}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Cost info banner ── */}
            <div style={{ padding:"10px 16px", borderRadius:10, background:"rgba(0,120,212,0.06)", border:"1px solid rgba(0,120,212,0.2)", fontSize:12, color:muted, marginBottom:20, display:"flex", gap:10, alignItems:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              <span>
                Costs are <strong style={{ color:text }}>estimates</strong> based on Pay-As-You-Go hourly rates × 730 hrs/month.
                Only <strong style={{ color:text }}>running</strong> VMs accrue compute cost — deallocated VMs show $0 (disk storage still billed separately).
                Use <strong style={{ color:"#0078D4" }}>Schedule</strong> on each VM to set auto start/stop and reduce costs by up to 60%.
              </span>
            </div>

            {rgs.length === 0 ? (
              <div style={{ textAlign:"center", padding:60, color:muted }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📭</div>
                <div style={{ fontWeight:700, fontSize:15, marginBottom:6, color:text }}>No VMs found</div>
                <div style={{ fontSize:13 }}>No virtual machines in {sub === "prod" ? "Production" : "Non-Production"} subscription.</div>
              </div>
            ) : (
              <>
                {/* ── Bar chart ── */}
                <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:12, padding:"20px 24px", marginBottom:20, animation:"fadeUp 0.35s ease both" }}>
                  <div style={{ fontSize:14, fontWeight:700, color:text, marginBottom:16 }}>Spend by Resource Group</div>
                  <div style={{ display:"grid", gap:10 }}>
                    {rgs.map((rg, i) => {
                      const col = costColor(rg.monthly_cost_usd)
                      return (
                        <div key={rg.resource_group} style={{ animation:`fadeUp 0.3s ease ${i * 0.04}s both` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ fontSize:13, fontWeight:600, color:text }}>{rg.resource_group}</span>
                              <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${col}18`, color:col, border:`1px solid ${col}30`, fontWeight:600 }}>
                                {rg.vm_count} VM{rg.vm_count !== 1 ? "s" : ""}
                              </span>
                              {rg.running > 0 && (
                                <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:"rgba(16,185,129,0.12)", color:"#10b981", border:"1px solid rgba(16,185,129,0.3)" }}>
                                  {rg.running} running
                                </span>
                              )}
                            </div>
                            <div style={{ textAlign:"right" }}>
                              <span style={{ fontSize:15, fontWeight:700, color:col }}>${rg.monthly_cost_usd.toFixed(2)}</span>
                              <span style={{ fontSize:11, color:muted }}>/mo</span>
                            </div>
                          </div>
                          <div style={{ height:8, borderRadius:4, background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)", overflow:"hidden" }}>
                            <div style={{ height:"100%", borderRadius:4, width:`${pct(rg.monthly_cost_usd)}%`, background:`linear-gradient(90deg,${col}80,${col})`, transition:"width 0.6s ease" }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Detailed table ── */}
                <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:12, overflow:"hidden", animation:"fadeUp 0.4s ease both" }}>
                  <div style={{ padding:"14px 18px", borderBottom:`1px solid ${border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }}>
                    <span style={{ fontSize:14, fontWeight:700, color:text }}>VM-level Breakdown</span>
                    <span style={{ fontSize:11, color:muted }}>Click a resource group to expand</span>
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr>
                        {["Resource Group","VMs","Running","Stopped","Est. Monthly",""].map(h =>
                          <th key={h} style={thS}>{h}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rgs.map((rg, ri) => {
                        const col      = costColor(rg.monthly_cost_usd)
                        const expanded = expandedRG === rg.resource_group
                        const isLast   = ri === rgs.length - 1

                        return [
                          // Resource group row
                          <tr key={rg.resource_group}
                            onClick={() => setExpandedRG(expanded ? null : rg.resource_group)}
                            style={{ cursor:"pointer", transition:"background 0.1s" }}
                            onMouseEnter={e => e.currentTarget.style.background = dark?"rgba(255,255,255,0.025)":"rgba(0,0,0,0.018)"}
                            onMouseLeave={e => e.currentTarget.style.background = expanded?(dark?"rgba(0,120,212,0.07)":"rgba(0,120,212,0.04)"):"transparent"}>

                            <td style={{ ...tdS, fontWeight:700, borderBottom:(expanded||isLast)?`1px solid ${border}`:`1px solid ${border}` }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <span style={{ fontSize:10, color:muted, transition:"transform 0.2s", display:"inline-block", transform:expanded?"rotate(90deg)":"rotate(0deg)" }}>▶</span>
                                {rg.resource_group}
                              </div>
                            </td>
                            <td style={{ ...tdS, color:muted }}>{rg.vm_count}</td>
                            <td style={{ ...tdS }}>
                              {rg.running > 0 && <span style={{ color:"#10b981", fontWeight:600 }}>{rg.running}</span>}
                              {rg.running === 0 && <span style={{ color:muted }}>0</span>}
                            </td>
                            <td style={{ ...tdS }}>
                              {rg.stopped > 0 && <span style={{ color:muted }}>{rg.stopped}</span>}
                              {rg.stopped === 0 && <span style={{ color:muted }}>0</span>}
                            </td>
                            <td style={tdS}>
                              <span style={{ fontSize:15, fontWeight:700, color:col }}>${rg.monthly_cost_usd.toFixed(2)}</span>
                            </td>
                            <td style={{ ...tdS, textAlign:"right", color:muted, fontSize:11 }}>
                              {Math.round((rg.monthly_cost_usd / total) * 100)}% of total
                            </td>
                          </tr>,

                          // Expanded VM rows
                          ...(expanded ? rg.vms.map((vm, vi) => {
                            const vmCol = vm.power_state === "running" ? "#10b981" : muted
                            const isLastVm = vi === rg.vms.length - 1
                            return (
                              <tr key={`${rg.resource_group}-${vm.name}`} style={{ background:dark?"rgba(0,120,212,0.04)":"rgba(0,120,212,0.02)" }}>
                                <td style={{ ...tdS, paddingLeft:36, fontSize:12, color:text, borderBottom:isLastVm&&isLast?"none":`1px solid ${border}` }}>
                                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                    <div style={{ width:6, height:6, borderRadius:"50%", background:vmCol, flexShrink:0 }} />
                                    {vm.name}
                                  </div>
                                </td>
                                <td style={{ ...tdS, fontFamily:"monospace", fontSize:11, color:muted, borderBottom:isLastVm&&isLast?"none":`1px solid ${border}` }} colSpan={2}>
                                  {vm.size || "—"}
                                </td>
                                <td style={{ ...tdS, borderBottom:isLastVm&&isLast?"none":`1px solid ${border}` }}>
                                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:6, background:`${vmCol}18`, color:vmCol, border:`1px solid ${vmCol}30` }}>
                                    {vm.power_state}
                                  </span>
                                </td>
                                <td style={{ ...tdS, borderBottom:isLastVm&&isLast?"none":`1px solid ${border}` }}>
                                  {vm.monthly_usd > 0
                                    ? <span style={{ fontWeight:600, color:"#f59e0b" }}>${vm.monthly_usd.toFixed(2)}/mo</span>
                                    : <span style={{ color:muted, fontSize:11 }}>$0 (deallocated)</span>
                                  }
                                </td>
                                <td style={{ ...tdS, borderBottom:isLastVm&&isLast?"none":`1px solid ${border}` }}>
                                  {vm.power_state === "running" && (
                                    <span style={{ fontSize:10, color:"#f59e0b" }}>💡 Schedule a stop to save</span>
                                  )}
                                </td>
                              </tr>
                            )
                          }) : []),
                        ]
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Optimization tips ── */}
                <div style={{ marginTop:20, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, animation:"fadeUp 0.45s ease both" }}>
                  {[
                    { icon:"⏰", title:"Schedule Start/Stop", desc:"Set auto_start and auto_stop tags on each VM from the VM management page. 12-hr windows save ~50% on compute.", color:"#a78bfa" },
                    { icon:"📦", title:"Right-size VMs", desc:"Review VMs with high memory but low CPU usage — downsize to a smaller SKU or switch to burstable B-series.", color:"#0078D4" },
                    { icon:"🔴", title:"Delete Idle VMs", desc:"Stopped (deallocated) VMs still incur disk storage costs. Delete unused VMs entirely to eliminate all charges.", color:"#ef4444" },
                  ].map(tip => (
                    <div key={tip.title} style={{ background:surface, border:`1px solid ${border}`, borderRadius:12, padding:"18px 20px" }}>
                      <div style={{ fontSize:28, marginBottom:10 }}>{tip.icon}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:tip.color, marginBottom:6 }}>{tip.title}</div>
                      <div style={{ fontSize:12, color:muted, lineHeight:1.6 }}>{tip.desc}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
