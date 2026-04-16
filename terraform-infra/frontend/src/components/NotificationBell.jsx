import { useState, useEffect, useRef } from "react"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"

export default function NotificationBell() {
  const { dark } = useTheme()
  const [open, setOpen]         = useState(false)
  const [requests, setRequests] = useState([])
  const [alerts,   setAlerts]   = useState([])
  const [seen, setSeen]         = useState(() => {
    try { return JSON.parse(localStorage.getItem("seen_requests") || "[]") }
    catch { return [] }
  })
  const [tab, setTab] = useState("approvals")   // "approvals" | "alerts"
  const ref = useRef(null)

  const userRole = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").role || "viewer" } catch { return "viewer" } })()
  const isAdmin = userRole === "admin"

  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"

  async function fetchPending() {
    try {
      const { data } = await api.get("/requests")
      setRequests(data.filter(r => r.status === "pending"))
    } catch(e) {}
  }

  async function fetchAlerts() {
    try {
      const { data } = await api.get("/alerts", { params: { unread_only: true } })
      setAlerts(data)
    } catch(e) {}
  }

  useEffect(() => {
    fetchPending()
    fetchAlerts()
    const interval = setInterval(() => { fetchPending(); fetchAlerts() }, 15000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const unseen = requests.filter(r => !seen.includes(r.id))
  const totalCount = unseen.length + alerts.length

  function markAllSeen() {
    const ids = [...seen, ...requests.map(r => r.id)]
    setSeen(ids)
    localStorage.setItem("seen_requests", JSON.stringify(ids))
  }

  async function markAlertRead(id) {
    try {
      await api.patch(`/alerts/${id}/read`)
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch(e) {}
  }

  async function markAllAlertsRead() {
    try {
      await api.patch("/alerts/read-all")
      setAlerts([])
    } catch(e) {}
  }

  function handleOpen() {
    setOpen(o => !o)
    if (!open) markAllSeen()
  }

  function timeAgo(iso) {
    const d = Math.floor((Date.now() - new Date(iso)) / 60000)
    if (d < 1)    return "just now"
    if (d < 60)   return `${d}m ago`
    if (d < 1440) return `${Math.floor(d/60)}h ago`
    return `${Math.floor(d/1440)}d ago`
  }

  async function handleApprove(id, e) {
    e.stopPropagation()
    try {
      await api.patch(`/requests/${id}/approve`, {})
      fetchPending()
    } catch(err) { alert(err.response?.data?.detail || err.message) }
  }

  async function handleReject(id, e) {
    e.stopPropagation()
    try {
      await api.patch(`/requests/${id}/reject`, {})
      fetchPending()
    } catch(err) { alert(err.response?.data?.detail || err.message) }
  }

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={handleOpen} style={{
        position:"relative", border:"none", cursor:"pointer",
        padding:"8px", borderRadius:"10px",
        background: open ? (dark ? "#1e293b" : "#f1f5f9") : "transparent",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke={totalCount > 0 ? "#f59e0b" : muted}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {totalCount > 0 && (
          <div style={{
            position:"absolute", top:"4px", right:"4px",
            width:"16px", height:"16px", borderRadius:"50%",
            background: alerts.length > 0 ? "#f43f5e" : "#f59e0b",
            color:"#fff", fontSize:"10px", fontWeight:"700",
            display:"flex", alignItems:"center", justifyContent:"center",
            animation:"pulse 2s infinite"
          }}>{totalCount > 9 ? "9+" : totalCount}</div>
        )}
      </button>

      {open && (
        <div style={{
          position:"fixed", top:"70px", left:"230px",
          width:"360px", background:surface,
          border:"1px solid "+border, borderRadius:"14px",
          boxShadow:"0 8px 32px rgba(0,0,0,0.18)",
          zIndex:9999, overflow:"hidden",
        }}>
          {/* Tab switcher */}
          <div style={{ display:"flex", borderBottom:"1px solid "+border }}>
            {[
              { key:"approvals", label:`Approvals ${requests.length > 0 ? `(${requests.length})` : ""}`, color:"#f59e0b" },
              { key:"alerts",    label:`Alerts ${alerts.length > 0 ? `(${alerts.length})` : ""}`,         color:"#f43f5e" },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex:1, padding:"11px 8px", border:"none", cursor:"pointer",
                fontSize:"12px", fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? t.color : muted,
                background: tab === t.key ? t.color + "10" : "transparent",
                borderBottom: tab === t.key ? `2px solid ${t.color}` : "2px solid transparent",
                transition:"all 0.15s ease",
              }}>{t.label}</button>
            ))}
          </div>

          {/* Approvals tab */}
          {tab === "approvals" && (
            <div>
              <div style={{ padding:"12px 16px 8px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:"12px", color:muted }}>{requests.length} pending request{requests.length !== 1 ? "s" : ""}</div>
                {requests.length > 0 && <a href="/approvals" style={{ fontSize:"11px", color:"#3b82f6", textDecoration:"none" }}>View all</a>}
              </div>
              <div style={{ maxHeight:"300px", overflowY:"auto" }}>
                {requests.length === 0 ? (
                  <div style={{ padding:"28px", textAlign:"center" }}>
                    <div style={{ fontSize:"24px", marginBottom:"8px" }}>✓</div>
                    <div style={{ fontSize:"13px", color:muted }}>No pending approvals</div>
                  </div>
                ) : requests.map(r => (
                  <div key={r.id} style={{ padding:"12px 16px", borderBottom:"1px solid "+border, background:subtle }}>
                    <div style={{ display:"flex", gap:"6px", marginBottom:"3px", alignItems:"center" }}>
                      <span style={{ background:"#f59e0b20", color:"#f59e0b", padding:"1px 7px", borderRadius:"10px", fontSize:"10px", fontWeight:"600" }}>PENDING</span>
                      <span style={{ fontSize:"10px", color:muted }}>{timeAgo(r.created_at)}</span>
                    </div>
                    <div style={{ fontSize:"13px", fontWeight:"600", color:text }}>{r.resource_name}</div>
                    <div style={{ fontSize:"11px", color:muted, marginTop:"1px" }}>
                      {r.resource_type?.toUpperCase()} · {r.region} · by {r.username}
                    </div>
                    {isAdmin && (
                      <div style={{ display:"flex", gap:"6px", marginTop:"8px" }}>
                        <button onClick={e => handleApprove(r.id, e)} style={{
                          flex:1, padding:"6px", borderRadius:"7px", fontSize:"12px", fontWeight:"600",
                          cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e"
                        }}>✓ Approve</button>
                        <button onClick={e => handleReject(r.id, e)} style={{
                          flex:1, padding:"6px", borderRadius:"7px", fontSize:"12px", fontWeight:"600",
                          cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e"
                        }}>✗ Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerts tab */}
          {tab === "alerts" && (
            <div>
              <div style={{ padding:"12px 16px 8px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:"12px", color:muted }}>{alerts.length} unread alert{alerts.length !== 1 ? "s" : ""}</div>
                {alerts.length > 0 && (
                  <button onClick={markAllAlertsRead} style={{ fontSize:"11px", color:"#3b82f6", background:"none", border:"none", cursor:"pointer" }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight:"300px", overflowY:"auto" }}>
                {alerts.length === 0 ? (
                  <div style={{ padding:"28px", textAlign:"center" }}>
                    <div style={{ fontSize:"24px", marginBottom:"8px" }}>✅</div>
                    <div style={{ fontSize:"13px", color:muted }}>No scheduler alerts</div>
                  </div>
                ) : alerts.map(a => (
                  <div key={a.id} style={{ padding:"12px 16px", borderBottom:"1px solid "+border, background:subtle }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1, marginRight:8 }}>
                        <div style={{ display:"flex", gap:"6px", alignItems:"center", marginBottom:"4px" }}>
                          <span style={{ background:"#f43f5e20", color:"#f43f5e", padding:"1px 7px", borderRadius:"10px", fontSize:"10px", fontWeight:"700" }}>
                            {a.alert_type === "scheduler_failure" ? "⚠ AUTO-SCHEDULE" : "INFO"}
                          </span>
                          <span style={{ fontSize:"10px", color:muted }}>{timeAgo(a.created_at)}</span>
                        </div>
                        {a.vm_name && <div style={{ fontSize:"12px", fontWeight:600, color:text, marginBottom:2 }}>{a.vm_name}</div>}
                        <div style={{ fontSize:"11px", color:muted, lineHeight:"1.4" }}>{a.message}</div>
                      </div>
                      <button onClick={() => markAlertRead(a.id)} style={{
                        background:"none", border:`1px solid ${border}`, borderRadius:6,
                        padding:"3px 7px", fontSize:"10px", color:muted, cursor:"pointer", flexShrink:0,
                      }}>✓</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
    </div>
  )
}
