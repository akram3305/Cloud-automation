import { createContext, useContext, useState, useCallback, useRef } from "react"

const ToastCtx = createContext(null)

export function useToast() {
  return useContext(ToastCtx)
}

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4m0 4h.01" />
    </svg>
  ),
  loading: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation:"toast-spin 0.8s linear infinite" }}>
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0" />
    </svg>
  ),
}

const COLORS = {
  success: { bg:"rgba(0,212,170,0.12)", border:"rgba(0,212,170,0.3)", icon:"#00d4aa", bar:"#00d4aa" },
  error:   { bg:"rgba(244,63,94,0.12)", border:"rgba(244,63,94,0.3)",  icon:"#f43f5e", bar:"#f43f5e" },
  info:    { bg:"rgba(59,130,246,0.12)", border:"rgba(59,130,246,0.3)", icon:"#3b82f6", bar:"#3b82f6" },
  warning: { bg:"rgba(245,158,11,0.12)", border:"rgba(245,158,11,0.3)", icon:"#f59e0b", bar:"#f59e0b" },
  loading: { bg:"rgba(167,139,250,0.12)", border:"rgba(167,139,250,0.3)", icon:"#a78bfa", bar:"#a78bfa" },
}

let _uid = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts(p => p.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 320)
    if (timers.current[id]) clearTimeout(timers.current[id])
  }, [])

  const toast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++_uid
    setToasts(p => [...p, { id, message, type, exiting: false }])
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  // Convenience helpers
  toast.success = (msg, dur) => toast(msg, "success", dur)
  toast.error   = (msg, dur) => toast(msg, "error",   dur)
  toast.info    = (msg, dur) => toast(msg, "info",    dur)
  toast.warning = (msg, dur) => toast(msg, "warning", dur)
  toast.loading = (msg)      => toast(msg, "loading", 0)
  toast.dismiss = dismiss

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastCtx.Provider>
  )
}

function ToastContainer({ toasts, dismiss }) {
  return (
    <div style={{
      position:"fixed", top:20, right:20, zIndex:99999,
      display:"flex", flexDirection:"column", gap:8,
      pointerEvents:"none",
    }}>
      <style>{`
        @keyframes toast-in  { from{opacity:0;transform:translateX(120%)} to{opacity:1;transform:translateX(0)} }
        @keyframes toast-out { from{opacity:1;transform:translateX(0)}    to{opacity:0;transform:translateX(120%)} }
        @keyframes toast-spin{ to{transform:rotate(360deg)} }
        @keyframes toast-bar { from{width:100%} to{width:0%} }
        .toast-item { pointer-events:all; }
        .toast-item:hover .toast-close { opacity:1 !important; }
      `}</style>
      {toasts.map(t => <Toast key={t.id} toast={t} dismiss={dismiss} />)}
    </div>
  )
}

function Toast({ toast: t, dismiss }) {
  const c = COLORS[t.type] || COLORS.info
  return (
    <div
      className="toast-item"
      style={{
        animation: t.exiting
          ? "toast-out 0.32s cubic-bezier(0.4,0,1,1) forwards"
          : "toast-in 0.36s cubic-bezier(0,0,0.2,1.4) both",
        minWidth: 280, maxWidth: 380,
        background:"rgba(10,15,30,0.92)",
        border:`1px solid ${c.border}`,
        borderRadius:14,
        backdropFilter:"blur(12px)",
        boxShadow:`0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${c.border}`,
        overflow:"hidden",
        position:"relative",
      }}
    >
      {/* Content row */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"13px 14px 14px" }}>
        <div style={{
          width:28, height:28, borderRadius:8, flexShrink:0,
          background:c.bg, border:`1px solid ${c.border}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          color:c.icon,
        }}>
          {ICONS[t.type]}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:500, color:"#e2e8f0", lineHeight:1.45 }}>
            {t.message}
          </div>
        </div>
        <button
          className="toast-close"
          onClick={() => dismiss(t.id)}
          style={{
            background:"none", border:"none", cursor:"pointer",
            color:"#64748b", padding:2, flexShrink:0,
            opacity:0, transition:"opacity 0.15s",
            display:"flex", alignItems:"center",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Progress bar (only for timed toasts) */}
      {t.type !== "loading" && (
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:2, background:"rgba(255,255,255,0.06)" }}>
          <div style={{
            height:"100%", background:c.bar,
            animation:"toast-bar 4s linear forwards",
            boxShadow:`0 0 6px ${c.bar}`,
          }} />
        </div>
      )}
    </div>
  )
}
