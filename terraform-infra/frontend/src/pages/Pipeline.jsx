import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getPipeline } from "../api/api"

/* ─── stage definitions ───────────────────────────────────────────────── */
const STAGES = [
  {
    key:   "submitted",
    label: "Submitted",
    sub:   "Request created",
    icon:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    color: "#6366f1",
  },
  {
    key:   "approved",
    label: "Approved",
    sub:   "Admin approved",
    icon:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    color: "#3b82f6",
  },
  {
    key:   "generating",
    label: "Writing TF",
    sub:   "Generating config",
    icon:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    color: "#8b5cf6",
  },
  {
    key:   "init",
    label: "TF Init",
    sub:   "Downloading providers",
    icon:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    color: "#06b6d4",
  },
  {
    key:   "plan",
    label: "TF Plan",
    sub:   "Planning changes",
    icon:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
    color: "#f59e0b",
  },
  {
    key:   "apply",
    label: "TF Apply",
    sub:   "Provisioning AWS",
    icon:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    color: "#00d4aa",
  },
  {
    key:   "complete",
    label: "Complete",
    sub:   "Infrastructure ready",
    icon:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>,
    color: "#10b981",
  },
]

const RESOURCE_ICONS = {
  eks:      "⚙️", ec2: "🖥️", s3: "🪣", vpc: "🔒",
  iam_role: "🔑", keypair: "🗝️", rds: "🗄️",
}

/* ─── helpers ─────────────────────────────────────────────────────────── */
function stageStatusFromDB(dbStatus, pipelineStages) {
  // Returns per-STAGES key: 'done' | 'running' | 'failed' | 'pending'
  const map = {}

  // submitted is always done once we have a request
  map.submitted = "done"

  // approved once DB status moves past 'pending'
  map.approved = dbStatus === "pending" ? "pending" : "done"

  // generating / init / plan / apply come from tracker
  const ps = pipelineStages || {}
  map.generating = ps.generating?.status || (["generating","planning","provisioning","completed"].includes(dbStatus) ? "done" : "pending")
  map.init       = ps.init?.status       || (["planning","provisioning","completed"].includes(dbStatus) ? "done" : "pending")
  map.plan       = ps.plan?.status       || (["provisioning","completed"].includes(dbStatus) ? "done" : "pending")
  map.apply      = ps.apply?.status      || (dbStatus === "completed" ? "done" : "pending")

  // complete / failed
  if (dbStatus === "completed") {
    map.complete = "done"
  } else if (["failed","plan_failed","rejected"].includes(dbStatus)) {
    map.complete = "failed"
  } else {
    map.complete = "pending"
  }

  return map
}

function activeStageKey(stMap) {
  const order = STAGES.map(s => s.key)
  for (let i = order.length - 1; i >= 0; i--) {
    if (stMap[order[i]] === "running") return order[i]
  }
  return null
}

function formatDuration(sec) {
  if (!sec) return ""
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
}

function logLineColor(msg) {
  const m = msg.toLowerCase()
  if (m.includes("error") || m.includes("failed") || m.includes("exception")) return "#f87171"
  if (m.includes("complete") || m.includes("ok") || m.includes("✓") || m.includes("success")) return "#34d399"
  if (m.includes("plan:") || m.includes("to add") || m.includes("to change")) return "#60a5fa"
  if (m.includes("warning") || m.includes("warn")) return "#fbbf24"
  if (m.startsWith("=")) return "#a78bfa"
  if (m.includes("step")) return "#e2e8f0"
  return "#94a3b8"
}

/* ─── CSS string (injected once) ─────────────────────────────────────── */
const CSS = `
@keyframes pl-spin   { to { transform: rotate(360deg) } }
@keyframes pl-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.12)} }
@keyframes pl-glow   { 0%,100%{box-shadow:0 0 18px 4px var(--c,#00d4aa)} 50%{box-shadow:0 0 36px 10px var(--c,#00d4aa)} }
@keyframes pl-check  { from{stroke-dashoffset:40;opacity:0} to{stroke-dashoffset:0;opacity:1} }
@keyframes pl-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes pl-shake  { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
@keyframes pl-flow   { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
@keyframes pl-particle { 0%{transform:translateY(0) scale(1);opacity:.6} 100%{transform:translateY(-120px) scale(0);opacity:0} }
@keyframes pl-scanline { 0%{top:-10%} 100%{top:110%} }
@keyframes pl-logslide { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
@keyframes pl-progress { from{width:0} to{width:100%} }

.pl-stage-card { transition: transform .25s, box-shadow .25s; }
.pl-stage-card:hover { transform: translateY(-4px) scale(1.02) !important; }

.pl-log-line { animation: pl-logslide .18s ease both; }

.pl-spinner {
  width:52px; height:52px; border-radius:50%;
  border: 2.5px solid transparent;
  border-top-color: currentColor; border-right-color: currentColor;
  animation: pl-spin .9s linear infinite;
}
.pl-ring {
  position:absolute; inset:-8px; border-radius:50%;
  border: 1.5px dashed currentColor; opacity:.4;
  animation: pl-spin 3s linear infinite reverse;
}
.pl-ring2 {
  position:absolute; inset:-16px; border-radius:50%;
  border: 1px dotted currentColor; opacity:.2;
  animation: pl-spin 6s linear infinite;
}
`

/* ─── component ───────────────────────────────────────────────────────── */
export default function Pipeline() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const logRef       = useRef(null)
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [particles, setParticles] = useState([])

  /* generate background particles once */
  useEffect(() => {
    setParticles(
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left:  `${Math.random() * 100}%`,
        delay: `${Math.random() * 6}s`,
        dur:   `${4 + Math.random() * 4}s`,
        size:  `${2 + Math.random() * 3}px`,
        color: ["#00d4aa30","#3b82f630","#8b5cf630","#f59e0b30"][i % 4],
      }))
    )
  }, [])

  /* polling */
  const poll = useCallback(async () => {
    try {
      const r = await getPipeline(id)
      setData(r.data)
    } catch (e) {
      console.error("pipeline poll:", e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    poll()
    const iv = setInterval(poll, 900)
    return () => clearInterval(iv)
  }, [poll])

  /* auto-scroll log */
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [data?.pipeline?.logs?.length])

  /* ── derived state ───────────────────────────────────────────────── */
  const dbStatus     = data?.status || "pending"
  const pipeStages   = data?.pipeline?.stages || {}
  const logs         = data?.pipeline?.logs   || []
  const overallStatus= data?.pipeline?.overall_status || "running"
  const stMap        = stageStatusFromDB(dbStatus, pipeStages)
  const activeSt     = activeStageKey(stMap)
  const isFinalDone  = dbStatus === "completed"
  const isFinalFail  = ["failed","plan_failed","rejected"].includes(dbStatus)

  /* ── stage card renderer ─────────────────────────────────────────── */
  function StageCard({ stage, idx }) {
    const st    = stMap[stage.key] || "pending"
    const isCurr= stage.key === activeSt
    const color = st === "failed" ? "#f43f5e" : stage.color

    const glowShadow = isCurr
      ? `0 0 0 1px ${color}60, 0 0 24px 4px ${color}40, 0 8px 32px ${color}20`
      : st === "done"
        ? `0 0 0 1px ${color}40, 0 4px 16px ${color}15`
        : st === "failed"
          ? "0 0 0 1px #f43f5e60, 0 0 20px 4px #f43f5e30"
          : "0 2px 12px rgba(0,0,0,0.3)"

    const cardBg = isCurr
      ? `linear-gradient(135deg, ${color}18, ${color}08)`
      : st === "done"
        ? `linear-gradient(135deg, ${color}12, transparent)`
        : st === "failed"
          ? "linear-gradient(135deg,#f43f5e15,transparent)"
          : "rgba(15,23,42,0.6)"

    const borderColor = isCurr
      ? `${color}90`
      : st === "done" ? `${color}60`
      : st === "failed" ? "#f43f5e60"
      : "#1e293b"

    const dur = pipeStages[stage.key]?.duration
    const stageDone   = st === "done"
    const stageFailed = st === "failed"
    const stagePend   = st === "pending"

    return (
      <div className="pl-stage-card" style={{
        flex: "1 1 0",
        minWidth: "90px",
        maxWidth: "140px",
        background: cardBg,
        border: `1.5px solid ${borderColor}`,
        borderRadius: "16px",
        padding: "18px 12px 14px",
        position: "relative",
        boxShadow: glowShadow,
        animation: stageFailed ? "pl-shake .4s ease" : `pl-fadein .4s ease ${idx * 60}ms both`,
        opacity: stagePend && !isCurr ? 0.45 : 1,
        cursor: "default",
        overflow: "visible",
      }}>

        {/* animated glow bg for active */}
        {isCurr && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: "16px",
            background: `radial-gradient(ellipse at 50% 0%, ${color}25 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />
        )}

        {/* icon area */}
        <div style={{
          position: "relative", width: "48px", height: "48px",
          margin: "0 auto 12px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isCurr && <div className="pl-ring"  style={{ color }} />}
          {isCurr && <div className="pl-ring2" style={{ color }} />}

          {/* circle bg */}
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%",
            background: isCurr
              ? `radial-gradient(circle, ${color}30, ${color}10)`
              : stageDone ? `${color}20` : stageFailed ? "#f43f5e15" : "#1e293b",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1.5px solid ${stageFailed ? "#f43f5e50" : stageDone ? `${color}50` : "transparent"}`,
            animation: isCurr ? `pl-glow 2s ease-in-out infinite` : "none",
            "--c": color,
            position: "relative", zIndex: 1,
          }}>
            {isCurr ? (
              <div className="pl-spinner" style={{ color }} />
            ) : stageDone ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
                <polyline points="20 6 9 17 4 12"
                  style={{ strokeDasharray:40, strokeDashoffset:0, animation:"pl-check .4s ease" }} />
              </svg>
            ) : stageFailed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <div style={{ color: "#475569", opacity: 0.7 }}>{stage.icon}</div>
            )}
          </div>
        </div>

        {/* label */}
        <div style={{
          textAlign: "center",
          fontSize: "12px", fontWeight: "700",
          color: isCurr ? color : stageDone ? color : stageFailed ? "#f43f5e" : "#475569",
          letterSpacing: "0.03em",
          textShadow: isCurr ? `0 0 12px ${color}` : "none",
          marginBottom: "3px",
        }}>
          {stage.label}
        </div>

        {/* sub */}
        <div style={{ textAlign: "center", fontSize: "10px", color: "#334155", lineHeight: 1.3 }}>
          {stage.sub}
        </div>

        {/* duration badge */}
        {dur && (
          <div style={{
            position: "absolute", top: "-8px", right: "-6px",
            background: `${color}cc`, color: "#0a0f1e",
            fontSize: "9px", fontWeight: "700",
            padding: "2px 6px", borderRadius: "20px",
            boxShadow: `0 2px 8px ${color}60`,
          }}>
            {formatDuration(dur)}
          </div>
        )}

        {/* status dot */}
        <div style={{
          position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)",
          width: "5px", height: "5px", borderRadius: "50%",
          background: isCurr ? color : stageDone ? color : stageFailed ? "#f43f5e" : "#1e293b",
          animation: isCurr ? "pl-pulse 1.2s ease infinite" : "none",
          boxShadow: isCurr ? `0 0 8px ${color}` : "none",
        }} />
      </div>
    )
  }

  /* ── connector renderer ──────────────────────────────────────────── */
  function Connector({ fromKey, toKey }) {
    const fromDone = stMap[fromKey] === "done"
    const toActive = stMap[toKey]  === "running"
    const fromStage= STAGES.find(s => s.key === fromKey)
    const toStage  = STAGES.find(s => s.key === toKey)
    const color    = fromDone ? (fromStage?.color || "#00d4aa") : "#1e293b"

    return (
      <div style={{ flex: "0 0 20px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{
          height: "2px", width: "100%",
          background: fromDone
            ? `linear-gradient(90deg, ${fromStage?.color || "#00d4aa"}, ${toStage?.color || "#00d4aa"})`
            : "#1e293b",
          borderRadius: "2px",
          transition: "background .6s ease",
          position: "relative",
          overflow: "visible",
        }}>
          {/* animated chevron */}
          {fromDone && (
            <div style={{
              position: "absolute", right: "-6px", top: "50%", transform: "translateY(-50%)",
              width: 0, height: 0,
              borderTop: "5px solid transparent",
              borderBottom: "5px solid transparent",
              borderLeft: `7px solid ${toStage?.color || "#00d4aa"}`,
              filter: `drop-shadow(0 0 4px ${toStage?.color || "#00d4aa"})`,
            }} />
          )}
          {/* flow shimmer when active */}
          {toActive && (
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(90deg, transparent, ${toStage?.color || "#00d4aa"}80, transparent)`,
              backgroundSize: "200% 100%",
              animation: "pl-flow 1.2s linear infinite",
            }} />
          )}
        </div>
      </div>
    )
  }

  /* ── overall status badge ────────────────────────────────────────── */
  const badgeColor = isFinalDone ? "#10b981" : isFinalFail ? "#f43f5e" : "#a78bfa"
  const badgeText  = isFinalDone ? "COMPLETED" : isFinalFail ? "FAILED" : "RUNNING"
  const badgePulse = !isFinalDone && !isFinalFail

  /* ── overall progress pct ────────────────────────────────────────── */
  const doneCount = STAGES.filter(s => stMap[s.key] === "done").length
  const pct       = Math.round((doneCount / STAGES.length) * 100)

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#030712" }}>
        <div className="pl-spinner" style={{ color: "#00d4aa", width: "56px", height: "56px" }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#030712", color: "#e2e8f0", position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>

      {/* ── animated background particles ── */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: p.left, bottom: "10%",
          width: p.size, height: p.size, borderRadius: "50%",
          background: p.color,
          animation: `pl-particle ${p.dur} ${p.delay} ease-in infinite`,
          pointerEvents: "none",
        }} />
      ))}

      {/* ── subtle grid bg ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
      }} />

      <div style={{ position: "relative", zIndex: 1, padding: "28px 32px", maxWidth: "1280px", margin: "0 auto" }}>

        {/* ── header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", animation: "pl-fadein .4s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button onClick={() => navigate(-1)} style={{
              background: "rgba(255,255,255,.05)", border: "1px solid #1e293b",
              borderRadius: "10px", color: "#94a3b8", fontSize: "18px",
              width: "38px", height: "38px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>‹</button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "22px" }}>
                  {RESOURCE_ICONS[data?.resource_type] || "🔧"}
                </span>
                <h1 style={{ fontSize: "22px", fontWeight: "800", margin: 0, letterSpacing: "-0.5px", color: "#f1f5f9" }}>
                  {data?.resource_name || `Request #${id}`}
                </h1>
                {/* live badge */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  background: `${badgeColor}18`, border: `1px solid ${badgeColor}40`,
                  borderRadius: "20px", padding: "4px 12px",
                  fontSize: "10px", fontWeight: "700", color: badgeColor, letterSpacing: "0.1em",
                }}>
                  {badgePulse && <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: badgeColor, animation: "pl-pulse 1.2s ease infinite" }} />}
                  {badgeText}
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "#475569", marginTop: "5px" }}>
                {data?.resource_type?.toUpperCase()} · Region: {data?.region || "—"} · Approved by {data?.approved_by || "—"} · Request #{id}
              </div>
            </div>
          </div>

          {/* progress ring */}
          <div style={{ textAlign: "center" }}>
            <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="#1e293b" strokeWidth="5" />
              <circle cx="32" cy="32" r="26" fill="none"
                stroke={badgeColor} strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - pct / 100)}`}
                style={{ transition: "stroke-dashoffset 0.8s ease", filter: `drop-shadow(0 0 6px ${badgeColor})` }}
              />
            </svg>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "-4px" }}>{pct}%</div>
          </div>
        </div>

        {/* ── progress bar ── */}
        <div style={{ height: "3px", background: "#0f172a", borderRadius: "2px", marginBottom: "36px", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: `linear-gradient(90deg, #6366f1, #3b82f6, #00d4aa)`,
            borderRadius: "2px", transition: "width 0.8s ease",
            boxShadow: "0 0 12px #00d4aa80",
          }} />
        </div>

        {/* ── 3D pipeline card ── */}
        <div style={{
          perspective: "1200px",
          marginBottom: "32px",
          animation: "pl-fadein .5s ease .1s both",
        }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(15,23,42,.95), rgba(7,12,24,.98))",
            border: "1px solid #1e293b",
            borderRadius: "20px",
            padding: "32px 28px",
            boxShadow: "0 32px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05)",
            transform: "rotateX(2deg)",
            transformStyle: "preserve-3d",
            position: "relative",
            overflow: "hidden",
          }}>

            {/* top shimmer line */}
            <div style={{
              position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
              background: "linear-gradient(90deg, transparent, #00d4aa60, transparent)",
            }} />

            {/* scan line effect */}
            {!isFinalDone && !isFinalFail && (
              <div style={{
                position: "absolute", left: 0, right: 0, height: "60px",
                background: "linear-gradient(180deg,transparent,rgba(0,212,170,.04),transparent)",
                animation: "pl-scanline 4s linear infinite",
                pointerEvents: "none",
              }} />
            )}

            <div style={{ fontSize: "10px", fontWeight: "700", color: "#334155", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "24px" }}>
              Deployment Pipeline
            </div>

            {/* stages row */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {STAGES.map((stage, idx) => (
                <div key={stage.key} style={{ display: "contents" }}>
                  <StageCard stage={stage} idx={idx} />
                  {idx < STAGES.length - 1 && (
                    <Connector fromKey={stage.key} toKey={STAGES[idx + 1].key} />
                  )}
                </div>
              ))}
            </div>

            {/* bottom: current activity label */}
            <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "10px", minHeight: "22px" }}>
              {activeSt ? (
                <>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: STAGES.find(s => s.key === activeSt)?.color, animation: "pl-pulse 1s ease infinite" }} />
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Running:&nbsp;
                    <span style={{ color: STAGES.find(s => s.key === activeSt)?.color, fontWeight: "600" }}>
                      {STAGES.find(s => s.key === activeSt)?.label}
                    </span>
                    {" — "}{STAGES.find(s => s.key === activeSt)?.sub}
                  </span>
                  <div style={{ marginLeft: "auto", fontSize: "11px", color: "#334155" }}>
                    {!isFinalDone && !isFinalFail && "Live · polling 900ms"}
                  </div>
                </>
              ) : isFinalDone ? (
                <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "600" }}>
                  ✓ All stages complete — infrastructure provisioned successfully
                </span>
              ) : isFinalFail ? (
                <span style={{ fontSize: "12px", color: "#f43f5e", fontWeight: "600" }}>
                  ✗ Pipeline failed · {data?.reject_reason || "Check logs below"}
                </span>
              ) : (
                <span style={{ fontSize: "12px", color: "#475569" }}>Waiting for pipeline to start...</span>
              )}
            </div>
          </div>
        </div>

        {/* ── stage timing table ── */}
        {Object.values(pipeStages).some(s => s.status !== "pending") && (
          <div style={{
            background: "rgba(15,23,42,.6)", border: "1px solid #1e293b",
            borderRadius: "14px", padding: "20px 24px", marginBottom: "24px",
            animation: "pl-fadein .5s ease .2s both",
          }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#334155", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "14px" }}>
              Stage Timings
            </div>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {Object.entries(pipeStages).map(([key, s]) => {
                const stDef = STAGES.find(st => st.key === key)
                const c     = s.status === "done" ? stDef?.color : s.status === "failed" ? "#f43f5e" : "#334155"
                return (
                  <div key={key} style={{
                    background: "rgba(0,0,0,.3)", border: `1px solid ${s.status !== "pending" ? c + "40" : "#1e293b"}`,
                    borderRadius: "10px", padding: "10px 14px", minWidth: "120px",
                  }}>
                    <div style={{ fontSize: "10px", color: "#475569", fontWeight: "600", letterSpacing: "0.06em", textTransform: "uppercase" }}>{key}</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: c, marginTop: "3px" }}>
                      {s.status === "pending" ? "—" : s.status}
                    </div>
                    {s.duration && <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>{formatDuration(s.duration)}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── terminal log ── */}
        <div style={{
          background: "#020817",
          border: "1px solid #1e293b",
          borderRadius: "14px", overflow: "hidden",
          animation: "pl-fadein .5s ease .3s both",
          boxShadow: "0 16px 48px rgba(0,0,0,.5)",
        }}>
          {/* terminal header */}
          <div style={{
            padding: "12px 18px",
            background: "rgba(15,23,42,.8)",
            borderBottom: "1px solid #1e293b",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f43f5e" }} />
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
            <span style={{ marginLeft: "10px", fontSize: "11px", color: "#475569", fontFamily: "monospace" }}>
              terraform · req_{id} · {data?.resource_name}
            </span>
            {!isFinalDone && !isFinalFail && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#10b981", animation: "pl-pulse 1.2s ease infinite" }} />
                <span style={{ fontSize: "10px", color: "#10b981" }}>LIVE</span>
              </div>
            )}
            <span style={{ marginLeft: "auto", fontSize: "10px", color: "#334155" }}>{logs.length} lines</span>
          </div>

          {/* log output */}
          <div ref={logRef} style={{
            padding: "16px 20px",
            fontFamily: "'Courier New', 'Consolas', monospace",
            fontSize: "12px", lineHeight: "1.7",
            maxHeight: "380px", overflowY: "auto",
            scrollBehavior: "smooth",
          }}>
            {logs.length === 0 ? (
              <div style={{ color: "#334155" }}>Waiting for pipeline output...</div>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="pl-log-line" style={{
                  color: logLineColor(line.msg),
                  animationDelay: `${Math.min(i * 5, 200)}ms`,
                }}>
                  <span style={{ color: "#1e3a5f", userSelect: "none", marginRight: "12px" }}>
                    {new Date(line.t * 1000).toISOString().substr(11, 8)}
                  </span>
                  {line.msg}
                </div>
              ))
            )}
            {/* blinking cursor when live */}
            {!isFinalDone && !isFinalFail && (
              <span style={{ color: "#00d4aa", animation: "pl-pulse .8s step-end infinite" }}>█</span>
            )}
          </div>
        </div>

        {/* ── footer ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
          <button onClick={() => navigate("/approvals")} style={{
            padding: "9px 20px", borderRadius: "10px", fontSize: "13px",
            border: "1px solid #1e293b", background: "transparent", color: "#64748b", cursor: "pointer",
          }}>
            ← Approvals
          </button>
          <button onClick={poll} style={{
            padding: "9px 20px", borderRadius: "10px", fontSize: "13px",
            border: "none", background: "#0f172a", color: "#94a3b8", cursor: "pointer",
          }}>
            ↻ Refresh
          </button>
        </div>

      </div>
    </div>
  )
}
