import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import {
  listGCPInstances, startGCPInstance, stopGCPInstance, getGCPCost,
  getGCPInstanceConnectInfo, getGCPInstanceSchedule, setGCPInstanceSchedule,
  getGCPInstanceFirewall, updateGCPInstanceFirewall,
  getGCPInstanceSSHKey, fixGCPInstanceSSHKey, regenerateGCPSSHKey,
} from "../api/api"
import ResourceBudgetModal from "../components/ResourceBudgetModal"

function SvgIcon({ d, size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const STATUS_COLORS = {
  RUNNING:      { bg:"rgba(34,197,94,0.15)",   color:"#22c55e", dot:"#22c55e"  },
  TERMINATED:   { bg:"rgba(100,116,139,0.15)", color:"#94a3b8", dot:"#94a3b8"  },
  STOPPED:      { bg:"rgba(245,158,11,0.15)",  color:"#f59e0b", dot:"#f59e0b"  },
  STAGING:      { bg:"rgba(66,133,244,0.15)",  color:"#4285F4", dot:"#4285F4"  },
  STOPPING:     { bg:"rgba(245,158,11,0.12)",  color:"#f59e0b", dot:"#f59e0b"  },
  PROVISIONING: { bg:"rgba(66,133,244,0.12)",  color:"#4285F4", dot:"#4285F4"  },
  SUSPENDED:    { bg:"rgba(239,68,68,0.12)",   color:"#ef4444", dot:"#ef4444"  },
}

const SCHEDULE_PRESETS = [
  { label:"Office Hours", auto_start:"09:00", auto_stop:"18:00" },
  { label:"Engineering Day", auto_start:"10:00", auto_stop:"20:00" },
  { label:"Night Batch", auto_start:"21:00", auto_stop:"06:00" },
  { label:"Always On", auto_start:"", auto_stop:"" },
]

function formatScheduleTime(value) {
  if (!value) return "Not set"
  const [hourText, minute = "00"] = value.split(":")
  const hour = Number(hourText)
  const suffix = hour >= 12 ? "PM" : "AM"
  const normalized = hour % 12 || 12
  return `${normalized}:${minute} ${suffix}`
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.TERMINATED
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px",
      borderRadius:20, background:s.bg, color:s.color, fontSize:10, fontWeight:700,
      whiteSpace:"nowrap" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:s.dot, flexShrink:0,
        boxShadow: status==="RUNNING" ? `0 0 4px ${s.dot}` : "none" }} />
      {status}
    </span>
  )
}

function ScheduleBadge({ instance, dark }) {
  const start = instance.labels?.auto_start || ""
  const stop = instance.labels?.auto_stop || ""
  const hasSchedule = Boolean(start || stop)
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px",
      borderRadius:999, fontSize:10, fontWeight:700,
      color: hasSchedule ? "#4285F4" : (dark ? "#94a3b8" : "#64748b"),
      background: hasSchedule ? "rgba(66,133,244,0.12)" : (dark ? "rgba(148,163,184,0.10)" : "rgba(100,116,139,0.08)"),
      border: hasSchedule ? "1px solid rgba(66,133,244,0.2)" : (dark ? "1px solid rgba(148,163,184,0.18)" : "1px solid rgba(100,116,139,0.14)"),
    }}>
      {hasSchedule ? "Daily schedule" : "No schedule"}
    </span>
  )
}

function ActionBtn({ label, onClick, disabled, color, bg }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:"7px 12px", fontSize:11, fontWeight:700, borderRadius:9, cursor:disabled?"not-allowed":"pointer",
        background: hov && !disabled ? bg.replace("0.15","0.26") : bg,
        border:`1px solid ${color}45`, color, transition:"all 0.16s ease",
        opacity: disabled ? 0.45 : 1, letterSpacing:"0.01em",
        boxShadow: hov && !disabled ? `0 6px 18px ${color}20` : "none",
      }}>
      {label}
    </button>
  )
}

function ModalOverlay({ onClose, children }) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.68)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
    >
      {children}
    </div>
  )
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      style={{ padding:"7px 12px", borderRadius:8, border:"1px solid rgba(66,133,244,0.35)", background:"rgba(66,133,244,0.10)", color:"#4285F4", cursor:"pointer", fontSize:12, fontWeight:600 }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

function GCPConnectModal({ instance, dark, onClose }) {
  const [info,      setInfo]      = useState(null)
  const [storedKey, setStoredKey] = useState(null)  // { filename, username, private_key }
  const [fetchErr,  setFetchErr]  = useState("")
  const [loading,   setLoading]   = useState(true)
  const [fixing,    setFixing]    = useState(false)
  const [fixMsg,    setFixMsg]    = useState("")
  const [fixErr,    setFixErr]    = useState("")
  const [regen,     setRegen]     = useState(false)
  const [regenErr,  setRegenErr]  = useState("")
  const [showRegen, setShowRegen] = useState(false)
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const txt     = dark ? "#e2e8f0" : "#1e293b"
  const muted   = dark ? "#64748b" : "#94a3b8"
  const codeBg  = dark ? "#0b1220" : "#f1f5f9"

  useEffect(() => {
    Promise.allSettled([
      getGCPInstanceConnectInfo(instance.name, instance.zone),
      getGCPInstanceSSHKey(instance.name, instance.zone),
    ]).then(([connResult, keyResult]) => {
      if (connResult.status === "fulfilled") setInfo(connResult.value.data)
      else setFetchErr(connResult.reason?.response?.data?.detail || "Could not fetch connection details.")
      if (keyResult.status === "fulfilled") setStoredKey(keyResult.value.data)
    }).finally(() => setLoading(false))
  }, [instance.name, instance.zone])

  function downloadPem(privateKey, filename) {
    const blob = new Blob([privateKey], { type: "text/plain" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFix() {
    setFixing(true)
    setFixMsg("")
    setFixErr("")
    try {
      const r = await fixGCPInstanceSSHKey(instance.name, instance.zone)
      setFixMsg(r.data.message || "SSH key re-applied. Try connecting now.")
    } catch(e) {
      setFixErr(e.response?.data?.detail || "Fix failed")
    } finally { setFixing(false) }
  }

  async function handleRegenerate() {
    setRegen(true)
    setRegenErr("")
    try {
      const r = await regenerateGCPSSHKey(instance.name, instance.zone, info?.ssh_username || "gcpuser")
      setStoredKey(r.data)
      downloadPem(r.data.private_key, r.data.filename)
      const r2 = await getGCPInstanceConnectInfo(instance.name, instance.zone)
      setInfo(r2.data)
      setShowRegen(false)
    } catch(e) {
      setRegenErr(e.response?.data?.detail || "Regeneration failed")
    } finally { setRegen(false) }
  }

  const isLinux     = (info?.os_type || "Linux").toLowerCase() !== "windows"
  const host        = info?.public_ip || info?.private_ip || ""
  const user        = info?.ssh_username || "gcpuser"
  const keyFile     = info?.key_filename  || `${instance.name}-${user}.pem`
  const sshCmd      = info?.ssh_command   || (host ? `ssh -i ${keyFile} ${user}@${host}` : null)
  const hasPublicIp = info?.has_public_ip ?? Boolean(info?.public_ip)

  function CodeRow({ label, value }) {
    return (
      <div style={{ marginBottom:10 }}>
        {label && <div style={{ fontSize:11, color:muted, marginBottom:5, fontWeight:600 }}>{label}</div>}
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <code style={{ flex:1, padding:"9px 12px", borderRadius:8, background:codeBg, color:"#34A853", fontSize:12, overflowX:"auto", wordBreak:"break-all", fontFamily:"monospace" }}>
            {value}
          </code>
          <CopyBtn text={value} />
        </div>
      </div>
    )
  }

  function Step({ n, children }) {
    return (
      <div style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
        <div style={{ width:20, height:20, borderRadius:"50%", background:"rgba(66,133,244,0.18)", color:"#4285F4", fontSize:11, fontWeight:800, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>{n}</div>
        <div style={{ fontSize:12, color:txt, lineHeight:1.6 }}>{children}</div>
      </div>
    )
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width:"100%", maxWidth:660, maxHeight:"90vh", overflowY:"auto", background:surface, border:`1px solid ${border}`, borderRadius:16, padding:24, boxShadow:"0 24px 64px rgba(0,0,0,0.45)", fontFamily:"system-ui,sans-serif" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:18 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:txt }}>Connect — {instance.name}</div>
            <div style={{ fontSize:12, color:muted, marginTop:3 }}>{instance.machine_type} · {instance.zone}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:muted, fontSize:22, cursor:"pointer", lineHeight:1 }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding:32, textAlign:"center", color:muted }}>Loading connection info…</div>
        ) : fetchErr ? (
          <div style={{ padding:14, borderRadius:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)", color:"#ef4444", fontSize:13 }}>
            {fetchErr}
          </div>
        ) : (
          <div style={{ display:"grid", gap:14 }}>

            {/* Status grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                ["Status",     info.status    || "UNKNOWN"],
                ["SSH User",   user],
                ["Public IP",  info.public_ip  || "Not assigned"],
                ["Private IP", info.private_ip || "Not assigned"],
              ].map(([label, value]) => (
                <div key={label} style={{ padding:10, border:`1px solid ${border}`, borderRadius:10 }}>
                  <div style={{ fontSize:10, color:muted, textTransform:"uppercase", marginBottom:3, fontWeight:600 }}>{label}</div>
                  <div style={{ fontSize:12, color:txt, fontWeight:700, wordBreak:"break-all" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* No public IP warning */}
            {!hasPublicIp && (
              <div style={{ padding:12, borderRadius:10, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.28)", color:"#f59e0b", fontSize:12, lineHeight:1.6 }}>
                <strong>No public IP assigned.</strong> SSH via internet is not available.<br />
                Use <strong>GCP Cloud Shell</strong> or <strong>IAP tunnel</strong>:<br />
                <code style={{ display:"block", marginTop:6, padding:"7px 10px", borderRadius:7, background:codeBg, color:"#f59e0b", fontSize:11, fontFamily:"monospace" }}>
                  gcloud compute ssh {user}@{instance.name} --zone={instance.zone} --tunnel-through-iap
                </code>
              </div>
            )}

            {/* SSH section (Linux) */}
            {isLinux && (
              <div style={{ padding:14, borderRadius:10, background:dark?"rgba(66,133,244,0.07)":"rgba(66,133,244,0.04)", border:"1px solid rgba(66,133,244,0.22)" }}>
                <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:10 }}>SSH Connection</div>

                {/* Key download — primary action */}
                {storedKey ? (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:9, background:dark?"rgba(52,168,83,0.1)":"rgba(52,168,83,0.07)", border:"1px solid rgba(52,168,83,0.28)", marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#34A853" }}>SSH key available</div>
                      <div style={{ fontSize:11, color:muted, marginTop:2 }}>{storedKey.filename}</div>
                    </div>
                    <button
                      onClick={() => downloadPem(storedKey.private_key, storedKey.filename)}
                      style={{ padding:"7px 16px", borderRadius:8, border:"1px solid rgba(52,168,83,0.5)", background:"rgba(52,168,83,0.15)", color:"#34A853", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                      ↓ Download .pem
                    </button>
                  </div>
                ) : (
                  <div style={{ padding:"9px 12px", borderRadius:8, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.28)", color:"#f59e0b", fontSize:12, marginBottom:12 }}>
                    No stored key found. If you downloaded the key at launch, use that file. Otherwise use the option below to set a new key.
                  </div>
                )}

                {hasPublicIp && sshCmd && <CodeRow label="Connect command:" value={sshCmd} />}

                {/* Permission fixes */}
                <div style={{ marginTop:10, padding:10, borderRadius:8, background:dark?"rgba(255,255,255,0.03)":"#f8fafc", border:`1px solid ${border}` }}>
                  <div style={{ fontSize:11, fontWeight:700, color:muted, marginBottom:6, textTransform:"uppercase" }}>Fix key permissions before connecting</div>
                  <div style={{ fontSize:11, color:muted, marginBottom:5 }}>Linux / macOS:</div>
                  <CodeRow value={`chmod 400 ${keyFile}`} />
                  <div style={{ fontSize:11, color:muted, marginTop:8, marginBottom:5 }}>Windows (PowerShell):</div>
                  <CodeRow value={`icacls "${keyFile}" /inheritance:r /grant:r "$($env:USERNAME):(R)"`} />
                </div>

                {/* Fix SSH key — uses same key, no new download */}
                {storedKey && (
                  <div style={{ marginTop:10, padding:12, borderRadius:8, background:dark?"rgba(255,255,255,0.03)":"#f8fafc", border:`1px solid ${border}` }}>
                    <div style={{ fontSize:12, fontWeight:700, color:txt, marginBottom:4 }}>SSH still failing with your key?</div>
                    <div style={{ fontSize:11, color:muted, marginBottom:10, lineHeight:1.6 }}>
                      Re-applies the <strong>same key</strong> to the instance with the correct format and disables OS Login override. No new download needed — keep using the same .pem file.
                    </div>
                    {fixErr && <div style={{ fontSize:12, color:"#ef4444", marginBottom:8 }}>{fixErr}</div>}
                    {fixMsg && <div style={{ fontSize:12, color:"#34A853", marginBottom:8 }}>{fixMsg}</div>}
                    <button onClick={handleFix} disabled={fixing} style={{ padding:"7px 16px", borderRadius:8, border:"1px solid rgba(66,133,244,0.4)", background:"rgba(66,133,244,0.1)", color:"#4285F4", fontSize:12, fontWeight:700, cursor:fixing?"not-allowed":"pointer", opacity:fixing?0.7:1 }}>
                      {fixing ? "Fixing…" : "Fix SSH Key (keep same .pem)"}
                    </button>
                  </div>
                )}

                {/* Last resort — generate entirely new key */}
                <div style={{ marginTop:8 }}>
                  <button
                    onClick={() => setShowRegen(v => !v)}
                    style={{ background:"transparent", border:"none", color:muted, fontSize:11, cursor:"pointer", padding:0, textDecoration:"underline" }}>
                    {showRegen ? "Hide" : "Replace with a completely new key"}
                  </button>
                  {showRegen && (
                    <div style={{ marginTop:8, padding:12, borderRadius:8, background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.2)" }}>
                      <div style={{ fontSize:12, color:txt, marginBottom:8, lineHeight:1.6 }}>
                        Generates a brand-new key pair. The old .pem will stop working. Only use this if the original key is permanently lost.
                      </div>
                      {regenErr && <div style={{ fontSize:12, color:"#ef4444", marginBottom:8 }}>{regenErr}</div>}
                      <button onClick={handleRegenerate} disabled={regen} style={{ padding:"7px 16px", borderRadius:8, border:"1px solid rgba(239,68,68,0.4)", background:"rgba(239,68,68,0.1)", color:"#ef4444", fontSize:12, fontWeight:700, cursor:regen?"not-allowed":"pointer" }}>
                        {regen ? "Generating…" : "Replace SSH Key (downloads new .pem)"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RDP section (Windows) */}
            {!isLinux && (
              <div style={{ padding:14, borderRadius:10, background:"rgba(66,133,244,0.06)", border:"1px solid rgba(66,133,244,0.22)", color:txt, fontSize:13, lineHeight:1.7 }}>
                <strong>Remote Desktop (RDP)</strong><br />
                Host: <strong>{info.rdp_host || host || "—"}</strong> &nbsp; Port: <strong>{info.port || 3389}</strong>
              </div>
            )}

            {/* Troubleshooting */}
            <div style={{ padding:14, borderRadius:10, background:dark?"rgba(255,255,255,0.02)":"#f8fafc", border:`1px solid ${border}` }}>
              <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:10 }}>Troubleshooting — if connection fails</div>
              <Step n="1">Make sure the VM status is <strong>RUNNING</strong> (current: <strong>{info.status}</strong>).</Step>
              <Step n="2">Verify port <strong>22</strong> is open in the firewall rule for this instance. If you did not add port 22 at launch, add it under <strong>VPC → Firewall rules</strong>.</Step>
              <Step n="3">Confirm the instance has a <strong>public IP</strong>. If not assigned, you need IAP tunnel or VPN to connect.</Step>
              <Step n="4">The key file must match the one used at launch (<strong>{keyFile}</strong>). Each instance uses a unique key pair.</Step>
              <Step n="5">On first boot startup scripts may still be running. Wait 60–90 seconds after the instance reaches RUNNING state.</Step>
              <Step n="6">If you see <em>"WARNING: UNPROTECTED PRIVATE KEY FILE"</em>, fix permissions (step above) and retry.</Step>
            </div>

          </div>
        )}
      </div>
    </ModalOverlay>
  )
}

const PRESET_PORTS = [
  { label:"SSH",   port:"22"  },
  { label:"HTTP",  port:"80"  },
  { label:"HTTPS", port:"443" },
  { label:"MySQL", port:"3306"},
  { label:"PG",    port:"5432"},
  { label:"Redis", port:"6379"},
  { label:"8080",  port:"8080"},
  { label:"3000",  port:"3000"},
]

function ManageFirewallModal({ instance, dark, onClose }) {
  const [ports,       setPorts]       = useState([])
  const [sourceRange, setSourceRange] = useState("0.0.0.0/0")
  const [network,     setNetwork]     = useState("default")
  const [customPort,  setCustomPort]  = useState("")
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState("")
  const [saved,       setSaved]       = useState(false)

  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const txt     = dark ? "#e2e8f0" : "#1e293b"
  const muted   = dark ? "#64748b" : "#94a3b8"
  const codeBg  = dark ? "#0b1220" : "#f1f5f9"

  useEffect(() => {
    getGCPInstanceFirewall(instance.name, instance.zone)
      .then(r => {
        setPorts(r.data.ports || [])
        setSourceRange(r.data.source_range || "0.0.0.0/0")
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [instance.name, instance.zone])

  function togglePreset(port) {
    setPorts(prev => prev.includes(port) ? prev.filter(p => p !== port) : [...prev, port])
  }

  function addCustom() {
    const p = customPort.trim()
    if (!p) return
    if (!ports.includes(p)) setPorts(prev => [...prev, p])
    setCustomPort("")
  }

  function removePort(p) {
    setPorts(prev => prev.filter(x => x !== p))
  }

  async function save() {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      await updateGCPInstanceFirewall(instance.name, instance.zone, {
        ports,
        source_range: sourceRange,
        network,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch(e) {
      setError(e.response?.data?.detail || "Failed to update firewall")
    } finally { setSaving(false) }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width:"100%", maxWidth:560, background:surface, border:`1px solid ${border}`, borderRadius:16, padding:24, boxShadow:"0 24px 64px rgba(0,0,0,0.45)", fontFamily:"system-ui,sans-serif" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:18 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:txt }}>Firewall Ports — {instance.name}</div>
            <div style={{ fontSize:12, color:muted, marginTop:3 }}>Add or remove TCP ports exposed on this instance</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:muted, fontSize:22, cursor:"pointer" }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding:32, textAlign:"center", color:muted }}>Loading firewall rules…</div>
        ) : (
          <div style={{ display:"grid", gap:16 }}>

            {/* Preset toggles */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:muted, marginBottom:8, textTransform:"uppercase" }}>Quick add</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {PRESET_PORTS.map(({ label, port }) => {
                  const active = ports.includes(port)
                  return (
                    <button key={port} onClick={() => togglePreset(port)} style={{
                      padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer",
                      border: active ? "1px solid rgba(66,133,244,0.6)" : `1px solid ${border}`,
                      background: active ? "rgba(66,133,244,0.18)" : "transparent",
                      color: active ? "#4285F4" : muted,
                      transition:"all 0.15s",
                    }}>
                      {label} ({port})
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom port input */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:muted, marginBottom:8, textTransform:"uppercase" }}>Custom port or range</div>
              <div style={{ display:"flex", gap:8 }}>
                <input
                  value={customPort}
                  onChange={e => setCustomPort(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustom()}
                  placeholder="e.g. 8443 or 8000-8010"
                  style={{ flex:1, padding:"8px 12px", borderRadius:8, border:`1px solid ${border}`, background:codeBg, color:txt, fontSize:13, outline:"none", fontFamily:"monospace" }}
                />
                <button onClick={addCustom} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid rgba(66,133,244,0.4)", background:"rgba(66,133,244,0.12)", color:"#4285F4", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  Add
                </button>
              </div>
            </div>

            {/* Active port chips */}
            {ports.length > 0 && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:muted, marginBottom:8, textTransform:"uppercase" }}>Active ports</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {ports.map(p => (
                    <span key={p} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:20, background:"rgba(52,168,83,0.14)", border:"1px solid rgba(52,168,83,0.35)", color:"#34A853", fontSize:12, fontWeight:700 }}>
                      {p}
                      <button onClick={() => removePort(p)} style={{ background:"none", border:"none", color:"#34A853", cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Source CIDR */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:muted, marginBottom:8, textTransform:"uppercase" }}>Source IP range (CIDR)</div>
              <input
                value={sourceRange}
                onChange={e => setSourceRange(e.target.value)}
                placeholder="0.0.0.0/0"
                style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:`1px solid ${border}`, background:codeBg, color:txt, fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"monospace" }}
              />
              <div style={{ fontSize:11, color:muted, marginTop:4 }}>Use your office IP (e.g. 203.0.113.0/24) to restrict access. 0.0.0.0/0 allows all.</div>
            </div>

            {/* Network field */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:muted, marginBottom:8, textTransform:"uppercase" }}>VPC Network</div>
              <input
                value={network}
                onChange={e => setNetwork(e.target.value)}
                placeholder="default"
                style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:`1px solid ${border}`, background:codeBg, color:txt, fontSize:13, outline:"none", boxSizing:"border-box" }}
              />
            </div>

            {error && (
              <div style={{ padding:10, borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)", color:"#ef4444", fontSize:13 }}>{error}</div>
            )}

            {/* Actions */}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, paddingTop:4 }}>
              <button onClick={onClose} style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${border}`, background:"transparent", color:muted, fontSize:13, cursor:"pointer" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding:"8px 22px", borderRadius:8, border:"none", background: saved ? "#34A853" : "#4285F4", color:"#fff", fontSize:13, fontWeight:700, cursor:saving?"not-allowed":"pointer", opacity:saving?0.7:1, transition:"background 0.3s" }}>
                {saving ? "Applying…" : saved ? "Applied ✓" : `Apply (${ports.length} port${ports.length!==1?"s":""})`}
              </button>
            </div>

          </div>
        )}
      </div>
    </ModalOverlay>
  )
}

function GCPScheduleModal({ instance, dark, onClose, onSaved }) {
  const [autoStart, setAutoStart] = useState("")
  const [autoStop, setAutoStop] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const surface = dark ? "#0f172a" : "#ffffff"
  const border = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const txt = dark ? "#e2e8f0" : "#1e293b"
  const muted = dark ? "#64748b" : "#94a3b8"

  useEffect(() => {
    getGCPInstanceSchedule(instance.name, instance.zone)
      .then(r => {
        setAutoStart(r.data.auto_start || "")
        setAutoStop(r.data.auto_stop || "")
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [instance.name, instance.zone])

  async function save(payload) {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      await setGCPInstanceSchedule(instance.name, instance.zone, payload)
      setSaved(true)
      setTimeout(() => onSaved?.(), 900)
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to save schedule")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width:"100%", maxWidth:460, background:surface, border:`1px solid ${border}`, borderRadius:16, padding:24, boxShadow:"0 24px 64px rgba(0,0,0,0.45)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:18 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:txt }}>Schedule - {instance.name}</div>
            <div style={{ fontSize:12, color:muted, marginTop:3 }}>Daily auto start and stop</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:muted, fontSize:22, cursor:"pointer" }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding:28, textAlign:"center", color:muted }}>Loading schedule...</div>
        ) : (
          <div style={{ display:"grid", gap:14 }}>
            {error && <div style={{ padding:12, borderRadius:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)", color:"#ef4444", fontSize:13 }}>{error}</div>}
            {saved && <div style={{ padding:12, borderRadius:10, background:"rgba(34,197,94,0.10)", border:"1px solid rgba(34,197,94,0.22)", color:"#22c55e", fontSize:13, fontWeight:700 }}>Schedule saved successfully.</div>}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div style={{ padding:12, borderRadius:10, border:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize:10, color:muted, textTransform:"uppercase", marginBottom:4 }}>Start Window</div>
                <div style={{ fontSize:13, color:"#22c55e", fontWeight:700 }}>{formatScheduleTime(autoStart)}</div>
              </div>
              <div style={{ padding:12, borderRadius:10, border:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize:10, color:muted, textTransform:"uppercase", marginBottom:4 }}>Stop Window</div>
                <div style={{ fontSize:13, color:"#f59e0b", fontWeight:700 }}>{formatScheduleTime(autoStop)}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize:12, color:txt, fontWeight:700, marginBottom:8 }}>Quick presets</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {SCHEDULE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setAutoStart(preset.auto_start)
                      setAutoStop(preset.auto_stop)
                    }}
                    style={{
                      padding:"8px 11px", borderRadius:10, cursor:"pointer",
                      border:`1px solid ${border}`,
                      background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)",
                      color:txt, fontSize:11, fontWeight:700,
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:12, color:txt, fontWeight:600, marginBottom:6 }}>Auto-start time</div>
              <input type="time" value={autoStart} onChange={e => setAutoStart(e.target.value)} style={{ width:"100%", boxSizing:"border-box", padding:"10px 12px", borderRadius:8, border:`1px solid ${border}`, background:surface, color:txt }} />
            </div>
            <div>
              <div style={{ fontSize:12, color:txt, fontWeight:600, marginBottom:6 }}>Auto-stop time</div>
              <input type="time" value={autoStop} onChange={e => setAutoStop(e.target.value)} style={{ width:"100%", boxSizing:"border-box", padding:"10px 12px", borderRadius:8, border:`1px solid ${border}`, background:surface, color:txt }} />
            </div>
            <div style={{ padding:12, borderRadius:10, background:dark?"rgba(66,133,244,0.07)":"rgba(66,133,244,0.06)", border:"1px solid rgba(66,133,244,0.16)", fontSize:11, color:muted, lineHeight:1.7 }}>
              The scheduler checks every minute and applies the same operational pattern used for AWS and Azure. If both values are set, the VM follows a repeatable daily runtime window.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => save({ auto_start:autoStart, auto_stop:autoStop })} disabled={saving} style={{ flex:1, padding:"10px 16px", borderRadius:10, background:"linear-gradient(135deg,#4285F4,#34A853)", color:"#fff", border:"none", cursor:"pointer", fontWeight:700, opacity:saving?0.7:1 }}>
                {saving ? "Saving..." : "Save Schedule"}
              </button>
              {(autoStart || autoStop) && (
                <button onClick={() => save({ auto_start:"", auto_stop:"" })} disabled={saving} style={{ padding:"10px 16px", borderRadius:10, border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#ef4444", cursor:"pointer", fontWeight:700 }}>
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}

export default function GCPCompute() {
  const { dark } = useTheme()
  const navigate  = useNavigate()

  const [instances,   setInstances]   = useState([])
  const [costData,    setCostData]    = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [notice,      setNotice]      = useState("")
  const [actioning,   setActioning]   = useState({})
  const [search,      setSearch]      = useState("")
  const [statusFilter,setStatusFilter]= useState("ALL")
  const [lastRefresh, setLastRefresh] = useState(null)
  const [connectInst,  setConnectInst]  = useState(null)
  const [scheduleInst, setScheduleInst] = useState(null)
  const [firewallInst, setFirewallInst] = useState(null)
  const [budgetInst,   setBudgetInst]   = useState(null)

  // ── theme tokens ─────────────────────────────────────────────────────────
  const bg     = dark ? "#070c18"                      : "#f0f4f8"
  const card   = dark ? "rgba(255,255,255,0.03)"       : "#ffffff"
  const border = dark ? "rgba(255,255,255,0.07)"       : "rgba(0,0,0,0.08)"
  const txt    = dark ? "#e2e8f0"                      : "#1e293b"
  const muted  = dark ? "#64748b"                      : "#94a3b8"
  const input  = dark ? "rgba(255,255,255,0.05)"       : "rgba(0,0,0,0.04)"
  const GCP    = { blue:"#4285F4", green:"#34A853", yellow:"#FBBC04", red:"#EA4335" }

  // ── cost lookup map: instance name → monthly cost ─────────────────────
  // costMap: name → { monthly_cost, list_price_monthly, status }
  const costMap = useMemo(() => {
    const m = {}
    if (!costData?.zones) return m
    for (const z of costData.zones) {
      for (const v of (z.vms || [])) {
        m[v.name] = {
          monthly_cost:       v.monthly_cost      ?? 0,
          list_price_monthly: v.list_price_monthly ?? 0,
          status:             v.status,
        }
      }
    }
    return m
  }, [costData])

  const load = () => {
    setLoading(true); setError("")
    Promise.all([
      listGCPInstances().catch(() => ({ data:{ instances:[] } })),
      getGCPCost().catch(() => ({ data: null })),
    ]).then(([inst, cost]) => {
      setInstances(inst.data?.instances || [])
      setCostData(cost.data)
      setLastRefresh(new Date())
    }).catch(e => {
      setInstances([])
      setError(e.response?.data?.detail || "GCP not configured yet")
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const doAction = async (fn, name, zone, label) => {
    setActioning(a => ({ ...a, [name]: label }))
    setError("")
    try {
      await fn(name, zone)
      setNotice(`${label[0].toUpperCase()}${label.slice(1)} request submitted for ${name}.`)
      load()
      setTimeout(() => setNotice(""), 3200)
    }
    catch (e) { setError(e.response?.data?.detail || `Failed to ${label} instance`) }
    finally { setActioning(a => { const n = {...a}; delete n[name]; return n }) }
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const totalVMs  = instances.length
  const running   = instances.filter(i => i.status === "RUNNING").length
  const stopped   = instances.filter(i => ["STOPPED","TERMINATED","SUSPENDED"].includes(i.status)).length
  const totalCost = costData?.grand_total ?? 0

  const STATUS_TABS = ["ALL", "RUNNING", "STOPPED", "TERMINATED"]

  const filtered = useMemo(() => {
    return instances.filter(i => {
      const q = search.toLowerCase()
      const matchText = !q ||
        i.name.toLowerCase().includes(q) ||
        i.zone.toLowerCase().includes(q) ||
        i.machine_type.toLowerCase().includes(q)
      const matchStatus = statusFilter === "ALL" || i.status === statusFilter
      return matchText && matchStatus
    })
  }, [instances, search, statusFilter])

  const zones = [...new Set(instances.map(i => i.zone))]

  return (
    <div style={{ minHeight:"100vh", background:bg, color:txt, fontFamily:"system-ui,sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        .gcprow:hover { background: ${dark?"rgba(255,255,255,0.025)":"rgba(0,0,0,0.025)"} !important; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding:"24px 28px 0", display:"flex", alignItems:"center",
        justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:42, height:42, borderRadius:12,
            background:"linear-gradient(135deg,#4285F4,#34A853)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 14px rgba(66,133,244,0.35)" }}>
            <span style={{ fontSize:10, fontWeight:800, color:"#fff", letterSpacing:"-0.5px" }}>GCP</span>
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:21, fontWeight:800, letterSpacing:"-0.3px" }}>Compute Engine</h1>
            <p style={{ margin:"2px 0 0", fontSize:12, color:muted }}>
              Virtual machine instances across all GCP zones
              {lastRefresh && <span style={{ marginLeft:8, color:dark?"#334155":"#cbd5e1" }}>· Updated {lastRefresh.toLocaleTimeString()}</span>}
            </p>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={load} disabled={loading}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9,
              background:card, border:`1px solid ${border}`, color:txt, fontSize:12,
              cursor:"pointer", opacity:loading?0.6:1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ animation:loading?"spin 0.8s linear infinite":"none" }}>
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button onClick={() => navigate("/gcp/cost")}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9,
              background:card, border:`1px solid ${border}`, color:GCP.yellow, fontSize:12,
              fontWeight:600, cursor:"pointer" }}>
            <SvgIcon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13} color={GCP.yellow} />
            Cost Report
          </button>
          <button onClick={() => navigate("/gcp/compute/create")}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9,
              background:"linear-gradient(135deg,#4285F4,#34A853)", border:"none",
              color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer",
              boxShadow:"0 4px 12px rgba(66,133,244,0.35)" }}>
            <SvgIcon d="M12 4v16m8-8H4" size={13} color="#fff" />
            Launch Instance
          </button>
        </div>
      </div>

      {/* ── Error / warning banner ──────────────────────────────────────── */}
      {error && (
        <div style={{ margin:"16px 28px 0", padding:"14px 18px", borderRadius:12,
          background:"rgba(66,133,244,0.07)", border:"1px solid rgba(66,133,244,0.25)" }}>
          <div style={{ fontSize:13, fontWeight:600, color:GCP.blue, marginBottom:3 }}>GCP Notice</div>
          <div style={{ fontSize:12, color:muted }}>{error}</div>
        </div>
      )}
      {notice && (
        <div style={{ margin:"16px 28px 0", padding:"14px 18px", borderRadius:12,
          background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.22)" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#22c55e", marginBottom:3 }}>Action Submitted</div>
          <div style={{ fontSize:12, color:muted }}>{notice}</div>
        </div>
      )}

      {/* ── Summary cards ──────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, padding:"20px 28px 0" }}>
        {[
          { label:"Total Instances", value:loading?"—":totalVMs,                  accent:GCP.blue,   icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2", sub:"across all zones" },
          { label:"Running",         value:loading?"—":running,                    accent:"#22c55e",  icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2", sub:"currently active" },
          { label:"Stopped / Off",   value:loading?"—":stopped,                   accent:"#f59e0b",  icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2", sub:"not incurring compute cost" },
          { label:"Est. Monthly Cost",value:loading?"—":`$${totalCost.toFixed(2)}`,accent:GCP.yellow,icon:"M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", sub:"running VMs only" },
        ].map(c => (
          <div key={c.label} style={{ background:card, border:`1px solid ${border}`,
            borderRadius:14, padding:"16px 18px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:12, right:14, opacity:0.12 }}>
              <SvgIcon d={c.icon} size={28} color={c.accent} />
            </div>
            <div style={{ fontSize:10, color:muted, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8, fontWeight:600 }}>{c.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:c.accent }}>{c.value}</div>
            <div style={{ fontSize:11, color:muted, marginTop:4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main table panel ───────────────────────────────────────────── */}
      <div style={{ margin:"16px 28px 28px", background:card, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden" }}>

        {/* Toolbar */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${border}`,
          display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>

          {/* Search */}
          <div style={{ position:"relative", flex:"1 1 220px", minWidth:180 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, zone, machine type…"
              style={{ width:"100%", padding:"7px 10px 7px 30px", borderRadius:8, background:input,
                border:`1px solid ${border}`, color:txt, fontSize:12, outline:"none",
                boxSizing:"border-box" }}
            />
          </div>

          {/* Status filter tabs */}
          <div style={{ display:"flex", gap:4 }}>
            {STATUS_TABS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding:"6px 12px", fontSize:11, fontWeight:600, borderRadius:7, cursor:"pointer",
                  background: statusFilter===s ? (s==="RUNNING"?"rgba(34,197,94,0.15)":s==="STOPPED"?"rgba(245,158,11,0.15)":s==="TERMINATED"?"rgba(100,116,139,0.15)":"rgba(66,133,244,0.15)") : "transparent",
                  border: statusFilter===s ? `1px solid ${s==="RUNNING"?"#22c55e50":s==="STOPPED"?"#f59e0b50":s==="TERMINATED"?"#94a3b850":"#4285F450"}` : `1px solid ${border}`,
                  color: statusFilter===s ? (s==="RUNNING"?"#22c55e":s==="STOPPED"?"#f59e0b":s==="TERMINATED"?"#94a3b8":txt) : muted,
                  transition:"all 0.15s" }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ fontSize:11, color:muted, flexShrink:0 }}>
            {filtered.length} / {totalVMs} instance{totalVMs!==1?"s":""}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding:48, textAlign:"center", color:muted }}>
            <div style={{ width:28, height:28, border:`2px solid ${GCP.blue}`, borderTopColor:"transparent",
              borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 14px" }} />
            <div style={{ fontSize:13 }}>Loading instances…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:60, textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🖥️</div>
            <div style={{ fontSize:14, fontWeight:600, color:txt, marginBottom:6 }}>
              {totalVMs === 0 ? "No instances found" : "No instances match your filter"}
            </div>
            <div style={{ fontSize:12, color:muted, marginBottom:20 }}>
              {totalVMs === 0
                ? "Configure GCP credentials or launch your first VM to get started."
                : "Try adjusting your search or status filter."}
            </div>
            {totalVMs === 0 && (
              <button onClick={() => navigate("/gcp/compute/create")}
                style={{ padding:"9px 22px", borderRadius:9,
                  background:"linear-gradient(135deg,#4285F4,#34A853)", border:"none",
                  color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer",
                  boxShadow:"0 4px 12px rgba(66,133,244,0.35)" }}>
                Launch First Instance
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }}>
                  {["Name","Status","Machine Type","Zone","Network","Internal IP","External IP","Est. Cost/mo","Actions"].map(h => (
                    <th key={h} style={{ padding:"9px 16px", fontSize:10, fontWeight:700, color:muted,
                      textAlign:"left", borderBottom:`1px solid ${border}`,
                      textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inst, idx) => {
                  const acting = actioning[inst.name]
                  const vmCost = costMap[inst.name] || null
                  const nic    = inst.network_interfaces?.[0] || {}
                  return (
                    <tr key={inst.name + idx} className="gcprow"
                      style={{ borderBottom:`1px solid ${border}`, transition:"background 0.1s" }}>

                      {/* Name */}
                      <td style={{ padding:"11px 16px" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:txt }}>{inst.name}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginTop:4 }}>
                          <span style={{ fontSize:10, color:muted }}>{inst.project || "—"}</span>
                          <ScheduleBadge instance={inst} dark={dark} />
                        </div>
                        {(inst.labels?.auto_start || inst.labels?.auto_stop) && (
                          <div style={{ fontSize:10, color:muted, marginTop:6 }}>
                            {inst.labels?.auto_start && <span>Start {formatScheduleTime(inst.labels.auto_start)}</span>}
                            {inst.labels?.auto_start && inst.labels?.auto_stop && <span> · </span>}
                            {inst.labels?.auto_stop && <span>Stop {formatScheduleTime(inst.labels.auto_stop)}</span>}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding:"11px 16px" }}>
                        {acting
                          ? <span style={{ fontSize:10, color:GCP.blue, fontWeight:600 }}>{acting.toUpperCase()}…</span>
                          : <StatusBadge status={inst.status} />}
                      </td>

                      {/* Machine type */}
                      <td style={{ padding:"11px 16px" }}>
                        <code style={{ fontSize:11, color:txt, background:input, padding:"2px 6px", borderRadius:4, whiteSpace:"nowrap" }}>
                          {inst.machine_type}
                        </code>
                      </td>

                      {/* Zone */}
                      <td style={{ padding:"11px 16px", fontSize:12, color:muted, whiteSpace:"nowrap" }}>{inst.zone}</td>

                      {/* Network */}
                      <td style={{ padding:"11px 16px", fontSize:11, color:muted, maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={nic.network}>
                        {nic.network || "—"}
                      </td>

                      {/* Internal IP */}
                      <td style={{ padding:"11px 16px" }}>
                        {nic.internal_ip
                          ? <code style={{ fontSize:11, color:txt }}>{nic.internal_ip}</code>
                          : <span style={{ fontSize:11, color:muted }}>—</span>}
                      </td>

                      {/* External IP */}
                      <td style={{ padding:"11px 16px" }}>
                        {nic.external_ip
                          ? <code style={{ fontSize:11, color:GCP.blue }}>{nic.external_ip}</code>
                          : <span style={{ fontSize:10, color:muted, fontStyle:"italic" }}>private only</span>}
                      </td>

                      {/* Cost */}
                      <td style={{ padding:"11px 16px", whiteSpace:"nowrap" }}>
                        {vmCost !== null ? (
                          inst.status === "RUNNING" ? (
                            <span style={{ fontSize:12, fontWeight:700, color:GCP.yellow }}>
                              ${vmCost.monthly_cost.toFixed(2)}
                            </span>
                          ) : (
                            <div>
                              <span style={{ fontSize:12, fontWeight:700, color:muted }}>$0.00</span>
                              <div style={{ fontSize:10, color:dark?"#334155":"#cbd5e1", marginTop:1 }}>
                                ${vmCost.list_price_monthly.toFixed(2)}/mo if on
                              </div>
                            </div>
                          )
                        ) : (
                          <span style={{ fontSize:12, color:muted }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding:"11px 16px" }}>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          {inst.status !== "RUNNING" && (
                            <ActionBtn label={acting==="start"?"Starting…":"Start"}
                              onClick={() => doAction(startGCPInstance, inst.name, inst.zone, "start")}
                              disabled={!!acting}
                              color="#22c55e" bg="rgba(34,197,94,0.15)" />
                          )}
                          {inst.status === "RUNNING" && (
                            <ActionBtn label={acting==="stop"?"Stopping…":"Stop"}
                              onClick={() => doAction(stopGCPInstance, inst.name, inst.zone, "stop")}
                              disabled={!!acting}
                              color="#f59e0b" bg="rgba(245,158,11,0.15)" />
                          )}
                          <ActionBtn label="Connect"
                            onClick={() => setConnectInst(inst)}
                            disabled={!!acting}
                            color="#50e6ff" bg="rgba(80,230,255,0.15)" />
                          <ActionBtn label={(inst.labels?.auto_start || inst.labels?.auto_stop) ? "Manage Schedule" : "Schedule"}
                            onClick={() => setScheduleInst(inst)}
                            disabled={!!acting}
                            color="#4285F4" bg="rgba(66,133,244,0.15)" />
                          <ActionBtn label="Ports"
                            onClick={() => setFirewallInst(inst)}
                            disabled={!!acting}
                            color="#FBBC04" bg="rgba(251,188,4,0.15)" />
                          <ActionBtn label="Budget"
                            onClick={() => setBudgetInst(inst)}
                            disabled={!!acting}
                            color="#f59e0b" bg="rgba(245,158,11,0.15)" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {!loading && filtered.length > 0 && (
          <div style={{ padding:"10px 20px", borderTop:`1px solid ${border}`,
            display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:11, color:muted }}>
              Showing {filtered.length} instance{filtered.length!==1?"s":""}
              {zones.length > 0 && <> across <span style={{ color:GCP.blue, fontWeight:600 }}>{zones.length}</span> zone{zones.length!==1?"s":""}</>}
            </div>
            <div style={{ fontSize:11, color:muted }}>
              Total estimated monthly: <span style={{ color:GCP.yellow, fontWeight:700 }}>${totalCost.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {connectInst && (
        <GCPConnectModal
          instance={connectInst}
          dark={dark}
          onClose={() => setConnectInst(null)}
        />
      )}

      {scheduleInst && (
        <GCPScheduleModal
          instance={scheduleInst}
          dark={dark}
          onClose={() => setScheduleInst(null)}
          onSaved={() => {
            setScheduleInst(null)
            load()
          }}
        />
      )}

      {firewallInst && (
        <ManageFirewallModal
          instance={firewallInst}
          dark={dark}
          onClose={() => setFirewallInst(null)}
        />
      )}
      {budgetInst && (
        <ResourceBudgetModal
          resource={{ vm_id: budgetInst.name, vm_name: budgetInst.name, cloud: "gcp", region: budgetInst.zone, instance_type: budgetInst.machine_type }}
          onClose={() => setBudgetInst(null)}
        />
      )}
    </div>
  )
}
