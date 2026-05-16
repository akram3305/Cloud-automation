import { useEffect, useState, useCallback, useRef } from "react"
import { getActivityLogs, getUsersActivitySummary } from "../api/api"
import { useTheme } from "../context/ThemeContext"

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICONS = {
  EC2:     "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
  VM:      "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
  Compute: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
  S3:      "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  Storage: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  EKS:     "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  RDS:     "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
  Lambda:  "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3l6 9m-6-9l-6 9",
  VPC:     "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  IAM:     "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  ELB:     "M3 6l9-4 9 4v6a9 9 0 01-9 8 9 9 0 01-9-8V6z",
  Request: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  Action:  "M13 10V3L4 14h7v7l9-11h-7z",
  AWS:     "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  default: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
}

const CLOUD_META = {
  aws:      { label: "AWS",      color: "#FF9900", bg: "#FF990015" },
  azure:    { label: "Azure",    color: "#0078D4", bg: "#0078D415" },
  gcp:      { label: "GCP",      color: "#4285F4", bg: "#4285F415" },
  platform: { label: "Platform", color: "#00d4aa", bg: "#00d4aa15" },
}

function timeAgo(iso) {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)    return s + "s ago"
  if (s < 3600)  return Math.floor(s / 60) + "m ago"
  if (s < 86400) return Math.floor(s / 3600) + "h ago"
  return Math.floor(s / 86400) + "d ago"
}

function fmtTime(iso) {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch { return iso }
}

// ── CSV download ──────────────────────────────────────────────────────────────
function downloadCSV(rows) {
  const headers = ["Time", "Cloud", "Action", "Type", "Resource", "Detail", "User", "Status", "Source"]
  const escape  = v => `"${String(v || "").replace(/"/g, '""')}"`
  const lines   = [
    headers.join(","),
    ...rows.map(r => [
      fmtTime(r.time), r.cloud || r.source, r.action, r.type,
      r.resource, r.detail, r.user || "system", r.status, r.source,
    ].map(escape).join(","))
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `activity-log-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── PDF print ─────────────────────────────────────────────────────────────────
function downloadPDF(rows) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Activity Log — ${new Date().toLocaleDateString()}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a202c;padding:20px}
  h1{font-size:18px;margin-bottom:4px}
  p{font-size:11px;color:#64748b;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th{background:#0f1f3d;color:#fff;padding:7px 9px;text-align:left;font-size:10px}
  td{padding:6px 9px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  tr:nth-child(even) td{background:#f8faff}
  .badge{display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700}
  .aws{background:#fff3e0;color:#e65100}
  .azure{background:#e3f2fd;color:#0d47a1}
  .gcp{background:#e8f5e9;color:#1b5e20}
  .platform{background:#e0f2f1;color:#004d40}
  @media print{body{padding:0}}
</style></head><body>
<h1>AIonOS — Activity Log</h1>
<p>Exported: ${new Date().toLocaleString()} · ${rows.length} events</p>
<table>
  <thead><tr><th>Time</th><th>Cloud</th><th>Action</th><th>Type</th><th>Resource</th><th>User</th><th>Status</th></tr></thead>
  <tbody>
  ${rows.map(r => `<tr>
    <td>${fmtTime(r.time)}</td>
    <td><span class="badge ${r.cloud || r.source}">${(r.cloud || r.source || "").toUpperCase()}</span></td>
    <td>${r.action || ""}</td>
    <td>${r.type || ""}</td>
    <td style="font-family:monospace;max-width:180px;overflow:hidden;text-overflow:ellipsis">${r.resource || ""}</td>
    <td>${r.user || "system"}</td>
    <td>${r.status || ""}</td>
  </tr>`).join("")}
  </tbody>
</table>
</body></html>`
  const w = window.open("", "_blank")
  w.document.write(html)
  w.document.close()
  setTimeout(() => { w.print(); w.close() }, 300)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Activity() {
  const { dark } = useTheme()
  const [logs,       setLogs]       = useState([])
  const [userSummary,setUserSummary]= useState([])
  const [loading,    setLoading]    = useState(true)
  const [cloudFilter,setCloudFilter]= useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [search,     setSearch]     = useState("")
  const [hours,      setHours]      = useState(72)
  const [autoRef,    setAutoRef]    = useState(true)
  const [lastRef,    setLastRef]    = useState(null)
  const [newCount,   setNewCount]   = useState(0)
  const [tab,        setTab]        = useState("events")  // events | users
  const prevIds = useRef(new Set())

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"

  const fetchLogs = useCallback(async (silent = false) => {
    try {
      const { data } = await getActivityLogs(200, hours, "all")
      const newIds = new Set(data.map(l => l.id))
      if (silent) {
        const added = [...newIds].filter(id => !prevIds.current.has(id)).length
        if (added > 0) setNewCount(n => n + added)
      }
      prevIds.current = newIds
      setLogs(data)
      setLastRef(new Date())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [hours])

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await getUsersActivitySummary()
      setUserSummary(data)
    } catch {}
  }, [])

  useEffect(() => { fetchLogs(); fetchUsers() }, [fetchLogs, fetchUsers])

  useEffect(() => {
    if (!autoRef) return
    const id = setInterval(() => fetchLogs(true), 15000)
    return () => clearInterval(id)
  }, [autoRef, fetchLogs])

  // Derived data
  const stats = {
    total:    logs.length,
    aws:      logs.filter(l => (l.cloud || l.source) === "aws").length,
    azure:    logs.filter(l => (l.cloud || l.source) === "azure").length,
    gcp:      logs.filter(l => (l.cloud || l.source) === "gcp").length,
    platform: logs.filter(l => (l.cloud || l.source) === "platform").length,
    errors:   logs.filter(l => l.status === "failed" || l.status === "error").length,
  }

  const allTypes = [...new Set(logs.map(l => l.type).filter(Boolean))].sort()

  const filtered = logs.filter(l => {
    const lCloud = l.cloud || l.source || "platform"
    if (cloudFilter !== "all" && lCloud !== cloudFilter) return false
    if (typeFilter !== "all" && (l.type || "").toLowerCase() !== typeFilter.toLowerCase()) return false
    if (search) {
      const q = search.toLowerCase()
      return (l.action || "").toLowerCase().includes(q)
          || (l.resource || "").toLowerCase().includes(q)
          || (l.user || "").toLowerCase().includes(q)
          || (l.detail || "").toLowerCase().includes(q)
    }
    return true
  })

  const CLOUD_TABS = [
    { id: "all",      label: "All Clouds", color: "#e2e8f0" },
    { id: "aws",      label: "AWS",        color: "#FF9900" },
    { id: "azure",    label: "Azure",      color: "#0078D4" },
    { id: "gcp",      label: "GCP",        color: "#4285F4" },
    { id: "platform", label: "Platform",   color: "#00d4aa" },
  ]

  const HOUR_OPTIONS = [
    { v: 24,  label: "24h"    },
    { v: 72,  label: "3 days" },
    { v: 168, label: "7 days" },
    { v: 720, label: "30 days"},
  ]

  return (
    <div style={{ padding: "28px 32px", background: bg, minHeight: "100vh" }}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar{ width:5px } ::-webkit-scrollbar-track{ background:transparent }
        ::-webkit-scrollbar-thumb{ background:${dark?"#1e293b":"#e2e8f0"};border-radius:4px }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: autoRef ? "#00d4aa" : "#64748b",
              boxShadow: autoRef ? "0 0 8px #00d4aa" : "none", animation: autoRef ? "pulse 2s infinite" : "none" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: autoRef ? "#00d4aa" : muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              {autoRef ? "Live · auto-refresh every 15s" : "Paused"}
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: text, margin: 0, letterSpacing: "-0.5px" }}>Activity Log</h1>
          <p style={{ fontSize: 13, color: muted, marginTop: 4, margin: 0 }}>
            Unified events from AWS · Azure · GCP · Platform
            {lastRef && <span> · updated {timeAgo(lastRef.toISOString())}</span>}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Time window */}
          <div style={{ display: "flex", background: surface, border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden" }}>
            {HOUR_OPTIONS.map(o => (
              <button key={o.v} onClick={() => setHours(o.v)}
                style={{ padding: "6px 12px", border: "none", fontSize: 12, cursor: "pointer",
                  background: hours === o.v ? "#00d4aa20" : "transparent",
                  color: hours === o.v ? "#00d4aa" : muted,
                  fontWeight: hours === o.v ? 600 : 400,
                  borderRight: `1px solid ${border}` }}>
                {o.label}
              </button>
            ))}
          </div>

          {newCount > 0 && (
            <div onClick={() => { setNewCount(0); fetchLogs() }}
              style={{ background: "#00d4aa15", border: "1px solid #00d4aa30", color: "#00d4aa",
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              +{newCount} new
            </div>
          )}

          <button onClick={() => setAutoRef(p => !p)}
            style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
              border: `1px solid ${border}`, background: autoRef ? "#00d4aa15" : surface, color: autoRef ? "#00d4aa" : muted }}>
            {autoRef ? "Pause" : "Resume"}
          </button>
          <button onClick={() => fetchLogs()}
            style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
              border: `1px solid ${border}`, background: surface, color: muted }}>
            ↻ Refresh
          </button>

          {/* Download buttons */}
          <button onClick={() => downloadCSV(filtered)}
            style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "1px solid rgba(52,168,83,0.4)", background: "rgba(52,168,83,0.1)", color: "#34A853",
              display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Excel / CSV
          </button>
          <button onClick={() => downloadPDF(filtered)}
            style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#ef4444",
              display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Events", value: stats.total,    color: "#e2e8f0",  textColor: text },
          { label: "AWS",          value: stats.aws,      color: "#FF9900",  textColor: "#FF9900" },
          { label: "Azure",        value: stats.azure,    color: "#0078D4",  textColor: "#0078D4" },
          { label: "GCP",          value: stats.gcp,      color: "#4285F4",  textColor: "#4285F4" },
          { label: "Platform",     value: stats.platform, color: "#00d4aa",  textColor: "#00d4aa" },
          { label: "Errors",       value: stats.errors,   color: "#f43f5e",  textColor: "#f43f5e" },
        ].map(({ label, value, color, textColor }) => (
          <div key={label} style={{ background: surface, border: `1px solid ${border}`,
            borderLeft: `3px solid ${color}`, borderRadius: 12, padding: "14px 16px",
            cursor: label !== "Total Events" && label !== "Errors" ? "pointer" : "default" }}
            onClick={() => {
              if (label === "AWS") setCloudFilter(f => f === "aws" ? "all" : "aws")
              if (label === "Azure") setCloudFilter(f => f === "azure" ? "all" : "azure")
              if (label === "GCP") setCloudFilter(f => f === "gcp" ? "all" : "gcp")
              if (label === "Platform") setCloudFilter(f => f === "platform" ? "all" : "platform")
            }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: textColor }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Tab switcher ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20,
        background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
        borderRadius: 10, padding: 4, width: "fit-content" }}>
        {[{ id: "events", label: "Event Stream" }, { id: "users", label: "User Activity" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              background: tab === t.id ? (dark ? "#0f172a" : "#fff") : "transparent",
              color: tab === t.id ? "#00d4aa" : muted,
              border: tab === t.id ? `1px solid ${border}` : "1px solid transparent",
              boxShadow: tab === t.id ? "0 2px 8px rgba(0,0,0,0.1)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "events" && (
        <>
          {/* ── Cloud filter tabs ──────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            {CLOUD_TABS.map(c => (
              <button key={c.id} onClick={() => setCloudFilter(c.id)}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${cloudFilter === c.id ? c.color + "60" : border}`,
                  background: cloudFilter === c.id ? c.color + "15" : surface,
                  color: cloudFilter === c.id ? c.color : muted, transition: "all 0.15s" }}>
                {c.label}
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>
                  {c.id === "all" ? stats.total : c.id === "aws" ? stats.aws : c.id === "azure" ? stats.azure : c.id === "gcp" ? stats.gcp : stats.platform}
                </span>
              </button>
            ))}

            {/* Type filter */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                border: `1px solid ${border}`, background: surface, color: typeFilter !== "all" ? "#00d4aa" : muted,
                fontFamily: "inherit", outline: "none" }}>
              <option value="all">All Types</option>
              {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Search */}
            <div style={{ position: "relative", marginLeft: "auto" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search action, resource, user…"
                style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
                  borderRadius: 8, border: `1px solid ${border}`, background: surface,
                  fontSize: 12, color: text, fontFamily: "inherit", outline: "none", width: 220 }} />
            </div>

            <span style={{ fontSize: 12, color: muted }}>{filtered.length} events</span>
          </div>

          {/* ── Event stream ────────────────────────────────────────────────── */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center", background: subtle }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: text }}>Event Stream</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {loading && (
                  <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #00d4aa",
                    borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                )}
                <span style={{ fontSize: 11, color: muted, fontFamily: "monospace" }}>
                  {new Date().toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {loading && logs.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: muted }}>Loading activity logs…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 64, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>📋</div>
                <div style={{ fontSize: 14, color: muted }}>No events match the current filters</div>
              </div>
            ) : (
              <div style={{ maxHeight: 620, overflowY: "auto" }}>
                {filtered.map((log, i) => {
                  const lCloud = log.cloud || log.source || "platform"
                  const cm     = CLOUD_META[lCloud] || CLOUD_META.platform
                  const icon   = ICONS[log.type] || ICONS.default
                  return (
                    <div key={log.id + i}
                      style={{ display: "flex", gap: 14, padding: "12px 20px",
                        borderBottom: `1px solid ${border}`,
                        animation: "fadeIn 0.25s ease both",
                        animationDelay: Math.min(i * 12, 300) + "ms",
                        transition: "background 0.12s" }}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? "#ffffff04" : "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                      {/* Icon */}
                      <div style={{ width: 34, height: 34, borderRadius: 9,
                        background: (log.color || cm.color) + "20",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, marginTop: 2 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={log.color || cm.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d={icon} />
                        </svg>
                      </div>

                      {/* Main info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{log.action}</span>
                          {log.resource && (
                            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#00d4aa",
                              background: "#00d4aa10", padding: "1px 7px", borderRadius: 4,
                              maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {log.resource}
                            </span>
                          )}
                          <span style={{ fontSize: 10, background: (log.color || "#64748b") + "18",
                            color: log.color || "#64748b", padding: "2px 7px", borderRadius: 10, fontWeight: 600 }}>
                            {log.type}
                          </span>
                          {/* Cloud badge */}
                          <span style={{ fontSize: 9, background: cm.bg, color: cm.color,
                            padding: "2px 7px", borderRadius: 10, fontWeight: 800, letterSpacing: "0.06em" }}>
                            {cm.label}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                          {log.detail && <span style={{ fontSize: 11, color: muted }}>{log.detail}</span>}
                          {log.user && log.user !== "system" && log.user !== "gcp-service" && log.user !== "azure-service" && log.user !== "aws-service" && (
                            <span style={{ fontSize: 11, color: dark ? "#94a3b8" : "#64748b", display: "flex", alignItems: "center", gap: 3 }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
                              </svg>
                              {log.user}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 80 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: muted }}>{timeAgo(log.time)}</div>
                        <div style={{ fontSize: 10, color: dark ? "#334155" : "#94a3b8", marginTop: 2 }}>
                          {new Date(log.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 700,
                            background: log.status === "failed" || log.status === "error" ? "#f43f5e20" : log.status === "pending" ? "#f59e0b20" : "#00d4aa15",
                            color:      log.status === "failed" || log.status === "error" ? "#f43f5e"   : log.status === "pending" ? "#f59e0b"   : "#00d4aa" }}>
                            {(log.status || "ok").toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── User Activity Tab ──────────────────────────────────────────────── */}
      {tab === "users" && (
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${border}`, background: subtle,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: text }}>User Actions Summary</span>
            <button onClick={() => downloadCSV(logs.filter(l => l.user && l.user !== "system"))}
              style={{ padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: "1px solid rgba(52,168,83,0.4)", background: "rgba(52,168,83,0.1)", color: "#34A853" }}>
              Export CSV
            </button>
          </div>
          {userSummary.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: muted, fontSize: 13 }}>
              No user activity recorded yet. Actions will appear here as users interact with the platform.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}`, background: subtle }}>
                    {["User", "Total Actions", "AWS", "Azure", "GCP", "Platform"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: h === "User" ? "left" : "right",
                        fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userSummary.map((u, i) => (
                    <tr key={u.username} style={{ borderBottom: i < userSummary.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` : "none" }}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? "#ffffff04" : "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#4285F4,#34A853)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>
                          {(u.username || "?")[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: text }}>{u.username}</span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#00d4aa", fontSize: 16 }}>{u.total}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#FF9900", fontWeight: 600 }}>{u.clouds?.aws || 0}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#0078D4", fontWeight: 600 }}>{u.clouds?.azure || 0}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#4285F4", fontWeight: 600 }}>{u.clouds?.gcp || 0}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: muted }}>{u.clouds?.platform || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-user recent actions from event stream */}
          {userSummary.length > 0 && (
            <div style={{ borderTop: `1px solid ${border}`, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
                Recent Actions by Real Users
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {logs
                  .filter(l => l.user && !["system","gcp-service","azure-service","aws-service"].includes(l.user))
                  .slice(0, 20)
                  .map((log, i) => {
                    const lCloud = log.cloud || log.source || "platform"
                    const cm     = CLOUD_META[lCloud] || CLOUD_META.platform
                    return (
                      <div key={log.id + i} style={{ display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", borderRadius: 9,
                        background: dark ? "rgba(255,255,255,0.025)" : "#f8faff",
                        border: `1px solid ${border}` }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#4285F4,#34A853)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                          {(log.user || "?")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, color: text, fontSize: 12 }}>{log.user}</span>
                          <span style={{ color: muted, fontSize: 12 }}> performed </span>
                          <span style={{ fontWeight: 700, color: log.color || "#00d4aa", fontSize: 12 }}>{log.action}</span>
                          {log.resource && <span style={{ color: muted, fontSize: 12 }}> on <span style={{ fontFamily: "monospace", color: "#00d4aa" }}>{log.resource}</span></span>}
                        </div>
                        <span style={{ fontSize: 9, background: cm.bg, color: cm.color, padding: "2px 6px", borderRadius: 8, fontWeight: 800, flexShrink: 0 }}>
                          {cm.label}
                        </span>
                        <span style={{ fontSize: 11, color: muted, flexShrink: 0 }}>{timeAgo(log.time)}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
