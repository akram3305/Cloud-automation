import { useEffect, useState, useCallback, useRef } from "react"
import { getActivityLogs } from "../api/api"
import { useTheme } from "../context/ThemeContext"

const TYPE_ICONS = {
  EC2:        "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
  S3:         "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  EKS:        "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  RDS:        "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
  Lambda:     "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3l6 9m-6-9l-6 9",
  VPC:        "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  IAM:        "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  ELB:        "M3 6l9-4 9 4v6a9 9 0 01-9 8 9 9 0 01-9-8V6z",
  Request:    "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  CloudTrail: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  AWS:        "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return s + "s ago"
  if (s < 3600) return Math.floor(s / 60) + "m ago"
  if (s < 86400) return Math.floor(s / 3600) + "h ago"
  return Math.floor(s / 86400) + "d ago"
}

export default function Activity() {
  const { dark } = useTheme()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [autoRef, setAutoRef] = useState(true)
  const [lastRef, setLastRef] = useState(null)
  const [newCount, setNewCount] = useState(0)
  const [hours, setHours] = useState(72)
  const prevIds = useRef(new Set())

  const bg = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border = dark ? "#1e293b" : "#e2e8f0"
  const text = dark ? "#f1f5f9" : "#0f172a"
  const muted = dark ? "#475569" : "#64748b"
  const subtle = dark ? "#1e293b" : "#f8fafc"

  const fetchLogs = useCallback(async (silent = false) => {
    try {
      const { data } = await getActivityLogs(100, hours)
      const newIds = new Set(data.map(l => l.id))
      const added = silent ? [...newIds].filter(id => !prevIds.current.has(id)).length : 0
      if (added > 0) setNewCount(n => n + added)
      prevIds.current = newIds
      setLogs(data)
      setLastRef(new Date())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [hours])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (!autoRef) return
    const id = setInterval(() => fetchLogs(true), 15000)
    return () => clearInterval(id)
  }, [autoRef, fetchLogs])

  const filtered = filter === "all" ? logs : logs.filter(l =>
    l.source === filter || l.type?.toLowerCase() === filter
  )

  const FILTERS = [
    { id: "all",      label: "All events" },
    { id: "platform", label: "Platform"   },
    { id: "aws",      label: "AWS"        },
    { id: "ec2",      label: "EC2"        },
    { id: "eks",      label: "EKS"        },
    { id: "s3",       label: "S3"         },
    { id: "rds",      label: "RDS"        },
    { id: "lambda",   label: "Lambda"     },
    { id: "iam",      label: "IAM"        },
    { id: "vpc",      label: "VPC"        },
  ]

  const HOUR_OPTIONS = [
    { v: 24,       label: "24h"    },
    { v: 72,       label: "3 days" },
    { v: 168,      label: "7 days" },
    { v: 720,      label: "30 days"},
  ]

  const stats = {
    total: logs.length,
    aws: logs.filter(l => l.source === "aws").length,
    platform: logs.filter(l => l.source === "platform").length,
    errors: logs.filter(l => l.status === "failed" || l.status === "error").length,
  }

  return (
    <div style={{ padding: "28px", background: bg, minHeight: "100vh", transition: "all 0.3s ease" }}>
      <style>{"@keyframes fadeIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}"}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: autoRef ? "#00d4aa" : "#64748b", boxShadow: autoRef ? "0 0 8px #00d4aa" : "none", animation: autoRef ? "pulse 2s infinite" : "none" }} />
            <span style={{ fontSize: "11px", fontWeight: "600", color: autoRef ? "#00d4aa" : "#64748b", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              {autoRef ? "Live - auto refresh every 15s" : "Paused"}
            </span>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: text, margin: 0, letterSpacing: "-0.5px" }}>Activity Log</h1>
          <p style={{ fontSize: "13px", color: muted, marginTop: "4px" }}>
            Real-time events from platform and AWS CloudTrail
            {lastRef && " - last updated " + timeAgo(lastRef.toISOString())}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Time window selector */}
          <div style={{ display: "flex", background: surface, border: "1px solid " + border, borderRadius: "8px", overflow: "hidden" }}>
            {HOUR_OPTIONS.map(o => (
              <button key={o.v} onClick={() => { setHours(o.v); setTimeout(fetchLogs, 0) }}
                style={{ padding: "6px 12px", border: "none", fontSize: "12px", cursor: "pointer", background: hours === o.v ? "#00d4aa20" : "transparent", color: hours === o.v ? "#00d4aa" : muted, fontWeight: hours === o.v ? 600 : 400, borderRight: "1px solid " + border }}>
                {o.label}
              </button>
            ))}
          </div>
          {newCount > 0 && (
            <div style={{ background: "#00d4aa15", border: "1px solid #00d4aa30", color: "#00d4aa", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
              onClick={() => { setNewCount(0); fetchLogs() }}>
              +{newCount} new events
            </div>
          )}
          <button onClick={() => setAutoRef(p => !p)}
            style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "500", cursor: "pointer", border: "1px solid " + border, background: autoRef ? "#00d4aa15" : surface, color: autoRef ? "#00d4aa" : muted }}>
            {autoRef ? "Pause" : "Resume"}
          </button>
          <button onClick={() => fetchLogs()}
            style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "500", cursor: "pointer", border: "1px solid " + border, background: surface, color: muted }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Total Events", value: stats.total, color: "#00d4aa" },
          { label: "AWS CloudTrail", value: stats.aws, color: "#FF9900" },
          { label: "Platform Events", value: stats.platform, color: "#3b82f6" },
          { label: "Failed/Errors", value: stats.errors, color: "#f43f5e" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: surface, border: "1px solid " + border, borderLeft: "3px solid " + color, borderRadius: "12px", padding: "16px", transition: "all 0.3s" }}>
            <div style={{ fontSize: "11px", fontWeight: "600", color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>{label}</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: text }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "500", cursor: "pointer",
            border: "1px solid " + (filter === f.id ? "#00d4aa40" : border),
            background: filter === f.id ? "#00d4aa15" : surface,
            color: filter === f.id ? "#00d4aa" : muted, transition: "all 0.15s"
          }}>{f.label}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: "12px", color: muted, alignSelf: "center" }}>{filtered.length} events</span>
      </div>

      <div style={{ background: surface, border: "1px solid " + border, borderRadius: "14px", overflow: "hidden", transition: "all 0.3s" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid " + border, display: "flex", justifyContent: "space-between", alignItems: "center", background: subtle }}>
          <span style={{ fontSize: "13px", fontWeight: "600", color: text }}>Event Stream</span>
          <span style={{ fontSize: "11px", color: muted, fontFamily: "monospace" }}>{new Date().toLocaleString("en-IN")}</span>
        </div>

        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: muted }}>Loading activity logs...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "64px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
            <div style={{ fontSize: "14px", color: muted }}>No events found</div>
          </div>
        ) : (
          <div style={{ maxHeight: "600px", overflowY: "auto" }}>
            {filtered.map((log, i) => (
              <div key={log.id + i} style={{ display: "flex", gap: "14px", padding: "14px 20px", borderBottom: "1px solid " + border, animation: "fadeIn 0.3s ease both", animationDelay: (i * 20) + "ms", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = dark ? "#ffffff04" : "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: log.color + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={log.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={TYPE_ICONS[log.type] || TYPE_ICONS.Request} />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: text }}>{log.action}</span>
                    <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#00d4aa", background: "#00d4aa10", padding: "1px 8px", borderRadius: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>{log.resource}</span>
                    <span style={{ fontSize: "11px", background: log.color + "15", color: log.color, padding: "2px 8px", borderRadius: "12px", fontWeight: "500" }}>{log.type}</span>
                    {log.source === "aws" && (
                      <span style={{ fontSize: "10px", background: "#FF990015", color: "#FF9900", padding: "1px 6px", borderRadius: "4px", fontWeight: "600" }}>AWS</span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: muted }}>{log.detail}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: "500", color: muted }}>{timeAgo(log.time)}</div>
                  <div style={{ fontSize: "10px", color: dark ? "#334155" : "#94a3b8", marginTop: "2px" }}>
                    {new Date(log.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
