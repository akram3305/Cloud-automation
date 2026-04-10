import { useEffect, useState, useCallback } from "react"
import { listVMs, startVM, stopVM, deleteVM, setSchedule } from "../api/api"
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

function Badge({ state, dark }) {
  const s = STATE[state] || STATE.pending
  return (
    <span style={{ background: dark?s.darkBg:s.bg, color: dark?s.darkColor:s.color, padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600", display:"inline-flex", alignItems:"center", gap:"5px" }}>
      <span style={{ width:"5px", height:"5px", borderRadius:"50%", background:s.dot }} />
      {state}
    </span>
  )
}

export default function Compute() {
  const { dark } = useTheme()
  const [vms,       setVms]       = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [schedVM, setSchedVM] = useState(null)
  const [connVM, setConnVM] = useState(null)
  const [success,   setSuccess]   = useState("")
  const [actionId,  setActionId]  = useState(null)

  const surface = dark ? "#0f172a"  : "#ffffff"
  const bg      = dark ? "#070c18"  : "#f0f4f8"
  const border  = dark ? "#1e293b"  : "#e2e8f0"
  const text    = dark ? "#f1f5f9"  : "#0f172a"
  const muted   = dark ? "#475569"  : "#64748b"
  const subtle  = dark ? "#1e293b"  : "#f8fafc"
  const th      = dark ? "#334155"  : "#64748b"

  const fetchVMs = useCallback(async () => {
    try { const { data } = await listVMs(); setVms(data) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchVMs(); const id = setInterval(fetchVMs, 10000); return () => clearInterval(id) }, [fetchVMs])

  async function handleAction(fn, id) {
    setActionId(id)
    try { await fn(id); fetchVMs() } catch(e) { alert(e.response?.data?.detail || e.message) }
    finally { setActionId(null) }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Terminate "${name}"? This is irreversible and will also destroy the EC2 instance.`)) return
    handleAction(deleteVM, id)
  }

  const running = vms.filter(v=>v.state==="running").length
  const stopped = vms.filter(v=>v.state==="stopped").length

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"all 0.3s ease" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", animation:"fadeUp 0.4s ease both" }}>
        <div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>Compute</h1>
          <div style={{ display:"flex", gap:"16px", marginTop:"6px" }}>
            <span style={{ fontSize:"13px", color:"#00d4aa" }}>{running} running</span>
            <span style={{ fontSize:"13px", color:muted }}>{stopped} stopped</span>
            <span style={{ fontSize:"13px", color:muted }}>{vms.length} total</span>
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
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"13px", fontWeight:"600", color:text }}>Virtual Machines</span>
          <button onClick={fetchVMs} style={{ background:"none", border:`1px solid ${border}`, borderRadius:"8px", padding:"6px 12px", fontSize:"12px", color:muted, cursor:"pointer" }}>Refresh</button>
        </div>

        {loading ? (
          <div style={{ padding:"48px", textAlign:"center", color:muted }}>Loading VMs...</div>
        ) : vms.length === 0 ? (
          <div style={{ padding:"64px", textAlign:"center" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>???</div>
            <div style={{ fontSize:"15px", fontWeight:"500", color:text, marginBottom:"6px" }}>No VMs yet</div>
            <div style={{ fontSize:"13px", color:muted }}>Create your first VM using the button above</div>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${border}`, background:subtle }}>
                {["Name","Instance ID","Type","Region","State","Actions"].map(h => (
                  <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:"11px", fontWeight:"600", color:th, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vms.map((vm,i) => (
                <tr key={vm.id} style={{ borderBottom:`1px solid ${border}`, transition:"background 0.15s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ fontWeight:"600", fontSize:"13px", color:text }}>{vm.name}</div>
                  </td>
                  <td style={{ padding:"14px 16px" }}>
                    <span style={{ fontFamily:"monospace", fontSize:"11px", color:muted, background:subtle, padding:"2px 8px", borderRadius:"6px" }}>{vm.instance_id||"-"}</span>
                  </td>
                  <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{vm.instance_type}</td>
                  <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{vm.region}</td>
                  <td style={{ padding:"14px 16px" }}><Badge state={vm.state} dark={dark} /></td>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", gap:"6px" }}>
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
                      <button onClick={()=>setConnVM(vm)} style={{padding:"5px 12px",borderRadius:"6px",fontSize:"12px",cursor:"pointer",border:"1px solid #00d4aa40",background:"#00d4aa15",color:"#00d4aa",marginRight:"6px"}}>Connect</button><button onClick={()=>setSchedVM(vm)} style={{padding:"5px 12px",borderRadius:"6px",fontSize:"12px",cursor:"pointer",border:"1px solid #3b82f640",background:"#3b82f615",color:"#3b82f6",marginRight:"6px"}}>{(vm.auto_start||vm.auto_stop)?"Scheduled":"Schedule"}</button><button onClick={()=>handleDelete(vm.id,vm.name)} disabled={actionId===vm.id}
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

