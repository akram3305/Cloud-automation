import { useState, useEffect, useCallback } from "react"
import { useTheme } from "../context/ThemeContext"
import { listRequests, listVMs, listBuckets, deleteBucket, startVM, stopVM, listVPCs, listLambdas, listLoadBalancers } from "../api/api"
import CreateVMModal from "../components/CreateVMModal"

const ACCESS_CODE = "AIONOS"
const STATUS_COLORS = {
  running:"#00d4aa", active:"#00d4aa", available:"#00d4aa",
  stopped:"#f59e0b", pending:"#3b82f6", provisioning:"#a78bfa", failed:"#f43f5e"
}
const S3_REGIONS = ["ap-south-1","ap-southeast-1","us-east-1","us-east-2","us-west-2","eu-west-1","eu-central-1"]
const GROUPS_CONFIG = [
  { type:"ec2",     label:"EC2 Instances",   color:"#FF9900", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
  { type:"s3",      label:"S3 Buckets",      color:"#00d4aa", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { type:"vpc",     label:"VPCs",            color:"#a78bfa", icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064" },
  { type:"lambda",  label:"Lambda Functions",color:"#f59e0b", icon:"M13 10V3L4 14h7v7l9-11h-7z" },
  { type:"elb",     label:"Load Balancers",  color:"#06b6d4", icon:"M8 9l4-4 4 4m0 6l-4 4-4-4" },
  { type:"request", label:"Pending Requests",color:"#a78bfa", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
]

export default function Resources() {
  const { dark } = useTheme()
  const [vms, setVms]           = useState([])
  const [reqs, setReqs]         = useState([])
  const [s3, setS3]             = useState([])
  const [vpcs, setVpcs]         = useState([])
  const [lambdas, setLambdas]   = useState([])
  const [lbs, setLbs]           = useState([])
  const [loading, setLoading]   = useState(true)
  const [success, setSuccess]   = useState("")
  const [actionId, setActionId] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [revealed, setRevealed] = useState({})
  const [showVMModal, setVMModal] = useState(false)
  const [showS3Modal, setS3Modal] = useState(false)
  const [s3Form, setS3Form]     = useState({ name:"", region:"ap-south-1", versioning:false, public:false, encryption:"AES256" })
  const [s3Creating, setS3C]    = useState(false)
  const [s3Err, setS3Err]       = useState("")

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const inp     = { padding:"8px 12px", border:"1px solid "+border, borderRadius:"8px", fontSize:"13px", width:"100%", background:surface, color:text }

  const fetchAll = useCallback(async () => {
    try {
      const [vr,rr,sr,vpcr,lr,lbr] = await Promise.all([
        listVMs(), listRequests(), listBuckets(),
        listVPCs().catch(()=>({data:[]})),
        listLambdas().catch(()=>({data:[]})),
        listLoadBalancers().catch(()=>({data:[]})),
      ])
      setVms(vr.data)
      setReqs(rr.data.filter(r=>!["completed","rejected"].includes(r.status)))
      setS3(sr.data)
      setVpcs(vpcr.data)
      setLambdas(lr.data)
      setLbs(lbr.data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function toggleSection(type) {
    if (expanded[type]) {
      setExpanded(p => ({...p,[type]:false}))
      return
    }
    if (!revealed[type]) {
      const code = window.prompt("Enter access code to unlock " + type + ":")
      if (!code) return
      if (code.toUpperCase() !== ACCESS_CODE) { alert("Incorrect access code"); return }
      setRevealed(p => ({...p,[type]:true}))
    }
    setExpanded(p => ({...p,[type]:true}))
  }

  function lockSection(type, e) {
    e.stopPropagation()
    setExpanded(p => ({...p,[type]:false}))
    setRevealed(p => ({...p,[type]:false}))
  }

  async function handleStart(vm) {
    setActionId(vm.id+"-start")
    try { await startVM(vm.id); fetchAll() } catch(e) { alert(e.response?.data?.detail||e.message) }
    finally { setActionId(null) }
  }

  async function handleStop(vm) {
    setActionId(vm.id+"-stop")
    try { await stopVM(vm.id); fetchAll() } catch(e) { alert(e.response?.data?.detail||e.message) }
    finally { setActionId(null) }
  }

  async function handleDeleteBucket(name) {
    if (!window.confirm("Delete bucket " + name + "?")) return
    try { await deleteBucket(name, true); setSuccess("Deleted "+name); fetchAll(); setTimeout(()=>setSuccess(""),3000) }
    catch(e) { alert(e.response?.data?.detail||e.message) }
  }

  async function handleS3Create() {
    if (!s3Form.name.trim()) { setS3Err("Name required"); return }
    setS3C(true); setS3Err("")
    try {
      const { createBucket } = await import("../api/api")
      await createBucket(s3Form)
      setSuccess("Bucket "+s3Form.name+" created")
      setS3Modal(false)
      setS3Form({ name:"", region:"ap-south-1", versioning:false, public:false, encryption:"AES256" })
      fetchAll()
      setTimeout(()=>setSuccess(""),3000)
    } catch(e) { setS3Err(e.response?.data?.detail||e.message) }
    finally { setS3C(false) }
  }

  function makeRows(type) {
    if (type==="ec2") return vms.map(v=>({
      id:v.id, label:v.name, status:v.state, region:v.region, detail:v.instance_type,
      actions:(
        <div style={{display:"flex",gap:"6px"}}>
          {v.state==="stopped"&&<button onClick={()=>handleStart(v)} disabled={actionId===v.id+"-start"} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #00d4aa40",background:"#00d4aa15",color:"#00d4aa"}}>{actionId===v.id+"-start"?"...":"Start"}</button>}
          {v.state==="running"&&<button onClick={()=>handleStop(v)}  disabled={actionId===v.id+"-stop"}  style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #f59e0b40",background:"#f59e0b15",color:"#f59e0b"}}>{actionId===v.id+"-stop"?"...":"Stop"}</button>}
        </div>
      )
    }))
    if (type==="s3") return s3.map(b=>({
      id:b.name, label:b.name, status:"active", region:b.region,
      detail:new Date(b.created).toLocaleDateString("en-IN"),
      actions:<button onClick={()=>handleDeleteBucket(b.name)} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #f43f5e40",background:"#f43f5e15",color:"#f43f5e"}}>Delete</button>
    }))
    if (type==="vpc") return vpcs.map(v=>({ id:v.id, label:v.name||v.id, status:"available", region:v.region, detail:v.cidr, actions:null }))
    if (type==="lambda") return lambdas.map(l=>({ id:l.name, label:l.name, status:"active", region:l.region, detail:l.runtime+" - "+l.size_kb+" KB", actions:null }))
    if (type==="elb") return lbs.map(lb=>({ id:lb.name, label:lb.name, status:lb.state, region:lb.region, detail:lb.type, actions:null }))
    if (type==="request") return reqs.map(r=>({ id:r.id, label:r.resource_name, status:r.status, region:"--", detail:r.resource_type+" by "+r.username, actions:null }))
    return []
  }

  return (
    <div style={{padding:"28px",background:bg,minHeight:"100vh",transition:"all 0.3s"}}>
      <style>{"@keyframes slideIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}"}</style>

      <div style={{marginBottom:"24px"}}>
        <h1 style={{fontSize:"24px",fontWeight:"700",color:text,margin:0}}>Resources</h1>
        <p style={{fontSize:"13px",color:muted,marginTop:"4px"}}>
          {vms.length} EC2 - {s3.length} S3 - {vpcs.length} VPC - {lambdas.length} Lambda - {lbs.length} LB
          <span style={{marginLeft:"10px",color:"#f59e0b",fontSize:"11px"}}>All sections locked - enter AIONOS to unlock</span>
        </p>
      </div>

      {success && <div style={{background:"#00d4aa15",border:"1px solid #00d4aa30",color:"#00d4aa",padding:"12px 16px",borderRadius:"10px",marginBottom:"16px",fontSize:"13px"}}>{success}</div>}

      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {GROUPS_CONFIG.map(group => {
          const rows = makeRows(group.type)
          const isExpanded = expanded[group.type]
          const isRevealed = revealed[group.type]
          return (
            <div key={group.type} style={{background:surface,border:"1px solid "+(isExpanded?group.color+"50":border),borderRadius:"14px",overflow:"hidden",transition:"all 0.3s"}}>
              <div onClick={()=>toggleSection(group.type)}
                style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",background:isExpanded?(dark?group.color+"10":group.color+"06"):"transparent",transition:"background 0.2s"}}>
                <div style={{width:"32px",height:"32px",borderRadius:"9px",background:group.color+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={group.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={group.icon}/></svg>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                    <span style={{fontSize:"13px",fontWeight:"600",color:text}}>{group.label}</span>
                    <span style={{background:group.color+"20",color:group.color,padding:"1px 8px",borderRadius:"10px",fontSize:"11px",fontWeight:"600"}}>{rows.length}</span>
                    {!isRevealed && <span style={{background:"#f59e0b15",color:"#f59e0b",padding:"1px 8px",borderRadius:"10px",fontSize:"10px",fontWeight:"600"}}>LOCKED</span>}
                    {isExpanded && isRevealed && group.type==="s3" && (
                      <button onClick={e=>{e.stopPropagation();setS3Modal(true)}} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"600",cursor:"pointer",border:"none",background:"#00d4aa",color:"#0a0f1e"}}>+ Create</button>
                    )}
                    {isExpanded && isRevealed && group.type==="ec2" && (
                      <button onClick={e=>{e.stopPropagation();setVMModal(true)}} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"600",cursor:"pointer",border:"none",background:"#FF9900",color:"#fff"}}>+ Launch</button>
                    )}
                  </div>
                  <div style={{fontSize:"10px",color:muted,marginTop:"1px"}}>
                    {isRevealed?(isExpanded?"Click to collapse":"Click to expand"):"Click to unlock"}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  {isRevealed && <button onClick={e=>lockSection(group.type,e)} style={{padding:"3px 8px",borderRadius:"6px",fontSize:"10px",fontWeight:"600",cursor:"pointer",border:"1px solid #f59e0b40",background:"#f59e0b15",color:"#f59e0b"}}>Lock</button>}
                  <span style={{fontSize:"16px",color:muted,display:"inline-block",transition:"transform 0.25s",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>&#x203A;</span>
                </div>
              </div>

              {isExpanded && isRevealed && (
                <div style={{borderTop:"1px solid "+border,animation:"slideIn 0.2s ease both"}}>
                  {rows.length===0 ? (
                    <div style={{padding:"24px",textAlign:"center",color:muted,fontSize:"13px"}}>No {group.label.toLowerCase()} found</div>
                  ) : (
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead>
                        <tr style={{background:subtle}}>
                          {["Name","Status","Region","Details","Actions"].map(h=>(
                            <th key={h} style={{padding:"8px 16px",textAlign:"left",fontSize:"10px",fontWeight:"600",color:muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row,i)=>{
                          const sc = STATUS_COLORS[row.status]||"#64748b"
                          return (
                            <tr key={i} style={{borderTop:"1px solid "+border}}
                              onMouseEnter={e=>e.currentTarget.style.background=dark?"#ffffff04":"#f8fafc"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{padding:"11px 16px",fontSize:"12px",fontWeight:"600",color:text,maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.label}</td>
                              <td style={{padding:"11px 16px"}}><span style={{background:sc+"15",color:sc,padding:"2px 8px",borderRadius:"20px",fontSize:"10px",fontWeight:"600"}}>{row.status}</span></td>
                              <td style={{padding:"11px 16px",fontSize:"11px",color:muted}}>{row.region}</td>
                              <td style={{padding:"11px 16px",fontSize:"11px",color:muted,maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.detail}</td>
                              <td style={{padding:"11px 16px"}}>{row.actions}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showVMModal && <CreateVMModal onClose={()=>setVMModal(false)} onSuccess={()=>{setVMModal(false);setSuccess("EC2 request submitted");fetchAll()}} />}

      {showS3Modal && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"20px"}}>
          <div style={{background:surface,borderRadius:"14px",border:"1px solid "+border,width:"100%",maxWidth:"440px"}}>
            <div style={{padding:"18px 24px",borderBottom:"1px solid "+border,display:"flex",justifyContent:"space-between"}}>
              <div style={{fontSize:"15px",fontWeight:"600",color:text}}>Create S3 Bucket</div>
              <button onClick={()=>setS3Modal(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",color:muted}}>x</button>
            </div>
            <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:"12px"}}>
              {s3Err && <div style={{background:"#f43f5e15",color:"#f43f5e",padding:"10px",borderRadius:"8px",fontSize:"13px"}}>{s3Err}</div>}
              <div>
                <label style={{display:"block",fontSize:"12px",fontWeight:"500",color:muted,marginBottom:"5px"}}>Bucket name</label>
                <input style={inp} placeholder="my-bucket" value={s3Form.name} onChange={e=>setS3Form(p=>({...p,name:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")}))} />
              </div>
              <div>
                <label style={{display:"block",fontSize:"12px",fontWeight:"500",color:muted,marginBottom:"5px"}}>Region</label>
                <select style={inp} value={s3Form.region} onChange={e=>setS3Form(p=>({...p,region:e.target.value}))}>
                  {S3_REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{display:"flex",gap:"8px"}}>
                {[{v:"AES256",l:"SSE-S3"},{v:"aws:kms",l:"SSE-KMS"},{v:"none",l:"None"}].map(opt=>(
                  <div key={opt.v} onClick={()=>setS3Form(p=>({...p,encryption:opt.v}))} style={{flex:1,padding:"8px",borderRadius:"8px",cursor:"pointer",border:"1px solid "+(s3Form.encryption===opt.v?"#00d4aa40":border),background:s3Form.encryption===opt.v?"#00d4aa10":surface,textAlign:"center"}}>
                    <div style={{fontSize:"12px",fontWeight:"600",color:s3Form.encryption===opt.v?"#00d4aa":text}}>{opt.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:"20px"}}>
                <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"12px",color:text}}>
                  <input type="checkbox" checked={s3Form.versioning} onChange={e=>setS3Form(p=>({...p,versioning:e.target.checked}))} />Versioning
                </label>
                <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"12px",color:text}}>
                  <input type="checkbox" checked={s3Form.public} onChange={e=>setS3Form(p=>({...p,public:e.target.checked}))} />Public
                </label>
              </div>
            </div>
            <div style={{padding:"14px 24px",borderTop:"1px solid "+border,display:"flex",justifyContent:"flex-end",gap:"10px"}}>
              <button onClick={()=>setS3Modal(false)} style={{padding:"8px 16px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",border:"1px solid "+border,background:"transparent",color:text}}>Cancel</button>
              <button onClick={handleS3Create} disabled={s3Creating} style={{padding:"8px 16px",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer",border:"none",background:"#00d4aa",color:"#0a0f1e",opacity:s3Creating?0.7:1}}>
                {s3Creating?"Creating...":"Create Bucket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
