import { useState } from "react"
import { useTheme } from "../context/ThemeContext"
import { getEnvTFState, getEnvLogs, getLogFile } from "../api/api"

const ENVS = ["dev", "staging", "prod"]
const ENV_COLORS = { dev: "#3b82f6", staging: "#f59e0b", prod: "#00d4aa" }

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "-"
  if (bytes < 1024)        return bytes + " B"
  if (bytes < 1048576)     return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / 1048576).toFixed(1) + " MB"
}

function formatDate(iso) {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const FILE_ICONS = { "main.tf": "🔧", "terraform.tfvars": "⚙️", "apply.log": "📝" }

export default function TFState() {
  const { dark } = useTheme()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f1f5f9"
  const codeBg  = dark ? "#020817" : "#f8fafc"

  const [selectedEnv,  setSelectedEnv]  = useState(null)
  const [activeTab,    setActiveTab]    = useState("tfstate")
  const [tfstateFiles, setTfstateFiles] = useState([])
  const [logFolders,   setLogFolders]   = useState([])
  const [expandedReq,  setExpandedReq]  = useState(null)
  const [fileContent,  setFileContent]  = useState(null)   // { name, content }
  const [loadingState, setLoadingState] = useState(false)
  const [loadingLogs,  setLoadingLogs]  = useState(false)
  const [loadingFile,  setLoadingFile]  = useState(false)

  // ── loaders ──────────────────────────────────────────────────────
  async function loadTFState(env) {
    setLoadingState(true)
    setTfstateFiles([])
    try { const r = await getEnvTFState(env); setTfstateFiles(r.data) }
    catch { setTfstateFiles([]) }
    setLoadingState(false)
  }

  async function loadLogs(env) {
    setLoadingLogs(true)
    setLogFolders([])
    try { const r = await getEnvLogs(env); setLogFolders(r.data) }
    catch { setLogFolders([]) }
    setLoadingLogs(false)
  }

  // ── handlers ─────────────────────────────────────────────────────
  function selectEnv(env) {
    if (selectedEnv === env) { setSelectedEnv(null); return }
    setSelectedEnv(env)
    setActiveTab("tfstate")
    setExpandedReq(null)
    setFileContent(null)
    loadTFState(env)
  }

  function switchTab(tab) {
    setActiveTab(tab)
    setExpandedReq(null)
    setFileContent(null)
    if (tab === "tfstate") loadTFState(selectedEnv)
    else loadLogs(selectedEnv)
  }

  function toggleReq(reqId) {
    if (expandedReq === reqId) { setExpandedReq(null); setFileContent(null) }
    else { setExpandedReq(reqId); setFileContent(null) }
  }

  async function viewFile(reqId, filename) {
    setLoadingFile(true)
    setFileContent(null)
    try {
      const r = await getLogFile(selectedEnv, reqId, filename)
      setFileContent({ name: filename, content: r.data.content })
    } catch {
      setFileContent({ name: filename, content: "Could not load file." })
    }
    setLoadingFile(false)
  }

  // ── render ───────────────────────────────────────────────────────
  const accent = selectedEnv ? ENV_COLORS[selectedEnv] : "#00d4aa"

  return (
    <div style={{ padding: "28px", background: bg, minHeight: "100vh", transition: "all 0.3s ease" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: "28px", animation: "fadeUp 0.4s ease both" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: text, margin: 0 }}>Terraform State &amp; Logs</h1>
        <p style={{ fontSize: "13px", color: muted, marginTop: "4px" }}>
          Browse tfstate files and deployment logs stored in S3 per environment
        </p>
      </div>

      {/* Environment cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "24px" }}>
        {ENVS.map((env, i) => {
          const color  = ENV_COLORS[env]
          const active = selectedEnv === env
          return (
            <button key={env} onClick={() => selectEnv(env)} style={{
              padding: "20px 22px", borderRadius: "14px",
              border: `2px solid ${active ? color : border}`,
              background: active ? `${color}18` : surface,
              cursor: "pointer", textAlign: "left",
              animation: `fadeUp 0.5s ease ${i * 80}ms both`,
              transition: "all 0.2s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ fontSize: "26px" }}>{active ? "📂" : "📁"}</div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: active ? color : text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {env}
                  </div>
                  <div style={{ fontSize: "11px", color: muted, marginTop: "3px" }}>
                    {active ? "Exploring..." : "Click to explore"}
                  </div>
                </div>
                {active && (
                  <div style={{ marginLeft: "auto", width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Detail panel */}
      {selectedEnv && (
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px", overflow: "hidden", animation: "fadeUp 0.3s ease both" }}>

          {/* Panel breadcrumb */}
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "15px" }}>📂</span>
            <span style={{ fontSize: "14px", fontWeight: "600", color: text }}>{selectedEnv}</span>
            <span style={{ fontSize: "13px", color: muted }}>/ infrastructure</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: accent }} />
              <span style={{ fontSize: "11px", color: accent, fontWeight: "500", textTransform: "uppercase" }}>{selectedEnv}</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${border}` }}>
            {[{ key: "tfstate", label: "TF State", icon: "🗂️" }, { key: "logs", label: "Deployment Logs", icon: "📋" }].map(tab => (
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

            {/* ── TF State tab ─────────────────────────────────── */}
            {activeTab === "tfstate" && (
              loadingState
                ? <EmptyMsg muted={muted}>Loading state files from S3...</EmptyMsg>
                : tfstateFiles.length === 0
                  ? <EmptyMsg muted={muted}>No .tfstate files found in <b>s3://aionos-terraform-state-3305/{selectedEnv}/</b></EmptyMsg>
                  : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${border}` }}>
                          {["State File Key", "Size", "Last Modified"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: "700", color: muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tfstateFiles.map((f, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${subtle}`, transition: "background 0.1s" }}>
                            <td style={{ padding: "13px 12px", fontSize: "12px", color: text, fontFamily: "monospace" }}>
                              <span style={{ marginRight: "8px" }}>🗂️</span>{f.key}
                            </td>
                            <td style={{ padding: "13px 12px", fontSize: "12px", color: muted }}>{formatSize(f.size)}</td>
                            <td style={{ padding: "13px 12px", fontSize: "12px", color: muted }}>{formatDate(f.last_modified)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
            )}

            {/* ── Logs tab ─────────────────────────────────────── */}
            {activeTab === "logs" && (
              loadingLogs
                ? <EmptyMsg muted={muted}>Loading deployment logs from S3...</EmptyMsg>
                : logFolders.length === 0
                  ? <EmptyMsg muted={muted}>No deployment logs found in <b>s3://aionos-terraform-state-3305/logs/{selectedEnv}/</b></EmptyMsg>
                  : (
                    <div style={{ display: "grid", gridTemplateColumns: fileContent || loadingFile ? "1fr 1.4fr" : "1fr", gap: "16px" }}>

                      {/* Left — req folder list */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {logFolders.map(req => (
                          <div key={req.req_id} style={{
                            border: `1px solid ${expandedReq === req.req_id ? accent : border}`,
                            borderRadius: "10px", overflow: "hidden", transition: "border-color 0.15s",
                          }}>
                            {/* Folder row */}
                            <button onClick={() => toggleReq(req.req_id)} style={{
                              width: "100%", padding: "10px 14px", border: "none",
                              background: expandedReq === req.req_id ? `${accent}12` : subtle,
                              cursor: "pointer", display: "flex", alignItems: "center",
                              justifyContent: "space-between", transition: "background 0.15s",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                                <span style={{ fontSize: "15px" }}>{expandedReq === req.req_id ? "📂" : "📁"}</span>
                                <span style={{ fontSize: "13px", fontWeight: "600", color: text }}>{req.req_id}</span>
                                <span style={{ fontSize: "10px", color: muted, background: border, borderRadius: "20px", padding: "2px 8px" }}>
                                  {req.files.length} file{req.files.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <span style={{ fontSize: "11px", color: muted }}>{formatDate(req.timestamp)}</span>
                            </button>

                            {/* File list */}
                            {expandedReq === req.req_id && (
                              <div style={{ padding: "8px 12px 10px", background: surface, display: "flex", flexDirection: "column", gap: "3px" }}>
                                {req.files.map(file => (
                                  <button key={file} onClick={() => viewFile(req.req_id, file)} style={{
                                    display: "flex", alignItems: "center", gap: "8px",
                                    padding: "7px 10px", border: "none", borderRadius: "8px",
                                    background: fileContent?.name === file ? `${accent}18` : "transparent",
                                    cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                                  }}>
                                    <span style={{ fontSize: "13px" }}>{FILE_ICONS[file] || "📄"}</span>
                                    <span style={{ fontSize: "12px", fontFamily: "monospace", color: fileContent?.name === file ? accent : text }}>
                                      {file}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Right — file viewer */}
                      {(fileContent || loadingFile) && (
                        <div style={{ background: codeBg, border: `1px solid ${border}`, borderRadius: "10px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                            <span style={{ fontSize: "12px", fontWeight: "600", color: text, fontFamily: "monospace" }}>
                              {loadingFile ? "Loading…" : fileContent?.name}
                            </span>
                            {fileContent && !loadingFile && (
                              <button onClick={() => setFileContent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: "16px", lineHeight: 1 }}>✕</button>
                            )}
                          </div>
                          <pre style={{
                            margin: 0, padding: "16px",
                            fontSize: "11px", fontFamily: "'Courier New', monospace",
                            color: dark ? "#e2e8f0" : "#0f172a",
                            overflowX: "auto", overflowY: "auto",
                            maxHeight: "480px", whiteSpace: "pre-wrap", wordBreak: "break-word",
                            flex: 1,
                          }}>
                            {loadingFile ? "Loading file content…" : fileContent?.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
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
