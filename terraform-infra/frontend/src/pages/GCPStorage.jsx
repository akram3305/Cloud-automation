import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { listGCPBuckets } from "../api/api"

const CLASS_COLORS = {
  STANDARD: { bg: "rgba(66,133,244,0.12)", color: "#4285f4", border: "rgba(66,133,244,0.3)" },
  NEARLINE:  { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  COLDLINE:  { bg: "rgba(99,102,241,0.12)", color: "#818cf8", border: "rgba(99,102,241,0.3)" },
  ARCHIVE:   { bg: "rgba(107,114,128,0.12)", color: "#9ca3af", border: "rgba(107,114,128,0.3)" },
}

function fmtSize(bytes) {
  if (!bytes) return "0 B"
  const u = ["B", "KB", "MB", "GB", "TB"]
  let i = 0, v = bytes
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(i > 0 ? 1 : 0)} ${u[i]}`
}

export default function GCPStorage() {
  const { dark } = useTheme()
  const navigate = useNavigate()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text     = dark ? "#f1f5f9" : "#0f172a"
  const muted    = dark ? "#64748b" : "#64748b"

  const [buckets,      setBuckets]      = useState([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState("")
  const [warning,      setWarning]      = useState("")
  const [warningType,  setWarningType]  = useState("")
  const [search,       setSearch]       = useState("")

  useEffect(() => {
    setLoading(true)
    listGCPBuckets()
      .then(r => {
        setBuckets(r.data?.buckets || [])
        if (r.data?.warning) {
          setWarning(r.data.warning)
          setWarningType(r.data.warning_type || "")
        }
      })
      .catch(e => setError(e.response?.data?.detail || "Failed to load buckets"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = buckets.filter(b =>
    !search || b.name?.toLowerCase().includes(search.toLowerCase()) || b.location?.toLowerCase().includes(search.toLowerCase())
  )

  const thStyle = {
    padding: "9px 14px", fontSize: 11, fontWeight: 600, color: muted,
    textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left",
    borderBottom: `1px solid ${border}`,
    background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
  }
  const tdStyle = { padding: "11px 14px", fontSize: 13, color: text, borderBottom: `1px solid ${border}` }

  return (
    <div style={{ background: bg, minHeight: "100vh" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin   { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>

      {/* Top bar */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#4285f4,#34a853)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(66,133,244,0.35)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>GCP Cloud Storage</h1>
            <p style={{ fontSize: 12, color: muted, margin: "2px 0 0" }}>
              Object storage buckets in your GCP project
              {buckets.length > 0 && ` — ${buckets.length} bucket${buckets.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${border}`, background: dark ? "rgba(255,255,255,0.04)" : "#fff", color: text, fontSize: 13, outline: "none", width: 200 }}
            placeholder="Search buckets…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            onClick={() => navigate("/gcp/storage/create")}
            style={{
              padding: "9px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700,
              fontSize: 13, background: "linear-gradient(135deg,#4285f4,#34a853)", color: "#fff",
              boxShadow: "0 4px 14px rgba(66,133,244,0.4)", display: "flex", alignItems: "center", gap: 7,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16m8-8H4"/></svg>
            Create Bucket
          </button>
        </div>
      </div>

      {error && (
        <div style={{ margin: "12px 28px 0", padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>
          {error}
        </div>
      )}

      {warning && (
        <div style={{ margin: "12px 28px 0", padding: "12px 16px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24", fontSize: 13, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            {warningType === "permission" ? (
              <>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>IAM permission denied — bucket listing unavailable</div>
                <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
                  The service account does not have permission to list buckets in this project.
                  To fix: go to <strong>GCP Console → IAM &amp; Admin → IAM</strong>, find the service account
                  <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 6px", borderRadius: 4, margin: "0 4px" }}>terraform-aionos-platform@test-project-terraform-493814.iam.gserviceaccount.com</code>
                  and grant it <strong>Storage Admin</strong> (or at minimum <strong>Storage Object Viewer</strong>) at the <em>project</em> level.
                  Bucket creation via Terraform is still available.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>GCP Storage API unreachable</div>
                <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
                  Your corporate firewall or proxy is blocking <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 4 }}>storage.googleapis.com</code>.
                  Bucket listing is unavailable, but you can still create new buckets via Terraform.
                  Ask your network team to whitelist GCP Storage API endpoints.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: "20px 28px" }}>
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Bucket Name", "Location", "Storage Class", "Access", "Created", "Size"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: muted, fontSize: 13 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid rgba(66,133,244,0.2)", borderTopColor: "#4285f4", animation: "spin 0.8s linear infinite" }} />
                    Loading buckets…
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 56, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{warning ? "🚧" : "🪣"}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 6 }}>
                    {search ? "No buckets match your search" : warning ? "Bucket list unavailable" : "No Cloud Storage buckets found"}
                  </div>
                  <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>
                    {search ? "Try a different search term." : warning ? "Network is blocking the GCP Storage API — see the warning above." : "Create your first bucket to get started."}
                  </div>
                  {!search && !warning && (
                    <button onClick={() => navigate("/gcp/storage/create")} style={{ padding: "10px 22px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "linear-gradient(135deg,#4285f4,#34a853)", color: "#fff" }}>
                      Create Bucket
                    </button>
                  )}
                </td></tr>
              ) : filtered.map((b, i) => {
                const isLast = i === filtered.length - 1
                const cls = CLASS_COLORS[b.storage_class] || CLASS_COLORS.STANDARD
                return (
                  <tr key={b.name}
                    onMouseEnter={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    style={{ transition: "background 0.1s", animation: "fadeUp 0.3s ease both" }}>
                    <td style={{ ...tdStyle, fontWeight: 700, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                      {b.name}
                    </td>
                    <td style={{ ...tdStyle, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                      <div style={{ fontSize: 13 }}>{b.location}</div>
                      {b.locationType && <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{b.locationType}</div>}
                    </td>
                    <td style={{ ...tdStyle, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 700, background: cls.bg, color: cls.color, border: `1px solid ${cls.border}` }}>
                        {b.storage_class || "STANDARD"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: muted, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                      {b.iamConfiguration?.uniformBucketLevelAccess?.enabled ? "Uniform" : "Fine-grained"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: muted, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                      {b.timeCreated ? new Date(b.timeCreated).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: muted, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                      {b.size_bytes !== undefined ? fmtSize(b.size_bytes) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
