import { useState, useEffect, useCallback, useRef } from "react"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"
import { getPipeline } from "../api/api"

/* ─── constants ──────────────────────────────────────────────────────── */
const STATUS_COLORS = {
  pending:      "#f59e0b",
  plan_ready:   "#3b82f6",
  plan_failed:  "#f43f5e",
  provisioning: "#a78bfa",
  completed:    "#00d4aa",
  failed:       "#f43f5e",
  rejected:     "#64748b",
  generating:   "#a78bfa",
  planning:     "#f59e0b",
}

const PIPELINE_STAGES = [
  { key:"submitted",  label:"Submitted",   sub:"Request created",       color:"#6366f1" },
  { key:"approved",   label:"Approved",    sub:"Admin approved",        color:"#3b82f6" },
  { key:"generating", label:"Write TF",    sub:"Generating config",     color:"#8b5cf6" },
  { key:"init",       label:"TF Init",     sub:"Downloading providers", color:"#06b6d4" },
  { key:"plan",       label:"TF Plan",     sub:"Planning changes",      color:"#f59e0b" },
  { key:"apply",      label:"TF Apply",    sub:"Provisioning AWS",      color:"#00d4aa" },
  { key:"complete",   label:"Complete",    sub:"Infrastructure ready",  color:"#10b981" },
]

const ACTIVE_DB = ["generating","planning","provisioning"]
const DONE_DB   = ["completed","failed","plan_failed"]

/* ─── helpers ────────────────────────────────────────────────────────── */
function timeAgo(iso) {
  if (!iso) return "--"
  const d = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (d < 1)    return "just now"
  if (d < 60)   return `${d}m ago`
  if (d < 1440) return `${Math.floor(d / 60)}h ago`
  return `${Math.floor(d / 1440)}d ago`
}

function stageMap(dbStatus, ps = {}) {
  const done = (s) => ps[s]?.status === "done"
    || (ps[s]?.status === undefined && {
      generating: ["planning","provisioning","completed"].includes(dbStatus),
      init:       ["provisioning","completed"].includes(dbStatus),
      plan:       ["completed"].includes(dbStatus),
      apply:      dbStatus === "completed",
    }[s])

  const running = (s) => ps[s]?.status === "running"
    || (ps[s]?.status === undefined && {
      generating: dbStatus === "generating",
      init:       false,
      plan:       dbStatus === "planning",
      apply:      dbStatus === "provisioning",
    }[s])

  const failed = (s) => ps[s]?.status === "failed"

  const resolve = (s) => {
    if (failed(s))  return "failed"
    if (done(s))    return "done"
    if (running(s)) return "running"
    return "pending"
  }

  return {
    submitted:  "done",
    approved:   dbStatus === "pending" ? "pending" : "done",
    generating: resolve("generating"),
    init:       resolve("init"),
    plan:       resolve("plan"),
    apply:      resolve("apply"),
    complete:   dbStatus === "completed" ? "done"
                : ["failed","plan_failed"].includes(dbStatus) ? "failed"
                : "pending",
  }
}

function logColor(msg) {
  const m = msg.toLowerCase()
  if (m.includes("error") || m.includes("failed") || m.includes("exception")) return "#f87171"
  if (m.includes("complete") || m.includes(" ok") || m.includes("✓"))         return "#34d399"
  if (m.includes("plan:") || m.includes("to add"))                             return "#60a5fa"
  if (m.startsWith("="))                                                        return "#a78bfa"
  return "#94a3b8"
}

function fmt(sec) {
  if (!sec) return ""
  return sec < 60 ? `${sec}s` : `${Math.floor(sec/60)}m ${Math.round(sec%60)}s`
}

/* ─── component ──────────────────────────────────────────────────────── */
export default function Approvals() {
  const { dark } = useTheme()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const codeBg  = dark ? "#020817" : "#f8fafc"
  const inp     = { padding:"8px 12px", border:"1px solid "+border, borderRadius:"8px", fontSize:"13px", width:"100%", background:surface, color:text }

  /* ── list state ──────────────────────────────────────────────────── */
  const [requests,   setRequests]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState("pending")
  const [selected,   setSelected]   = useState(null)   // pending req for approval
  const [tfPreview,  setTFPreview]  = useState("")
  const [planOutput, setPlanOut]    = useState("")
  const [activeTab,  setActiveTab]  = useState("details")
  const [note,       setNote]       = useState("")
  const [submitting, setSub]        = useState(false)
  const [success,    setSuccess]    = useState("")
  const [error,      setError]      = useState("")

  /* ── inline pipeline state ───────────────────────────────────────── */
  const [pipelineReqId,  setPipelineReqId]  = useState(null)
  const [pipelineData,   setPipelineData]   = useState(null)
  const [pipelineAlive,  setPipelineAlive]  = useState(false)
  const logRef = useRef(null)

  /* ── fetch requests list ─────────────────────────────────────────── */
  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/requests")
      setRequests(data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])
  useEffect(() => {
    const iv = setInterval(fetchRequests, 15000)
    return () => clearInterval(iv)
  }, [fetchRequests])

  /* ── pipeline polling ────────────────────────────────────────────── */
  useEffect(() => {
    if (!pipelineReqId) return
    let alive = true
    setPipelineAlive(true)

    const poll = async () => {
      try {
        const { data } = await getPipeline(pipelineReqId)
        if (!alive) return
        setPipelineData(data)
        if ([...DONE_DB, "rejected"].includes(data.status)) {
          alive = false
          setPipelineAlive(false)
          fetchRequests()
        }
      } catch { /* ignore */ }
    }

    poll()
    const iv = setInterval(poll, 900)
    return () => { alive = false; clearInterval(iv); setPipelineAlive(false) }
  }, [pipelineReqId, fetchRequests])

  /* ── auto-scroll log ─────────────────────────────────────────────── */
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [pipelineData?.pipeline?.logs?.length])

  /* ── actions ─────────────────────────────────────────────────────── */
  function pickRequest(req) {
    if ([...ACTIVE_DB, ...DONE_DB].includes(req.status)) {
      // show inline pipeline for this request
      setSelected(null)
      setPipelineData(null)
      setPipelineReqId(req.id)
    } else {
      // show detail/approval panel
      setPipelineReqId(null)
      setPipelineData(null)
      setSelected(req)
      setTFPreview("")
      setPlanOut("")
      setActiveTab("details")
      api.get(`/terraform/${req.id}/preview`)
        .then(r => setTFPreview(r.data.content || ""))
        .catch(() => setTFPreview("Preview not available"))
    }
  }

  async function handleApprove() {
    if (!selected) return
    setSub(true); setError("")
    const reqId   = selected.id
    const reqName = selected.resource_name
    try {
      await api.patch(`/requests/${reqId}/approve`, { note })
      setSuccess(`Pipeline started for "${reqName}"`)
      setNote("")
      setSelected(null)        // close detail panel
      setPipelineData(null)
      setPipelineReqId(reqId)  // open inline pipeline
      fetchRequests()
      setTimeout(() => setSuccess(""), 8000)
    } catch(e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setSub(false)
    }
  }

  async function handleReject() {
    if (!selected) return
    setSub(true); setError("")
    try {
      await api.patch(`/requests/${selected.id}/reject`, { note })
      setSuccess(`Request "${selected.resource_name}" rejected`)
      setSelected(null)
      setNote("")
      fetchRequests()
      setTimeout(() => setSuccess(""), 4000)
    } catch(e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setSub(false)
    }
  }

  /* ── derived ─────────────────────────────────────────────────────── */
  const filtered = requests.filter(r => filter === "all" || r.status === filter)
  const counts   = {
    pending:      requests.filter(r => r.status === "pending").length,
    plan_ready:   requests.filter(r => r.status === "plan_ready").length,
    provisioning: requests.filter(r => r.status === "provisioning").length,
    completed:    requests.filter(r => r.status === "completed").length,
    failed:       requests.filter(r => r.status === "failed").length,
  }

  /* ── inline pipeline renderer ────────────────────────────────────── */
  const pd    = pipelineData
  const ps    = pd?.pipeline?.stages || {}
  const logs  = pd?.pipeline?.logs   || []
  const dbSt  = pd?.status || "generating"
  const sMap  = stageMap(dbSt, ps)
  const isDone = DONE_DB.includes(dbSt)
  const doneCount = PIPELINE_STAGES.filter(s => sMap[s.key] === "done").length
  const pct   = Math.round((doneCount / PIPELINE_STAGES.length) * 100)

  function StageRow({ stage, isLast }) {
    const st    = sMap[stage.key] || "pending"
    const color = st === "failed" ? "#f43f5e" : stage.color
    const isDone= st === "done"
    const isRun = st === "running"
    const isFail= st === "failed"
    const isPend= st === "pending"
    const dur   = ps[stage.key]?.duration

    return (
      <div style={{ display:"flex", gap:"0" }}>
        {/* left: dot + connector */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"32px", flexShrink:0 }}>
          {/* dot */}
          <div style={{
            width:"28px", height:"28px", borderRadius:"50%",
            background: isDone ? color : isRun ? `${color}25` : isFail ? "#f43f5e20" : subtle,
            border: `2px solid ${isPend ? border : color}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0, transition:"all .3s",
          }}>
            {isDone && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={dark?"#0a0f1e":"#fff"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
            {isRun && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
                style={{ animation:"apr-spin 1.1s linear infinite" }}>
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            )}
            {isFail && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
            {isPend && (
              <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:border }} />
            )}
          </div>
          {/* connector */}
          {!isLast && (
            <div style={{
              width:"2px", flex:1, minHeight:"20px",
              background: isDone ? color : border,
              transition:"background .4s",
              margin:"3px 0",
            }} />
          )}
        </div>

        {/* right: label + status */}
        <div style={{ paddingLeft:"12px", paddingBottom: isLast ? "0" : "18px", flex:1, display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:"13px", fontWeight: isRun ? "700" : "500", color: isPend ? muted : isRun ? color : isFail ? "#f43f5e" : text, lineHeight:1 }}>
              {stage.label}
            </div>
            <div style={{ fontSize:"10px", color:muted, marginTop:"3px" }}>{stage.sub}</div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0, marginLeft:"8px" }}>
            {isDone  && <span style={{ fontSize:"11px", fontWeight:"600", color }}>done {dur ? `· ${fmt(dur)}` : ""}</span>}
            {isRun   && <span style={{ fontSize:"11px", fontWeight:"600", color }}>running...</span>}
            {isFail  && <span style={{ fontSize:"11px", fontWeight:"600", color:"#f43f5e" }}>failed</span>}
            {isPend  && <span style={{ fontSize:"11px", color:muted }}>pending</span>}
          </div>
        </div>
      </div>
    )
  }

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh" }}>
      <style>{`@keyframes apr-spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ marginBottom:"24px" }}>
        <h1 style={{ fontSize:"22px", fontWeight:"700", color:text, margin:0 }}>Approvals</h1>
        <p style={{ fontSize:"13px", color:muted, marginTop:"4px" }}>Review and approve Terraform resource requests</p>
      </div>

      {success && <div style={{ background:"#00d4aa12", border:"1px solid #00d4aa30", color:"#00d4aa", padding:"11px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{success}</div>}
      {error   && <div style={{ background:"#f43f5e12", border:"1px solid #f43f5e30", color:"#f43f5e", padding:"11px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{error}</div>}

      {/* stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"12px", marginBottom:"20px" }}>
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} onClick={() => setFilter(k)} style={{
            background:surface, borderRadius:"10px", padding:"14px", cursor:"pointer",
            border:"1px solid "+(filter===k ? (STATUS_COLORS[k]+"60") : border),
            borderLeft:"3px solid "+(STATUS_COLORS[k]||"#64748b"),
          }}>
            <div style={{ fontSize:"10px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{k.replace("_"," ")}</div>
            <div style={{ fontSize:"22px", fontWeight:"700", color:STATUS_COLORS[k]||text, marginTop:"4px" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* filter tabs */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"16px", flexWrap:"wrap" }}>
        {["all","pending","plan_ready","provisioning","completed","failed","rejected"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"6px 14px", borderRadius:"8px", fontSize:"12px", cursor:"pointer",
            border:"1px solid "+(filter===f?"#3b82f640":border),
            background:filter===f?"#3b82f615":surface,
            color:filter===f?"#3b82f6":muted, fontWeight:filter===f?"600":"400",
          }}>
            {f.replace("_"," ")}
          </button>
        ))}
      </div>

      {/* main grid */}
      <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:"16px", alignItems:"start" }}>

        {/* ── left: request list ── */}
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden" }}>
          <div style={{ padding:"13px 16px", borderBottom:"1px solid "+border, fontSize:"13px", fontWeight:"600", color:text }}>
            Requests ({filtered.length})
          </div>
          {loading ? (
            <div style={{ padding:"32px", textAlign:"center", color:muted, fontSize:"13px" }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center", color:muted, fontSize:"13px" }}>No requests</div>
          ) : (
            <div style={{ maxHeight:"620px", overflowY:"auto" }}>
              {filtered.map(req => {
                const sc        = STATUS_COLORS[req.status] || "#64748b"
                const isActive  = pipelineReqId === req.id || selected?.id === req.id
                const isRunning = ACTIVE_DB.includes(req.status)
                return (
                  <div key={req.id} onClick={() => pickRequest(req)} style={{
                    padding:"13px 16px", borderBottom:"1px solid "+border,
                    cursor:"pointer",
                    background: isActive ? (dark ? sc+"12" : sc+"08") : "transparent",
                    borderLeft: isActive ? `3px solid ${sc}` : "3px solid transparent",
                    transition:"background .15s",
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"5px" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"13px", fontWeight:"600", color:text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {req.resource_name}
                        </div>
                        <div style={{ fontSize:"11px", color:muted, marginTop:"2px" }}>
                          {req.resource_type?.toUpperCase()} · {req.region} · by {req.username}
                        </div>
                      </div>
                      <span style={{ background:sc+"20", color:sc, padding:"2px 8px", borderRadius:"10px", fontSize:"10px", fontWeight:"600", whiteSpace:"nowrap", marginLeft:"8px" }}>
                        {req.status}
                      </span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:"10px", color:muted }}>
                      <span>{timeAgo(req.created_at)}</span>
                      {/* indicator for active pipeline */}
                      {isRunning && (
                        <span style={{ display:"flex", alignItems:"center", gap:"4px", color:sc, fontWeight:"600" }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                            style={{ animation:"apr-spin 1.1s linear infinite" }}>
                            <path d="M21 12a9 9 0 11-6.219-8.56"/>
                          </svg>
                          running
                        </span>
                      )}
                      {[...DONE_DB].includes(req.status) && (
                        <span style={{ color:sc, fontWeight:"600" }}>
                          {req.status === "completed" ? "✓ done" : "✗ failed"}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── right panel ── */}
        {pipelineReqId ? (

          /* ══ INLINE PIPELINE ══════════════════════════════════════════ */
          <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden" }}>

            {/* header */}
            <div style={{ padding:"16px 20px", borderBottom:"1px solid "+border, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <span style={{ fontSize:"15px", fontWeight:"700", color:text }}>
                    {pd?.resource_name || `Request #${pipelineReqId}`}
                  </span>
                  {/* status chip */}
                  <span style={{
                    padding:"3px 10px", borderRadius:"20px", fontSize:"10px", fontWeight:"700",
                    background: isDone
                      ? (dbSt === "completed" ? "#00d4aa20" : "#f43f5e20")
                      : "#a78bfa20",
                    color: isDone
                      ? (dbSt === "completed" ? "#00d4aa" : "#f43f5e")
                      : "#a78bfa",
                    display:"flex", alignItems:"center", gap:"5px",
                  }}>
                    {!isDone && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        style={{ animation:"apr-spin 1.1s linear infinite" }}>
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                    )}
                    {isDone ? (dbSt === "completed" ? "COMPLETED" : "FAILED") : "RUNNING"}
                  </span>
                </div>
                <div style={{ fontSize:"11px", color:muted, marginTop:"4px" }}>
                  {pd?.resource_type?.toUpperCase()} · {pd?.region} · Approved by {pd?.approved_by || "—"}
                </div>
              </div>
              <button onClick={() => { setPipelineReqId(null); setPipelineData(null) }} style={{
                background:"none", border:"none", color:muted, cursor:"pointer", fontSize:"18px", padding:"4px 8px",
              }}>✕</button>
            </div>

            {/* progress bar */}
            <div style={{ height:"3px", background:subtle }}>
              <div style={{
                height:"100%", width:`${pct}%`,
                background:"linear-gradient(90deg,#6366f1,#3b82f6,#00d4aa)",
                transition:"width .6s ease",
              }} />
            </div>

            <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:"0" }}>

              {/* stage timeline */}
              <div style={{ marginBottom:"20px" }}>
                {PIPELINE_STAGES.map((stage, idx) => (
                  <StageRow key={stage.key} stage={stage} isLast={idx === PIPELINE_STAGES.length - 1} />
                ))}
              </div>

              {/* final message */}
              {isDone && (
                <div style={{
                  padding:"12px 16px", borderRadius:"10px", marginBottom:"16px",
                  background: dbSt === "completed" ? "#00d4aa12" : "#f43f5e12",
                  border:"1px solid " + (dbSt === "completed" ? "#00d4aa30" : "#f43f5e30"),
                }}>
                  <div style={{ fontSize:"13px", fontWeight:"700", color: dbSt === "completed" ? "#00d4aa" : "#f43f5e", marginBottom:"4px" }}>
                    {dbSt === "completed" ? "✓ Infrastructure provisioned successfully" : "✗ Pipeline failed"}
                  </div>
                  {pd?.instance_id && (
                    <div style={{ fontSize:"12px", color:muted }}>Resource ID: <code style={{ color:"#00d4aa" }}>{pd.instance_id}</code></div>
                  )}
                  {dbSt !== "completed" && pd?.reject_reason && (
                    <div style={{ fontSize:"12px", color:muted }}>{pd.reject_reason}</div>
                  )}
                </div>
              )}

              {/* terminal log */}
              {logs.length > 0 && (
                <div style={{ background:codeBg, border:"1px solid "+border, borderRadius:"10px", overflow:"hidden" }}>
                  {/* terminal bar */}
                  <div style={{ padding:"9px 14px", borderBottom:"1px solid "+border, display:"flex", alignItems:"center", gap:"6px" }}>
                    <div style={{ width:"9px", height:"9px", borderRadius:"50%", background:"#f43f5e" }} />
                    <div style={{ width:"9px", height:"9px", borderRadius:"50%", background:"#f59e0b" }} />
                    <div style={{ width:"9px", height:"9px", borderRadius:"50%", background:"#10b981" }} />
                    <span style={{ marginLeft:"8px", fontSize:"10px", color:muted, fontFamily:"monospace" }}>
                      terraform · req_{pipelineReqId}
                    </span>
                    {pipelineAlive && (
                      <span style={{ marginLeft:"auto", fontSize:"10px", color:"#10b981", display:"flex", alignItems:"center", gap:"4px" }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                          style={{ animation:"apr-spin 1.1s linear infinite" }}>
                          <path d="M21 12a9 9 0 11-6.219-8.56"/>
                        </svg>
                        live
                      </span>
                    )}
                    <span style={{ fontSize:"10px", color:muted, marginLeft: pipelineAlive ? "8px" : "auto" }}>{logs.length} lines</span>
                  </div>
                  {/* log output */}
                  <div ref={logRef} style={{
                    padding:"12px 16px", maxHeight:"240px", overflowY:"auto",
                    fontFamily:"'Courier New',monospace", fontSize:"11px", lineHeight:"1.8",
                  }}>
                    {logs.map((line, i) => (
                      <div key={i} style={{ color: logColor(line.msg) }}>
                        <span style={{ color:"#1e3a5f", userSelect:"none", marginRight:"10px" }}>
                          {new Date(line.t * 1000).toISOString().substr(11, 8)}
                        </span>
                        {line.msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

        ) : selected ? (

          /* ══ DETAIL / APPROVAL PANEL ══════════════════════════════════ */
          <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:"15px", fontWeight:"700", color:text }}>{selected.resource_name}</div>
                <div style={{ fontSize:"11px", color:muted, marginTop:"3px" }}>
                  {selected.resource_type?.toUpperCase()} · {selected.region} · by {selected.username} · {timeAgo(selected.created_at)}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", color:muted, cursor:"pointer", fontSize:"18px", padding:"4px 8px" }}>✕</button>
            </div>

            {/* tabs */}
            <div style={{ padding:"0 20px", borderBottom:"1px solid "+border, display:"flex", gap:"4px" }}>
              {[["details","Details"],["tf","TF Config"],["plan","Plan Output"]].map(([id, label]) => (
                <button key={id} onClick={() => setActiveTab(id)} style={{
                  padding:"9px 14px", border:"none", fontSize:"12px", cursor:"pointer",
                  background:"transparent", color:activeTab===id?"#3b82f6":muted,
                  fontWeight:activeTab===id?"700":"400",
                  borderBottom:`2px solid ${activeTab===id?"#3b82f6":"transparent"}`,
                }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ padding:"18px 20px", maxHeight:"480px", overflowY:"auto" }}>

              {activeTab === "details" && (
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"16px" }}>
                    {[
                      ["Request ID",    `#${selected.id}`],
                      ["Status",        selected.status],
                      ["Resource Type", selected.resource_type],
                      ["Region",        selected.region],
                      ["Project",       selected.payload?.tags?.project || "--"],
                      ["Owner",         selected.payload?.tags?.owner || "--"],
                      ["Environment",   selected.payload?.tags?.environment || "--"],
                      ["Instance ID",   selected.instance_id || "—"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background:subtle, borderRadius:"8px", padding:"9px 12px" }}>
                        <div style={{ fontSize:"10px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"3px" }}>{k}</div>
                        <div style={{ fontSize:"12px", fontWeight:"600", color:text, wordBreak:"break-all" }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* payload preview */}
                  <div style={{ background:subtle, borderRadius:"8px", padding:"12px" }}>
                    <div style={{ fontSize:"10px", fontWeight:"600", color:muted, marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.05em" }}>Request Payload</div>
                    <pre style={{ margin:0, fontSize:"11px", fontFamily:"monospace", color:muted, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                      {JSON.stringify(selected.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === "tf" && (
                <pre style={{ background:codeBg, border:"1px solid "+border, borderRadius:"8px", padding:"14px", fontSize:"11px", color:"#00d4aa", fontFamily:"monospace", overflowX:"auto", maxHeight:"380px", overflowY:"auto", margin:0, lineHeight:"1.6", whiteSpace:"pre-wrap" }}>
                  {tfPreview || "Loading..."}
                </pre>
              )}

              {activeTab === "plan" && (
                planOutput
                  ? <pre style={{ background:codeBg, border:"1px solid "+border, borderRadius:"8px", padding:"14px", fontSize:"11px", color:text, fontFamily:"monospace", overflowX:"auto", maxHeight:"380px", overflowY:"auto", margin:0, lineHeight:"1.6", whiteSpace:"pre-wrap" }}>{planOutput}</pre>
                  : <div style={{ padding:"40px", textAlign:"center", color:muted, fontSize:"13px" }}>No plan output yet</div>
              )}
            </div>

            {/* approve / reject buttons */}
            {["pending","plan_ready","plan_failed","failed"].includes(selected.status) && (
              <div style={{ padding:"16px 20px", borderTop:"1px solid "+border, background:subtle }}>
                <input style={{ ...inp, marginBottom:"10px" }} placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
                <div style={{ display:"flex", gap:"8px" }}>
                  <button onClick={handleApprove} disabled={submitting} style={{
                    flex:1, padding:"11px", borderRadius:"8px", fontSize:"13px", fontWeight:"700",
                    cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e",
                    opacity: submitting ? 0.7 : 1, transition:"opacity .2s",
                  }}>
                    {submitting ? "Starting..." : "✓ Approve & Apply"}
                  </button>
                  <button onClick={handleReject} disabled={submitting} style={{
                    padding:"11px 18px", borderRadius:"8px", fontSize:"13px", fontWeight:"600",
                    cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e12", color:"#f43f5e",
                    opacity: submitting ? 0.7 : 1,
                  }}>
                    Reject
                  </button>
                </div>
                <div style={{ fontSize:"11px", color:muted, marginTop:"8px", textAlign:"center" }}>
                  Approve triggers: Write TF → Init → Plan → Apply — pipeline shows live on this page
                </div>
              </div>
            )}
          </div>

        ) : (

          /* ══ EMPTY STATE ══════════════════════════════════════════════ */
          <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", display:"flex", alignItems:"center", justifyContent:"center", minHeight:"420px" }}>
            <div style={{ textAlign:"center", color:muted }}>
              <div style={{ fontSize:"40px", marginBottom:"14px" }}>📋</div>
              <div style={{ fontSize:"14px", fontWeight:"600", color:text, marginBottom:"6px" }}>Select a request</div>
              <div style={{ fontSize:"12px" }}>Pending requests show the approval panel</div>
              <div style={{ fontSize:"12px", marginTop:"2px" }}>Running or finished requests show the live pipeline</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
