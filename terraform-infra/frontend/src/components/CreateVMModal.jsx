import { useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"
import TagsStep from "./TagsStep"

const STEPS = ["Instance","Network","Key Pair","Tags","Review"]

const ALL_REGIONS = ["ap-south-1","ap-south-2","ap-southeast-1","ap-southeast-2","ap-northeast-1","ap-northeast-2","us-east-1","us-east-2","us-west-1","us-west-2","eu-west-1","eu-west-2","eu-central-1","eu-north-1","ca-central-1","sa-east-1","me-south-1","af-south-1"]

const INSTANCE_GROUPS = [
  { group:"General", color:"#3b82f6", types:[
    {t:"t2.micro",c:1,r:"1 GiB",p:"$0.012/hr"},{t:"t2.small",c:1,r:"2 GiB",p:"$0.023/hr"},
    {t:"t2.medium",c:2,r:"4 GiB",p:"$0.046/hr"},{t:"t3.micro",c:2,r:"1 GiB",p:"$0.011/hr"},
    {t:"t3.medium",c:2,r:"4 GiB",p:"$0.042/hr"},{t:"t3.large",c:2,r:"8 GiB",p:"$0.083/hr"},
    {t:"t3.xlarge",c:4,r:"16 GiB",p:"$0.166/hr"},{t:"m5.large",c:2,r:"8 GiB",p:"$0.096/hr"},
    {t:"m5.xlarge",c:4,r:"16 GiB",p:"$0.192/hr"},{t:"m5.2xlarge",c:8,r:"32 GiB",p:"$0.384/hr"},
  ]},
  { group:"Compute", color:"#f59e0b", types:[
    {t:"c5.large",c:2,r:"4 GiB",p:"$0.085/hr"},{t:"c5.xlarge",c:4,r:"8 GiB",p:"$0.170/hr"},
    {t:"c5.2xlarge",c:8,r:"16 GiB",p:"$0.340/hr"},{t:"c5a.xlarge",c:4,r:"8 GiB",p:"$0.154/hr"},
  ]},
  { group:"Memory", color:"#a78bfa", types:[
    {t:"r5.large",c:2,r:"16 GiB",p:"$0.126/hr"},{t:"r5.xlarge",c:4,r:"32 GiB",p:"$0.252/hr"},
    {t:"r5.2xlarge",c:8,r:"64 GiB",p:"$0.504/hr"},
  ]},
  { group:"GPU", color:"#f43f5e", types:[
    {t:"g4dn.xlarge",c:4,r:"16 GiB",p:"$0.526/hr"},{t:"g4dn.2xlarge",c:8,r:"32 GiB",p:"$0.752/hr"},
    {t:"g5.xlarge",c:4,r:"16 GiB",p:"$1.006/hr"},
  ]},
  { group:"ARM", color:"#00d4aa", types:[
    {t:"t4g.medium",c:2,r:"4 GiB",p:"$0.034/hr"},{t:"t4g.large",c:2,r:"8 GiB",p:"$0.067/hr"},
    {t:"m6g.large",c:2,r:"8 GiB",p:"$0.077/hr"},
  ]},
]

const AMIS = [
  {id:"ami-0c2af51e265bd5e0e",name:"Amazon Linux 2023",os:"linux"},
  {id:"ami-0f58b397bc5c1f2e8",name:"Ubuntu 22.04 LTS",os:"ubuntu"},
  {id:"ami-00bb6a80f01f03502",name:"Ubuntu 20.04 LTS",os:"ubuntu"},
  {id:"ami-02b8269d5e85954ef",name:"Windows Server 2022",os:"windows"},
  {id:"ami-0acb4f799a89ed5c6",name:"RHEL 9",os:"rhel"},
]

export default function CreateVMModal({ onClose, onSuccess }) {
  const { dark } = useTheme()
  const [step, setStep]            = useState(0)
  const [error, setError]          = useState("")
  const [name, setName]            = useState("")
  const [region, setRegion]        = useState("ap-south-1")
  const [ami, setAmi]              = useState("ami-0c2af51e265bd5e0e")
  const [instanceType, setIT]      = useState("t3.medium")
  const [instGroup, setIG]         = useState("General")
  const [vpcs, setVpcs]            = useState([])
  const [subnets, setSubnets]      = useState([])
  const [sgs, setSgs]              = useState([])
  const [selectedVpc, setVpc]      = useState("")
  const [selectedSubnet, setSub]   = useState("")
  const [selectedSgs, setSelSgs]   = useState([])
  const [keypairs, setKPs]         = useState([])
  const [selectedKP, setKP]        = useState("")
  const [createNewKP, setNewKP]    = useState(false)
  const [newKPName, setKPName]     = useState("")
  const [creatingKP, setCreatingKP]= useState(false)
  const [kpCreated, setKPCreated]  = useState(null)
  const [loadingNet, setLoadNet]   = useState(false)
  const [submitting, setSub2]      = useState(false)
  const [tags, setTags]            = useState({project:"",owner:"",environment:"",_custom:[]})
  const [submitted, setSubmitted]  = useState(false)

  const surface = dark?"#0f172a":"#ffffff"
  const border  = dark?"#1e293b":"#e2e8f0"
  const text    = dark?"#f1f5f9":"#0f172a"
  const muted   = dark?"#475569":"#64748b"
  const subtle  = dark?"#1e293b":"#f8fafc"
  const inp     = {padding:"8px 12px",border:"1px solid "+border,borderRadius:"8px",fontSize:"13px",width:"100%",background:surface,color:text}

  useEffect(()=>{
    if(step===1) loadNetworking()
    if(step===2) loadKeypairs()
  },[step,region])

  async function loadNetworking() {
    setLoadNet(true)
    try {
      const {data} = await api.get(`/vpc/list?region=${region}`)
      setVpcs(data)
      const def = data.find(v=>v.default)||data[0]
      if(def){setVpc(def.id);setSubnets(def.subnets||[]);setSgs(def.security_groups||[]);setSub(def.subnets?.[0]?.id||"")}
    } catch(e){console.error(e)}
    finally{setLoadNet(false)}
  }

  function handleVpcChange(id){
    setVpc(id)
    const vpc=vpcs.find(v=>v.id===id)
    if(vpc){setSubnets(vpc.subnets||[]);setSgs(vpc.security_groups||[]);setSub(vpc.subnets?.[0]?.id||"");setSelSgs([])}
  }

  async function loadKeypairs(){
    try{const {data}=await api.get(`/iam/keypairs?region=${region}`);setKPs(data);if(data.length>0&&!selectedKP)setKP(data[0].name)}catch(e){console.error(e)}
  }

  async function handleCreateKP(){
    if(!newKPName.trim()){setError("Key pair name required");return}
    setCreatingKP(true);setError("")
    try{
      const {data}=await api.post('/iam/keypairs/create', {name:newKPName, region:region})
      const blob=new Blob([data.private_key],{type:"text/plain"})
      const url=URL.createObjectURL(blob)
      const a=document.createElement("a");a.href=url;a.download=newKPName+".pem";a.click()
      URL.revokeObjectURL(url)
      setKPCreated({name:newKPName});setKP(newKPName);setNewKP(false)
      setKPs(prev=>[...prev,{name:newKPName,region}])
    }catch(e){setError(e.response?.data?.detail||e.message)}
    finally{setCreatingKP(false)}
  }

  function validateTags() {
    if(!tags.project?.trim()) return "Project Name is required"
    if(!tags.owner?.trim())   return "Project Owner is required"
    if(!tags.environment)     return "Environment is required"
    return null
  }

  // ── FIXED: all EC2 config goes inside payload{} ─────────────────────────
  async function handleSubmit(){
    if(step===1 && selectedVpc && selectedSgs.length===0){setError("Please select at least one security group");return}
    if(!name.trim()){setError("Instance name required");return}
    setSub2(true);setError("")
    try{
      await api.post("/requests", {
        resource_name:  name,
        resource_type:  "ec2",
        region,
        payload: {
          instance_type:           instanceType,
          ami_id:                  ami,
          subnet_id:               selectedSubnet || "",
          security_group_ids:      selectedSgs,
          key_name:                selectedKP || "",
          root_volume_type:        "gp3",
          root_volume_size:        20,
          root_volume_encrypted:   false,
          associate_public_ip:     true,
          monitoring:              false,
          disable_api_termination: false,
          tags: {
            project:     tags.project     || "AIonOS-Platform",
            owner:       tags.owner       || "admin",
            environment: tags.environment || "dev",
            CreatedBy:   "AIonOS-Platform",
          }
        }
      })
      setSubmitted(true)
    }catch(e){setError(e.response?.data?.detail||e.message)}
    finally{setSub2(false)}
  }

  function handleNext() {
    setError("")
    if(step===3) {
      const err = validateTags()
      if(err){setError(err);return}
    }
    setStep(s=>s+1)
  }

  const curGroup = INSTANCE_GROUPS.find(g=>g.group===instGroup)
  const selBtn = (active,color="#00d4aa")=>({padding:"8px 10px",borderRadius:"8px",cursor:"pointer",fontSize:"12px",border:"1px solid "+(active?color+"40":border),background:active?color+"15":surface,color:active?color:muted,transition:"all 0.15s",textAlign:"left"})

  // Success screen
  if(submitted) return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:"16px"}}>
      <div style={{background:surface,borderRadius:"18px",border:"1px solid "+border,width:"100%",maxWidth:"440px",padding:"40px",textAlign:"center"}}>
        <div style={{width:"64px",height:"64px",borderRadius:"50%",background:"#00d4aa20",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style={{fontSize:"20px",fontWeight:"700",color:text,marginBottom:"8px"}}>Request Submitted!</div>
        <div style={{fontSize:"13px",color:muted,marginBottom:"16px"}}><strong style={{color:text}}>{name}</strong> is pending admin approval</div>
        <div style={{background:subtle,borderRadius:"10px",padding:"12px",textAlign:"left",marginBottom:"20px"}}>
          {[["Instance",instanceType],["Region",region],["AMI",AMIS.find(a=>a.id===ami)?.name||ami],["Project",tags.project],["Owner",tags.owner],["Environment",tags.environment]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+border,fontSize:"12px"}}>
              <span style={{color:muted}}>{k}</span>
              <span style={{fontWeight:"600",color:text}}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={()=>{onSuccess();onClose()}} style={{padding:"10px 28px",borderRadius:"10px",fontSize:"14px",fontWeight:"600",cursor:"pointer",border:"none",background:"#00d4aa",color:"#0a0f1e"}}>Done</button>
      </div>
    </div>
  )

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:"16px"}}>
      <div style={{background:surface,borderRadius:"18px",border:"1px solid "+border,width:"100%",maxWidth:"720px",maxHeight:"92vh",overflow:"auto"}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid "+border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:"17px",fontWeight:"700",color:text}}>Launch EC2 Instance</div>
            <div style={{fontSize:"12px",color:muted,marginTop:"2px"}}>Configure your virtual machine</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:"22px",color:muted}}>×</button>
        </div>

        {/* Steps */}
        <div style={{padding:"14px 24px",borderBottom:"1px solid "+border,display:"flex",gap:"0"}}>
          {STEPS.map((s,i)=>(
            <div key={s} style={{display:"flex",alignItems:"center",flex:i<STEPS.length-1?1:"auto"}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                <div style={{width:"22px",height:"22px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:"700",
                  background:i<step?"#FF9900":i===step?"#FF990020":subtle,
                  color:i<step?"#fff":i===step?"#FF9900":muted,
                  border:i===step?"2px solid #FF9900":"2px solid "+(i<step?"#FF9900":border)}}>{i<step?"✓":i+1}</div>
                <span style={{fontSize:"11px",fontWeight:i===step?"600":"400",color:i===step?text:muted}}>{s}</span>
              </div>
              {i<STEPS.length-1&&<div style={{flex:1,height:"2px",background:i<step?"#FF9900":border,margin:"0 6px"}}/>}
            </div>
          ))}
        </div>

        {error&&<div style={{margin:"12px 24px 0",background:"#f43f5e15",color:"#f43f5e",padding:"10px",borderRadius:"8px",fontSize:"13px"}}>{error}</div>}

        <div style={{padding:"20px 24px"}}>
          {/* STEP 0: Instance */}
          {step===0&&(
            <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
                <div>
                  <label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>Instance name *</label>
                  <input style={inp} placeholder="my-server-prod" value={name} onChange={e=>setName(e.target.value)} autoFocus />
                </div>
                <div>
                  <label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>Region</label>
                  <select style={inp} value={region} onChange={e=>setRegion(e.target.value)}>
                    {ALL_REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"8px"}}>AMI</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px"}}>
                  {AMIS.map(a=>(
                    <div key={a.id} onClick={()=>setAmi(a.id)} style={selBtn(ami===a.id,"#FF9900")}>
                      <div style={{fontWeight:"600",fontSize:"12px",color:ami===a.id?"#FF9900":text}}>{a.name}</div>
                      <div style={{fontSize:"10px",color:muted,marginTop:"2px",fontFamily:"monospace"}}>{a.id.slice(-12)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"8px"}}>Instance type</label>
                <div style={{display:"flex",gap:"6px",marginBottom:"8px",flexWrap:"wrap"}}>
                  {INSTANCE_GROUPS.map(g=>(
                    <button key={g.group} onClick={()=>setIG(g.group)} style={{padding:"4px 12px",borderRadius:"20px",fontSize:"11px",fontWeight:"500",cursor:"pointer",border:"1px solid "+(instGroup===g.group?g.color+"60":border),background:instGroup===g.group?g.color+"15":surface,color:instGroup===g.group?g.color:muted}}>{g.group}</button>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px"}}>
                  {curGroup?.types.map(t=>(
                    <div key={t.t} onClick={()=>setIT(t.t)} style={selBtn(instanceType===t.t,curGroup.color)}>
                      <div style={{fontSize:"11px",fontWeight:"700",color:instanceType===t.t?curGroup.color:text}}>{t.t}</div>
                      <div style={{fontSize:"10px",color:muted}}>{t.c}vCPU/{t.r}</div>
                      <div style={{fontSize:"10px",color:"#f59e0b"}}>{t.p}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Multi-Cloud Cost Comparison */}
          {step===0 && instanceType && (()=>{
            const CLOUD_PRICING = {
              "t2.micro":{aws:0.012,azure:0.018,gcp:0.010,linode:0.0075},
              "t2.small":{aws:0.023,azure:0.031,gcp:0.020,linode:0.015},
              "t2.medium":{aws:0.046,azure:0.062,gcp:0.038,linode:0.030},
              "t3.micro":{aws:0.011,azure:0.016,gcp:0.009,linode:0.007},
              "t3.medium":{aws:0.042,azure:0.058,gcp:0.034,linode:0.028},
              "t3.large":{aws:0.083,azure:0.112,gcp:0.068,linode:0.054},
              "t3.xlarge":{aws:0.166,azure:0.224,gcp:0.136,linode:0.108},
              "m5.large":{aws:0.096,azure:0.134,gcp:0.082,linode:0.060},
              "m5.xlarge":{aws:0.192,azure:0.268,gcp:0.164,linode:0.120},
              "m5.2xlarge":{aws:0.384,azure:0.536,gcp:0.328,linode:0.240},
              "c5.large":{aws:0.085,azure:0.118,gcp:0.072,linode:0.054},
              "c5.xlarge":{aws:0.170,azure:0.236,gcp:0.144,linode:0.108},
              "c5.2xlarge":{aws:0.340,azure:0.472,gcp:0.288,linode:0.216},
              "c5a.xlarge":{aws:0.154,azure:0.210,gcp:0.130,linode:0.096},
              "r5.large":{aws:0.126,azure:0.178,gcp:0.106,linode:0.084},
              "r5.xlarge":{aws:0.252,azure:0.356,gcp:0.212,linode:0.168},
              "r5.2xlarge":{aws:0.504,azure:0.712,gcp:0.424,linode:0.336},
              "g4dn.xlarge":{aws:0.526,azure:0.730,gcp:0.560,linode:0.500},
              "g4dn.2xlarge":{aws:0.752,azure:1.040,gcp:0.800,linode:0.720},
              "g5.xlarge":{aws:1.006,azure:1.380,gcp:1.100,linode:0.960},
              "t4g.medium":{aws:0.034,azure:0.048,gcp:0.028,linode:0.022},
              "t4g.large":{aws:0.067,azure:0.094,gcp:0.056,linode:0.044},
              "m6g.large":{aws:0.077,azure:0.108,gcp:0.064,linode:0.050},
            }
            const prices = CLOUD_PRICING[instanceType]||{aws:0.05,azure:0.07,gcp:0.04,linode:0.03}
            const clouds = [
              {name:"AWS",key:"aws",color:"#FF9900",logo:"AWS"},
              {name:"Azure",key:"azure",color:"#0078D4",logo:"AZ"},
              {name:"GCP",key:"gcp",color:"#4285F4",logo:"GCP"},
              {name:"Linode",key:"linode",color:"#00b050",logo:"LIN"},
            ]
            const minPrice = Math.min(...clouds.map(c=>prices[c.key]))
            return (
              <div style={{padding:"0 0 4px"}}>
                <div style={{fontSize:"12px",color:muted,marginBottom:"10px",display:"flex",alignItems:"center",gap:"6px"}}>
                  <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#00d4aa",display:"inline-block"}}/>
                  Cloud cost comparison for <strong style={{color:text,marginLeft:"4px"}}>{instanceType}</strong>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
                  {clouds.map(cloud=>{
                    const hr=prices[cloud.key]
                    const day=(hr*24).toFixed(2)
                    const mo=(hr*24*30).toFixed(0)
                    const cheapest=hr===minPrice
                    const selected=cloud.key==="aws"
                    return (
                      <div key={cloud.key} style={{background:selected?cloud.color+"15":surface,border:"1px solid "+(cheapest?cloud.color:border),borderRadius:"10px",padding:"12px 10px",textAlign:"center",position:"relative"}}>
                        {cheapest&&<div style={{position:"absolute",top:"-9px",left:"50%",transform:"translateX(-50%)",background:cloud.color,color:"#fff",fontSize:"9px",fontWeight:"700",padding:"2px 8px",borderRadius:"20px",whiteSpace:"nowrap"}}>CHEAPEST</div>}
                        {selected&&!cheapest&&<div style={{position:"absolute",top:"-9px",right:"6px",background:"#FF9900",color:"#fff",fontSize:"9px",fontWeight:"700",padding:"2px 8px",borderRadius:"20px"}}>SELECTED</div>}
                        <div style={{width:"30px",height:"30px",borderRadius:"8px",background:cloud.color+"20",border:"1px solid "+cloud.color+"40",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",fontSize:"9px",fontWeight:"800",color:cloud.color}}>{cloud.logo}</div>
                        <div style={{fontSize:"12px",fontWeight:"600",color:text,marginBottom:"4px"}}>{cloud.name}</div>
                        <div style={{fontSize:"18px",fontWeight:"700",color:cloud.color}}>${hr}</div>
                        <div style={{fontSize:"10px",color:muted}}>/hr</div>
                        <div style={{marginTop:"8px",paddingTop:"8px",borderTop:"1px solid "+border}}>
                          <div style={{fontSize:"10px",color:muted}}>Daily <span style={{color:text,fontWeight:"600"}}>${day}</span></div>
                          <div style={{fontSize:"10px",color:muted,marginTop:"2px"}}>Monthly <span style={{color:text,fontWeight:"600"}}>${mo}</span></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{fontSize:"10px",color:muted,marginTop:"6px",textAlign:"right"}}>Estimates for equivalent config in ap-south-1 / nearest region</div>
              </div>
            )
          })()}

          {/* STEP 1: Network */}
          {step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
              <div style={{background:"#3b82f610",border:"1px solid #3b82f630",borderRadius:"8px",padding:"10px 14px",fontSize:"12px",color:"#3b82f6"}}>
                Network configuration is optional. Skip to use default VPC settings.
              </div>
              {loadingNet?<div style={{padding:"40px",textAlign:"center",color:muted}}>Loading network resources...</div>:(
                <>
                  <div>
                    <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:muted,marginBottom:"8px"}}>VPC</label>
                    <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                      {vpcs.map(v=>(
                        <div key={v.id} onClick={()=>handleVpcChange(v.id)} style={{...selBtn(selectedVpc===v.id,"#a78bfa"),padding:"10px 14px"}}>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <span style={{fontWeight:"600",fontSize:"13px",color:selectedVpc===v.id?"#a78bfa":text}}>{v.name}</span>
                            {v.default&&<span style={{fontSize:"9px",background:"#3b82f620",color:"#3b82f6",padding:"1px 6px",borderRadius:"4px"}}>DEFAULT</span>}
                          </div>
                          <div style={{fontSize:"11px",color:muted,marginTop:"2px"}}>{v.id} — {v.cidr} — {v.subnet_count} subnets</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selectedVpc&&<div>
                    <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:muted,marginBottom:"8px"}}>Subnet</label>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                      {subnets.map(s=>(
                        <div key={s.id} onClick={()=>setSub(s.id)} style={{...selBtn(selectedSubnet===s.id,"#3b82f6"),padding:"8px 12px"}}>
                          <div style={{fontWeight:"600",fontSize:"12px",color:selectedSubnet===s.id?"#3b82f6":text}}>{s.name}</div>
                          <div style={{fontSize:"10px",color:muted}}>{s.az} — {s.cidr}</div>
                          <div style={{fontSize:"10px",color:s.public?"#00d4aa":"#f59e0b"}}>{s.public?"Public":"Private"} — {s.available_ips} IPs free</div>
                        </div>
                      ))}
                    </div>
                  </div>}
                  {selectedVpc&&<div>
                    <label style={{display:"block",fontSize:"12px",fontWeight:"600",color:muted,marginBottom:"8px"}}>Security Groups</label>
                    <div style={{border:"1px solid "+border,borderRadius:"10px",overflow:"hidden",maxHeight:"180px",overflowY:"auto"}}>
                      {sgs.map(sg=>(
                        <div key={sg.id} onClick={()=>setSelSgs(p=>p.includes(sg.id)?p.filter(s=>s!==sg.id):[...p,sg.id])}
                          style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid "+border,background:selectedSgs.includes(sg.id)?"#f59e0b10":"transparent",display:"flex",alignItems:"center",gap:"10px"}}>
                          <input type="checkbox" checked={selectedSgs.includes(sg.id)} onChange={()=>{}} style={{pointerEvents:"none"}} />
                          <div>
                            <div style={{fontSize:"12px",fontWeight:"600",color:selectedSgs.includes(sg.id)?"#f59e0b":text}}>{sg.name}</div>
                            <div style={{fontSize:"10px",color:muted}}>{sg.id}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>}
                </>
              )}
            </div>
          )}

          {/* STEP 2: Key Pair */}
          {step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
              <div style={{background:"#3b82f610",border:"1px solid #3b82f630",borderRadius:"10px",padding:"14px",fontSize:"12px",color:"#3b82f6"}}>
                A key pair lets you SSH into your EC2. Creating a new key pair will auto-download the .pem file.
              </div>
              {kpCreated&&<div style={{background:"#00d4aa15",border:"1px solid #00d4aa30",borderRadius:"8px",padding:"12px 14px"}}>
                <div style={{fontSize:"13px",fontWeight:"600",color:"#00d4aa"}}>Key pair created and downloaded!</div>
                <div style={{fontSize:"12px",color:muted,marginTop:"3px"}}><code style={{background:"#00d4aa10",padding:"1px 6px",borderRadius:"4px"}}>{kpCreated.name}.pem</code> saved to Downloads.</div>
              </div>}
              <div>
                <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",marginBottom:"10px",fontSize:"13px",color:text}}>
                  <input type="radio" checked={!createNewKP} onChange={()=>setNewKP(false)} />Use existing key pair
                </label>
                {!createNewKP&&<div style={{paddingLeft:"20px",display:"flex",flexDirection:"column",gap:"4px"}}>
                  {keypairs.length===0?<div style={{padding:"14px",textAlign:"center",color:muted,fontSize:"12px",border:"1px solid "+border,borderRadius:"8px"}}>No key pairs in {region}. Create a new one.</div>
                  :keypairs.map(kp=>(
                    <div key={kp.name} onClick={()=>setKP(kp.name)} style={{...selBtn(selectedKP===kp.name,"#3b82f6"),padding:"10px 14px"}}>
                      <div style={{fontWeight:"600",fontSize:"12px",color:selectedKP===kp.name?"#3b82f6":text}}>{kp.name}</div>
                      <div style={{fontSize:"10px",color:muted}}>{kp.region||region}</div>
                    </div>
                  ))}
                </div>}
              </div>
              <div>
                <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",marginBottom:"10px",fontSize:"13px",color:text}}>
                  <input type="radio" checked={createNewKP} onChange={()=>setNewKP(true)} />Create new key pair (auto-downloads .pem)
                </label>
                {createNewKP&&<div style={{paddingLeft:"20px"}}>
                  <div style={{display:"flex",gap:"10px",marginBottom:"8px"}}>
                    <input style={inp} placeholder="my-keypair" value={newKPName} onChange={e=>setKPName(e.target.value.replace(/[^a-zA-Z0-9-_]/g,""))} />
                    <button onClick={handleCreateKP} disabled={creatingKP} style={{padding:"9px 18px",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer",border:"none",background:"#3b82f6",color:"#fff",whiteSpace:"nowrap",opacity:creatingKP?0.7:1}}>
                      {creatingKP?"Creating...":"Create & Download"}
                    </button>
                  </div>
                </div>}
              </div>
              <div>
                <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"13px",color:muted}}>
                  <input type="radio" checked={!selectedKP&&!createNewKP} onChange={()=>{setKP("");setNewKP(false)}} />No key pair (not recommended)
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: Tags */}
          {step===3&&<TagsStep tags={tags} setTags={setTags} />}

          {/* STEP 4: Review */}
          {step===4&&(
            <div>
              <div style={{background:subtle,borderRadius:"12px",padding:"20px",border:"1px solid "+border}}>
                <div style={{fontSize:"14px",fontWeight:"600",color:text,marginBottom:"14px"}}>Configuration Summary</div>
                {[
                  ["Instance Name",  name],
                  ["Region",         region],
                  ["Instance Type",  instanceType],
                  ["AMI",            AMIS.find(a=>a.id===ami)?.name||ami],
                  ["VPC",            vpcs.find(v=>v.id===selectedVpc)?.name||"Default"],
                  ["Subnet",         subnets.find(s=>s.id===selectedSubnet)?.name||"Default"],
                  ["Security Groups",selectedSgs.length>0?selectedSgs.length+" selected":"Default"],
                  ["Key Pair",       selectedKP||"None"],
                  ["Project",        tags.project||"--"],
                  ["Owner",          tags.owner||"--"],
                  ["Environment",    tags.environment||"--"],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+border}}>
                    <span style={{fontSize:"12px",color:muted}}>{k}</span>
                    <span style={{fontSize:"12px",fontWeight:"600",color:text,textAlign:"right",maxWidth:"60%"}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{background:"#f59e0b10",border:"1px solid #f59e0b30",borderRadius:"8px",padding:"12px 14px",marginTop:"12px",fontSize:"12px",color:"#f59e0b"}}>
                An admin must approve this request before the instance launches in AWS.
              </div>
            </div>
          )}
        </div>

        <div style={{padding:"16px 24px",borderTop:"1px solid "+border,display:"flex",justifyContent:"space-between"}}>
          <button onClick={step===0?onClose:()=>setStep(s=>s-1)} style={{padding:"9px 18px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",border:"1px solid "+border,background:"transparent",color:text}}>{step===0?"Cancel":"Back"}</button>
          <button onClick={step<STEPS.length-1?handleNext:handleSubmit} disabled={submitting||(step===0&&!name.trim())}
            style={{padding:"9px 22px",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer",border:"none",background:"#FF9900",color:"#fff",opacity:(submitting||(step===0&&!name.trim()))?0.7:1}}>
            {submitting?"Submitting...":(step<STEPS.length-1?"Next →":"Submit Request")}
          </button>
        </div>
      </div>
    </div>
  )
}