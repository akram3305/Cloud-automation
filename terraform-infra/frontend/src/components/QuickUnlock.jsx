/**
 * QuickUnlock — a privacy overlay for sensitive resource details.
 *
 * Usage:
 *   <QuickUnlock label="Connection Details" dark={dark}>
 *     <SensitiveContent />
 *   </QuickUnlock>
 *
 * The content stays blurred behind a frosted overlay until the user clicks the
 * unlock button. Once unlocked, state is kept for the lifetime of the component
 * (page navigation resets it — no persistent storage of the unlock state).
 */
import { useState, useEffect } from "react"

export default function QuickUnlock({ children, label = "Sensitive Details", dark = true, autoLockSeconds = 0 }) {
  const [unlocked, setUnlocked] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [unlocking, setUnlocking] = useState(false)

  // Auto-relock after N seconds if configured
  useEffect(() => {
    if (!unlocked || autoLockSeconds <= 0) return
    setCountdown(autoLockSeconds)
    const tick = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) { clearInterval(tick); setUnlocked(false); return 0 }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [unlocked, autoLockSeconds])

  function handleUnlock() {
    if (unlocking) return
    setUnlocking(true)
    // brief animation before revealing
    setTimeout(() => { setUnlocked(true); setUnlocking(false) }, 420)
  }

  const overlayBg = dark
    ? "rgba(7,12,24,0.82)"
    : "rgba(240,244,248,0.82)"
  const borderColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"

  return (
    <div style={{ position:"relative" }}>
      <style>{`
        @keyframes qu-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes qu-ring   { 0%{transform:scale(0.8);opacity:0.7} 100%{transform:scale(1.8);opacity:0} }
        @keyframes qu-reveal { from{opacity:0;filter:blur(8px)} to{opacity:1;filter:blur(0)} }
        @keyframes qu-spin   { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── Actual content (always rendered, conditionally blurred) ── */}
      <div style={{
        filter: unlocked ? "none" : "blur(6px)",
        userSelect: unlocked ? "auto" : "none",
        pointerEvents: unlocked ? "auto" : "none",
        transition:"filter 0.4s ease",
        animation: unlocked ? "qu-reveal 0.45s ease both" : "none",
      }}>
        {children}
      </div>

      {/* ── Lock overlay ── */}
      {!unlocked && (
        <div style={{
          position:"absolute", inset:0,
          background:overlayBg,
          backdropFilter:"blur(2px)",
          borderRadius:12,
          border:`1px solid ${borderColor}`,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          gap:16, zIndex:10,
        }}>
          {/* Animated lock icon with ring */}
          <div style={{ position:"relative", width:56, height:56 }}>
            {/* Pulsing ring */}
            {!unlocking && (
              <div style={{
                position:"absolute", inset:-6, borderRadius:"50%",
                border:"2px solid rgba(0,212,170,0.3)",
                animation:"qu-ring 1.8s ease-out infinite",
              }} />
            )}
            {/* Lock circle */}
            <div style={{
              width:56, height:56, borderRadius:"50%",
              background: unlocking
                ? "linear-gradient(135deg,#00d4aa,#0ea5e9)"
                : dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
              border:"1.5px solid rgba(0,212,170,0.4)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow: unlocking ? "0 0 24px rgba(0,212,170,0.4)" : "0 0 12px rgba(0,212,170,0.15)",
              transition:"all 0.3s ease",
              animation: !unlocking ? "qu-pulse 2.4s ease-in-out infinite" : "none",
            }}>
              {unlocking ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation:"qu-spin 0.6s linear infinite" }}>
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              )}
            </div>
          </div>

          {/* Label */}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:13, fontWeight:600, color: dark ? "#e2e8f0" : "#1e293b", marginBottom:4 }}>
              {label}
            </div>
            <div style={{ fontSize:11, color: dark ? "#64748b" : "#94a3b8" }}>
              {unlocking ? "Unlocking…" : "Click to reveal"}
            </div>
          </div>

          {/* Unlock button */}
          <button
            onClick={handleUnlock}
            disabled={unlocking}
            style={{
              display:"flex", alignItems:"center", gap:8,
              padding:"9px 20px", borderRadius:10,
              background: unlocking
                ? "rgba(0,212,170,0.2)"
                : "linear-gradient(90deg,rgba(0,212,170,0.2),rgba(14,165,233,0.15))",
              border:"1px solid rgba(0,212,170,0.35)",
              color:"#00d4aa", fontSize:13, fontWeight:600,
              cursor: unlocking ? "default" : "pointer",
              transition:"all 0.2s ease",
              boxShadow:"0 0 20px rgba(0,212,170,0.15)",
            }}
            onMouseEnter={e => { if (!unlocking) { e.currentTarget.style.boxShadow="0 0 28px rgba(0,212,170,0.3)"; e.currentTarget.style.transform="translateY(-1px)" }}}
            onMouseLeave={e => { e.currentTarget.style.boxShadow="0 0 20px rgba(0,212,170,0.15)"; e.currentTarget.style.transform="translateY(0)" }}
          >
            {!unlocking && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 019.9-1"/>
              </svg>
            )}
            {unlocking ? "Unlocking…" : "Quick Unlock"}
          </button>
        </div>
      )}

      {/* ── Re-lock button when unlocked ── */}
      {unlocked && (
        <div style={{
          position:"absolute", top:8, right:8, zIndex:5,
          display:"flex", alignItems:"center", gap:6,
        }}>
          {autoLockSeconds > 0 && countdown > 0 && (
            <span style={{ fontSize:10, color:"#f59e0b", fontVariantNumeric:"tabular-nums" }}>
              🔓 auto-lock in {countdown}s
            </span>
          )}
          <button
            onClick={() => setUnlocked(false)}
            title="Lock again"
            style={{
              display:"flex", alignItems:"center", gap:5,
              padding:"4px 9px", borderRadius:7, fontSize:11, fontWeight:600,
              background:"rgba(244,63,94,0.1)", border:"1px solid rgba(244,63,94,0.25)",
              color:"#f43f5e", cursor:"pointer", transition:"all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(244,63,94,0.2)" }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(244,63,94,0.1)" }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            Lock
          </button>
        </div>
      )}
    </div>
  )
}
