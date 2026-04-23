import { useState } from "react"
import { useTheme } from "../context/ThemeContext"
import { getCloudIndex, getCloudLog } from "../api/api"

const CLOUDS = ["aws", "azure", "gcp"]
const CLOUD_COLORS  = { aws: "#f59e0b", azure: "#0078D4", gcp: "#4285f4" }
const CLOUD_LABELS  = { aws: "Amazon Web Services", azure: "Microsoft Azure", gcp: "Google Cloud Platform" }
const CLOUD_ICONS   = { aws: "☁️", azure: "🔷", gcp: "🌐" }
const ENVS          = ["dev", "staging", "prod"]
const ENV_COLORS    = { dev: "#3b82f6", staging: "#f59e0b", prod: "#00d4aa" }

const STATUS_COLORS = {
  completed:   "#00d4aa",
  failed:      "#f43f5e",
  provisioning:"#a78bfa",
  planning:    "#3b82f6",
  pending:     "#f59e0b",
}

function formatDate(iso) {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function TFState() {
  const { dark } = useTheme()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text     = dark ? "#f1f5f9" : "#0f172a"
  const muted    = dark ? "#475569" : "#64748b"
  const subtle   = dark ? "#1e293b" : "#f1f5f9"
  const codeBg   = dark ? "#020817" : "#f8fafc"

  const [selectedCloud,  setSelectedCloud]  = useState(null)
  const [activeTab,      setActiveTab]      = useState("deployments")
  const [deployments,    setDeployments]    = useState([])
  const [totalDeploys,   setTotalDeploys]   = useState(0)
  const [logEnv,         setLogEnv]         = useState("dev")
  const [logContent,     setLogContent]     = useState("")
  const [loadingIndex,   setLoadingIndex]   = useState(false)
  const [loadingLog,     setLoadingLog]     = useState(false)

  const accent = selectedCloud ? CLOUD_COLORS[selectedCloud] : "#00d4aa"

  async function selectCloud(cloud) {
    if (selectedCloud === cloud) { setSelectedCloud(null); return }
    setSelectedCloud(cloud)
    setActiveTab("deployments")
    setLogContent("")
    setLoadingIndex(true)
    setDeployments([])
    try {
      const r = await getCloudIndex(cloud)
      setDeployments(r.data.deployments || [])
      setTotalDeploys(r.data.total || 0)
    } catch {
      setDeployments([])
    }
    setLoadingIndex(false)
  }

  async function loadLog(cloud, env) {
    setLoadingLog(true)
    setLogContent("")
    try {
      const r = await getCloudLog(cloud, env)
      setLogContent(r.data.content || "(no logs yet)")
    } catch {
      setLogContent("Could not load logs.")
    }
    setLoadingLog(false)
  }

  function switchTab(tab) {
    setActiveTab(tab)
    if (tab === "log" && selectedCloud) {
      loadLog(selectedCloud, logEnv)
    }
  }

  function changeLogEnv(env) {
    setLogEnv(env)
    if (selectedCloud) loadLog(selectedCloud, env)
  }

  return (
    <div style={{ padding: "28px", background: bg, minHeight: "100vh", transition: "all 0.3s ease" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: "28px", animation: "fadeUp 0.4s ease both" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: text, margin: 0 }}>Terraform State &amp; Logs</h1>
        <p style={{ fontSize: "13px", color: muted, marginTop: "4px" }}>
          Browse deployment history and logs stored per cloud in S3
        </p>
      </div>

      {/* Cloud cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "24px" }}>
        {CLOUDS.map((cloud, i) => {
          const color  = CLOUD_COLORS[cloud]
          const active = selectedCloud === cloud
          return (
            <button key={cloud} onClick={() => selectCloud(cloud)} style={{
              padding: "20px 22px", borderRadius: "14px",
              border: `2px solid ${active ? color : border}`,
              background: active ? `${color}18` : surface,
              cursor: "pointer", textAlign: "left",
              animation: `fadeUp 0.5s ease ${i * 80}ms both`,
              transition: "all 0.2s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ fontSize: "26px" }}>{CLOUD_ICONS[cloud]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: active ? color : text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {cloud}
                  </div>
                  <div style={{ fontSize: "11px", color: muted, marginTop: "3px" }}>
                    {active ? CLOUD_LABELS[cloud] : "Click to explore"}
                  </div>
                </div>
                {active && (
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Detail panel */}
      {selectedCloud && (
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px", overflow: "hidden", animation: "fadeUp 0.3s ease both" }}>

          {/* Breadcrumb */}
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "15px" }}>{CLOUD_ICONS[selectedCloud]}</span>
            <span style={{ fontSize: "14px", fontWeight: "600", color: text, textTransform: "uppercase" }}>{selectedCloud}</span>
            <span style={{ fontSize: "13px", color: muted }}>/ infrastructure</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
              {!loadingIndex && (
                <span style={{ fontSize: "11px", background: `${accent}18`, color: accent, border: `1px solid ${accent}40`, borderRadius: "20px", padding: "2px 10px", fontWeight: "600" }}>
                  {totalDeploys} deployment{totalDeploys !== 1 ? "s" : ""}
                </span>
              )}
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: accent }} />
              <span style={{ fontSize: "11px", color: accent, fontWeight: "500", textTransform: "uppercase" }}>{selectedCloud}</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${border}` }}>
            {[
              { key: "deployments", label: "Deployments", icon: "🗂️" },
              { key: "log",         label: "Deploy Log",  icon: "📋" },
            ].map(tab => (
              <button key={tab.key} onClick={() => switchTab(tab.key)} style={{
                padding: "13px 24px", border: "none", background: "transparent", cursor: "pointer",
                borderBottom: `2px solid ${activeTab === tab.key ? accent : "transparent"}`,
                color: activeTab === tab.key ? accent : muted,
                fontWeight: activeTab === tab.key ? "600" : "400",
                fontSize: "13px", display: "flex", alignItems: "center", gap: "7px",
                transition: "all 0.15s ease",
              }}>
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: "20px" }}>

            {/* ── Deployments tab ── */}
            {activeTab === "deployments" && (
              loadingIndex
                ? <EmptyMsg muted={muted}>Loading deployment manifest from S3…</EmptyMsg>
                : deployments.length === 0
                  ? <EmptyMsg muted={muted}>
                      No deployments found in <b>s3://aionos-terraform-state-3305/aionos/{selectedCloud}/index.json</b>
                    </EmptyMsg>
                  : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${border}` }}>
                          {["Req #", "Resource", "Type", "Env", "Status", "Deployed At", "By"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: "700", color: muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...deployments].reverse().map((d, i) => {
                          const statusColor = STATUS_COLORS[d.status] || "#64748b"
                          const envColor    = ENV_COLORS[d.environment] || "#64748b"
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${subtle}` }}>
                              <td style={{ padding: "12px 12px", fontSize: "12px", color: accent, fontFamily: "monospace", fontWeight: "600" }}>
                                #{d.req_id}
                              </td>
                              <td style={{ padding: "12px 12px", fontSize: "12px", color: text, fontWeight: "500" }}>
                                {d.resource_name || "-"}
                              </td>
                              <td style={{ padding: "12px 12px" }}>
                                <span style={{ fontSize: "10px", fontFamily: "monospace", background: subtle, color: muted, padding: "2px 7px", borderRadius: "6px" }}>
                                  {d.resource_type || "-"}
                                </span>
                              </td>
                              <td style={{ padding: "12px 12px" }}>
                                <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", background: `${envColor}18`, color: envColor, border: `1px solid ${envColor}40`, padding: "2px 8px", borderRadius: "20px" }}>
                                  {d.environment}
                                </span>
                              </td>
                              <td style={{ padding: "12px 12px" }}>
                                <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}40`, padding: "2px 8px", borderRadius: "20px" }}>
                                  {d.status}
                                </span>
                              </td>
                              <td style={{ padding: "12px 12px", fontSize: "11px", color: muted }}>{formatDate(d.deployed_at)}</td>
                              <td style={{ padding: "12px 12px", fontSize: "11px", color: muted }}>{d.username || "-"}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
            )}

            {/* ── Deploy Log tab ── */}
            {activeTab === "log" && (
              <div>
                {/* Env selector */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  {ENVS.map(env => {
                    const c = ENV_COLORS[env]
                    const active = logEnv === env
                    return (
                      <button key={env} onClick={() => changeLogEnv(env)} style={{
                        padding: "6px 18px", borderRadius: "20px", border: `1px solid ${active ? c : border}`,
                        background: active ? `${c}18` : "transparent", cursor: "pointer",
                        fontSize: "12px", fontWeight: active ? "700" : "400",
                        color: active ? c : muted, transition: "all 0.15s ease",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>
                        {env}
                      </button>
                    )
                  })}
                </div>

                {loadingLog
                  ? <EmptyMsg muted={muted}>Loading deploy log from S3…</EmptyMsg>
                  : (
                    <div style={{ background: codeBg, border: `1px solid ${border}`, borderRadius: "10px", overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12px", fontWeight: "600", color: text, fontFamily: "monospace" }}>
                          aionos/{selectedCloud}/{logEnv}/deploy.log
                        </span>
                        <span style={{ fontSize: "10px", color: muted, background: subtle, borderRadius: "6px", padding: "2px 8px" }}>
                          {logContent ? logContent.split("\n").length + " lines" : ""}
                        </span>
                      </div>
                      <pre style={{
                        margin: 0, padding: "16px",
                        fontSize: "11px", fontFamily: "'Courier New', monospace",
                        color: dark ? "#e2e8f0" : "#0f172a",
                        overflowX: "auto", overflowY: "auto",
                        maxHeight: "520px", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {logContent || "(no logs yet for this environment)"}
                      </pre>
                    </div>
                  )
                }
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

function EmptyMsg({ muted, children }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: muted, fontSize: "13px", lineHeight: "1.7" }}>
      {children}
    </div>
  )
}
