import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import {
  listAzureVMs, startAzureVM, stopAzureVM, restartAzureVM, deleteAzureVM,
  getAzureVMConnectInfo, getAzureVMSchedule, setAzureVMSchedule,
  recordUserAction,
} from "../api/api"
import ResourceBudgetModal from "../components/ResourceBudgetModal"
import SSHTerminalModal from "../components/SSHTerminalModal"
import { usePinnedResources } from "../components/PinnedResources"

const SUBS = ["nonprod", "prod"]
const STATUS_COLOR = {
  running: "#10b981", deallocated: "#64748b", stopped: "#f59e0b",
  starting: "#0078D4", stopping: "#f59e0b", deallocating: "#f59e0b", unknown: "#64748b",
}

// ── Connect Modal ─────────────────────────────────────────────────────────────
function ConnectModal({ vm, rg, sub, dark, surface, border, text, muted, onClose }) {
  const [info,    setInfo]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    setLoading(true)
    getAzureVMConnectInfo(rg, vm.name, sub)
      .then(r => setInfo(r.data))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false))
  }, [rg, vm.name, sub])

  const copy = (str) => {
    navigator.clipboard.writeText(str)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLinux = !info?.os_type?.toLowerCase().includes("windows")

  return (
    <Overlay onClose={onClose}>
      <ModalBox dark={dark} surface={surface} border={border}>
        <ModalHeader icon="🔗" title={`Connect — ${vm.name}`} sub={info ? `${info.os_type} · ${sub}` : sub} onClose={onClose} text={text} muted={muted} />

        {loading ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:48, gap:12, color:muted }}>
            <Spinner color="#0078D4" /> Fetching connection info…
          </div>
        ) : !info ? (
          <Alert color="#ef4444" bg="rgba(239,68,68,0.1)" border_="rgba(239,68,68,0.3)">
            Could not fetch connection info. The VM may not have a NIC attached or credentials are insufficient.
          </Alert>
        ) : (
          <div style={{ display:"grid", gap:16 }}>

            {/* Power state warning */}
            {info.power_state !== "running" && (
              <Alert color="#f59e0b" bg="rgba(245,158,11,0.08)" border_="rgba(245,158,11,0.3)">
                VM is currently <strong>{info.power_state}</strong>. Start it before connecting.
              </Alert>
            )}

            {/* IP addresses */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <InfoCard label="Public IP" value={info.public_ip || "None assigned"} mono dark={dark} surface={surface} border={border} text={text} muted={muted} highlight={!!info.public_ip} />
              <InfoCard label="Private IP" value={info.private_ip || "—"} mono dark={dark} surface={surface} border={border} text={text} muted={muted} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <InfoCard label="Admin Username" value={info.admin_username} mono dark={dark} surface={surface} border={border} text={text} muted={muted} />
              <InfoCard label="Port" value={String(info.port)} mono dark={dark} surface={surface} border={border} text={text} muted={muted} />
            </div>

            {/* SSH / RDP section */}
            {isLinux ? (
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:text, marginBottom:8 }}>SSH Command</div>
                {info.ssh_command ? (
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <code style={{ flex:1, background:dark?"#0d1117":"#f8fafc", border:`1px solid ${border}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:"#7fba00", fontFamily:"monospace", overflowX:"auto", display:"block" }}>
                      {info.ssh_command}
                    </code>
                    <button onClick={() => copy(info.ssh_command)} style={copyBtnStyle(copied)}>
                      {copied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:muted, padding:"10px 14px", borderRadius:8, background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)", border:`1px solid ${border}` }}>
                    No public IP assigned. Connect via Azure Bastion or a jump host using the private IP: <strong style={{ color:"#0078D4" }}>{info.private_ip}</strong>
                  </div>
                )}
                <div style={{ fontSize:11, color:muted, marginTop:8 }}>
                  💡 Tip: Use <code style={{ background:"rgba(0,0,0,0.2)", padding:"1px 5px", borderRadius:4 }}>-i ~/.ssh/your_key.pem</code> if you used an SSH key during VM creation.
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:text, marginBottom:8 }}>RDP Connection</div>
                <div style={{ display:"grid", gap:10 }}>
                  <div style={{ padding:"12px 14px", borderRadius:8, background:"rgba(0,120,212,0.06)", border:"1px solid rgba(0,120,212,0.2)", fontSize:13, color:text }}>
                    <div style={{ marginBottom:8 }}>Open <strong>Remote Desktop Connection</strong> (mstsc) and connect to:</div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <code style={{ flex:1, fontFamily:"monospace", fontSize:12, color:"#0078D4" }}>{info.rdp_host}:{info.port}</code>
                      <button onClick={() => copy(`${info.rdp_host}:${info.port}`)} style={copyBtnStyle(copied)}>
                        {copied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:muted }}>
                    Username: <strong style={{ color:text }}>{info.admin_username}</strong> · Use the password you set during VM creation.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ModalBox>
    </Overlay>
  )
}

// ── Schedule Modal ────────────────────────────────────────────────────────────
function ScheduleModal({ vm, rg, sub, dark, surface, border, text, muted, onClose, onSaved }) {
  const [autoStart, setAutoStart] = useState("")
  const [autoStop,  setAutoStop]  = useState("")
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState("")
  const [saved,     setSaved]     = useState(false)

  useEffect(() => {
    setLoading(true)
    getAzureVMSchedule(rg, vm.name, sub)
      .then(r => { setAutoStart(r.data.auto_start || ""); setAutoStop(r.data.auto_stop || "") })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [rg, vm.name, sub])

  async function handleSave() {
    setSaving(true); setError("")
    try {
      await setAzureVMSchedule(rg, vm.name, sub, { auto_start: autoStart, auto_stop: autoStop })
      setSaved(true)
      setTimeout(() => { setSaved(false); onSaved?.() }, 1500)
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to save schedule")
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true); setError("")
    try {
      await setAzureVMSchedule(rg, vm.name, sub, { auto_start: "", auto_stop: "" })
      setAutoStart(""); setAutoStop("")
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to clear schedule")
    } finally {
      setSaving(false)
    }
  }

  const inp = { background:surface, border:`1px solid ${border}`, borderRadius:8, padding:"9px 12px", fontSize:14, color:text, fontFamily:"monospace", outline:"none", width:"100%", boxSizing:"border-box" }

  return (
    <Overlay onClose={onClose}>
      <ModalBox dark={dark} surface={surface} border={border} width={460}>
        <ModalHeader icon="⏰" title={`Schedule — ${vm.name}`} sub={`Auto start/stop · ${sub}`} onClose={onClose} text={text} muted={muted} />

        {loading ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:32, gap:12, color:muted }}>
            <Spinner color="#0078D4" /> Loading schedule…
          </div>
        ) : (
          <div style={{ display:"grid", gap:18 }}>
            {error && <Alert color="#ef4444" bg="rgba(239,68,68,0.1)" border_="rgba(239,68,68,0.3)">{error}</Alert>}
            {saved && <Alert color="#10b981" bg="rgba(16,185,129,0.1)" border_="rgba(16,185,129,0.3)">Schedule saved successfully!</Alert>}

            {/* Cost saving callout */}
            <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.25)", fontSize:12, color:muted }}>
              <span style={{ color:"#10b981", fontWeight:700 }}>💰 Cost tip:</span> A VM stopped (deallocated) during off-hours saves ~60% on compute.
              Setting 08:00 start + 20:00 stop → only 12 hrs/day billed instead of 24.
            </div>

            <div>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>
                🟢 Auto-Start Time (24 h HH:MM)
              </label>
              <input type="time" value={autoStart} onChange={e => setAutoStart(e.target.value)} style={inp} />
              <div style={{ fontSize:11, color:muted, marginTop:4 }}>VM will be started at this time daily (UTC). Leave blank to disable.</div>
            </div>

            <div>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>
                🔴 Auto-Stop Time (24 h HH:MM)
              </label>
              <input type="time" value={autoStop} onChange={e => setAutoStop(e.target.value)} style={inp} />
              <div style={{ fontSize:11, color:muted, marginTop:4 }}>VM will be deallocated (stopped + compute billing paused) at this time. Leave blank to disable.</div>
            </div>

            {/* Preview */}
            {(autoStart || autoStop) && (
              <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(0,120,212,0.06)", border:"1px solid rgba(0,120,212,0.2)", fontSize:12, color:muted }}>
                <div style={{ fontWeight:600, color:"#0078D4", marginBottom:4 }}>Schedule preview</div>
                {autoStart && <div>▶ Start every day at <strong style={{ color:text }}>{autoStart}</strong></div>}
                {autoStop  && <div>⏹ Stop  every day at <strong style={{ color:text }}>{autoStop}</strong></div>}
                {autoStart && autoStop && (
                  <div style={{ marginTop:6 }}>
                    Running window: <strong style={{ color:"#10b981" }}>
                      {Math.abs(parseInt(autoStop)-parseInt(autoStart))} hrs/day
                    </strong> · Saved: <strong style={{ color:"#10b981" }}>
                      {24-Math.abs(parseInt(autoStop)-parseInt(autoStart))} hrs/day
                    </strong>
                  </div>
                )}
              </div>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex:1, padding:"10px 0", borderRadius:10, fontSize:13, fontWeight:700, cursor:saving?"not-allowed":"pointer", border:"none", color:"#fff", background:"linear-gradient(135deg,#0078D4,#50e6ff)", boxShadow:"0 4px 12px rgba(0,120,212,0.3)", opacity:saving?0.7:1 }}>
                {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Schedule"}
              </button>
              {(autoStart || autoStop) && (
                <button onClick={handleClear} disabled={saving}
                  style={{ padding:"10px 16px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", border:"1px solid rgba(239,68,68,0.4)", color:"#ef4444", background:"rgba(239,68,68,0.08)" }}>
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </ModalBox>
    </Overlay>
  )
}

// ── Shared mini-components ────────────────────────────────────────────────────
function Overlay({ onClose, children }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }}>
      {children}
    </div>
  )
}
function ModalBox({ dark, surface, border, children, width=560 }) {
  return (
    <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:16, padding:28, width, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.5)", animation:"fadeUp 0.25s ease both" }}>
      {children}
    </div>
  )
}
function ModalHeader({ icon, title, sub, onClose, text, muted }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
      <div>
        <div style={{ fontSize:16, fontWeight:700, color:text }}>{icon} {title}</div>
        {sub && <div style={{ fontSize:12, color:muted, marginTop:2 }}>{sub}</div>}
      </div>
      <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer", color:muted, fontSize:20, lineHeight:1, padding:4 }}>×</button>
    </div>
  )
}
function InfoCard({ label, value, mono, dark, surface, border, text, muted, highlight }) {
  return (
    <div style={{ padding:"10px 12px", borderRadius:8, background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)", border:`1px solid ${highlight?"rgba(0,120,212,0.3)":border}` }}>
      <div style={{ fontSize:10, fontWeight:600, color:muted, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:600, color:highlight?"#0078D4":text, fontFamily:mono?"monospace":"inherit" }}>{value}</div>
    </div>
  )
}
function Alert({ color, bg, border_, children }) {
  return (
    <div style={{ padding:"10px 14px", borderRadius:8, background:bg, border:`1px solid ${border_}`, color, fontSize:13 }}>{children}</div>
  )
}
function Spinner({ color="#0078D4", size=20 }) {
  return <div style={{ width:size, height:size, borderRadius:"50%", border:`3px solid ${color}30`, borderTopColor:color, animation:"spin 0.8s linear infinite", flexShrink:0 }} />
}
const copyBtnStyle = (copied) => ({
  padding:"6px 12px", borderRadius:7, fontSize:11, fontWeight:600, cursor:"pointer", flexShrink:0,
  background:copied?"rgba(16,185,129,0.15)":"rgba(0,120,212,0.12)",
  border:copied?"1px solid rgba(16,185,129,0.4)":"1px solid rgba(0,120,212,0.3)",
  color:copied?"#10b981":"#0078D4",
})

// ── Main Component ────────────────────────────────────────────────────────────
export default function AzureCompute() {
  const { dark }   = useTheme()
  const navigate   = useNavigate()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "rgba(255,255,255,0.03)" : "#ffffff"
  const border  = dark ? "rgba(255,255,255,0.06)" : "#e2e8f0"
  const text    = dark ? "#e2e8f0" : "#0f172a"
  const muted   = dark ? "#64748b" : "#64748b"
  const thBg    = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"

  const [subscription, setSub]       = useState("nonprod")
  const [vms,          setVms]       = useState([])
  const [loading,      setLoading]   = useState(false)
  const [error,        setError]     = useState("")
  const [actioning,    setActioning] = useState({})

  // Modal state
  const [connectVM,  setConnectVM]  = useState(null)   // { vm, rg }
  const [scheduleVM, setScheduleVM] = useState(null)   // { vm, rg }
  const [budgetVM,   setBudgetVM]   = useState(null)   // { vm, rg }
  const [termVM,     setTermVM]     = useState(null)   // { vm, rg, sub }
  const { isPinned, toggle: togglePin } = usePinnedResources()

  const fetchVMs = () => {
    setLoading(true); setError("")
    listAzureVMs(subscription)
      .then(r => setVms(r.data.vms || []))
      .catch(e => setError(e.response?.data?.detail || "Failed to load VMs"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchVMs() }, [subscription])

  const action = async (fn, rg, name, label) => {
    const key = `${rg}/${name}`
    setActioning(a => ({ ...a, [key]: label }))
    try {
      await fn(rg, name, subscription)
      recordUserAction({ cloud: "azure", action: `VM ${label}`, resource_type: "VM", resource: name, detail: `${rg} · ${subscription}`, status: "success" }).catch(() => {})
      fetchVMs()
    }
    catch (e) {
      recordUserAction({ cloud: "azure", action: `VM ${label}`, resource_type: "VM", resource: name, detail: `${rg} · ${subscription}`, status: "failed" }).catch(() => {})
      setError(e.response?.data?.detail || `Failed to ${label}`)
    }
    finally { setActioning(a => { const n = {...a}; delete n[key]; return n }) }
  }

  const thStyle = { padding:"10px 14px", fontSize:11, fontWeight:600, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", textAlign:"left", borderBottom:`1px solid ${border}` }
  const tdStyle = { padding:"12px 14px", fontSize:13, color:text, borderBottom:`1px solid ${border}` }

  return (
    <div style={{ padding:32, background:bg, minHeight:"100vh" }}>
      <style>{`
        @keyframes spin    { from { transform:rotate(0deg)  } to { transform:rotate(360deg) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:"linear-gradient(135deg,#0078D4,#50e6ff)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 12px rgba(0,120,212,0.35)" }}>
            <span style={{ fontSize:12, fontWeight:800, color:"#fff" }}>Az</span>
          </div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, color:text, margin:0 }}>Azure Virtual Machines</h1>
            <p style={{ fontSize:12, color:muted, margin:"3px 0 0" }}>Manage, connect, and schedule VMs across subscriptions</p>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {/* Subscription toggle */}
          <div style={{ display:"flex", background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", border:`1px solid ${border}`, borderRadius:8, padding:3, gap:3 }}>
            {[
              { id:"nonprod", label:"Non-Production", color:"#10b981" },
              { id:"prod",    label:"Production",     color:"#f59e0b" },
            ].map(s => (
              <button key={s.id} onClick={() => setSub(s.id)} style={{
                padding:"5px 14px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer", border:"none",
                background: subscription === s.id ? s.color : "transparent",
                color:      subscription === s.id ? "#fff" : muted,
                transition:"all 0.15s",
              }}>{s.label}</button>
            ))}
          </div>
          <button onClick={fetchVMs} style={{ background:surface, border:`1px solid ${border}`, borderRadius:8, color:text, padding:"8px 14px", fontSize:13, cursor:"pointer" }}>↻ Refresh</button>
          <button onClick={() => navigate("/azure/cost")} style={{ background:surface, border:`1px solid ${border}`, borderRadius:8, color:"#10b981", padding:"8px 14px", fontSize:13, cursor:"pointer", fontWeight:600 }}>💰 Cost by RG</button>
          <button onClick={() => navigate("/azure/compute/create")}
            style={{ background:"linear-gradient(135deg,#0078D4,#50e6ff)", border:"none", borderRadius:8, color:"#fff", padding:"8px 20px", fontSize:13, fontWeight:600, cursor:"pointer", boxShadow:"0 4px 12px rgba(0,120,212,0.35)", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:16, lineHeight:1 }}>+</span> Create VM
          </button>
        </div>
      </div>

      {error && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:16 }}>{error}</div>}

      {/* ── VM Table ── */}
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:thBg }}>
              {["Name","Power State","VM Size","OS","Location","Resource Group","Actions"].map(h =>
                <th key={h} style={thStyle}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ ...tdStyle, textAlign:"center", color:muted, padding:40 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                  <Spinner color="#0078D4" size={32} />
                  Loading VMs…
                </div>
              </td></tr>
            ) : vms.length === 0 ? (
              <tr><td colSpan={7} style={{ ...tdStyle, textAlign:"center", color:muted, padding:48 }}>
                <div style={{ fontSize:32, marginBottom:10 }}>☁</div>
                <div style={{ fontWeight:600, color:text, marginBottom:4 }}>No VMs found</div>
                <div style={{ fontSize:12 }}>in {subscription === "prod" ? "Production" : "Non-Production"} subscription</div>
              </td></tr>
            ) : vms.map(vm => {
              const rg     = vm.id?.split("/resourceGroups/")[1]?.split("/")[0] || ""
              const key    = `${rg}/${vm.name}`
              const acting = actioning[key]
              const sc     = STATUS_COLOR[vm.power_state] || "#64748b"
              const isRunning = vm.power_state === "running"

              return (
                <tr key={vm.id}
                  onMouseEnter={e => e.currentTarget.style.background = dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  style={{ transition:"background 0.15s" }}>

                  <td style={tdStyle}>
                    <div style={{ fontWeight:700, fontSize:13, color:text }}>{vm.name}</div>
                  </td>

                  <td style={tdStyle}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:`${sc}22`, color:sc, border:`1px solid ${sc}44` }}>
                      <span style={{ width:6, height:6, borderRadius:"50%", background:sc }} />
                      {vm.power_state || "unknown"}
                    </span>
                  </td>

                  <td style={{ ...tdStyle, fontFamily:"monospace", fontSize:11 }}>{vm.vm_size || "—"}</td>
                  <td style={tdStyle}>{vm.os_type || "—"}</td>
                  <td style={tdStyle}>{vm.location || "—"}</td>

                  <td style={tdStyle}>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:6, background:subscription==="prod"?"rgba(245,158,11,0.12)":"rgba(16,185,129,0.12)", color:subscription==="prod"?"#f59e0b":"#10b981", fontFamily:"monospace" }}>
                      {rg || "—"}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {/* Start */}
                      {!isRunning && (
                        <ActionBtn label="Start" color="#10b981" acting={acting} actKey="start"
                          onClick={() => action(startAzureVM, rg, vm.name, "start")} />
                      )}
                      {/* Stop */}
                      {isRunning && (
                        <ActionBtn label="Stop" color="#f59e0b" acting={acting} actKey="stop"
                          onClick={() => action(stopAzureVM, rg, vm.name, "stop")} />
                      )}
                      {/* Restart */}
                      {isRunning && (
                        <ActionBtn label="Restart" color="#0078D4" acting={acting} actKey="restart"
                          onClick={() => action(restartAzureVM, rg, vm.name, "restart")} />
                      )}
                      {/* Pin */}
                      <button
                        onClick={() => togglePin({ id:`azure-vm-${vm.name}-${rg}`, name:vm.name, type:"Azure VM", cloud:"azure", status:vm.power_state||"unknown", link:"/azure/compute", meta:`${rg} · ${subscription}` })}
                        title={isPinned(`azure-vm-${vm.name}-${rg}`) ? "Unpin" : "Pin to My Resources"}
                        style={{ padding:"5px 8px", borderRadius:6, fontSize:13, cursor:"pointer", border:`1px solid ${isPinned(`azure-vm-${vm.name}-${rg}`) ? "#fbbf2440" : "rgba(100,116,139,0.25)"}`, background:isPinned(`azure-vm-${vm.name}-${rg}`) ? "rgba(251,191,36,0.12)" : "transparent", color:isPinned(`azure-vm-${vm.name}-${rg}`) ? "#fbbf24" : "#64748b" }}>
                        {isPinned(`azure-vm-${vm.name}-${rg}`) ? "★" : "☆"}
                      </button>
                      {/* Connect */}
                      <ActionBtn label="Connect" color="#50e6ff" acting={acting} actKey={null}
                        onClick={() => setConnectVM({ vm, rg })} />
                      {vm.power_state === "running" && (
                        <ActionBtn label="Terminal" color="#a78bfa" acting={acting} actKey={null}
                          onClick={() => setTermVM({ vm, rg, sub: subscription })} />
                      )}
                      {/* Schedule */}
                      <ActionBtn label="Schedule" color="#a78bfa" acting={acting} actKey={null}
                        onClick={() => setScheduleVM({ vm, rg })} />
                      {/* Budget */}
                      <ActionBtn label="Budget" color="#f59e0b" acting={acting} actKey={null}
                        onClick={() => setBudgetVM({ vm, rg })} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modals ── */}
      {connectVM && (
        <ConnectModal
          vm={connectVM.vm} rg={connectVM.rg} sub={subscription}
          dark={dark} surface={dark?"#0f172a":"#ffffff"} border={border} text={text} muted={muted}
          onClose={() => setConnectVM(null)}
        />
      )}
      {scheduleVM && (
        <ScheduleModal
          vm={scheduleVM.vm} rg={scheduleVM.rg} sub={subscription}
          dark={dark} surface={dark?"#0f172a":"#ffffff"} border={border} text={text} muted={muted}
          onClose={() => setScheduleVM(null)}
          onSaved={() => fetchVMs()}
        />
      )}
      {budgetVM && (
        <ResourceBudgetModal
          resource={{ vm_id: budgetVM.vm.name, vm_name: budgetVM.vm.name, cloud: "azure", region: budgetVM.vm.location, instance_type: budgetVM.vm.vm_size }}
          onClose={() => setBudgetVM(null)}
        />
      )}
      {termVM && (
        <AzureTerminalBridge
          vm={termVM.vm} rg={termVM.rg} sub={termVM.sub}
          dark={dark} onClose={() => setTermVM(null)}
        />
      )}
    </div>
  )
}

// ── AzureTerminalBridge — fetches public IP then opens SSH terminal ────────────
function AzureTerminalBridge({ vm, rg, sub, dark, onClose }) {
  const [host, setHost] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAzureVMConnectInfo(rg, vm.name, sub)
      .then(r => setHost(r.data?.public_ip || ""))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [rg, vm.name, sub]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1200, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#fff", fontSize:14 }}>Fetching VM info…</div>
    </div>
  )

  return (
    <SSHTerminalModal
      vmName={vm.name}
      host={host}
      cloud="azure"
      dark={dark}
      onClose={onClose}
    />
  )
}

// ── ActionBtn ─────────────────────────────────────────────────────────────────
function ActionBtn({ label, color, acting, actKey, onClick }) {
  const busy = actKey && acting === actKey
  return (
    <button onClick={onClick} disabled={!!acting && actKey !== null}
      style={{
        padding:"4px 10px", fontSize:11, fontWeight:600, borderRadius:6,
        cursor:(!!acting && actKey !== null)?"not-allowed":"pointer",
        opacity:(!!acting && actKey !== null)?0.5:1,
        background:`${color}18`, border:`1px solid ${color}44`, color,
        transition:"all 0.15s",
      }}>
      {busy ? "…" : label}
    </button>
  )
}
