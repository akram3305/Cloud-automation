import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
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
    {t:"t3.xlarge",c:4,r:"16 GiB",p:"$0.166/hr"},{t:"t3.2xlarge",c:8,r:"32 GiB",p:"$0.333/hr"},
    {t:"m5.large",c:2,r:"8 GiB",p:"$0.096/hr"},{t:"m5.xlarge",c:4,r:"16 GiB",p:"$0.192/hr"},
    {t:"m5.2xlarge",c:8,r:"32 GiB",p:"$0.384/hr"},{t:"m5.4xlarge",c:16,r:"64 GiB",p:"$0.768/hr"},
    {t:"m6i.large",c:2,r:"8 GiB",p:"$0.112/hr"},{t:"m6i.xlarge",c:4,r:"16 GiB",p:"$0.224/hr"},
    {t:"m6i.2xlarge",c:8,r:"32 GiB",p:"$0.448/hr"},{t:"m6i.4xlarge",c:16,r:"64 GiB",p:"$0.896/hr"},
    {t:"m6i.8xlarge",c:32,r:"128 GiB",p:"$1.792/hr"},{t:"m6i.16xlarge",c:64,r:"256 GiB",p:"$3.584/hr"},
    {t:"m6i.32xlarge",c:128,r:"512 GiB",p:"$7.168/hr"},
  ]},
  { group:"Compute", color:"#f59e0b", types:[
    {t:"c5.large",c:2,r:"4 GiB",p:"$0.085/hr"},{t:"c5.xlarge",c:4,r:"8 GiB",p:"$0.170/hr"},
    {t:"c5.2xlarge",c:8,r:"16 GiB",p:"$0.340/hr"},{t:"c5.4xlarge",c:16,r:"32 GiB",p:"$0.680/hr"},
    {t:"c5.9xlarge",c:36,r:"72 GiB",p:"$1.530/hr"},{t:"c5.18xlarge",c:72,r:"144 GiB",p:"$3.060/hr"},
    {t:"c5a.xlarge",c:4,r:"8 GiB",p:"$0.154/hr"},{t:"c6i.xlarge",c:4,r:"8 GiB",p:"$0.204/hr"},
    {t:"c6i.4xlarge",c:16,r:"32 GiB",p:"$0.816/hr"},{t:"c6i.16xlarge",c:64,r:"128 GiB",p:"$3.264/hr"},
  ]},
  { group:"Memory", color:"#a78bfa", types:[
    {t:"r5.large",c:2,r:"16 GiB",p:"$0.126/hr"},{t:"r5.xlarge",c:4,r:"32 GiB",p:"$0.252/hr"},
    {t:"r5.2xlarge",c:8,r:"64 GiB",p:"$0.504/hr"},{t:"r5.4xlarge",c:16,r:"128 GiB",p:"$1.008/hr"},
    {t:"r5.8xlarge",c:32,r:"256 GiB",p:"$2.016/hr"},{t:"r5.16xlarge",c:64,r:"512 GiB",p:"$4.032/hr"},
    {t:"r6i.large",c:2,r:"16 GiB",p:"$0.126/hr"},{t:"r6i.xlarge",c:4,r:"32 GiB",p:"$0.252/hr"},
    {t:"r6i.4xlarge",c:16,r:"128 GiB",p:"$1.008/hr"},{t:"r6i.16xlarge",c:64,r:"512 GiB",p:"$4.032/hr"},
  ]},
  { group:"GPU", color:"#f43f5e", types:[
    {t:"g4dn.xlarge",c:4,r:"16 GiB",p:"$0.526/hr"},{t:"g4dn.2xlarge",c:8,r:"32 GiB",p:"$0.752/hr"},
    {t:"g4dn.4xlarge",c:16,r:"64 GiB",p:"$1.204/hr"},{t:"g5.xlarge",c:4,r:"16 GiB",p:"$1.006/hr"},
    {t:"g5.2xlarge",c:8,r:"32 GiB",p:"$1.212/hr"},{t:"p3.2xlarge",c:8,r:"61 GiB",p:"$3.060/hr"},
  ]},
  { group:"ARM", color:"#00d4aa", types:[
    {t:"t4g.medium",c:2,r:"4 GiB",p:"$0.034/hr"},{t:"t4g.large",c:2,r:"8 GiB",p:"$0.067/hr"},
    {t:"t4g.xlarge",c:4,r:"16 GiB",p:"$0.134/hr"},{t:"m6g.large",c:2,r:"8 GiB",p:"$0.077/hr"},
    {t:"m6g.xlarge",c:4,r:"16 GiB",p:"$0.154/hr"},{t:"m6g.4xlarge",c:16,r:"64 GiB",p:"$0.616/hr"},
    {t:"m6g.16xlarge",c:64,r:"256 GiB",p:"$2.464/hr"},
  ]},
]

const AMIS = [
  {id:"ami-0c2af51e265bd5e0e",name:"Amazon Linux 2023",os:"linux"},
  {id:"ami-0f58b397bc5c1f2e8",name:"Ubuntu 22.04 LTS",os:"ubuntu"},
  {id:"ami-00bb6a80f01f03502",name:"Ubuntu 20.04 LTS",os:"ubuntu"},
  {id:"ami-02b8269d5e85954ef",name:"Windows Server 2022",os:"windows"},
  {id:"ami-0acb4f799a89ed5c6",name:"RHEL 9",os:"rhel"},
]

function findBestAwsInstance(vcpu, ram_gb) {
  let best = INSTANCE_GROUPS[0].types[4], bestGroup = "General", bestScore = Infinity
  INSTANCE_GROUPS.forEach(g => {
    g.types.forEach(t => {
      const tr = parseFloat(t.r)
      const score = Math.abs(t.c / Math.max(vcpu, 0.1) - 1) + Math.abs(tr / Math.max(ram_gb, 0.1) - 1)
      if (score < bestScore) { bestScore = score; best = t; bestGroup = g.group }
    })
  })
  return { type: best.t, group: bestGroup }
}

export default function CreateVMModal({ onClose, onSuccess, prefill }) {
  const { dark }    = useTheme()
  const navigate    = useNavigate()
  const [step, setStep]            = useState(0)
  const [error, setError]          = useState("")
  const [name, setName]            = useState("")
  const [region, setRegion]        = useState("ap-south-1")
  const [ami, setAmi]              = useState("ami-0c2af51e265bd5e0e")
  const [instanceType, setIT]      = useState(() => prefill ? findBestAwsInstance(prefill.vcpu, prefill.ram_gb).type : "t3.medium")
  const [instGroup, setIG]         = useState(() => prefill ? findBestAwsInstance(prefill.vcpu, prefill.ram_gb).group : "General")
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
  const [cloudPrices, setCloudPrices] = useState(null)
  const [priceLoading, setPriceLoad]  = useState(false)

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

  useEffect(()=>{
    if(!instanceType) return
    setPriceLoad(true)
    api.get(`/cost/compare?instance_type=${instanceType}&region=${region}`)
      .then(r=>setCloudPrices(r.data))
      .catch(()=>setCloudPrices(null))
      .finally(()=>setPriceLoad(false))
  },[instanceType,region])

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

  async function handleSubmit(){
    if(!name.trim()){setError("Instance name required");return}
    setSub2(true);setError("")
    try{
      // ── Auto-create key pair if user chose new KP but didn't click the button ──
      let finalKP = selectedKP || ""
      if(createNewKP && newKPName.trim()){
        if(!kpCreated){
          try{
            const {data}=await api.post('/iam/keypairs/create',{name:newKPName,region})
            const blob=new Blob([data.private_key],{type:"text/plain"})
            const url=URL.createObjectURL(blob)
            const a=document.createElement("a");a.href=url;a.download=newKPName+".pem";a.click()
            URL.revokeObjectURL(url)
            setKPCreated({name:newKPName})
          }catch(e){
            setError("Key pair creation failed: "+(e.response?.data?.detail||e.message))
            setSub2(false);return
          }
        }
        finalKP=newKPName
      }

      await api.post("/requests",{
        resource_name:  name,
        resource_type:  "ec2",
        region,
        payload:{
          instance_type:           instanceType,
          ami_id:                  ami,
          subnet_id:               selectedSubnet||"",
          security_group_ids:      selectedSgs,
          key_name:                finalKP,
          root_volume_type:        "gp3",
          root_volume_size:        20,
          root_volume_encrypted:   false,
          associate_public_ip:     true,
          monitoring:              false,
          disable_api_termination: false,
          tags:{
            project:     tags.project    ||"AIonOS-Platform",
            owner:       tags.owner      ||"admin",
            environment: tags.environment||"dev",
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
    if(step===2 && createNewKP && !newKPName.trim()){
      setError("Enter a name for the new key pair");return
    }
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
            // Specs for the selected instance type
            const specInfo = INSTANCE_GROUPS.flatMap(g=>g.types).find(t=>t.t===instanceType)

            const CLOUDS = [
              {name:"AWS",  key:"aws",   color:"#FF9900", logo:"AWS", appRoute:null},
              {name:"Azure",key:"azure", color:"#0078D4", logo:"AZ",  appRoute:"/azure/compute/create"},
              {name:"GCP",  key:"gcp",   color:"#4285F4", logo:"GCP", appRoute:"/gcp/compute/create"},
            ]
            const prices = cloudPrices
              ? {aws:cloudPrices.aws?.price, azure:cloudPrices.azure?.price, gcp:cloudPrices.gcp?.price}
              : {aws:null, azure:null, gcp:null}
            const minPrice = prices.aws!=null ? Math.min(...CLOUDS.map(c=>prices[c.key]).filter(Boolean)) : null

            return (
              <div style={{padding:"0 0 4px"}}>
                {/* Header row */}
                <div style={{fontSize:"12px",color:muted,marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                  <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#00d4aa",display:"inline-block",flexShrink:0}}/>
                  Cost comparison —
                  <strong style={{color:text}}>{instanceType}</strong>
                  {specInfo && <span style={{color:muted}}>({specInfo.c} vCPU · {specInfo.r})</span>}
                  {cloudPrices?.aws?.source==="live" && <span style={{fontSize:"9px",background:"#00d4aa15",color:"#00d4aa",border:"1px solid #00d4aa30",padding:"1px 7px",borderRadius:"10px"}}>LIVE</span>}
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                  {CLOUDS.map(cloud=>{
                    const hr      = prices[cloud.key]
                    const equiv   = cloud.key!=="aws" ? cloudPrices?.[cloud.key]?.equivalent : null
                    const specs   = cloud.key==="aws"
                                      ? (specInfo ? `${specInfo.c} vCPU · ${specInfo.r}` : null)
                                      : cloudPrices?.[cloud.key]?.specs || null
                    const day     = hr!=null ? (hr*24).toFixed(2)    : "--"
                    const mo      = hr!=null ? (hr*24*30).toFixed(0) : "--"
                    const cheapest = hr!=null && hr===minPrice
                    const selected = cloud.key==="aws"
                    const clickable = !!cloud.appRoute

                    return (
                      <div
                        key={cloud.key}
                        onClick={()=>{
                          if(!clickable) return
                          onClose()
                          const prefill = specInfo
                            ? { vcpu: specInfo.c, ram_gb: parseFloat(specInfo.r) }
                            : undefined
                          navigate(cloud.appRoute, prefill ? { state:{ prefill } } : undefined)
                        }}
                        style={{
                          background: selected ? cloud.color+"15" : surface,
                          border: "1px solid "+(cheapest ? cloud.color : border),
                          borderRadius:"10px", padding:"12px 10px", textAlign:"center",
                          position:"relative",
                          cursor: clickable ? "pointer" : "default",
                          transition:"box-shadow 0.15s, transform 0.15s",
                        }}
                        onMouseEnter={e=>{ if(clickable){ e.currentTarget.style.boxShadow=`0 4px 18px ${cloud.color}30`; e.currentTarget.style.transform="translateY(-2px)" } }}
                        onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="none" }}
                      >
                        {cheapest && <div style={{position:"absolute",top:"-9px",left:"50%",transform:"translateX(-50%)",background:cloud.color,color:"#fff",fontSize:"9px",fontWeight:"700",padding:"2px 8px",borderRadius:"20px",whiteSpace:"nowrap"}}>CHEAPEST</div>}
                        {selected && !cheapest && <div style={{position:"absolute",top:"-9px",right:"6px",background:"#FF9900",color:"#fff",fontSize:"9px",fontWeight:"700",padding:"2px 8px",borderRadius:"20px"}}>SELECTED</div>}
                        {clickable && <div style={{position:"absolute",top:"7px",right:"8px",fontSize:"9px",color:cloud.color,opacity:0.7,fontWeight:"600"}}>→</div>}

                        <div style={{width:"32px",height:"32px",borderRadius:"8px",background:cloud.color+"20",border:"1px solid "+cloud.color+"40",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",fontSize:"9px",fontWeight:"800",color:cloud.color}}>{cloud.logo}</div>
                        <div style={{fontSize:"12px",fontWeight:"700",color:text,marginBottom:"2px"}}>{cloud.name}</div>
                        {equiv && <div style={{fontSize:"9px",color:cloud.color,fontWeight:"600",marginBottom:"1px"}}>{equiv}</div>}
                        {specs && <div style={{fontSize:"9px",color:muted,marginBottom:"4px"}}>{specs}</div>}

                        {priceLoading
                          ? <div style={{width:"56px",height:"22px",borderRadius:"6px",background:dark?"#1e293b":"#e2e8f0",margin:"6px auto"}}/>
                          : <>
                              <div style={{fontSize:"20px",fontWeight:"700",color:cloud.color,lineHeight:1}}>{hr!=null ? `$${hr.toFixed(4)}` : "--"}</div>
                              <div style={{fontSize:"10px",color:muted,marginBottom:"6px"}}>/hr</div>
                            </>
                        }

                        <div style={{borderTop:"1px solid "+border,paddingTop:"8px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:"10px"}}>
                            <span style={{color:muted}}>Daily</span>
                            <span style={{color:text,fontWeight:"600"}}>${day}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:"10px",marginTop:"3px"}}>
                            <span style={{color:muted}}>Monthly</span>
                            <span style={{color:text,fontWeight:"600"}}>${mo}</span>
                          </div>
                        </div>

                        {clickable && (
                          <div style={{marginTop:"8px",fontSize:"10px",color:cloud.color,fontWeight:"600"}}>
                            Create {cloud.name} VM →
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{fontSize:"10px",color:muted,marginTop:"6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>AWS: live · Azure &amp; GCP: nearest-region equivalent</span>
                  <span style={{color:muted}}>Click Azure/GCP to go to their VM creation</span>
                </div>
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
              <div style={{background:"#00d4aa10",border:"1px solid #00d4aa30",borderRadius:"10px",padding:"14px",fontSize:"12px",color:"#00d4aa"}}>
                Key pair is created automatically when you submit — the <strong>.pem file</strong> will download to your computer instantly. No separate approval needed.
              </div>
              {kpCreated&&<div style={{background:"#00d4aa15",border:"1px solid #00d4aa30",borderRadius:"8px",padding:"12px 14px",display:"flex",alignItems:"center",gap:"10px"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <div>
                  <div style={{fontSize:"13px",fontWeight:"600",color:"#00d4aa"}}>Key pair ready</div>
                  <div style={{fontSize:"12px",color:muted,marginTop:"2px"}}><code style={{background:"#00d4aa10",padding:"1px 6px",borderRadius:"4px"}}>{kpCreated.name}.pem</code> downloaded.</div>
                </div>
              </div>}
              <div>
                <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",marginBottom:"10px",fontSize:"13px",color:text}}>
                  <input type="radio" checked={!createNewKP} onChange={()=>setNewKP(false)} />Use existing key pair
                </label>
                {!createNewKP&&<div style={{paddingLeft:"20px",display:"flex",flexDirection:"column",gap:"4px"}}>
                  {keypairs.length===0
                    ?<div style={{padding:"14px",textAlign:"center",color:muted,fontSize:"12px",border:"1px solid "+border,borderRadius:"8px"}}>No key pairs in {region}. Create a new one below.</div>
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
                  <input type="radio" checked={createNewKP} onChange={()=>{setNewKP(true);setKP("")}} />Create new key pair
                </label>
                {createNewKP&&(
                  <div style={{paddingLeft:"20px"}}>
                    <input
                      style={{...inp,marginBottom:"6px"}}
                      placeholder="my-keypair-name"
                      value={newKPName}
                      onChange={e=>setKPName(e.target.value.replace(/[^a-zA-Z0-9-_]/g,""))}
                      autoFocus
                    />
                    <div style={{fontSize:"11px",color:muted}}>
                      The .pem file will download automatically when you click <strong style={{color:text}}>Submit Request</strong>.
                    </div>
                  </div>
                )}
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
                  ["Key Pair",       createNewKP ? (newKPName||(kpCreated?.name)||"new — auto-created on submit") : (selectedKP||"None")],
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
            {submitting
              ? (createNewKP&&!kpCreated?"Creating key pair...":"Submitting...")
              : (step<STEPS.length-1?"Next →":"Submit Request")}
          </button>
        </div>
      </div>
    </div>
  )
}