import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"

const STORAGE_KEY = "aionos_pinned"

// ── Cloud badge colours ───────────────────────────────────────────────────────
const CLOUD_META = {
  aws:   { label: "AWS",   color: "#FF9900", bg: "rgba(255,153,0,0.12)"  },
  gcp:   { label: "GCP",   color: "#4285F4", bg: "rgba(66,133,244,0.12)" },
  azure: { label: "Azure", color: "#0078D4", bg: "rgba(0,120,212,0.12)"  },
}

const STATUS_DOT = {
  running:     "#22c55e",
  RUNNING:     "#22c55e",
  stopped:     "#f59e0b",
  STOPPED:     "#f59e0b",
  deallocated: "#64748b",
  terminated:  "#64748b",
  TERMINATED:  "#64748b",
  pending:     "#3b82f6",
  approved:    "#22c55e",
  rejected:    "#ef4444",
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function usePinnedResources() {
  const [pins, setPins] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") } catch { return [] }
  })

  const save = (next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setPins(next)
  }

  const pin = useCallback((resource) => {
    setPins(prev => {
      const next = [resource, ...prev.filter(p => p.id !== resource.id)]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const unpin = useCallback((id) => {
    setPins(prev => {
      const next = prev.filter(p => p.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isPinned = useCallback((id) => pins.some(p => p.id === id), [pins])
  const toggle   = useCallback((resource) => {
    isPinned(resource.id) ? unpin(resource.id) : pin(resource)
  }, [isPinned, pin, unpin])

  return { pins, pin, unpin, isPinned, toggle }
}

// ── PinButton ─────────────────────────────────────────────────────────────────
export function PinButton({ resource, dark }) {
  const { isPinned, toggle } = usePinnedResources()
  const pinned = isPinned(resource.id)

  return (
    <button
      onClick={e => { e.stopPropagation(); toggle(resource) }}
      title={pinned ? "Remove from My Resources" : "Pin to My Resources"}
      style={{
        padding: "4px 8px", borderRadius: 6, border: "none", cursor: "pointer",
        background: pinned ? "rgba(251,191,36,0.15)" : "transparent",
        color: pinned ? "#fbbf24" : dark ? "#475569" : "#94a3b8",
        fontSize: 14, lineHeight: 1, transition: "all 0.15s",
      }}
    >
      {pinned ? "★" : "☆"}
    </button>
  )
}

// ── Dashboard widget ──────────────────────────────────────────────────────────
export default function PinnedResources({ dark }) {
  const navigate = useNavigate()
  const { pins, unpin } = usePinnedResources()

  if (pins.length === 0) return null

  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#94a3b8"

  return (
    <div style={{
      background: surface, border: `1px solid ${border}`,
      borderRadius: 14, padding: "18px 20px", marginBottom: 24,
      animation: "fadeUp 0.4s ease both",
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 15, color: "#fbbf24" }}>★</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: text }}>My Resources</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
          background: "rgba(251,191,36,0.15)", color: "#fbbf24",
        }}>{pins.length}</span>
      </div>

      {/* grid */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {pins.map(pin => {
          const cm  = CLOUD_META[pin.cloud] || CLOUD_META.aws
          const dot = STATUS_DOT[pin.status] || "#64748b"
          return (
            <div
              key={pin.id}
              onClick={() => navigate(pin.link)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${border}`,
                background: dark ? "rgba(255,255,255,0.03)" : "#f8faff",
                transition: "all 0.15s", minWidth: 180, maxWidth: 260,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#00d4aa55"}
              onMouseLeave={e => e.currentTarget.style.borderColor = border}
            >
              {/* cloud badge */}
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
                background: cm.bg, color: cm.color, flexShrink: 0,
              }}>{cm.label}</span>

              {/* name + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {pin.name}
                </div>
                {pin.meta && (
                  <div style={{ fontSize: 10, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {pin.meta}
                  </div>
                )}
              </div>

              {/* status dot */}
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />

              {/* unpin */}
              <button
                onClick={e => { e.stopPropagation(); unpin(pin.id) }}
                title="Unpin"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: muted, fontSize: 13, padding: "0 2px", flexShrink: 0,
                  lineHeight: 1,
                }}
              >×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
