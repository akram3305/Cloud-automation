import { useState, useEffect, useRef } from "react"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"

export default function NotificationBell() {
  const { dark } = useTheme()
  const [open, setOpen]         = useState(false)
  const [requests, setRequests] = useState([])
  const [seen, setSeen]         = useState(() => {
    try { return JSON.parse(localStorage.getItem("seen_requests") || "[]") }
    catch { return [] }
  })
  const ref = useRef(null)

  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"

  async function fetchPending() {
    try {
      const { data } = await api.get("/requests")
      const pending = data.filter(r => r.status === "pending")
      setRequests(pending)
    } catch(e) {}
  }

  useEffect(() => {
    fetchPending()
    const interval = setInterval(fetchPending, 15000)
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
  const count  = unseen.length

  function markAllSeen() {
    const ids = [...seen, ...requests.map(r => r.id)]
    setSeen(ids)
    localStorage.setItem("seen_requests", JSON.stringify(ids))
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
      {/* Bell button — fixed: removed duplicate background:"none", kept only the ternary */}
      <button onClick={handleOpen} style={{
        position:"relative", border:"none", cursor:"pointer",
        padding:"8px", borderRadius:"10px",
        background: open ? (dark ? "#1e293b" : "#f1f5f9") : "transparent",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={count>0?"#f59e0b":muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {count > 0 && (
          <div style={{
            position:"absolute", top:"4px", right:"4px",
            width:"16px", height:"16px", borderRadius:"50%",
            background:"#f43f5e", color:"#fff",
            fontSize:"10px", fontWeight:"700",
            display:"flex", alignItems:"center", justifyContent:"center",
            animation:"pulse 2s infinite"
          }}>{count > 9 ? "9+" : count}</div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:"fixed", top:"70px", left:"230px",
          width:"340px", background:surface,
          border:"1px solid "+border, borderRadius:"14px",
          boxShadow:"0 8px 32px rgba(0,0,0,0.18)",
          zIndex:9999, overflow:"hidden",
        }}>
          {/* Header */}
          <div style={{ padding:"14px 16px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:"13px", fontWeight:"600", color:text }}>Pending Approvals</div>
              <div style={{ fontSize:"11px", color:muted, marginTop:"1px" }}>{requests.length} request{requests.length!==1?"s":""} waiting</div>
            </div>
            {requests.length > 0 && (
              <a href="/approvals" style={{ fontSize:"11px", color:"#3b82f6", textDecoration:"none" }}>View all</a>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight:"320px", overflowY:"auto" }}>
            {requests.length === 0 ? (
              <div style={{ padding:"28px", textAlign:"center" }}>
                <div style={{ fontSize:"24px", marginBottom:"8px" }}>✓</div>
                <div style={{ fontSize:"13px", color:muted }}>No pending approvals</div>
              </div>
            ) : requests.map(r => (
              <div key={r.id} style={{ padding:"12px 16px", borderBottom:"1px solid "+border, background:subtle }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
                      <span style={{ background:"#f59e0b20", color:"#f59e0b", padding:"1px 7px", borderRadius:"10px", fontSize:"10px", fontWeight:"600" }}>PENDING</span>
                      <span style={{ fontSize:"10px", color:muted }}>{timeAgo(r.created_at)}</span>
                    </div>
                    <div style={{ fontSize:"13px", fontWeight:"600", color:text }}>{r.resource_name}</div>
                    <div style={{ fontSize:"11px", color:muted, marginTop:"1px" }}>
                      {r.resource_type?.toUpperCase()} · {r.instance_type} · {r.region} · by {r.username}
                    </div>
                    {r.key_name  && <div style={{ fontSize:"10px", color:"#00d4aa", marginTop:"2px" }}>Key: {r.key_name}</div>}
                    {r.subnet_id && <div style={{ fontSize:"10px", color:"#3b82f6", marginTop:"1px" }}>Subnet: {r.subnet_id}</div>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:"6px" }}>
                  <button onClick={e=>handleApprove(r.id,e)} style={{
                    flex:1, padding:"6px", borderRadius:"7px", fontSize:"12px", fontWeight:"600",
                    cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e"
                  }}>✓ Approve</button>
                  <button onClick={e=>handleReject(r.id,e)} style={{
                    flex:1, padding:"6px", borderRadius:"7px", fontSize:"12px", fontWeight:"600",
                    cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e"
                  }}>✗ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
    </div>
  )
}