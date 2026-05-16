import { useState, useEffect, useRef } from "react"
import { useTheme } from "../context/ThemeContext"
import { listGCPOrgProjectsQuick, createGCPProject } from "../api/api"

const GCP_GRADIENT = "linear-gradient(135deg,#4285F4,#34A853,#FBBC04,#EA4335)"
const LS_KEY = "gcp_selected_project"

function getStored() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null") } catch { return null }
}
function setStored(p) {
  if (p) localStorage.setItem(LS_KEY, JSON.stringify(p))
  else localStorage.removeItem(LS_KEY)
}

export default function GCPProjectSelector({ value, onChange, showLabel = true, compact = false }) {
  const { dark } = useTheme()
  const [open,       setOpen]       = useState(false)
  const [projects,   setProjects]   = useState([])
  const [loading,    setLoading]    = useState(false)
  const [creating,   setCreating]   = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newId,      setNewId]      = useState("")
  const [newName,    setNewName]    = useState("")
  const [createErr,  setCreateErr]  = useState("")
  const [search,     setSearch]     = useState("")
  const ref = useRef(null)

  const bg     = dark ? "#0f172a"                     : "#fff"
  const border = dark ? "rgba(255,255,255,0.09)"      : "rgba(0,0,0,0.1)"
  const text   = dark ? "#e2e8f0"                     : "#1e293b"
  const muted  = dark ? "#64748b"                     : "#94a3b8"
  const hoverBg = dark ? "rgba(255,255,255,0.06)"     : "rgba(0,0,0,0.04)"
  const dropBg  = dark ? "#0f172a"                    : "#fff"

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Load projects once on mount — show cached list immediately, refresh in background
  useEffect(() => {
    const CACHE_KEY = "gcp_projects_selector_v1"
    try {
      const c = localStorage.getItem(CACHE_KEY)
      if (c) setProjects(JSON.parse(c))
    } catch {}
    setLoading(true)
    listGCPOrgProjectsQuick()
      .then(r => {
        const list = r.data?.projects || []
        setProjects(list)
        try { localStorage.setItem("gcp_projects_selector_v1", JSON.stringify(list)) } catch {}
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selected = value || getStored()
  const filtered = search
    ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : projects

  function select(proj) {
    const p = { id: proj.id, name: proj.name }
    setStored(p)
    onChange && onChange(p)
    setOpen(false)
    setSearch("")
  }

  function clearProject() {
    setStored(null)
    onChange && onChange(null)
    setOpen(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newId.trim()) return
    setCreating(true)
    setCreateErr("")
    try {
      const res = await createGCPProject({ project_id: newId.trim(), name: newName.trim() || newId.trim() })
      const newProj = { id: res.data.project_id, name: res.data.name || res.data.project_id }
      setProjects(prev => [...prev, { ...newProj, status: "ACTIVE", is_default: false }])
      select(newProj)
      setShowCreate(false)
      setNewId("")
      setNewName("")
    } catch (ex) {
      setCreateErr(ex?.response?.data?.detail || "Failed to create project")
    } finally {
      setCreating(false)
    }
  }

  const triggerH = compact ? 32 : 38

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block", minWidth: compact ? 180 : 240 }}>
      {showLabel && (
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: muted, marginBottom: 5 }}>
          GCP Project
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", height: triggerH,
          display: "flex", alignItems: "center", gap: 8,
          padding: compact ? "0 10px" : "0 12px",
          background: bg, border: `1px solid ${border}`,
          borderRadius: 9, cursor: "pointer",
          color: text, fontSize: compact ? 12 : 13,
          fontFamily: "inherit", transition: "border-color 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "#4285F4"}
        onMouseLeave={e => e.currentTarget.style.borderColor = border}
      >
        <div style={{ width: 20, height: 20, borderRadius: 5, background: GCP_GRADIENT, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "#fff" }}>G</div>
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.name : "All Projects"}
        </span>
        {selected && (
          <span
            onClick={e => { e.stopPropagation(); clearProject() }}
            style={{ fontSize: 14, color: muted, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}
            title="Clear selection"
          >×</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: triggerH + 6, left: 0, right: 0, minWidth: 260,
          background: dropBg, border: `1px solid ${border}`,
          borderRadius: 11, boxShadow: "0 8px 32px rgba(0,0,0,0.22)", zIndex: 9999,
          overflow: "hidden",
        }}>
          {/* Search */}
          <div style={{ padding: "10px 10px 6px" }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects…"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "7px 10px", borderRadius: 7, fontSize: 12,
                background: dark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                border: `1px solid ${border}`, color: text,
                fontFamily: "inherit", outline: "none",
              }}
            />
          </div>

          {/* "All Projects" option */}
          <div
            onClick={clearProject}
            style={{
              padding: "8px 12px", cursor: "pointer", fontSize: 12,
              color: !selected ? "#4285F4" : muted,
              background: !selected ? "rgba(66,133,244,0.08)" : "transparent",
              fontWeight: !selected ? 700 : 400,
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={e => { if (selected) e.currentTarget.style.background = hoverBg }}
            onMouseLeave={e => { if (selected) e.currentTarget.style.background = "transparent" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            All Projects
          </div>

          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "16px 12px", color: muted, fontSize: 12, textAlign: "center" }}>Loading projects…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "14px 12px", color: muted, fontSize: 12, textAlign: "center" }}>No projects found</div>
            ) : filtered.map(p => {
              const isActive = selected?.id === p.id
              return (
                <div
                  key={p.id}
                  onClick={() => select(p)}
                  style={{
                    padding: "9px 12px", cursor: "pointer", fontSize: 12,
                    background: isActive ? "rgba(66,133,244,0.1)" : "transparent",
                    borderLeft: isActive ? "3px solid #4285F4" : "3px solid transparent",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = hoverBg }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent" }}
                >
                  <div style={{ fontWeight: isActive ? 700 : 500, color: isActive ? "#4285F4" : text }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: muted, fontFamily: "monospace", marginTop: 1 }}>{p.id}</div>
                </div>
              )
            })}
          </div>

          {/* Create New Project */}
          <div style={{ borderTop: `1px solid ${border}`, padding: "8px 10px" }}>
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                  background: "rgba(52,168,83,0.1)", border: "1px solid rgba(52,168,83,0.3)",
                  color: "#34A853", cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create New Project
              </button>
            ) : (
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input
                  autoFocus
                  value={newId}
                  onChange={e => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="project-id (lowercase, hyphens)"
                  maxLength={30}
                  style={{ padding: "7px 9px", borderRadius: 7, fontSize: 11, background: dark ? "rgba(255,255,255,0.06)" : "#f8fafc", border: `1px solid ${border}`, color: text, fontFamily: "monospace", outline: "none" }}
                />
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Display name (optional)"
                  style={{ padding: "7px 9px", borderRadius: 7, fontSize: 11, background: dark ? "rgba(255,255,255,0.06)" : "#f8fafc", border: `1px solid ${border}`, color: text, fontFamily: "inherit", outline: "none" }}
                />
                {createErr && <div style={{ fontSize: 10, color: "#f43f5e" }}>{createErr}</div>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="submit"
                    disabled={!newId.trim() || creating}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 11, fontWeight: 700, background: "#34A853", border: "none", color: "#fff", cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.6 : 1 }}
                  >
                    {creating ? "Creating…" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewId(""); setNewName(""); setCreateErr("") }}
                    style={{ padding: "7px 12px", borderRadius: 7, fontSize: 11, background: "transparent", border: `1px solid ${border}`, color: muted, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
