import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { listCloudProjects } from "../api/api"

const CLOUD = {
  aws:   { label: "AWS",   color: "#FF9900", bg: "rgba(255,153,0,0.12)",   accent: "#00d4aa", gradient: "linear-gradient(135deg,#FF9900,#FFB347)" },
  azure: { label: "Azure", color: "#0078D4", bg: "rgba(0,120,212,0.12)",   accent: "#50e6ff", gradient: "linear-gradient(135deg,#0078D4,#50e6ff)" },
  gcp:   { label: "GCP",   color: "#4285F4", bg: "rgba(66,133,244,0.12)",  accent: "#34A853", gradient: "linear-gradient(135deg,#4285f4,#34A853)" },
}

function Skeleton({ w = "100%", h = 16, r = 8, dark }) {
  const base  = dark ? "#1e293b" : "#e2e8f0"
  const shine = dark ? "#263347" : "#f1f5f9"
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: `linear-gradient(90deg,${base} 25%,${shine} 50%,${base} 75%)`,
      backgroundSize: "700px 100%",
      animation: "shimmer 1.4s infinite linear",
    }} />
  )
}

function CloudBadge({ cloud }) {
  const c = CLOUD[cloud]
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
      background: c.gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: cloud === "gcp" ? 9 : 11, fontWeight: 800, color: "#fff",
      boxShadow: `0 2px 10px ${c.color}40`,
    }}>
      {c.label}
    </div>
  )
}

function StatCard({ label, value, color, dark }) {
  const cardBg = dark ? "rgba(255,255,255,0.035)" : "#fff"
  const border = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  return (
    <div style={{
      background: cardBg, border: `1px solid ${border}`,
      borderRadius: 14, padding: "18px 22px",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: dark ? "#64748b" : "#94a3b8", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: "-0.5px" }}>{value}</div>
    </div>
  )
}

export default function OrgProjects() {
  const navigate       = useNavigate()
  const { dark: darkMode } = useTheme()

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState("all")
  const [error,   setError]   = useState(null)

  const bg      = darkMode ? "#070c18" : "#f0f4f8"
  const text    = darkMode ? "#e2e8f0" : "#1e293b"
  const muted   = darkMode ? "#64748b" : "#94a3b8"
  const cardBg  = darkMode ? "rgba(255,255,255,0.025)" : "#fff"
  const border  = darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await listCloudProjects()
      setData(r.data)
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load projects")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const projects = data?.projects || []
  const filtered = filter === "all" ? projects : projects.filter(p => p.cloud === filter)

  const totalCost  = data?.total_cost || 0
  const awsCount   = projects.filter(p => p.cloud === "aws").length
  const azureCount = projects.filter(p => p.cloud === "azure").length
  const gcpCount   = projects.filter(p => p.cloud === "gcp").length

  function cloudDest(p) {
    if (p.cloud === "aws")   return "/"
    if (p.cloud === "azure") return "/azure"
    if (p.cloud === "gcp")   return "/gcp"
    return "/"
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, padding: "32px 40px", color: text }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-700px 0} 100%{background-position:700px 0} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px", marginBottom: 5 }}>
            Cloud Accounts & Projects
          </div>
          <div style={{ fontSize: 13, color: muted }}>
            All AWS accounts, Azure subscriptions, and GCP projects accessible from your org credentials.
          </div>
        </div>
        <button
          onClick={() => navigate("/settings")}
          style={{
            padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: "transparent", border: `1px solid ${border}`,
            color: muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          Manage Credentials
        </button>
        <button
          onClick={fetch}
          style={{
            padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.3)",
            color: "#00d4aa", cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total MTD Cost" value={`$${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="#00d4aa" dark={darkMode} />
        <StatCard label="AWS Accounts"        value={loading ? "—" : awsCount}   color={CLOUD.aws.color}   dark={darkMode} />
        <StatCard label="Azure Subscriptions" value={loading ? "—" : azureCount} color={CLOUD.azure.color} dark={darkMode} />
        <StatCard label="GCP Projects"        value={loading ? "—" : gcpCount}   color={CLOUD.gcp.color}   dark={darkMode} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["all", "aws", "azure", "gcp"].map(f => {
          const c = f === "all" ? { color: "#00d4aa" } : CLOUD[f]
          const active = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: active ? `${c.color}18` : "transparent",
                border: `1px solid ${active ? c.color + "60" : border}`,
                color: active ? c.color : muted,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {f === "all" ? "All Providers" : f.toUpperCase()}
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "14px 18px", borderRadius: 10,
          background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)",
          color: "#f43f5e", fontSize: 13, marginBottom: 20,
        }}>
          {error} — <button onClick={fetch} style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>Retry</button>
        </div>
      )}

      {/* Projects table */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1.4fr 1.2fr 1fr 1fr auto",
          padding: "12px 20px",
          background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
          borderBottom: `1px solid ${border}`,
          fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: muted,
        }}>
          <span>Account / Project</span>
          <span>ID</span>
          <span>Cloud</span>
          <span>Status</span>
          <span>MTD Cost</span>
          <span></span>
        </div>

        {loading ? (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} h={42} dark={darkMode} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: muted }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.4 }}>
              <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No projects found</div>
            <div style={{ fontSize: 12 }}>
              Configure credentials in{" "}
              <button onClick={() => navigate("/settings")} style={{ background: "none", border: "none", color: "#00d4aa", cursor: "pointer", fontSize: 12 }}>
                Settings
              </button>{" "}
              to discover accounts and projects.
            </div>
          </div>
        ) : (
          filtered.map((p, i) => {
            const c = CLOUD[p.cloud]
            const rowBg = i % 2 === 0 ? "transparent" : (darkMode ? "rgba(255,255,255,0.012)" : "rgba(0,0,0,0.015)")
            const isActive = p.status === "ACTIVE"
            return (
              <div
                key={`${p.cloud}-${p.id}`}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1.4fr 1.2fr 1fr 1fr auto",
                  padding: "14px 20px", alignItems: "center",
                  background: rowBg,
                  borderBottom: i < filtered.length - 1 ? `1px solid ${border}` : "none",
                  animation: "fadeUp 0.3s ease",
                  animationDelay: `${i * 0.03}s`,
                }}
              >
                {/* Name */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <CloudBadge cloud={p.cloud} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: text, display: "flex", alignItems: "center", gap: 6 }}>
                      {p.name}
                      {p.is_current && (
                        <span style={{
                          fontSize: 9, background: `${c.color}18`, color: c.color,
                          border: `1px solid ${c.color}40`, borderRadius: 4,
                          padding: "1px 5px", fontWeight: 700,
                        }}>ACTIVE</span>
                      )}
                    </div>
                    {p.email && <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>{p.email}</div>}
                  </div>
                </div>

                {/* ID */}
                <div style={{ fontSize: 12, color: muted, fontFamily: "monospace" }}>
                  {p.id?.length > 20 ? p.id.slice(0, 18) + "…" : p.id}
                </div>

                {/* Cloud */}
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    background: c.bg, color: c.color,
                    border: `1px solid ${c.color}30`,
                    borderRadius: 6, padding: "3px 10px",
                  }}>
                    {c.label}
                  </span>
                </div>

                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: isActive ? "#00d4aa" : "#f43f5e",
                    boxShadow: isActive ? "0 0 6px #00d4aa" : "0 0 6px #f43f5e",
                  }} />
                  <span style={{ fontSize: 12, color: isActive ? "#00d4aa" : "#f43f5e", fontWeight: 600 }}>
                    {isActive ? "Active" : p.status}
                  </span>
                </div>

                {/* Cost */}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: text }}>
                    ${(p.cost_mtd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 10, color: muted }}>MTD</div>
                </div>

                {/* Action */}
                <button
                  onClick={() => navigate(cloudDest(p))}
                  style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: `${c.color}10`, border: `1px solid ${c.color}30`,
                    color: c.color, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  View
                </button>
              </div>
            )
          })
        )}

        {/* Footer total */}
        {!loading && filtered.length > 0 && (
          <div style={{
            padding: "12px 20px",
            background: darkMode ? "rgba(0,212,170,0.05)" : "rgba(0,212,170,0.04)",
            borderTop: `1px solid rgba(0,212,170,0.15)`,
            display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 12, color: muted }}>Total estimated MTD cost</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#00d4aa" }}>
              ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {data?.as_of && (
        <div style={{ marginTop: 12, textAlign: "right", fontSize: 11, color: muted }}>
          Last fetched: {new Date(data.as_of).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
