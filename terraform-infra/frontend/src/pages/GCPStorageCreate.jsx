import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { createRequest } from "../api/api"

// ── GCP regions for storage ──────────────────────────────────────────────────
const REGIONS = {
  "Multi-Region": [
    { value: "US",   label: "US (multi-region)" },
    { value: "EU",   label: "EU (multi-region)" },
    { value: "ASIA", label: "Asia (multi-region)" },
  ],
  "Dual-Region": [
    { value: "NAM4",  label: "NAM4 — Iowa + South Carolina" },
    { value: "EUR4",  label: "EUR4 — Netherlands + Finland" },
    { value: "ASIA1", label: "ASIA1 — Tokyo + Osaka" },
  ],
  "Region": [
    { value: "us-central1",         label: "Iowa (us-central1)" },
    { value: "us-east1",            label: "S. Carolina (us-east1)" },
    { value: "us-east4",            label: "N. Virginia (us-east4)" },
    { value: "us-west1",            label: "Oregon (us-west1)" },
    { value: "us-west2",            label: "Los Angeles (us-west2)" },
    { value: "europe-west1",        label: "Belgium (europe-west1)" },
    { value: "europe-west2",        label: "London (europe-west2)" },
    { value: "europe-west4",        label: "Netherlands (europe-west4)" },
    { value: "asia-east1",          label: "Taiwan (asia-east1)" },
    { value: "asia-south1",         label: "Mumbai (asia-south1)" },
    { value: "asia-southeast1",     label: "Singapore (asia-southeast1)" },
    { value: "asia-northeast1",     label: "Tokyo (asia-northeast1)" },
    { value: "australia-southeast1",label: "Sydney (australia-southeast1)" },
  ],
}

const STORAGE_CLASSES = [
  { value: "STANDARD", label: "Standard",  desc: "Best for frequently accessed data",          price: "$0.020/GB/mo" },
  { value: "NEARLINE", label: "Nearline",  desc: "Low cost for data accessed less than once/mo", price: "$0.010/GB/mo" },
  { value: "COLDLINE", label: "Coldline",  desc: "Very low cost for data accessed less than once/quarter", price: "$0.004/GB/mo" },
  { value: "ARCHIVE",  label: "Archive",   desc: "Lowest cost for long-term archival (< once/year)", price: "$0.0012/GB/mo" },
]

const STEPS = ["Bucket Basics", "Location & Class", "Access Control", "Data Protection", "Tags", "Review"]

function sanitizeBucketName(v) {
  return v.toLowerCase().replace(/[^a-z0-9-_.]/g, "-").replace(/^-+/, "").slice(0, 63)
}

export default function GCPStorageCreate() {
  const { dark } = useTheme()
  const navigate = useNavigate()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text     = dark ? "#f1f5f9" : "#0f172a"
  const muted    = dark ? "#64748b" : "#64748b"
  const panel    = dark ? "rgba(255,255,255,0.03)" : "#f8fafc"

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  // Step 0 — Basics
  const [bucketName, setBucketName] = useState("")
  const [environment, setEnvironment] = useState("dev")
  const [description, setDescription] = useState("")

  // Step 1 — Location & Class
  const [locationType, setLocationType] = useState("Region")
  const [region, setRegion] = useState("us-central1")
  const [storageClass, setStorageClass] = useState("STANDARD")

  // Step 2 — Access Control
  const [uniformAccess, setUniformAccess] = useState(true)
  const [publicPrevention, setPublicPrevention] = useState("enforced")

  // Step 3 — Data Protection
  const [versioningEnabled, setVersioningEnabled] = useState(false)
  const [lifecycleAge, setLifecycleAge] = useState("")
  const [toNearlineDays, setToNearlineDays] = useState("")
  const [toColdlineDays, setToColdlineDays] = useState("")
  const [enableCors, setEnableCors] = useState(false)
  const [corsOrigins, setCorsOrigins] = useState("*")
  const [forceDestroy, setForceDestroy] = useState(false)

  // Step 4 — Tags / Labels
  const [tags, setTags] = useState([{ key: "", value: "" }])

  // ── Validation ───────────────────────────────────────────────────────────
  const nameError = (() => {
    if (!bucketName) return ""
    if (bucketName.length < 3) return "At least 3 characters"
    if (!/^[a-z0-9]/.test(bucketName)) return "Must start with a letter or number"
    if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(bucketName) && bucketName.length > 1) return "Only lowercase letters, numbers, hyphens, underscores, dots"
    return ""
  })()

  const canProceed = [
    bucketName.length >= 3 && !nameError,
    true,
    true,
    true,
    true,
  ][step] ?? true

  // ── When location type changes, reset region to first option ─────────────
  const handleLocationType = (lt) => {
    setLocationType(lt)
    setRegion(REGIONS[lt][0].value)
  }

  // ── Tags helpers ─────────────────────────────────────────────────────────
  const addTag = () => setTags(t => [...t, { key: "", value: "" }])
  const removeTag = (i) => setTags(t => t.filter((_, idx) => idx !== i))
  const updateTag = (i, field, val) => setTags(t => t.map((tag, idx) => idx === i ? { ...tag, [field]: val } : tag))

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true)
    setError("")
    const validTags = tags.filter(t => t.key.trim())
    const labelsObj = Object.fromEntries(validTags.map(t => [t.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_"), t.value.trim()]))

    try {
      await createRequest({
        resource_type:  "gcp_storage",
        resource_name:  bucketName,
        cloud_provider: "gcp",
        region,
        payload: {
          bucket_name:               bucketName,
          region,
          location_type:             locationType.toUpperCase().replace("-", "_"),
          storage_class:             storageClass,
          uniform_bucket_access:     uniformAccess,
          public_access_prevention:  publicPrevention,
          versioning_enabled:        versioningEnabled,
          lifecycle_age_days:        lifecycleAge ? parseInt(lifecycleAge) : 0,
          lifecycle_to_nearline_days: toNearlineDays ? parseInt(toNearlineDays) : 0,
          lifecycle_to_coldline_days: toColdlineDays ? parseInt(toColdlineDays) : 0,
          enable_cors:               enableCors,
          cors_origins:              corsOrigins.split(",").map(s => s.trim()).filter(Boolean),
          force_destroy:             forceDestroy,
          labels:                    labelsObj,
          tags:                      { environment, description },
        },
      })
      setSubmitted(true)
    } catch (e) {
      setError(e.response?.data?.detail || "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle = {
    width: "100%", padding: "10px 13px", borderRadius: 8, fontSize: 13, color: text,
    background: dark ? "rgba(255,255,255,0.04)" : "#fff",
    border: `1px solid ${border}`, outline: "none", boxSizing: "border-box",
  }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6, display: "block" }
  const fieldStyle = { marginBottom: 18 }

  const Toggle = ({ checked, onChange, label, desc }) => (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 16px", borderRadius: 10, background: panel, border: `1px solid ${border}`, marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{
        width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", flexShrink: 0,
        background: checked ? "#4285f4" : (dark ? "#1e293b" : "#e2e8f0"), transition: "background 0.2s",
      }}>
        <div style={{
          position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18,
          borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </button>
    </div>
  )

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ background: bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 480, textAlign: "center", padding: 40, background: surface, borderRadius: 16, border: `1px solid ${border}` }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(52,168,83,0.15)", border: "2px solid #34a853", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34a853" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: text, margin: "0 0 8px" }}>Request Submitted</h2>
          <p style={{ fontSize: 13, color: muted, margin: "0 0 24px" }}>
            Bucket <strong style={{ color: "#4285f4" }}>{bucketName}</strong> is pending approval.
            Once approved, Terraform will provision it in GCP Cloud Storage.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => navigate("/approvals")} style={{ padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "linear-gradient(135deg,#4285f4,#34a853)", color: "#fff" }}>
              View Approvals
            </button>
            <button onClick={() => navigate("/gcp/storage")} style={{ padding: "10px 22px", borderRadius: 8, border: `1px solid ${border}`, cursor: "pointer", fontWeight: 600, fontSize: 13, background: "transparent", color: text }}>
              Back to Storage
            </button>
          </div>
        </div>
      </div>
    )
  }

  const activeClass = STORAGE_CLASSES.find(c => c.value === storageClass)

  return (
    <div style={{ background: bg, minHeight: "100vh" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        input:focus, select:focus, textarea:focus { border-color: #4285f4 !important; box-shadow: 0 0 0 3px rgba(66,133,244,0.15); }
        select option { background: ${dark ? "#0f172a" : "#ffffff"}; color: ${dark ? "#f1f5f9" : "#0f172a"}; }
      `}</style>

      {/* Top bar */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "16px 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => navigate("/gcp/storage")} style={{ background: "transparent", border: "none", cursor: "pointer", color: muted, display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>
          Back
        </button>
        <div style={{ width: 1, height: 20, background: border }} />
        <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#4285f4,#34a853)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
          </svg>
        </div>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: text, margin: 0 }}>Create Cloud Storage Bucket</h1>
          <p style={{ fontSize: 11, color: muted, margin: 0 }}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>
      </div>

      {/* Step pills */}
      <div style={{ display: "flex", gap: 0, padding: "0 28px", background: surface, borderBottom: `1px solid ${border}`, overflowX: "auto" }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <button
              onClick={() => i < step && setStep(i)}
              style={{
                padding: "12px 16px", border: "none", background: "transparent", cursor: i < step ? "pointer" : "default",
                fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                color: i === step ? "#4285f4" : i < step ? "#34a853" : muted,
                borderBottom: i === step ? "2px solid #4285f4" : "2px solid transparent",
              }}
            >
              <span style={{ marginRight: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", fontSize: 10, fontWeight: 700, background: i === step ? "#4285f4" : i < step ? "#34a853" : (dark ? "#1e293b" : "#e2e8f0"), color: i <= step ? "#fff" : muted }}>
                {i < step ? "✓" : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ margin: "12px 28px 0", padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── LEFT: Step content ── */}
        <div style={{ animation: "fadeUp 0.3s ease both" }}>

          {/* ── STEP 0: Bucket Basics ── */}
          {step === 0 && (
            <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 20px" }}>Bucket Basics</h2>

              <div style={fieldStyle}>
                <label style={labelStyle}>Bucket Name *</label>
                <input
                  style={{ ...inputStyle, borderColor: nameError ? "#ef4444" : border }}
                  placeholder="e.g. akram-dev-bucket-001"
                  value={bucketName}
                  onChange={e => setBucketName(sanitizeBucketName(e.target.value))}
                />
                {nameError && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{nameError}</div>}
                <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>Must be globally unique. Only lowercase letters, numbers, hyphens, underscores, dots (3–63 chars).</div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Environment</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["dev", "staging", "prod"].map(e => (
                    <button key={e} onClick={() => setEnvironment(e)} style={{
                      flex: 1, padding: "9px 0", borderRadius: 8, border: `1.5px solid ${environment === e ? "#4285f4" : border}`,
                      background: environment === e ? "rgba(66,133,244,0.1)" : "transparent",
                      color: environment === e ? "#4285f4" : muted, fontWeight: 600, fontSize: 12, cursor: "pointer", textTransform: "capitalize",
                    }}>{e}</button>
                  ))}
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Description (optional)</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
                  placeholder="What will this bucket be used for?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── STEP 1: Location & Class ── */}
          {step === 1 && (
            <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 20px" }}>Location & Storage Class</h2>

              <div style={fieldStyle}>
                <label style={labelStyle}>Location Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {["Region", "Multi-Region", "Dual-Region"].map(lt => (
                    <button key={lt} onClick={() => handleLocationType(lt)} style={{
                      padding: "14px 10px", borderRadius: 10,
                      border: `1.5px solid ${locationType === lt ? "#4285f4" : border}`,
                      background: locationType === lt ? "rgba(66,133,244,0.08)" : panel,
                      color: locationType === lt ? "#4285f4" : text, fontWeight: 700, fontSize: 12, cursor: "pointer", textAlign: "center",
                    }}>
                      {lt === "Region" && <div style={{ fontSize: 20, marginBottom: 6 }}>📍</div>}
                      {lt === "Multi-Region" && <div style={{ fontSize: 20, marginBottom: 6 }}>🌍</div>}
                      {lt === "Dual-Region" && <div style={{ fontSize: 20, marginBottom: 6 }}>⚖️</div>}
                      {lt}
                      <div style={{ fontSize: 10, color: muted, fontWeight: 400, marginTop: 4 }}>
                        {lt === "Region" ? "Single region, lowest latency" : lt === "Multi-Region" ? "High availability, global" : "Balanced resilience"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Location</label>
                <select value={region} onChange={e => setRegion(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  {(REGIONS[locationType] || []).map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Storage Class</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {STORAGE_CLASSES.map(cls => (
                    <button key={cls.value} onClick={() => setStorageClass(cls.value)} style={{
                      padding: "14px 16px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                      border: `1.5px solid ${storageClass === cls.value ? "#4285f4" : border}`,
                      background: storageClass === cls.value ? "rgba(66,133,244,0.08)" : panel,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: storageClass === cls.value ? "#4285f4" : text }}>{cls.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#34a853" }}>{cls.price}</span>
                      </div>
                      <div style={{ fontSize: 11, color: muted }}>{cls.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Access Control ── */}
          {step === 2 && (
            <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 20px" }}>Access Control</h2>

              <div style={fieldStyle}>
                <label style={labelStyle}>Access Control Model</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { v: true, label: "Uniform", rec: true, desc: "Apply access policies at the bucket level using IAM. Recommended — simpler and more secure." },
                    { v: false, label: "Fine-grained", rec: false, desc: "Apply access policies at both bucket and object level using ACLs. Use for legacy or advanced setups." },
                  ].map(opt => (
                    <button key={String(opt.v)} onClick={() => setUniformAccess(opt.v)} style={{
                      padding: 16, borderRadius: 10, textAlign: "left", cursor: "pointer",
                      border: `1.5px solid ${uniformAccess === opt.v ? "#4285f4" : border}`,
                      background: uniformAccess === opt.v ? "rgba(66,133,244,0.08)" : panel,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: uniformAccess === opt.v ? "#4285f4" : text }}>{opt.label}</span>
                        {opt.rec && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(52,168,83,0.15)", color: "#34a853", fontWeight: 700 }}>RECOMMENDED</span>}
                      </div>
                      <div style={{ fontSize: 11, color: muted }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Public Access Prevention</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { v: "enforced", label: "Enforced", icon: "🔒", desc: "Prevents any public access regardless of IAM or ACL policies. Strongest protection." },
                    { v: "inherited", label: "Inherited", icon: "🔓", desc: "Inherits project-level public access settings. Allows public access if explicitly granted." },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => setPublicPrevention(opt.v)} style={{
                      padding: 16, borderRadius: 10, textAlign: "left", cursor: "pointer",
                      border: `1.5px solid ${publicPrevention === opt.v ? "#4285f4" : border}`,
                      background: publicPrevention === opt.v ? "rgba(66,133,244,0.08)" : panel,
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{opt.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: publicPrevention === opt.v ? "#4285f4" : text, marginBottom: 4 }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: muted }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Data Protection ── */}
          {step === 3 && (
            <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 20px" }}>Data Protection</h2>

              <Toggle checked={versioningEnabled} onChange={setVersioningEnabled} label="Object Versioning" desc="Keep previous versions of objects when overwritten or deleted. Useful for backup and recovery." />

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 12 }}>Lifecycle Rules (optional)</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Delete after (days)</label>
                    <input type="number" min="1" style={inputStyle} placeholder="e.g. 365"
                      value={lifecycleAge} onChange={e => setLifecycleAge(e.target.value)} />
                    <div style={{ fontSize: 10, color: muted, marginTop: 3 }}>0 = disabled</div>
                  </div>
                  <div>
                    <label style={labelStyle}>Move to Nearline (days)</label>
                    <input type="number" min="1" style={inputStyle} placeholder="e.g. 30"
                      value={toNearlineDays} onChange={e => setToNearlineDays(e.target.value)} />
                    <div style={{ fontSize: 10, color: muted, marginTop: 3 }}>0 = disabled</div>
                  </div>
                  <div>
                    <label style={labelStyle}>Move to Coldline (days)</label>
                    <input type="number" min="1" style={inputStyle} placeholder="e.g. 90"
                      value={toColdlineDays} onChange={e => setToColdlineDays(e.target.value)} />
                    <div style={{ fontSize: 10, color: muted, marginTop: 3 }}>0 = disabled</div>
                  </div>
                </div>
              </div>

              <Toggle checked={enableCors} onChange={setEnableCors} label="Enable CORS" desc="Allow cross-origin requests to objects in this bucket (e.g. for web apps)." />

              {enableCors && (
                <div style={{ marginTop: 10, ...fieldStyle }}>
                  <label style={labelStyle}>Allowed Origins (comma-separated)</label>
                  <input style={inputStyle} placeholder="* or https://example.com, https://app.example.com"
                    value={corsOrigins} onChange={e => setCorsOrigins(e.target.value)} />
                </div>
              )}

              <Toggle checked={forceDestroy} onChange={setForceDestroy} label="Force Destroy" desc="Allow Terraform to delete this bucket even if it contains objects. Use with caution in production." />
            </div>
          )}

          {/* ── STEP 4: Tags / Labels ── */}
          {step === 4 && (
            <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 6px" }}>Labels (Tags)</h2>
              <p style={{ fontSize: 12, color: muted, margin: "0 0 20px" }}>
                GCP labels are key-value pairs attached to the bucket for cost allocation, filtering, and automation. Keys must be lowercase.
              </p>

              {tags.map((tag, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Key (e.g. team)"
                    value={tag.key}
                    onChange={e => updateTag(i, "key", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_"))}
                  />
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Value (e.g. platform)"
                    value={tag.value}
                    onChange={e => updateTag(i, "value", e.target.value)}
                  />
                  <button onClick={() => removeTag(i)} style={{ padding: "8px 10px", borderRadius: 7, border: `1px solid ${border}`, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>×</button>
                </div>
              ))}

              <button onClick={addTag} style={{
                padding: "9px 16px", borderRadius: 8, border: `1.5px dashed ${border}`, background: "transparent",
                color: "#4285f4", fontSize: 12, fontWeight: 600, cursor: "pointer", width: "100%", marginTop: 4,
              }}>
                + Add Label
              </button>

              {/* Pre-suggested labels */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, color: muted, fontWeight: 600, marginBottom: 8 }}>SUGGESTED LABELS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    { key: "team",    value: "platform" },
                    { key: "project", value: "aionos" },
                    { key: "cost-center", value: "engineering" },
                    { key: "owner",   value: "" },
                  ].map(s => (
                    <button key={s.key} onClick={() => {
                      const exists = tags.find(t => t.key === s.key)
                      if (!exists) setTags(prev => [...prev.filter(t => t.key !== ""), { key: s.key, value: s.value }])
                    }} style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, border: `1px solid ${border}`,
                      background: panel, color: text, cursor: "pointer",
                    }}>
                      {s.key}{s.value ? `=${s.value}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: Review ── */}
          {step === 5 && (
            <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 20px" }}>Review & Submit</h2>

              {[
                { title: "Bucket Basics", rows: [
                  ["Bucket Name", bucketName],
                  ["Environment", environment],
                  ...(description ? [["Description", description]] : []),
                ]},
                { title: "Location & Storage Class", rows: [
                  ["Location Type", locationType],
                  ["Location / Region", region],
                  ["Storage Class", storageClass],
                  ["Price", activeClass?.price || "—"],
                ]},
                { title: "Access Control", rows: [
                  ["Access Model", uniformAccess ? "Uniform (recommended)" : "Fine-grained"],
                  ["Public Access", publicPrevention === "enforced" ? "Enforced (blocked)" : "Inherited from project"],
                ]},
                { title: "Data Protection", rows: [
                  ["Versioning", versioningEnabled ? "Enabled" : "Disabled"],
                  ...(lifecycleAge ? [["Delete after", `${lifecycleAge} days`]] : []),
                  ...(toNearlineDays ? [["→ Nearline after", `${toNearlineDays} days`]] : []),
                  ...(toColdlineDays ? [["→ Coldline after", `${toColdlineDays} days`]] : []),
                  ["CORS", enableCors ? `Enabled (${corsOrigins})` : "Disabled"],
                  ["Force Destroy", forceDestroy ? "Yes (objects deletable)" : "No"],
                ]},
                { title: "Labels", rows: tags.filter(t => t.key).map(t => [t.key, t.value || "(no value)"]) },
              ].map(section => section.rows.length > 0 && (
                <div key={section.title} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#4285f4", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{section.title}</div>
                  <div style={{ background: panel, borderRadius: 10, border: `1px solid ${border}`, overflow: "hidden" }}>
                    {section.rows.map(([k, v], i) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: i < section.rows.length - 1 ? `1px solid ${border}` : "none", fontSize: 13 }}>
                        <span style={{ color: muted }}>{k}</span>
                        <span style={{ fontWeight: 600, color: text }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 24, padding: "12px 16px", borderRadius: 10, background: "rgba(66,133,244,0.06)", border: "1px solid rgba(66,133,244,0.2)", fontSize: 12, color: muted }}>
                This request will be sent for admin approval. Terraform will provision the bucket after approval.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <button
              onClick={() => step > 0 ? setStep(s => s - 1) : navigate("/gcp/storage")}
              style={{ padding: "10px 22px", borderRadius: 9, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {step === 0 ? "Cancel" : "← Back"}
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed}
                style={{ padding: "10px 26px", borderRadius: 9, border: "none", cursor: canProceed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 13, background: canProceed ? "linear-gradient(135deg,#4285f4,#34a853)" : (dark ? "#1e293b" : "#e2e8f0"), color: canProceed ? "#fff" : muted }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ padding: "10px 26px", borderRadius: 9, border: "none", cursor: submitting ? "wait" : "pointer", fontWeight: 700, fontSize: 13, background: "linear-gradient(135deg,#4285f4,#34a853)", color: "#fff", opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Submitting…" : "Submit for Approval"}
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT: Sticky summary ── */}
        <div style={{ position: "sticky", top: 20, alignSelf: "start" }}>
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Bucket Summary</div>

            <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${border}` }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 3 }}>Bucket Name</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: bucketName ? "#4285f4" : muted, fontFamily: "monospace" }}>{bucketName || "—"}</div>
            </div>

            {[
              ["Location Type", locationType],
              ["Region", region],
              ["Storage Class", storageClass],
              ["Price", activeClass?.price || "—"],
              ["Access Model", uniformAccess ? "Uniform" : "Fine-grained"],
              ["Public Access", publicPrevention === "enforced" ? "Blocked" : "Inherited"],
              ["Versioning", versioningEnabled ? "Enabled" : "Disabled"],
              ["Environment", environment],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: muted }}>{k}</span>
                <span style={{ fontWeight: 600, color: text }}>{v}</span>
              </div>
            ))}

            {tags.filter(t => t.key).length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${border}` }}>
                <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>Labels</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {tags.filter(t => t.key).map(t => (
                    <span key={t.key} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(66,133,244,0.1)", color: "#4285f4", border: "1px solid rgba(66,133,244,0.2)" }}>
                      {t.key}{t.value ? `=${t.value}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: "rgba(52,168,83,0.08)", border: "1px solid rgba(52,168,83,0.25)", borderRadius: 12, padding: 14, fontSize: 12, color: muted }}>
            <div style={{ color: "#34a853", fontWeight: 700, marginBottom: 4 }}>Cloud Storage Pricing</div>
            <div style={{ marginBottom: 2 }}>Storage costs start at <strong style={{ color: text }}>$0.020/GB/month</strong> (Standard).</div>
            <div style={{ marginBottom: 2 }}>Egress charges apply for data leaving the region.</div>
            <div>No bucket creation fees — only pay for what you store.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
