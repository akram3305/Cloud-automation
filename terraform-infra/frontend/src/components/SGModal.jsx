import { useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"

const COMMON_RULES = [
  {label:"SSH",        protocol:"tcp",from_port:22,  to_port:22,  cidr:"0.0.0.0/0"},
  {label:"HTTP",       protocol:"tcp",from_port:80,  to_port:80,  cidr:"0.0.0.0/0"},
  {label:"HTTPS",      protocol:"tcp",from_port:443, to_port:443, cidr:"0.0.0.0/0"},
  {label:"RDP",        protocol:"tcp",from_port:3389,to_port:3389,cidr:"0.0.0.0/0"},
  {label:"MySQL",      protocol:"tcp",from_port:3306,to_port:3306,cidr:"0.0.0.0/0"},
  {label:"PostgreSQL", protocol:"tcp",from_port:5432,to_port:5432,cidr:"0.0.0.0/0"},
  {label:"MongoDB",    protocol:"tcp",from_port:27017,to_port:27017,cidr:"0.0.0.0/0"},
  {label:"Redis",      protocol:"tcp",from_port:6379,to_port:6379,cidr:"0.0.0.0/0"},
  {label:"All traffic",protocol:"-1", from_port:0,  to_port:65535,cidr:"0.0.0.0/0"},
  {label:"Custom",     protocol:"tcp",from_port:8080,to_port:8080,cidr:"0.0.0.0/0"},
]

const ALL_REGIONS = ["ap-south-1","ap-south-2","ap-southeast-1","us-east-1","us-east-2","us-west-1","us-west-2","eu-west-1","eu-central-1"]

export default function SGModal({ onClose, onSuccess, preselectedVpc, preselectedRegion }) {
  const { dark } = useTheme()
  const [vpcs, setVpcs]         = useState([])
  const [selectedVpc, setVpc]   = useState(preselectedVpc || "")
  const [region, setRegion]     = useState(preselectedRegion || "ap-south-1")
  const [name, setName]         = useState("")
  const [desc, setDesc]         = useState("Managed by AIonOS Platform")
  const [rulesIn, setRulesIn]   = useState([
    {protocol:"tcp",from_port:22,to_port:22,cidr:"0.0.0.0/0",desc:"SSH"},
    {protocol:"tcp",from_port:80,to_port:80,cidr:"0.0.0.0/0",desc:"HTTP"},
    {protocol:"tcp",from_port:443,to_port:443,cidr:"0.0.0.0/0",desc:"HTTPS"},
  ])
  const [rulesOut, setRulesOut] = useState([{protocol:"-1",from_port:0,to_port:65535,cidr:"0.0.0.0/0",desc:"All outbound"}])
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState("")
  const [success, setSuccess]   = useState(false)

  const surface = dark?"#0f172a":"#ffffff"
  const border  = dark?"#1e293b":"#e2e8f0"
  const text    = dark?"#f1f5f9":"#0f172a"
  const muted   = dark?"#475569":"#64748b"
  const subtle  = dark?"#1e293b":"#f8fafc"
  const inp     = {padding:"7px 10px",border:"1px solid "+border,borderRadius:"6px",fontSize:"12px",background:surface,color:text}

  useEffect(() => { loadVPCs() }, [region])
  async function loadVPCs() {
    try {
      const {data} = await api.get(`/vpc/list?region=${region}`)
      setVpcs(data)
      if(data.length>0&&!selectedVpc) setVpc(data[0].id)
    } catch(e) { console.error(e) }
  }

  function addRuleIn(preset) {
    setRulesIn(p=>[...p,{protocol:preset.protocol,from_port:preset.from_port,to_port:preset.to_port,cidr:preset.cidr,desc:preset.label}])
  }
  function removeRuleIn(i){setRulesIn(p=>p.filter((_,j)=>j!==i))}
  function updateRuleIn(i,field,val){setRulesIn(p=>p.map((r,j)=>j===i?{...r,[field]:val}:r))}
  function removeRuleOut(i){setRulesOut(p=>p.filter((_,j)=>j!==i))}
  function updateRuleOut(i,field,val){setRulesOut(p=>p.map((r,j)=>j===i?{...r,[field]:val}:r))}

  async function handleCreate() {
    if(!name.trim()){setError("Name required");return}
    if(!selectedVpc){setError("Select a VPC");return}
    setCreating(true);setError("")
    try {
      await api.post("/vpc/security-groups/create",{
        vpc_id:selectedVpc, name, description:desc, region,
        rules_in:rulesIn, rules_out:rulesOut
      })
      setSuccess(true)
      setTimeout(()=>{onSuccess();onClose()},2000)
    } catch(e){setError(e.response?.data?.detail||e.message)}
    finally{setCreating(false)}
  }

  if(success) return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:"16px"}}>
      <div style={{background:surface,borderRadius:"18px",border:"1px solid "+border,width:"100%",maxWidth:"400px",padding:"40px",textAlign:"center"}}>
        <div style={{width:"64px",height:"64px",borderRadius:"50%",background:"#00d4aa20",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style={{fontSize:"18px",fontWeight:"700",color:text,marginBottom:"6px"}}>Security Group Created!</div>
        <div style={{fontSize:"13px",color:muted}}>{name} created with {rulesIn.length} inbound rules</div>
      </div>
    </div>
  )

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:"16px"}}>
      <div style={{background:surface,borderRadius:"18px",border:"1px solid "+border,width:"100%",maxWidth:"680px",maxHeight:"92vh",overflow:"auto"}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid "+border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:"17px",fontWeight:"700",color:text}}>Create Security Group</div>
            <div style={{fontSize:"12px",color:muted,marginTop:"2px"}}>Define inbound and outbound traffic rules</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:"22px",color:muted}}>x</button>
        </div>

        {error&&<div style={{margin:"12px 24px 0",background:"#f43f5e15",color:"#f43f5e",padding:"10px",borderRadius:"8px",fontSize:"13px"}}>{error}</div>}

        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:"14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
            <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>Name *</label>
              <input style={{...inp,width:"100%",padding:"8px 12px"}} placeholder="my-security-group" value={name} onChange={e=>setName(e.target.value)} /></div>
            <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>Region</label>
              <select style={{...inp,width:"100%",padding:"8px 12px"}} value={region} onChange={e=>setRegion(e.target.value)}>
                {ALL_REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
              </select></div>
          </div>
          <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>VPC *</label>
            <select style={{...inp,width:"100%",padding:"8px 12px"}} value={selectedVpc} onChange={e=>setVpc(e.target.value)}>
              <option value="">Select VPC...</option>
              {vpcs.map(v=><option key={v.id} value={v.id}>{v.name} ({v.cidr})</option>)}
            </select></div>
          <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>Description</label>
            <input style={{...inp,width:"100%",padding:"8px 12px"}} value={desc} onChange={e=>setDesc(e.target.value)} /></div>

          {/* Inbound Rules */}
          <div>
            <div style={{fontSize:"13px",fontWeight:"600",color:text,marginBottom:"8px"}}>Inbound Rules ({rulesIn.length})</div>
            <div style={{marginBottom:"8px",display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {COMMON_RULES.map(r=>(
                <button key={r.label} onClick={()=>addRuleIn(r)} style={{padding:"3px 10px",borderRadius:"20px",fontSize:"11px",cursor:"pointer",border:"1px solid "+border,background:subtle,color:muted,transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#f59e0b40";e.currentTarget.style.color="#f59e0b"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=border;e.currentTarget.style.color=muted}}>
                  + {r.label}
                </button>
              ))}
            </div>
            <div style={{border:"1px solid "+border,borderRadius:"8px",overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"80px 80px 80px 1fr 120px 30px",gap:"1px",background:subtle,padding:"6px 10px"}}>
                {["Protocol","From","To","CIDR","Description",""].map(h=><div key={h} style={{fontSize:"10px",fontWeight:"600",color:muted,textTransform:"uppercase"}}>{h}</div>)}
              </div>
              {rulesIn.map((r,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"80px 80px 80px 1fr 120px 30px",gap:"6px",padding:"6px 10px",borderTop:"1px solid "+border,alignItems:"center"}}>
                  <select style={inp} value={r.protocol} onChange={e=>updateRuleIn(i,"protocol",e.target.value)}>
                    <option value="tcp">TCP</option><option value="udp">UDP</option><option value="icmp">ICMP</option><option value="-1">All</option>
                  </select>
                  <input style={inp} type="number" value={r.from_port} disabled={r.protocol==="-1"} onChange={e=>updateRuleIn(i,"from_port",parseInt(e.target.value))} />
                  <input style={inp} type="number" value={r.to_port} disabled={r.protocol==="-1"} onChange={e=>updateRuleIn(i,"to_port",parseInt(e.target.value))} />
                  <input style={inp} value={r.cidr} onChange={e=>updateRuleIn(i,"cidr",e.target.value)} placeholder="0.0.0.0/0" />
                  <input style={inp} value={r.desc||""} onChange={e=>updateRuleIn(i,"desc",e.target.value)} placeholder="Description" />
                  <button onClick={()=>removeRuleIn(i)} style={{padding:"3px 6px",borderRadius:"4px",fontSize:"12px",cursor:"pointer",border:"1px solid #f43f5e40",background:"#f43f5e15",color:"#f43f5e"}}>x</button>
                </div>
              ))}
              {rulesIn.length===0&&<div style={{padding:"16px",textAlign:"center",color:muted,fontSize:"12px"}}>No inbound rules — all traffic blocked</div>}
            </div>
          </div>

          {/* Outbound Rules */}
          <div>
            <div style={{fontSize:"13px",fontWeight:"600",color:text,marginBottom:"8px"}}>Outbound Rules ({rulesOut.length})</div>
            <div style={{border:"1px solid "+border,borderRadius:"8px",overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"80px 80px 80px 1fr 30px",gap:"1px",background:subtle,padding:"6px 10px"}}>
                {["Protocol","From","To","CIDR",""].map(h=><div key={h} style={{fontSize:"10px",fontWeight:"600",color:muted,textTransform:"uppercase"}}>{h}</div>)}
              </div>
              {rulesOut.map((r,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"80px 80px 80px 1fr 30px",gap:"6px",padding:"6px 10px",borderTop:"1px solid "+border,alignItems:"center"}}>
                  <select style={inp} value={r.protocol} onChange={e=>updateRuleOut(i,"protocol",e.target.value)}>
                    <option value="-1">All</option><option value="tcp">TCP</option><option value="udp">UDP</option>
                  </select>
                  <input style={inp} type="number" value={r.from_port} disabled={r.protocol==="-1"} onChange={e=>updateRuleOut(i,"from_port",parseInt(e.target.value))} />
                  <input style={inp} type="number" value={r.to_port} disabled={r.protocol==="-1"} onChange={e=>updateRuleOut(i,"to_port",parseInt(e.target.value))} />
                  <input style={inp} value={r.cidr} onChange={e=>updateRuleOut(i,"cidr",e.target.value)} placeholder="0.0.0.0/0" />
                  <button onClick={()=>removeRuleOut(i)} style={{padding:"3px 6px",borderRadius:"4px",fontSize:"12px",cursor:"pointer",border:"1px solid #f43f5e40",background:"#f43f5e15",color:"#f43f5e"}}>x</button>
                </div>
              ))}
            </div>
            <button onClick={()=>setRulesOut(p=>[...p,{protocol:"-1",from_port:0,to_port:65535,cidr:"0.0.0.0/0",desc:""}])} style={{marginTop:"6px",padding:"4px 12px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #3b82f640",background:"#3b82f615",color:"#3b82f6"}}>+ Add Outbound Rule</button>
          </div>
        </div>

        <div style={{padding:"16px 24px",borderTop:"1px solid "+border,display:"flex",justifyContent:"space-between"}}>
          <button onClick={onClose} style={{padding:"9px 18px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",border:"1px solid "+border,background:"transparent",color:text}}>Cancel</button>
          <button onClick={handleCreate} disabled={creating} style={{padding:"9px 22px",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer",border:"none",background:"#f59e0b",color:"#fff",opacity:creating?0.7:1}}>
            {creating?"Creating...":"Create Security Group"}
          </button>
        </div>
      </div>
    </div>
  )
}
