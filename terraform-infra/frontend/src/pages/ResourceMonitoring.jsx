import { useState, useEffect, useCallback } from "react"
import { useTheme } from "../context/ThemeContext"
import {
  getUtilization, refreshUtilization,
  getBudgetAlerts,
  getCostOverview, getGCPCost,
} from "../api/api"

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  idle:          { bg: "#ef444418", color: "#ef4444", dot: "#ef4444", label: "Idle" },
  underutilized: { bg: "#f59e0b18", color: "#f59e0b", dot: "#f59e0b", label: "Underutilized" },
  active:        { bg: "#00d4aa18", color: "#00d4aa", dot: "#00d4aa", label: "Active" },
  stopped:       { bg: "#64748b18", color: "#64748b", dot: "#64748b", label: "Stopped" },
  unknown:       { bg: "#3b82f618", color: "#3b82f6", dot: "#3b82f6", label: "Unknown" },
}
const CLOUD_COLOR  = { aws: "#FF9900", gcp: "#4285F4", azure: "#0078D4" }
const CLOUD_LABEL  = { aws: "AWS EC2", gcp: "GCP Compute", azure: "Azure VM" }

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.unknown
  return (
    <span style={{ background: s.bg, color: s.color, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  )
}

function CloudTag({ cloud }) {
  const c = CLOUD_COLOR[cloud] || "#64748b"
  return (
    <span style={{ background: c + "18", color: c, border: "1px solid " + c + "40", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
      {cloud}
    </span>
  )
}

function CpuBar({ value, status }) {
  if (value === null || value === undefined) return <span style={{ fontSize: 11, color: "#64748b" }}>N/A</span>
  const color = status === "active" ? "#00d4aa" : status === "underutilized" ? "#f59e0b" : status === "idle" ? "#ef4444" : "#64748b"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 4, height: 6, overflow: "hidden", minWidth: 60 }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 38, textAlign: "right" }}>{value.toFixed(1)}%</span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ResourceMonitoring() {
  const { dark } = useTheme()
  const [tab,         setTab]         = useState("utilization")  // utilization | alerts
  const [vms,         setVms]         = useState([])
  const [alertLogs,   setAlertLogs]   = useState([])
  const [cloudFilter, setCloudFilter] = useState("all")
  const [statusFilter,setStatusFilter]= useState("all")
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [costData,    setCostData]    = useState({ aws: 0, gcp: 0, azure: 0 })

  const surface = dark ? "#0f172a"  : "#ffffff"
  const bg      = dark ? "#070c18"  : "#f0f4f8"
  const border  = dark ? "#1e293b"  : "#e2e8f0"
  const text    = dark ? "#f1f5f9"  : "#0f172a"
  const muted   = dark ? "#475569"  : "#64748b"
  const subtle  = dark ? "#1e293b"  : "#f8fafc"

  const userRole = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").role || "viewer" } catch { return "viewer" } })()
  const canEdit  = userRole !== "viewer"

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [utilRes, alertRes] = await Promise.allSettled([
        getUtilization(), getBudgetAlerts(),
      ])
      if (utilRes.status  === "fulfilled") setVms(utilRes.value.data)
      if (alertRes.status === "fulfilled") setAlertLogs(alertRes.value.data)

      const [awsCost, gcpCost] = await Promise.allSettled([getCostOverview(), getGCPCost()])
      const aws  = awsCost.status === "fulfilled"  ? (awsCost.value.data?.total_this_month  || 0) : 0
      const gcp  = gcpCost.status === "fulfilled"  ? (gcpCost.value.data?.total_cost        || 0) : 0
      setCostData({ aws: parseFloat(aws) || 0, gcp: parseFloat(gcp) || 0, azure: 0 })
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRefresh() {
    setRefreshing(true)
    try { await refreshUtilization() } catch(e) {}
    setTimeout(() => { setRefreshing(false); load() }, 3000)
  }

  // ── Derived stats ────────────────────────────────────────────────────────
  const filteredVMs = vms.filter(v =>
    (cloudFilter  === "all" || v.cloud  === cloudFilter) &&
    (statusFilter === "all" || v.status === statusFilter)
  )

  const counts = {
    idle:          vms.filter(v => v.status === "idle").length,
    underutilized: vms.filter(v => v.status === "underutilized").length,
    active:        vms.filter(v => v.status === "active").length,
    stopped:       vms.filter(v => v.status === "stopped").length,
  }

  const cloudCounts = { aws: 0, gcp: 0, azure: 0 }
  vms.forEach(v => { if (cloudCounts[v.cloud] !== undefined) cloudCounts[v.cloud]++ })

  const tabBtn = (id) => ({
    padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: tab === id ? 600 : 400,
    cursor: "pointer", border: "none", transition: "all 0.15s",
    background: tab === id ? "#00d4aa20" : "transparent",
    color:      tab === id ? "#00d4aa"   : muted,
  })

  const totalCost = costData.aws + costData.gcp + costData.azure

  return (
    <div style={{ padding: 28, background: bg, minHeight: "100vh" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, animation: "fadeUp 0.4s ease both" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: text, margin: 0, letterSpacing: "-0.5px" }}>Resource Monitoring</h1>
          <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>VM utilization, cost budgets &amp; automated alerts across all clouds</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canEdit && (
            <button onClick={handleRefresh} disabled={refreshing}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, fontSize: 13, cursor: "pointer", border: "1px solid " + border, background: subtle, color: muted }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}>
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              {refreshing ? "Scanning..." : "Refresh"}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 24, animation: "fadeUp 0.4s ease 0.05s both" }}>
        {[
          { label: "Idle VMs",          value: counts.idle,          color: "#ef4444", status: "idle" },
          { label: "Underutilized",      value: counts.underutilized,  color: "#f59e0b", status: "underutilized" },
          { label: "Active VMs",         value: counts.active,         color: "#00d4aa", status: "active" },
          { label: "Stopped",            value: counts.stopped,        color: "#64748b", status: "stopped" },
          { label: "Total Spend (MTD)",  value: `$${totalCost.toFixed(2)}`, color: "#a78bfa", status: null },
        ].map(card => (
          <div key={card.label}
            onClick={() => card.status && setStatusFilter(p => p === card.status ? "all" : card.status)}
            style={{ background: surface, border: "1px solid " + (statusFilter === card.status ? card.color + "60" : border),
              borderRadius: 12, padding: "16px 18px", cursor: card.status ? "pointer" : "default",
              transition: "all 0.15s", boxShadow: statusFilter === card.status ? `0 0 0 2px ${card.color}30` : "none" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.color }}>{card.value}</div>
            {card.status === "idle" && counts.idle > 0 && (
              <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>Action recommended</div>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background: surface, border: "1px solid " + border, borderRadius: 14, overflow: "hidden", animation: "fadeUp 0.4s ease 0.1s both" }}>
        <div style={{ padding: "0 20px", borderBottom: "1px solid " + border, display: "flex", gap: 4 }}>
          <button style={tabBtn("utilization")} onClick={() => setTab("utilization")}>VM Utilization</button>
          <button style={tabBtn("alerts")}      onClick={() => setTab("alerts")}>Alert History</button>
        </div>

        {/* ── VM Utilization tab ── */}
        {tab === "utilization" && (
          <div>
            {/* Filter bar */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid " + border, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {["all","aws","gcp","azure"].map(c => (
                  <button key={c} onClick={() => setCloudFilter(c)}
                    style={{ padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer",
                      border: "1px solid " + (cloudFilter === c ? (CLOUD_COLOR[c] || "#00d4aa") + "60" : border),
                      background: cloudFilter === c ? (CLOUD_COLOR[c] || "#00d4aa") + "15" : "transparent",
                      color: cloudFilter === c ? (CLOUD_COLOR[c] || "#00d4aa") : muted }}>
                    {c === "all" ? `All (${vms.length})` : `${c.toUpperCase()} (${cloudCounts[c]})`}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                {["all","idle","underutilized","active","stopped"].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    style={{ padding: "4px 12px", borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: "pointer",
                      border: "1px solid " + (statusFilter === s ? (STATUS_STYLE[s]?.color || "#00d4aa") + "50" : border),
                      background: statusFilter === s ? (STATUS_STYLE[s]?.bg || "#00d4aa15") : "transparent",
                      color: statusFilter === s ? (STATUS_STYLE[s]?.color || "#00d4aa") : muted }}>
                    {s === "all" ? "All" : STATUS_STYLE[s]?.label || s}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 48, textAlign: "center", color: muted }}>Loading utilization data...</div>
            ) : filteredVMs.length === 0 ? (
              <div style={{ padding: 64, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: text, marginBottom: 6 }}>No data yet</div>
                <div style={{ fontSize: 13, color: muted, marginBottom: 16 }}>Click Refresh to scan VM utilization across all clouds</div>
                {canEdit && (
                  <button onClick={handleRefresh} style={{ padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "#00d4aa", color: "#0a0f1e" }}>
                    Scan Now
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid " + border, background: subtle }}>
                      {["Cloud","VM Name","Region","Type","State","Avg CPU (24h)","Status","Owner"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVMs.map(vm => (
                      <tr key={vm.vm_id} style={{ borderBottom: "1px solid " + border, transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = dark ? "#ffffff05" : "#f8fafc"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "12px 16px" }}><CloudTag cloud={vm.cloud} /></td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: text }}>{vm.vm_name}</div>
                          <div style={{ fontSize: 10, color: muted, fontFamily: "monospace", marginTop: 2 }}>{vm.vm_id?.slice(0, 22)}</div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: muted }}>{vm.region}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: muted }}>{vm.instance_type || "—"}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: vm.state === "running" ? "#00d4aa" : muted }}>{vm.state}</span>
                        </td>
                        <td style={{ padding: "12px 16px", minWidth: 130 }}>
                          <CpuBar value={vm.avg_cpu_24h} status={vm.status} />
                        </td>
                        <td style={{ padding: "12px 16px" }}><StatusBadge status={vm.status} /></td>
                        <td style={{ padding: "12px 16px", fontSize: 11, color: muted, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {vm.owner_email || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legend */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid " + border, display: "flex", gap: 20, flexWrap: "wrap" }}>
              {Object.entries(STATUS_STYLE).map(([k, s]) => (
                <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot }} />
                  <strong style={{ color: s.color }}>{s.label}</strong>
                  {k === "idle"          && " — CPU < 5%"}
                  {k === "underutilized" && " — CPU 5–15%"}
                  {k === "active"        && " — CPU ≥ 15%"}
                </span>
              ))}
              <span style={{ fontSize: 11, color: muted, marginLeft: "auto" }}>Scans every 30 min · Email alerts sent to VM owner + admins</span>
            </div>
          </div>
        )}

        {/* ── Alert History tab ── */}
        {tab === "alerts" && (
          <div>
            {loading ? (
              <div style={{ padding: 48, textAlign: "center", color: muted }}>Loading alerts...</div>
            ) : alertLogs.length === 0 ? (
              <div style={{ padding: 64, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: text, marginBottom: 6 }}>No alerts yet</div>
                <div style={{ fontSize: 13, color: muted }}>Budget threshold alerts will appear here once triggered</div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid " + border, background: subtle }}>
                    {["Budget","Cloud","Threshold","Spend","Limit","Action","Time"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertLogs.map(a => {
                    const tColor = a.threshold >= 100 ? "#ef4444" : a.threshold >= 90 ? "#f97316" : a.threshold >= 70 ? "#f59e0b" : "#3b82f6"
                    return (
                      <tr key={a.id} style={{ borderBottom: "1px solid " + border, transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = dark ? "#ffffff05" : "#f8fafc"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: text }}>{a.budget_name}</td>
                        <td style={{ padding: "12px 16px" }}><CloudTag cloud={a.cloud === "all" ? "aws" : a.cloud} /></td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: tColor }}>{a.threshold}%</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: tColor, fontWeight: 600 }}>${(a.current_spend||0).toFixed(2)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: muted }}>${(a.monthly_limit||0).toFixed(2)}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
                            background: a.action_taken === "stopped" ? "#ef444415" : "#00d4aa15",
                            color: a.action_taken === "stopped" ? "#ef4444" : "#00d4aa" }}>
                            {a.action_taken || "notified"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 11, color: muted }}>
                          {a.sent_at ? new Date(a.sent_at).toLocaleString("en-IN") : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
