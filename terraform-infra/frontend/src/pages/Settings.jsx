import { useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import { getCredentials, updateCredentials, testCredentials } from "../api/api"

const CLOUD_COLORS = {
  aws:   { primary: "#FF9900", bg: "rgba(255,153,0,0.08)",   border: "rgba(255,153,0,0.25)",  label: "Amazon Web Services" },
  azure: { primary: "#0078D4", bg: "rgba(0,120,212,0.08)",   border: "rgba(0,120,212,0.25)",  label: "Microsoft Azure" },
  gcp:   { primary: "#4285F4", bg: "rgba(66,133,244,0.08)",  border: "rgba(66,133,244,0.25)", label: "Google Cloud Platform" },
}

const AWS_FIELDS = [
  { key: "AWS_ACCESS_KEY_ID",     label: "Access Key ID",     placeholder: "AKIAIOSFODNN7EXAMPLE", secret: false },
  { key: "AWS_SECRET_ACCESS_KEY", label: "Secret Access Key", placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", secret: true },
  { key: "AWS_DEFAULT_REGION",    label: "Default Region",    placeholder: "ap-south-1", secret: false },
]

const AZURE_SECTIONS = [
  {
    label: "Common",
    fields: [{ key: "AZURE_TENANT_ID", label: "Tenant ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret: false }],
  },
  {
    label: "Production Subscription",
    prefix: "PROD",
    fields: [
      { key: "AZURE_PROD_SUBSCRIPTION_ID", label: "Subscription ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret: false },
      { key: "AZURE_PROD_CLIENT_ID",        label: "Client ID",       placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret: false },
      { key: "AZURE_PROD_CLIENT_SECRET",    label: "Client Secret",   placeholder: "your-client-secret", secret: true },
    ],
  },
  {
    label: "Non-Production Subscription",
    prefix: "NONPROD",
    fields: [
      { key: "AZURE_NONPROD_SUBSCRIPTION_ID", label: "Subscription ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret: false },
      { key: "AZURE_NONPROD_CLIENT_ID",        label: "Client ID",       placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret: false },
      { key: "AZURE_NONPROD_CLIENT_SECRET",    label: "Client Secret",   placeholder: "your-client-secret", secret: true },
    ],
  },
  {
    label: "Connectivity Subscription (Hub)",
    prefix: "CONNECTIVITY",
    fields: [
      { key: "AZURE_CONNECTIVITY_SUBSCRIPTION_ID", label: "Subscription ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret: false },
      { key: "AZURE_CONNECTIVITY_CLIENT_ID",        label: "Client ID",       placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret: false },
      { key: "AZURE_CONNECTIVITY_CLIENT_SECRET",    label: "Client Secret",   placeholder: "your-client-secret", secret: true },
    ],
  },
]

const GCP_FIELDS = [
  { key: "GCP_PROJECT_ID",       label: "Default Project ID",    placeholder: "my-project-123456", secret: false },
  { key: "GCP_ORG_ID",           label: "Organization ID",       placeholder: "123456789012 (optional — lists all org projects)", secret: false },
  { key: "GCP_CREDENTIALS_JSON", label: "Service Account JSON",  placeholder: '{"type":"service_account","project_id":"..."}', secret: true, textarea: true },
]

function FieldInput({ field, value, onChange, dark }) {
  const [show, setShow] = useState(false)
  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"
  const bg          = dark ? "rgba(255,255,255,0.04)" : "#fff"
  const text        = dark ? "#e2e8f0" : "#1e293b"

  const base = {
    width: "100%", boxSizing: "border-box",
    background: bg, border: `1px solid ${borderColor}`,
    borderRadius: 8, padding: "8px 12px",
    fontSize: 13, color: text, fontFamily: "inherit",
    transition: "border 0.2s",
  }

  if (field.textarea) {
    return (
      <textarea
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        style={{ ...base, resize: "vertical" }}
        onFocus={e => e.currentTarget.style.borderColor = "#00d4aa55"}
        onBlur={e => e.currentTarget.style.borderColor = borderColor}
      />
    )
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        type={field.secret && !show ? "password" : "text"}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        style={{ ...base, paddingRight: field.secret ? 36 : 12 }}
        onFocus={e => e.currentTarget.style.borderColor = "#00d4aa55"}
        onBlur={e => e.currentTarget.style.borderColor = borderColor}
      />
      {field.secret && (
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: dark ? "#64748b" : "#94a3b8",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {show
              ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
              : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
            }
          </svg>
        </button>
      )}
    </div>
  )
}

function TestButton({ provider, dark, onResult }) {
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      const r = await testCredentials(provider)
      onResult(r.data)
    } catch {
      onResult({ ok: false, message: "Request failed" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={run}
      disabled={loading}
      style={{
        padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
        background: "transparent",
        border: `1px solid ${CLOUD_COLORS[provider].primary}55`,
        color: CLOUD_COLORS[provider].primary,
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.6 : 1,
        transition: "all 0.2s",
      }}
    >
      {loading ? "Testing…" : "Test Connection"}
    </button>
  )
}

function ProviderCard({ provider, label, children, dark, onTest, testResult }) {
  const c          = CLOUD_COLORS[provider]
  const cardBg     = dark ? "rgba(255,255,255,0.025)" : "#fff"
  const borderClr  = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"

  return (
    <div style={{
      background: cardBg, border: `1px solid ${borderClr}`, borderRadius: 16,
      overflow: "hidden", marginBottom: 24,
    }}>
      <div style={{
        padding: "16px 20px",
        background: c.bg, borderBottom: `1px solid ${c.border}`,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${c.primary}, ${c.primary}bb)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: provider === "gcp" ? 9 : 11, fontWeight: 800, color: "#fff",
          boxShadow: `0 2px 12px ${c.primary}40`,
        }}>
          {provider === "aws" ? "AWS" : provider === "azure" ? "AZ" : "GCP"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.primary }}>{label}</div>
          <div style={{ fontSize: 11, color: dark ? "#64748b" : "#94a3b8", marginTop: 1 }}>
            Organization-level credentials
          </div>
        </div>
        <TestButton provider={provider} dark={dark} onResult={onTest} />
      </div>

      {testResult && (
        <div style={{
          padding: "10px 20px",
          background: testResult.ok
            ? "rgba(0,212,170,0.08)"
            : "rgba(244,63,94,0.08)",
          borderBottom: `1px solid ${testResult.ok ? "rgba(0,212,170,0.2)" : "rgba(244,63,94,0.2)"}`,
          display: "flex", alignItems: "center", gap: 8, fontSize: 12,
          color: testResult.ok ? "#00d4aa" : "#f43f5e",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {testResult.ok
              ? <path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/>
              : <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>
            }
          </svg>
          {testResult.message}
        </div>
      )}

      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

export default function Settings() {
  const { dark } = useTheme()
  const user     = JSON.parse(localStorage.getItem("user") || "{}")
  const isAdmin  = user.role === "admin"

  const [creds,      setCreds]      = useState({ aws: {}, azure: {}, gcp: {} })
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [testResult, setTestResult] = useState({})

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const text    = dark ? "#e2e8f0" : "#1e293b"
  const muted   = dark ? "#64748b" : "#94a3b8"
  const labelClr = dark ? "#cbd5e1" : "#475569"

  useEffect(() => {
    getCredentials()
      .then(r => setCreds(r.data || { aws: {}, azure: {}, gcp: {} }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function setField(provider, key, val) {
    setCreds(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [key]: val },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await updateCredentials(creds)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert("Failed to save credentials")
    } finally {
      setSaving(false)
    }
  }

  function LabelText({ children }) {
    return (
      <div style={{ fontSize: 12, fontWeight: 600, color: labelClr, marginBottom: 5 }}>
        {children}
      </div>
    )
  }

  function SectionTitle({ children }) {
    return (
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color: muted,
        borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
        paddingBottom: 8, marginBottom: 14, marginTop: 18,
      }}>
        {children}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 40, color: muted, fontSize: 14 }}>Loading credentials…</div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, padding: "32px 40px", color: text }}>
      <style>{`
        input::placeholder, textarea::placeholder { color: ${muted}; opacity: 0.7; }
        input:focus, textarea:focus { outline: none; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px", marginBottom: 6 }}>
          Organization Settings
        </div>
        <div style={{ fontSize: 13, color: muted }}>
          Configure cloud provider credentials used to discover accounts, subscriptions, and projects across your organization.
        </div>
        {!isAdmin && (
          <div style={{
            marginTop: 12, padding: "10px 16px", borderRadius: 10,
            background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
            color: "#f59e0b", fontSize: 12, display: "flex", alignItems: "center", gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Read-only: admin role required to update credentials.
          </div>
        )}
      </div>

      {/* AWS */}
      <ProviderCard
        provider="aws" label="Amazon Web Services" dark={dark}
        onTest={r => setTestResult(t => ({ ...t, aws: r }))}
        testResult={testResult.aws}
      >
        {AWS_FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <LabelText>{f.label}</LabelText>
            <FieldInput field={f} value={creds.aws?.[f.key]} onChange={v => setField("aws", f.key, v)} dark={dark} />
          </div>
        ))}
      </ProviderCard>

      {/* Azure */}
      <ProviderCard
        provider="azure" label="Microsoft Azure" dark={dark}
        onTest={r => setTestResult(t => ({ ...t, azure: r }))}
        testResult={testResult.azure}
      >
        {AZURE_SECTIONS.map(section => (
          <div key={section.label}>
            <SectionTitle>{section.label}</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {section.fields.map(f => (
                <div key={f.key} style={{ gridColumn: f.key.endsWith("SECRET") || f.key === "AZURE_TENANT_ID" ? "1 / -1" : "auto" }}>
                  <LabelText>{f.label}</LabelText>
                  <FieldInput field={f} value={creds.azure?.[f.key]} onChange={v => setField("azure", f.key, v)} dark={dark} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </ProviderCard>

      {/* GCP */}
      <ProviderCard
        provider="gcp" label="Google Cloud Platform" dark={dark}
        onTest={r => setTestResult(t => ({ ...t, gcp: r }))}
        testResult={testResult.gcp}
      >
        {GCP_FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <LabelText>{f.label}</LabelText>
            <FieldInput field={f} value={creds.gcp?.[f.key]} onChange={v => setField("gcp", f.key, v)} dark={dark} />
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: 11, color: muted }}>
          Paste the full service account JSON. The account needs <code>resourcemanager.projects.list</code> at the org level.
        </div>
      </ProviderCard>

      {/* Save Button */}
      {isAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 28px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: saving ? "rgba(0,212,170,0.4)" : "linear-gradient(135deg,#00d4aa,#0ea5e9)",
              border: "none", color: "#fff", cursor: saving ? "default" : "pointer",
              boxShadow: "0 4px 16px rgba(0,212,170,0.3)",
              transition: "all 0.2s",
            }}
          >
            {saving ? "Saving…" : "Save Credentials"}
          </button>
          {saved && (
            <span style={{ fontSize: 13, color: "#00d4aa", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/>
              </svg>
              Saved successfully
            </span>
          )}
        </div>
      )}
    </div>
  )
}
