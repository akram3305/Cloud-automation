import { useEffect, useState, useCallback, useRef } from "react"
import { listVMs, startVM, stopVM, deleteVM } from "../api/api"
import CreateVMModal from "../components/CreateVMModal"
import EC2ConnectionInfo from "../components/EC2ConnectionInfo"
import { useTheme } from "../context/ThemeContext"
import ScheduleModal from "../components/ScheduleModal"

const STATE = {
  running:  { bg:"#dcfce7", color:"#15803d", dot:"#16a34a", darkBg:"#14532d20", darkColor:"#4ade80" },
  stopped:  { bg:"#fef9c3", color:"#854d0e", dot:"#ca8a04", darkBg:"#78350f20", darkColor:"#fcd34d" },
  stopping: { bg:"#fed7aa", color:"#7c2d12", dot:"#ea580c", darkBg:"#7c2d1220", darkColor:"#fb923c" },
  pending:  { bg:"#dbeafe", color:"#1e40af", dot:"#2563eb", darkBg:"#1e3a8a20", darkColor:"#60a5fa" },
}

const ENV_COLORS = {
  prod:    { bg:"#f43f5e15", color:"#f43f5e", border:"#f43f5e40" },
  staging: { bg:"#f59e0b15", color:"#f59e0b", border:"#f59e0b40" },
  dev:     { bg:"#00d4aa15", color:"#00d4aa", border:"#00d4aa40" },
}

function Badge({ state, dark }) {
  const s = STATE[state] || STATE.pending
  return (
    <span style={{ background:dark?s.darkBg:s.bg, color:dark?s.darkColor:s.color, padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600", display:"inline-flex", alignItems:"center", gap:"5px" }}>
      <span style={{ width:"5px", height:"5px", borderRadius:"50%", background:s.dot }} />
      {state}
    </span>
  )
}

function EnvBadge({ env }) {
  const c = ENV_COLORS[env] || { bg:"#64748b15", color:"#64748b", border:"#64748b40" }
  return (
    <span style={{ background:c.bg, color:c.color, border:"1px solid "+c.border, padding:"2px 8px", borderRadius:"6px", fontSize:"10px", fontWeight:"600", textTransform:"uppercase", letterSpacing:"0.04em" }}>
      {env || "dev"}
    </span>
  )
}

export default function Compute() {
  const { dark } = useTheme()
  const [vms,       setVms]       = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [schedVM,   setSchedVM]   = useState(null)
  const [connVM,    setConnVM]    = useState(null)
  const [success,   setSuccess]   = useState("")
  const [actionId,  setActionId]  = useState(null)
  const [envFilter, setEnvFilter] = useState("all")
  const [sseActive, setSseActive] = useState(false)
  const [lastSync,  setLastSync]  = useState(null)
  const esRef = useRef(null)

  const surface = dark ? "#0f172a"  : "#ffffff"
  const bg      = dark ? "#070c18"  : "#f0f4f8"
  const border  = dark ? "#1e293b"  : "#e2e8f0"
  const text    = dark ? "#f1f5f9"  : "#0f172a"
  const muted   = dark ? "#475569"  : "#64748b"
  const subtle  = dark ? "#1e293b"  : "#f8fafc"
  const th      = dark ? "#334155"  : "#64748b"

  const fetchVMs = useCallback(async () => {
    try { const { data } = await listVMs(); setVms(data); setLastSync(new Date()) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  // ── SSE real-time subscription ─────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return

    function connect() {
      const es = new EventSource(`/api/sync/stream?token=${encodeURIComponent(token)}`)
      esRef.current = es

      es.onopen = () => setSseActive(true)

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (!data.error && Array.isArray(data)) {
            setVms(data)
            setLastSync(new Date())
            setSseActive(true)
          }
        } catch {}
      }

      es.onerror = () => {
        setSseActive(false)
        es.close()
        // Reconnect after 15s if SSE drops
        setTimeout(connect, 15000)
      }
    }

    connect()
    return () => { esRef.current?.close(); setSseActive(false) }
  }, [])

  // ── Polling fallback (runs regardless, SSE data will override) ─────────
  useEffect(() => {
    fetchVMs()
    const id = setInterval(fetchVMs, 10000)
    return () => clearInterval(id)
  }, [fetchVMs])

  async function handleAction(fn, id) {
    setActionId(id)
    try { await fn(id); fetchVMs() } catch(e) { alert(e.response?.data?.detail || e.message) }
    finally { setActionId(null) }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Terminate "${name}"? This is irreversible and will also destroy the EC2 instance.`)) return
    handleAction(deleteVM, id)
  }

  // ── Filter helpers ────────────────────────────────────────────────────
  const normalizeEnv = (vm) => {
    const e = (vm.environment || "dev").toLowerCase()
    if (e === "production") return "prod"
    if (e === "development") return "dev"
    return e
  }

  const filtered = envFilter === "all" ? vms : vms.filter(v => normalizeEnv(v) === envFilter)

  const counts = {
    all:     vms.length,
    dev:     vms.filter(v => normalizeEnv(v) === "dev").length,
    staging: vms.filter(v => normalizeEnv(v) === "staging").length,
    prod:    vms.filter(v => normalizeEnv(v) === "prod").length,
  }

  const running = vms.filter(v=>v.state==="running").length
  const stopped = vms.filter(v=>v.state==="stopped").length

  const ENV_TABS = [
    { key:"all",     label:"All",     color:"#64748b" },
    { key:"dev",     label:"Dev",     color:"#00d4aa" },
    { key:"staging", label:"Staging", color:"#f59e0b" },
    { key:"prod",    label:"Prod",    color:"#f43f5e" },
  ]

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"all 0.3s ease" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", animation:"fadeUp 0.4s ease both" }}>
        <div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>Compute</h1>
          <div style={{ display:"flex", gap:"16px", marginTop:"6px", alignItems:"center" }}>
            <span style={{ fontSize:"13px", color:"#00d4aa" }}>{running} running</span>
            <span style={{ fontSize:"13px", color:muted }}>{stopped} stopped</span>
            <span style={{ fontSize:"13px", color:muted }}>{vms.length} total</span>
            {/* Live indicator */}
            <span style={{ display:"flex", alignItems:"center", gap:"5px", fontSize:"11px", color: sseActive?"#00d4aa":muted }}>
              <span style={{ width:"6px", height:"6px", borderRadius:"50%", background: sseActive?"#00d4aa":"#64748b", animation: sseActive?"pulse 2s infinite":"none" }} />
              {sseActive ? "Live" : lastSync ? `Updated ${Math.round((Date.now()-lastSync)/1000)}s ago` : "Syncing..."}
            </span>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display:"flex", alignItems:"center", gap:"8px", background:"#00d4aa", color:"#0a0f1e", border:"none", padding:"10px 18px", borderRadius:"10px", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create VM
        </button>
      </div>

      {success && (
        <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", color:"#00d4aa", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px", animation:"fadeUp 0.3s ease both" }}>
          {success}
        </div>
      )}

      {/* Table */}
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", overflow:"hidden", animation:"fadeUp 0.4s ease 0.1s both", transition:"all 0.3s ease" }}>

        {/* Table header with env filter tabs */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"10px" }}>
          {/* Environment tabs */}
          <div style={{ display:"flex", gap:"4px" }}>
            {ENV_TABS.map(tab => (
              <button key={tab.key} onClick={() => setEnvFilter(tab.key)}
                style={{ padding:"5px 12px", borderRadius:"8px", fontSize:"12px", fontWeight:"600", cursor:"pointer", transition:"all 0.15s",
                  border:"1px solid "+(envFilter===tab.key ? tab.color+"60" : border),
                  background: envFilter===tab.key ? tab.color+"18" : "transparent",
                  color:      envFilter===tab.key ? tab.color : muted }}>
                {tab.label}
                <span style={{ marginLeft:"5px", background: envFilter===tab.key ? tab.color+"25":subtle, color: envFilter===tab.key ? tab.color : muted, padding:"1px 6px", borderRadius:"10px", fontSize:"10px" }}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
          <button onClick={fetchVMs} style={{ background:"none", border:`1px solid ${border}`, borderRadius:"8px", padding:"5px 12px", fontSize:"12px", color:muted, cursor:"pointer" }}>Refresh</button>
        </div>

        {loading ? (
          <div style={{ padding:"48px", textAlign:"center", color:muted }}>Loading VMs...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:"64px", textAlign:"center" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>🖥️</div>
            <div style={{ fontSize:"15px", fontWeight:"500", color:text, marginBottom:"6px" }}>
              {envFilter === "all" ? "No VMs yet" : `No ${envFilter} VMs`}
            </div>
            <div style={{ fontSize:"13px", color:muted }}>
              {envFilter === "all" ? "Create your first VM using the button above" : `No instances tagged as "${envFilter}" environment`}
            </div>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${border}`, background:subtle }}>
                {["Name / Env","Instance ID","Type","Region","State","Actions"].map(h => (
                  <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:"11px", fontWeight:"600", color:th, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((vm) => (
                <tr key={vm.id} style={{ borderBottom:`1px solid ${border}`, transition:"background 0.15s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ fontWeight:"600", fontSize:"13px", color:text, marginBottom:"4px" }}>{vm.name}</div>
                    <EnvBadge env={normalizeEnv(vm)} />
                  </td>
                  <td style={{ padding:"14px 16px" }}>
                    <span style={{ fontFamily:"monospace", fontSize:"11px", color:muted, background:subtle, padding:"2px 8px", borderRadius:"6px" }}>{vm.instance_id||"-"}</span>
                  </td>
                  <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{vm.instance_type}</td>
                  <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{vm.region}</td>
                  <td style={{ padding:"14px 16px" }}><Badge state={vm.state} dark={dark} /></td>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                      {vm.state==="stopped" && (
                        <button onClick={()=>handleAction(startVM,vm.id)} disabled={actionId===vm.id}
                          style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #00d4aa40", background:"#00d4aa15", color:"#00d4aa" }}>
                          {actionId===vm.id?"...":"Start"}
                        </button>
                      )}
                      {vm.state==="running" && (
                        <button onClick={()=>handleAction(stopVM,vm.id)} disabled={actionId===vm.id}
                          style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #f59e0b40", background:"#f59e0b15", color:"#f59e0b" }}>
                          {actionId===vm.id?"...":"Stop"}
                        </button>
                      )}
                      <button onClick={()=>setConnVM(vm)} style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"12px", cursor:"pointer", border:"1px solid #00d4aa40", background:"#00d4aa15", color:"#00d4aa" }}>Connect</button>
                      <button onClick={()=>setSchedVM(vm)} style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"12px", cursor:"pointer", border:"1px solid #3b82f640", background:"#3b82f615", color:"#3b82f6" }}>
                        {(vm.auto_start||vm.auto_stop)?"Scheduled":"Schedule"}
                      </button>
                      <button onClick={()=>handleDelete(vm.id,vm.name)} disabled={actionId===vm.id}
                        style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>
                        {actionId===vm.id?"...":"Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {connVM && <EC2ConnectionInfo vm={connVM} onClose={()=>setConnVM(null)} />}
      {schedVM && <ScheduleModal vm={schedVM} onClose={()=>setSchedVM(null)} onSaved={()=>{setSchedVM(null);fetchVMs()}} />}
      {showModal && <CreateVMModal onClose={()=>setShowModal(false)} onSuccess={()=>{ setShowModal(false); setSuccess("Request submitted - awaiting admin approval"); fetchVMs(); setTimeout(()=>setSuccess(""),4000) }} />}
    </div>
  )
}
