import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts"
import { useTheme } from "../context/ThemeContext"
import {
  getGCPBillingOverview, getGCPBillingMonthly, getGCPBillingDaily,
  getGCPBillingByService, getGCPBillingTopResources,
} from "../api/api"

const GCP_COLORS = ["#4285F4", "#34A853", "#FBBC04", "#EA4335", "#5F6368", "#AB47BC"]

function Skeleton({ w = "100%", h = 16, r = 8, dark }) {
  const b = dark ? "#1e293b" : "#e2e8f0", s = dark ? "#263347" : "#f1f5f9"
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: `linear-gradient(90deg,${b} 25%,${s} 50%,${b} 75%)`, backgroundSize: "700px 100%", animation: "shimmer 1.4s infinite linear" }} />
  )
}

function StatCard({ label, value, sub, color, dark }) {
  const bg = dark ? "rgba(255,255,255,0.035)" : "#fff"
  const bd = dark ? "rgba(255,255,255,0.06)"  : "rgba(0,0,0,0.07)"
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 14, padding: "18px 22px", borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: dark ? "#64748b" : "#94a3b8", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: dark ? "#64748b" : "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, dark }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#e2e8f0" : "#1e293b", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 3, height: 16, background: "#4285F4", borderRadius: 2 }} />
      {children}
    </div>
  )
}

function Card({ children, dark, style = {} }) {
  const bg = dark ? "rgba(255,255,255,0.025)" : "#fff"
  const bd = dark ? "rgba(255,255,255,0.06)"  : "rgba(0,0,0,0.07)"
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 14, padding: "20px 22px", ...style }}>
      {children}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label, dark }) => {
  if (!active || !payload?.length) return null
  const bg = dark ? "#0f172a" : "#fff"
  const bd = dark ? "#1e293b" : "#e2e8f0"
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
      <div style={{ fontSize: 11, color: dark ? "#64748b" : "#94a3b8", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 13, fontWeight: 700, color: p.color, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          {p.name}: ${Number(p.value).toFixed(2)}
        </div>
      ))}
    </div>
  )
}

export default function GCPBilling() {
  const navigate = useNavigate()
  const { dark } = useTheme()

  const bg    = dark ? "#070c18" : "#f0f4f8"
  const text  = dark ? "#e2e8f0" : "#1e293b"
  const muted = dark ? "#64748b" : "#94a3b8"

  const [selProject, setSelProject] = useState(() => {
    const stored = localStorage.getItem("gcp_selected_project")
    return stored ? JSON.parse(stored) : null
  })

  const [overview,    setOverview]    = useState(null)
  const [monthly,     setMonthly]     = useState(null)
  const [daily,       setDaily]       = useState(null)
  const [byService,   setByService]   = useState(null)
  const [topResources,setTopResources]= useState(null)
  const [loading,     setLoading]     = useState(true)

  const pid = selProject?.id || null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ovRes, moRes, dayRes, svcRes, topRes] = await Promise.allSettled([
        getGCPBillingOverview(pid),
        getGCPBillingMonthly(pid, 3),
        getGCPBillingDaily(pid, 30),
        getGCPBillingByService(pid),
        getGCPBillingTopResources(pid),
      ])
      if (ovRes.status  === "fulfilled") setOverview(ovRes.value.data)
      if (moRes.status  === "fulfilled") setMonthly(moRes.value.data)
      if (dayRes.status === "fulfilled") setDaily(dayRes.value.data)
      if (svcRes.status === "fulfilled") setByService(svcRes.value.data)
      if (topRes.status === "fulfilled") setTopResources(topRes.value.data)
    } catch (_) {}
    setLoading(false)
  }, [pid])

  useEffect(() => { load() }, [load])

  // ── Derived data ────────────────────────────────────────────────────────
  const totalCost    = overview?.total || 0
  const computeCost  = (overview?.projects || []).reduce((s, p) => s + p.compute_cost, 0)
  const storageCost  = (overview?.projects || []).reduce((s, p) => s + p.storage_cost, 0)
  const networkCost  = (overview?.projects || []).reduce((s, p) => s + p.network_cost, 0)

  // Monthly chart: bar chart by month, one bar per project
  const monthChartData = (monthly?.months || []).map(m => {
    const row = { month: m.month.split(" ")[0] }  // "Apr 2025" → "Apr"
    const projs = m.by_project || {}
    let total = 0
    Object.entries(projs).forEach(([projId, cost]) => {
      row[projId] = cost
      total += cost
    })
    row._total = round2(total)
    return row
  })

  const projectIds = monthly?.project_ids || []

  // Daily chart
  const dailyChartData = (daily?.days || []).map(d => ({
    date:   d.label,
    total:  d.total,
  }))

  // Service pie
  const servicePieData = (byService?.services || []).map(s => ({
    name:  s.name,
    value: s.cost,
    color: s.color,
    pct:   s.pct,
  })).filter(s => s.value > 0)

  // Top resources table
  const topList = topResources?.resources || []

  function round2(v) { return Math.round((v || 0) * 100) / 100 }

  function fmtCost(v) { return `$${round2(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

  const axisStyle = { fill: muted, fontSize: 11 }

  return (
    <div style={{ minHeight: "100vh", background: bg, padding: "32px 40px", color: text }}>
      <style>{`@keyframes shimmer{0%{background-position:-700px 0}100%{background-position:700px 0}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>GCP Billing Dashboard</div>
          </div>
          <div style={{ fontSize: 13, color: muted }}>
            {selProject ? `Project: ${selProject.name}` : "All accessible GCP projects"} · Estimated compute costs
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {selProject && (
            <button
              onClick={() => { setSelProject(null); localStorage.removeItem("gcp_selected_project") }}
              style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600, background: "transparent", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: muted, cursor: "pointer" }}
            >
              All Projects
            </button>
          )}
          <button
            onClick={() => navigate("/gcp/projects")}
            style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600, background: "rgba(66,133,244,0.1)", border: "1px solid rgba(66,133,244,0.3)", color: "#4285F4", cursor: "pointer" }}
          >
            Switch Project
          </button>
          <button onClick={load} style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600, background: "rgba(52,168,83,0.1)", border: "1px solid rgba(52,168,83,0.3)", color: "#34A853", cursor: "pointer" }}>Refresh</button>
        </div>
      </div>

      {/* Note about estimates */}
      <div style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(66,133,244,0.06)", border: "1px solid rgba(66,133,244,0.15)", fontSize: 12, color: dark ? "#93c5fd" : "#3b82f6", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Costs are estimated from running Compute instances (on-demand pricing). Daily snapshots build up historical trend data over time.
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total MTD Cost"    value={loading ? "—" : fmtCost(totalCost)}   color="#4285F4" dark={dark} sub="All services" />
        <StatCard label="Compute"           value={loading ? "—" : fmtCost(computeCost)} color="#34A853" dark={dark} sub="Running VMs" />
        <StatCard label="Storage"           value={loading ? "—" : fmtCost(storageCost)} color="#FBBC04" dark={dark} sub="Cloud Storage" />
        <StatCard label="Network (est.)"    value={loading ? "—" : fmtCost(networkCost)} color="#EA4335" dark={dark} sub="5% of compute" />
      </div>

      {/* Charts row 1: Monthly trend + Service breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 24 }}>

        {/* Monthly bar chart */}
        <Card dark={dark}>
          <SectionTitle dark={dark}>3-Month Cost Trend by Project</SectionTitle>
          {loading ? <Skeleton h={200} dark={dark} /> : (
            monthChartData.length === 0 ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 13 }}>
                No snapshot data yet — data builds as you use the billing page.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                  <XAxis dataKey="month" tick={axisStyle} />
                  <YAxis tick={axisStyle} tickFormatter={v => `$${v}`} />
                  <Tooltip content={<CustomTooltip dark={dark} />} />
                  <Legend />
                  {projectIds.map((pid, i) => (
                    <Bar key={pid} dataKey={pid} name={pid.split("-").slice(0, 2).join("-")}
                      fill={GCP_COLORS[i % GCP_COLORS.length]} radius={[4, 4, 0, 0]} stackId="a" />
                  ))}
                  {projectIds.length === 0 && (
                    <Bar dataKey="_total" name="Total" fill="#4285F4" radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )
          )}
        </Card>

        {/* Service breakdown pie */}
        <Card dark={dark}>
          <SectionTitle dark={dark}>Cost by Service</SectionTitle>
          {loading ? <Skeleton h={200} dark={dark} /> : (
            servicePieData.length === 0 ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 13 }}>No cost data</div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={servicePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                      {servicePieData.map((entry, i) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `$${v.toFixed(2)}`} contentStyle={{ background: dark ? "#0f172a" : "#fff", border: `1px solid ${dark ? "#1e293b" : "#e2e8f0"}`, borderRadius: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {servicePieData.map(s => (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                        <span style={{ color: dark ? "#cbd5e1" : "#475569" }}>{s.name}</span>
                      </div>
                      <div style={{ fontWeight: 700, color: s.color }}>${s.value.toFixed(2)} ({s.pct}%)</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </Card>
      </div>

      {/* Daily cost line chart */}
      <Card dark={dark} style={{ marginBottom: 24 }}>
        <SectionTitle dark={dark}>Daily Cost — Last 30 Days</SectionTitle>
        {loading ? <Skeleton h={180} dark={dark} /> : (
          dailyChartData.length === 0 ? (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 13 }}>No daily data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={dailyChartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} />
                <XAxis dataKey="date" tick={axisStyle} interval={4} />
                <YAxis tick={axisStyle} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip dark={dark} />} />
                <Line type="monotone" dataKey="total" name="Cost" stroke="#4285F4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )
        )}
      </Card>

      {/* Project cost breakdown table */}
      {(overview?.projects || []).length > 0 && (
        <Card dark={dark} style={{ marginBottom: 24 }}>
          <SectionTitle dark={dark}>Project Cost Breakdown (Current Month)</SectionTitle>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}` }}>
                  {["Project", "Instances", "Running", "Compute", "Storage", "Network", "Total"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Project" ? "left" : "right", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(overview?.projects || []).map((p, i) => (
                  <tr key={p.project_id} style={{ borderBottom: i < overview.projects.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` : "none" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        onClick={() => { setSelProject({ id: p.project_id, name: p.project_id }); localStorage.setItem("gcp_selected_project", JSON.stringify({ id: p.project_id, name: p.project_id })) }}
                        style={{ background: "none", border: "none", color: "#4285F4", cursor: "pointer", fontFamily: "monospace", fontSize: 12, fontWeight: 600, padding: 0 }}
                      >
                        {p.project_id}
                      </button>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: text }}>{p.instance_count}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#34A853", fontWeight: 600 }}>{p.running_count}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: text }}>{fmtCost(p.compute_cost)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: text }}>{fmtCost(p.storage_cost)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: text }}>{fmtCost(p.network_cost)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: p.total_cost > 500 ? "#f43f5e" : p.total_cost > 100 ? "#f59e0b" : "#34A853" }}>{fmtCost(p.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: text }}>Total</td>
                  <td colSpan={5} />
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#4285F4", fontSize: 16 }}>{fmtCost(totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Top resources */}
      <Card dark={dark}>
        <SectionTitle dark={dark}>Top Resources by Cost (Running Instances)</SectionTitle>
        {loading ? <Skeleton h={160} dark={dark} /> : topList.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: muted, fontSize: 13 }}>No running instances found</div>
        ) : (
          <div>
            {topList.map((res, i) => {
              const pct = totalCost > 0 ? (res.monthly_cost / totalCost * 100) : 0
              return (
                <div key={`${res.project_id}-${res.name}`} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "10px 0",
                  borderBottom: i < topList.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` : "none",
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: `${GCP_COLORS[i % GCP_COLORS.length]}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: GCP_COLORS[i % GCP_COLORS.length] }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{res.name}</span>
                      <span style={{ fontSize: 10, background: res.status === "RUNNING" ? "rgba(52,168,83,0.15)" : "rgba(245,158,11,0.15)", color: res.status === "RUNNING" ? "#34A853" : "#f59e0b", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>{res.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>{res.project_id} · {res.zone} · {res.machine_type}</div>
                    <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: GCP_COLORS[i % GCP_COLORS.length], width: `${Math.min(pct * 3, 100)}%`, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: GCP_COLORS[i % GCP_COLORS.length] }}>{fmtCost(res.monthly_cost)}<span style={{ fontSize: 10, fontWeight: 400, color: muted }}>/mo</span></div>
                    <div style={{ fontSize: 10, color: muted }}>${(res.hourly_rate || 0).toFixed(4)}/hr</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
