import { useState, useEffect, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts"
import { useTheme } from "../context/ThemeContext"
import {
  listGCPOrgProjects, listGCPOrgProjectsQuick,
  getGCPBillingOverview, getGCPBillingMonthly, getGCPBillingDaily,
  getGCPBillingByService, getGCPBillingTopResources,
} from "../api/api"
import GCPProjectSelector from "../components/GCPProjectSelector"

const GCP_GRADIENT = "linear-gradient(135deg,#4285F4,#34A853,#FBBC04,#EA4335)"
const GCP_COLORS   = ["#4285F4","#34A853","#FBBC04","#EA4335","#5F6368","#AB47BC"]

// ── Shared primitives ─────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 16, r = 8, dark }) {
  const b = dark ? "#1e293b" : "#e2e8f0", s = dark ? "#263347" : "#f1f5f9"
  return (
    <div style={{ width: w, height: h, borderRadius: r, flexShrink: 0,
      background: `linear-gradient(90deg,${b} 25%,${s} 50%,${b} 75%)`,
      backgroundSize: "700px 100%", animation: "shimmer 1.4s infinite linear" }} />
  )
}

function StatCard({ label, value, sub, color, dark, onClick }) {
  const bg = dark ? "rgba(255,255,255,0.035)" : "#fff"
  const bd = dark ? "rgba(255,255,255,0.06)"  : "rgba(0,0,0,0.07)"
  return (
    <div
      onClick={onClick}
      style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 14,
        padding: "18px 22px", borderTop: `3px solid ${color}`,
        cursor: onClick ? "pointer" : "default", transition: "transform 0.15s, box-shadow 0.15s" }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${color}20` } }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: dark ? "#64748b" : "#94a3b8", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: dark ? "#64748b" : "#94a3b8", marginTop: 4 }}>{sub}</div>}
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

function SectionTitle({ children, dark }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#e2e8f0" : "#1e293b", marginBottom: 14,
      display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 3, height: 16, background: "#4285F4", borderRadius: 2 }} />
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

// ── Projects tab ─────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  const active = status === "ACTIVE"
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: active ? "#22c55e" : "#f59e0b" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#22c55e" : "#f59e0b", boxShadow: active ? "0 0 6px #22c55e" : "none" }} />
      {active ? "Active" : status}
    </span>
  )
}

function ProjectCard({ proj, dark, onSelect }) {
  const bg     = dark ? "rgba(255,255,255,0.025)" : "#fff"
  const border = dark ? "rgba(255,255,255,0.06)"  : "rgba(0,0,0,0.07)"
  const text   = dark ? "#e2e8f0" : "#1e293b"
  const muted  = dark ? "#64748b" : "#94a3b8"
  const cost   = proj.total_mtd || 0
  return (
    <div
      style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "18px 20px",
        cursor: "pointer", transition: "all 0.18s ease",
        borderLeft: proj.is_default ? "3px solid #4285F4" : "3px solid transparent" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#4285F455"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(66,133,244,0.1)" }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = proj.is_default ? "#4285F4" : border; e.currentTarget.style.boxShadow = "none" }}
      onClick={() => onSelect(proj)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: GCP_GRADIENT,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff",
          boxShadow: "0 2px 10px rgba(66,133,244,0.3)" }}>GCP</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{proj.name}</span>
            {proj.is_default && (
              <span style={{ fontSize: 9, background: "rgba(66,133,244,0.15)", color: "#4285F4",
                border: "1px solid rgba(66,133,244,0.4)", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>DEFAULT</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: muted, marginTop: 2, fontFamily: "monospace" }}>{proj.id}</div>
        </div>
        <StatusDot status={proj.status} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Instances", value: proj.instance_count || 0, color: "#4285F4" },
          { label: "Running",   value: proj.running_count  || 0, color: "#34A853" },
          { label: "Buckets",   value: proj.bucket_count   || 0, color: "#FBBC04" },
          { label: "Networks",  value: proj.network_count  || 0, color: "#EA4335" },
        ].map(m => (
          <div key={m.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 10, color: muted, marginTop: 1 }}>{m.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 12, borderTop: `1px solid ${border}` }}>
        <span style={{ fontSize: 11, color: muted }}>Est. MTD compute cost</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: cost > 500 ? "#f43f5e" : cost > 100 ? "#f59e0b" : "#34A853" }}>
          ${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  )
}

function ProjectsTab({ dark, text, muted, bdr }) {
  const navigate = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [search,  setSearch]  = useState("")

  const SWR_KEY = "gcp_projects_v1"

  const load = useCallback(async (forceRefresh = false) => {
    setError(null)
    const cached = localStorage.getItem(SWR_KEY)

    // SWR: show stale cache immediately (skip spinner)
    if (cached && !forceRefresh) {
      try { setData(JSON.parse(cached)); setLoading(false) } catch { setLoading(true) }
    } else {
      setLoading(true)
      // Phase 1: quick fetch (no enrichment) — shows basic cards fast (~1s)
      try {
        const r = await listGCPOrgProjectsQuick()
        setData(r.data); setLoading(false)
      } catch (e) {
        setError(e?.response?.data?.detail || "Failed to load GCP projects")
        setLoading(false)
        return
      }
    }

    // Phase 2: full enrichment in background (silently updates cards)
    try {
      const r = await listGCPOrgProjects()
      setData(r.data)
      try { localStorage.setItem(SWR_KEY, JSON.stringify(r.data)) } catch {}
    } catch (_) {}
  }, [])
  useEffect(() => { load(false) }, [load])

  function handleSelect(proj) {
    localStorage.setItem("gcp_selected_project", JSON.stringify({ id: proj.id, name: proj.name }))
    navigate("/gcp/compute")
  }

  const projects = data?.projects || []
  const filtered = search
    ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : projects
  const totalCost    = data?.total_cost || 0
  const totalInst    = projects.reduce((s, p) => s + (p.instance_count || 0), 0)
  const totalRunning = projects.reduce((s, p) => s + (p.running_count  || 0), 0)

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Projects"      value={loading ? "—" : projects.length}                    color="#4285F4" dark={dark} />
        <StatCard label="Total Instances"     value={loading ? "—" : totalInst}                          color="#34A853" dark={dark} />
        <StatCard label="Running Now"         value={loading ? "—" : totalRunning}                       color="#FBBC04" dark={dark} />
        <StatCard label="Est. Total MTD Cost" value={loading ? "—" : `$${totalCost.toFixed(2)}`}         color="#EA4335" dark={dark} sub="Compute estimate" />
      </div>

      <div style={{ marginBottom: 20, position: "relative", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
            style={{ width: "100%", boxSizing: "border-box",
              background: dark ? "rgba(255,255,255,0.05)" : "#fff",
              border: `1px solid ${bdr}`, borderRadius: 10, padding: "9px 12px 9px 36px",
              fontSize: 13, color: text, fontFamily: "inherit", outline: "none" }} />
        </div>
        <button onClick={() => load(true)}
          style={{ padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: "rgba(52,168,83,0.1)", border: "1px solid rgba(52,168,83,0.3)", color: "#34A853", cursor: "pointer" }}>
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: "14px 18px", borderRadius: 10, background: "rgba(244,63,94,0.08)",
          border: "1px solid rgba(244,63,94,0.2)", color: "#f43f5e", fontSize: 13, marginBottom: 20 }}>
          {error} — <button onClick={load} style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {[1,2,3].map(i => <Skeleton key={i} h={180} dark={dark} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: muted }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>☁</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No projects found</div>
          <div style={{ fontSize: 13 }}>Add <strong>GCP_CREDENTIALS_JSON</strong> and <strong>GCP_ORG_ID</strong> in Settings.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {filtered.map((proj, i) => (
            <div key={proj.id} style={{ animation: "fadeUp 0.3s ease", animationDelay: `${i * 0.04}s`, animationFillMode: "both" }}>
              <ProjectCard proj={proj} dark={dark} onSelect={handleSelect} />
            </div>
          ))}
        </div>
      )}

      {!data?.org_id && !loading && (
        <div style={{ marginTop: 24, padding: "14px 18px", borderRadius: 10,
          background: "rgba(66,133,244,0.06)", border: "1px solid rgba(66,133,244,0.2)",
          fontSize: 12, color: dark ? "#93c5fd" : "#3b82f6", display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Tip: Add <strong style={{ margin: "0 4px" }}>GCP_ORG_ID</strong> in Settings to filter projects to your Google Cloud Organization.
        </div>
      )}
    </>
  )
}

// ── Billing tab ───────────────────────────────────────────────────────────────

function BillingTab({ dark, text, muted }) {
  const [selProject, setSelProject] = useState(null)   // always default to ALL projects
  const [overview,     setOverview]     = useState(null)
  const [monthly,      setMonthly]      = useState(null)
  const [daily,        setDaily]        = useState(null)
  const [byService,    setByService]    = useState(null)
  const [topResources, setTopResources] = useState(null)
  const [loading, setLoading] = useState(true)

  const pid = selProject?.id || null

  const load = useCallback(async () => {
    setLoading(true)
    const cacheKey = `gcp_billing_v2_${pid || "all"}`

    // SWR: show cached data instantly while fresh fetch runs in background
    try {
      const c = localStorage.getItem(cacheKey)
      if (c) {
        const d = JSON.parse(c)
        if (d.overview)     setOverview(d.overview)
        if (d.monthly)      setMonthly(d.monthly)
        if (d.daily)        setDaily(d.daily)
        if (d.byService)    setByService(d.byService)
        if (d.topResources) setTopResources(d.topResources)
        setLoading(false)
      }
    } catch {}

    // Fire ALL 5 APIs in parallel — no phase 1 / phase 2 delay
    const [ovRes, moRes, dayRes, svcRes, topRes] = await Promise.allSettled([
      getGCPBillingOverview(pid),
      getGCPBillingMonthly(pid, 3),
      getGCPBillingDaily(pid, 30),
      getGCPBillingByService(pid),
      getGCPBillingTopResources(pid),
    ])

    const ov  = ovRes.status  === "fulfilled" ? ovRes.value.data  : null
    const mo  = moRes.status  === "fulfilled" ? moRes.value.data  : null
    const day = dayRes.status === "fulfilled" ? dayRes.value.data : null
    const svc = svcRes.status === "fulfilled" ? svcRes.value.data : null
    const top = topRes.status === "fulfilled" ? topRes.value.data : null

    if (ov)  setOverview(ov)
    if (mo)  setMonthly(mo)
    if (day) setDaily(day)
    if (svc) setByService(svc)
    if (top) setTopResources(top)
    setLoading(false)

    try { localStorage.setItem(`gcp_billing_v2_${pid || "all"}`, JSON.stringify({ overview: ov, monthly: mo, daily: day, byService: svc, topResources: top })) } catch {}
  }, [pid])

  useEffect(() => { load() }, [load])

  function handleProjectChange(p) {
    setSelProject(p)
    // clear stale data so new project shows clean skeletons
    setOverview(null); setMonthly(null); setDaily(null); setByService(null); setTopResources(null)
    setLoading(true)
  }

  const fmt2 = v => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const totalCost   = overview?.total || 0
  const computeCost = (overview?.projects || []).reduce((s, p) => s + p.compute_cost, 0)
  const storageCost = (overview?.projects || []).reduce((s, p) => s + p.storage_cost, 0)
  const networkCost = (overview?.projects || []).reduce((s, p) => s + p.network_cost, 0)

  const today       = new Date()
  const daysElapsed = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dailyRate   = daysElapsed > 0 ? totalCost / daysElapsed : 0
  const forecast    = Math.round(dailyRate * daysInMonth * 100) / 100
  const daysLeft    = daysInMonth - daysElapsed

  const monthChartData = (monthly?.months || []).map(m => {
    const row = { month: m.month.split(" ")[0] }
    let total = 0
    Object.entries(m.by_project || {}).forEach(([pId, cost]) => { row[pId] = cost; total += cost })
    row._total = Math.round(total * 100) / 100
    return row
  })
  const projectIds     = monthly?.project_ids || []
  const dailyChartData = (daily?.days || []).map(d => ({ date: d.label, total: d.total }))
  const servicePieData = (byService?.services || []).map(s => ({ name: s.name, value: s.cost, color: s.color, pct: s.pct })).filter(s => s.value > 0)
  const topList        = topResources?.resources || []
  const projectList    = overview?.projects || []

  const axisStyle = { fill: muted, fontSize: 11 }
  const cardBd    = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <GCPProjectSelector value={selProject} onChange={handleProjectChange} showLabel={true} />
        <button onClick={load}
          style={{ padding: "8px 16px", borderRadius: 9, fontSize: 12, fontWeight: 600,
            background: "rgba(52,168,83,0.1)", border: "1px solid rgba(52,168,83,0.3)", color: "#34A853", cursor: "pointer" }}>
          ↻ Refresh
        </button>
        {loading && (
          <div style={{ fontSize: 12, color: muted, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid #4285F4`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
            Loading billing data…
          </div>
        )}
        {!loading && (
          <div style={{ fontSize: 12, color: muted }}>
            {selProject ? `Filtered: ${selProject.name}` : `All projects · updated just now`}
          </div>
        )}
      </div>

      {/* ── Stats row ───────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 20 }}>
        {loading && !overview ? (
          [1,2,3,4,5].map(i => <Skeleton key={i} h={88} dark={dark} r={14} />)
        ) : (
          <>
            <StatCard label="Total MTD"      value={fmt2(totalCost)}   color="#4285F4" dark={dark} sub="All services" />
            <StatCard label="Compute"        value={fmt2(computeCost)} color="#34A853" dark={dark} sub="Running VMs" />
            <StatCard label="Storage"        value={fmt2(storageCost)} color="#FBBC04" dark={dark} sub="Cloud Storage" />
            <StatCard label="Network (est.)" value={fmt2(networkCost)} color="#EA4335" dark={dark} sub="5% of compute" />
            <div style={{ background: dark ? "rgba(255,255,255,0.035)" : "#fff", border: `1px solid ${cardBd}`,
              borderRadius: 14, padding: "18px 22px", borderTop: "3px solid #8b5cf6" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
                color: dark ? "#64748b" : "#94a3b8", marginBottom: 8 }}>Month Forecast</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#8b5cf6" }}>{fmt2(forecast)}</div>
              <div style={{ fontSize: 11, color: dark ? "#64748b" : "#94a3b8", marginTop: 4 }}>
                {daysLeft}d left · ${dailyRate.toFixed(2)}/day
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Per-project cost cards (always visible, no filter needed) ── */}
      {!selProject && projectList.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            Cost by Project — Current Month
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {projectList.map((p, i) => {
              const pct = totalCost > 0 ? (p.total_cost / totalCost) * 100 : 0
              const col = p.total_cost > 500 ? "#f43f5e" : p.total_cost > 100 ? "#f59e0b" : "#34A853"
              return (
                <div key={p.project_id}
                  onClick={() => handleProjectChange({ id: p.project_id, name: p.project_id })}
                  style={{ background: dark ? "rgba(255,255,255,0.03)" : "#fff",
                    border: `1px solid ${cardBd}`, borderRadius: 12, padding: "14px 16px",
                    cursor: "pointer", transition: "all 0.15s",
                    borderLeft: `3px solid ${GCP_COLORS[i % GCP_COLORS.length]}` }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 16px ${GCP_COLORS[i % GCP_COLORS.length]}22`; e.currentTarget.style.transform = "translateY(-1px)" }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none" }}
                >
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: GCP_COLORS[i % GCP_COLORS.length], fontWeight: 700, marginBottom: 6,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.project_id}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: col, marginBottom: 4 }}>
                    {fmt2(p.total_cost)}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: muted, marginBottom: 8 }}>
                    <span>{p.running_count} running</span>
                    <span>{pct.toFixed(1)}% of total</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: dark ? "rgba(255,255,255,0.06)" : "#f1f5f9" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: GCP_COLORS[i % GCP_COLORS.length],
                      width: `${Math.min(pct, 100)}%`, transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ fontSize: 10, color: muted, marginTop: 6 }}>Click to filter →</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Active filter banner */}
      {selProject && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", borderRadius: 10, background: "rgba(66,133,244,0.08)",
          border: "1px solid rgba(66,133,244,0.2)", marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: dark ? "#93c5fd" : "#3b82f6" }}>
            Showing data for: <strong>{selProject.name}</strong>
          </div>
          <button onClick={() => handleProjectChange(null)}
            style={{ fontSize: 11, fontWeight: 700, color: "#4285F4", background: "none", border: "1px solid rgba(66,133,244,0.3)",
              borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
            ✕ Show All
          </button>
        </div>
      )}

      {/* ── Charts row: 3-month trend + service pie ─────── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginBottom: 18 }}>
        <Card dark={dark}>
          <SectionTitle dark={dark}>3-Month Cost Trend</SectionTitle>
          {loading && !monthly ? <Skeleton h={200} dark={dark} /> : monthChartData.length === 0 ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 13 }}>
              No snapshot data yet — builds as you use this page daily.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                <XAxis dataKey="month" tick={axisStyle} />
                <YAxis tick={axisStyle} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip dark={dark} />} />
                <Legend />
                {projectIds.length > 0
                  ? projectIds.map((pId, i) => (
                    <Bar key={pId} dataKey={pId} name={pId.split("-").slice(0,2).join("-")}
                      fill={GCP_COLORS[i % GCP_COLORS.length]} radius={[4,4,0,0]} stackId="a" />
                  ))
                  : <Bar dataKey="_total" name="Total" fill="#4285F4" radius={[4,4,0,0]} />
                }
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card dark={dark}>
          <SectionTitle dark={dark}>Cost by Service</SectionTitle>
          {loading && !byService ? <Skeleton h={200} dark={dark} /> : servicePieData.length === 0 ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 13 }}>No cost data</div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={servicePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                    {servicePieData.map(e => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={v => `$${v.toFixed(2)}`}
                    contentStyle={{ background: dark ? "#0f172a" : "#fff", border: `1px solid ${dark ? "#1e293b" : "#e2e8f0"}`, borderRadius: 10 }} />
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
          )}
        </Card>
      </div>

      {/* ── Daily cost line ──────────────────────────────── */}
      <Card dark={dark} style={{ marginBottom: 18 }}>
        <SectionTitle dark={dark}>Daily Cost — Last 30 Days</SectionTitle>
        {loading && !daily ? <Skeleton h={180} dark={dark} /> : dailyChartData.length === 0 ? (
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
        )}
      </Card>

      {/* ── Project breakdown table (all-projects mode) ── */}
      {projectList.length > 0 && (
        <Card dark={dark} style={{ marginBottom: 18 }}>
          <SectionTitle dark={dark}>Project Cost Breakdown (Current Month)</SectionTitle>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${cardBd}` }}>
                  {["Project","Instances","Running","Compute","Storage","Network","Total MTD",""].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Project" || h === "" ? "left" : "right",
                      fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectList.map((p, i) => (
                  <tr key={p.project_id}
                    style={{ borderBottom: i < projectList.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` : "none",
                      background: selProject?.id === p.project_id ? (dark ? "rgba(66,133,244,0.06)" : "rgba(66,133,244,0.04)") : "transparent" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#4285F4" }}>{p.project_id}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: text }}>{p.instance_count}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#34A853", fontWeight: 600 }}>{p.running_count}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: text }}>{fmt2(p.compute_cost)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: text }}>{fmt2(p.storage_cost)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: text }}>{fmt2(p.network_cost)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800,
                      color: p.total_cost > 500 ? "#f43f5e" : p.total_cost > 100 ? "#f59e0b" : "#34A853" }}>
                      {fmt2(p.total_cost)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        onClick={() => handleProjectChange(selProject?.id === p.project_id ? null : { id: p.project_id, name: p.project_id })}
                        style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                          background: selProject?.id === p.project_id ? "rgba(244,63,94,0.1)" : "rgba(66,133,244,0.1)",
                          border: selProject?.id === p.project_id ? "1px solid rgba(244,63,94,0.3)" : "1px solid rgba(66,133,244,0.3)",
                          color: selProject?.id === p.project_id ? "#f43f5e" : "#4285F4", cursor: "pointer" }}>
                        {selProject?.id === p.project_id ? "Clear" : "Filter"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: text }}>Total</td>
                  <td colSpan={5} />
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#4285F4", fontSize: 16 }}>{fmt2(totalCost)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ── Top resources ────────────────────────────────── */}
      <Card dark={dark}>
        <SectionTitle dark={dark}>Top Resources by Cost</SectionTitle>
        {loading && !topResources ? <Skeleton h={160} dark={dark} /> : topList.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: muted, fontSize: 13 }}>No running instances found</div>
        ) : (
          topList.map((res, i) => {
            const pct = totalCost > 0 ? res.monthly_cost / totalCost * 100 : 0
            return (
              <div key={`${res.project_id}-${res.name}`} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "10px 0",
                borderBottom: i < topList.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` : "none" }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: `${GCP_COLORS[i % GCP_COLORS.length]}20`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: GCP_COLORS[i % GCP_COLORS.length] }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{res.name}</span>
                    <span style={{ fontSize: 10, background: res.status === "RUNNING" ? "rgba(52,168,83,0.15)" : "rgba(245,158,11,0.15)",
                      color: res.status === "RUNNING" ? "#34A853" : "#f59e0b", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>{res.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>{res.project_id} · {res.zone} · {res.machine_type}</div>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: GCP_COLORS[i % GCP_COLORS.length],
                      width: `${Math.min(pct * 3, 100)}%`, transition: "width 0.5s ease" }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: GCP_COLORS[i % GCP_COLORS.length] }}>
                    {fmt2(res.monthly_cost)}<span style={{ fontSize: 10, fontWeight: 400, color: muted }}>/mo</span>
                  </div>
                  <div style={{ fontSize: 10, color: muted }}>${(res.hourly_rate || 0).toFixed(4)}/hr</div>
                </div>
              </div>
            )
          })
        )}
      </Card>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GCPProjects() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { dark } = useTheme()
  const activeTab = searchParams.get("tab") || "projects"

  const bg   = dark ? "#070c18" : "#f0f4f8"
  const text  = dark ? "#e2e8f0" : "#1e293b"
  const muted = dark ? "#64748b" : "#94a3b8"
  const bdr   = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"

  function setTab(tab) {
    setSearchParams({ tab })
  }

  const tabs = [
    { id: "projects", label: "All Projects",       icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" },
    { id: "billing",  label: "Billing & Cost",      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  ]

  return (
    <div style={{ minHeight: "100vh", background: bg, padding: "32px 40px", color: text }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-700px 0} 100%{background-position:700px 0} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        input:focus { outline: none; }
        input::placeholder { opacity: 0.6; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: GCP_GRADIENT, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", boxShadow: "0 4px 16px rgba(66,133,244,0.3)" }}>GCP</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>GCP Projects & Billing</div>
            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
              {activeTab === "projects" ? "All projects accessible to your service account" : "Estimated costs, trends and forecasts"}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
        borderRadius: 12, padding: 4, width: "fit-content" }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.18s ease", fontFamily: "inherit",
              background: activeTab === t.id ? (dark ? "#0f172a" : "#fff") : "transparent",
              color: activeTab === t.id ? "#4285F4" : muted,
              border: activeTab === t.id ? `1px solid ${bdr}` : "1px solid transparent",
              boxShadow: activeTab === t.id ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "projects"
        ? <ProjectsTab dark={dark} text={text} muted={muted} bdr={bdr} />
        : <BillingTab  dark={dark} text={text} muted={muted} />
      }
    </div>
  )
}
