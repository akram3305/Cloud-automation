import { useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"
import TagsStep from "./TagsStep"

const ALL_REGIONS = ["ap-south-1","ap-south-2","ap-southeast-1","ap-southeast-2","ap-northeast-1","us-east-1","us-east-2","us-west-1","us-west-2","eu-west-1","eu-west-2","eu-central-1","eu-north-1","ca-central-1","sa-east-1"]

const AZS_BY_REGION = {
  "ap-south-1":    ["ap-south-1a","ap-south-1b","ap-south-1c"],
  "ap-south-2":    ["ap-south-2a","ap-south-2b"],
  "ap-southeast-1":["ap-southeast-1a","ap-southeast-1b","ap-southeast-1c"],
  "ap-southeast-2":["ap-southeast-2a","ap-southeast-2b","ap-southeast-2c"],
  "ap-northeast-1":["ap-northeast-1a","ap-northeast-1b","ap-northeast-1c"],
  "us-east-1":     ["us-east-1a","us-east-1b","us-east-1c","us-east-1d"],
  "us-east-2":     ["us-east-2a","us-east-2b","us-east-2c"],
  "us-west-1":     ["us-west-1a","us-west-1b"],
  "us-west-2":     ["us-west-2a","us-west-2b","us-west-2c"],
  "eu-west-1":     ["eu-west-1a","eu-west-1b","eu-west-1c"],
  "eu-west-2":     ["eu-west-2a","eu-west-2b","eu-west-2c"],
  "eu-central-1":  ["eu-central-1a","eu-central-1b","eu-central-1c"],
  "eu-north-1":    ["eu-north-1a","eu-north-1b","eu-north-1c"],
  "ca-central-1":  ["ca-central-1a","ca-central-1b"],
  "sa-east-1":     ["sa-east-1a","sa-east-1b","sa-east-1c"],
}

const SUBNET_PRESETS = [
  { label:"2 subnets (1 public + 1 private)",          pub:1, priv:1 },
  { label:"4 subnets (2 public + 2 private)",          pub:2, priv:2 },
  { label:"6 subnets (2 public + 2 private + 2 data)", pub:2, priv:4 },
  { label:"Custom",                                    pub:0, priv:0, custom:true },
]

// ✅ Correct CIDR math — derives subnet CIDRs from VPC CIDR
function parseCIDR(cidr) {
  try {
    const [ip, prefix] = cidr.split("/")
    const parts = ip.split(".").map(Number)
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null
    if (isNaN(Number(prefix)) || Number(prefix) < 8 || Number(prefix) > 28) return null
    return { parts, prefix: Number(prefix) }
  } catch { return null }
}

function generateSubnetCIDRs(vpcCidr, count) {
  const parsed = parseCIDR(vpcCidr)
  if (!parsed) return []
  const { parts, prefix } = parsed
  const subPrefix = prefix <= 16 ? 24 : prefix <= 22 ? 26 : 28
  const baseInt = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  const blockSize = Math.pow(2, 32 - subPrefix)
  const result = []
  for (let i = 0; i < count; i++) {
    const n = (baseInt + i * blockSize) >>> 0
    result.push(`${(n>>>24)&0xff}.${(n>>>16)&0xff}.${(n>>>8)&0xff}.${n&0xff}/${subPrefix}`)
  }
  return result
}

function buildSubnets(preset, vpcCidr, vpcName, region) {
  if (preset.custom) return []
  const azList = AZS_BY_REGION[region] || AZS_BY_REGION["ap-south-1"]
  const total  = preset.pub + preset.priv
  const cidrs  = generateSubnetCIDRs(vpcCidr, total)
  const result = []
  let idx = 0
  for (let i = 0; i < preset.pub; i++) {
    const az = azList[i % azList.length]
    result.push({ name:`${vpcName}-public-${az.split("-").pop()}`, cidr:cidrs[idx++]||"", az, public:true })
  }
  for (let i = 0; i < preset.priv; i++) {
    const az = azList[i % azList.length]
    result.push({ name:`${vpcName}-private-${az.split("-").pop()}`, cidr:cidrs[idx++]||"", az, public:false })
  }
  return result
}

export default function VPCModal({ onClose, onSuccess }) {
  const { dark } = useTheme()
  const [step, setStep]         = useState(0)
  const [form, setForm]         = useState({ name:"", cidr:"10.0.0.0/16", region:"ap-south-1", enable_dns:true, create_igw:true, create_nat:false })
  const [subnets, setSubnets]   = useState([])
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState("")
  const [result, setResult]     = useState(null)
  const [preset, setPreset]     = useState(0)
  const [tags, setTags]         = useState({ project:"", owner:"", environment:"", _custom:[] })

  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const inp     = { padding:"8px 12px", border:"1px solid "+border, borderRadius:"8px", fontSize:"13px", width:"100%", background:surface, color:text }

  const STEPS = ["VPC Config","Subnets","Tags","Review"]
  const azList = AZS_BY_REGION[form.region] || AZS_BY_REGION["ap-south-1"]

  function applyPreset(idx, cidr, name, region) {
    setPreset(idx)
    const p = SUBNET_PRESETS[idx]
    if (!p.custom) setSubnets(buildSubnets(p, cidr, name, region))
  }

  function addSubnet() {
    const az    = azList[subnets.length % azList.length]
    const cidrs = generateSubnetCIDRs(form.cidr, subnets.length + 1)
    setSubnets(p => [...p, { name:`${form.name}-subnet-${az.split("-").pop()}`, cidr:cidrs[subnets.length]||"", az, public:false }])
  }

  function removeSubnet(i) { setSubnets(p => p.filter((_,j) => j !== i)) }
  function updateSubnet(i, field, val) { setSubnets(p => p.map((s,j) => j===i ? {...s,[field]:val} : s)) }

  // ✅ Generate subnets when moving step 0 → 1, using live form values
  function handleNext() {
    setError("")
    if (step === 0) {
      if (!form.name.trim()) { setError("VPC name required"); return }
      if (!parseCIDR(form.cidr)) { setError("Invalid CIDR. Example: 192.168.1.0/24"); return }
      // Generate NOW with current form values
      const p = SUBNET_PRESETS[preset]
      setSubnets(buildSubnets(p, form.cidr, form.name, form.region))
    }
    if (step === 2) {
      if (!tags.project?.trim() || !tags.owner?.trim() || !tags.environment) {
        setError("All tags are required"); return
      }
    }
    setStep(s => s + 1)
  }

  async function handleCreate() {
    if (!form.name.trim()) { setError("VPC name required"); return }
    if (subnets.length === 0) { setError("Add at least one subnet"); return }
    if (!tags.project?.trim() || !tags.owner?.trim() || !tags.environment) { setError("All tags are required"); return }
    setCreating(true); setError("")
    try {
      const { data } = await api.post("/vpc/create", { ...form, subnets, tags })
      setResult(data)
      setStep(4)
    } catch(e) { setError(e.response?.data?.detail || e.message) }
    finally { setCreating(false) }
  }

  // Success screen
  if (step === 4 && result) return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:"16px" }}>
      <div style={{ background:surface, borderRadius:"18px", border:"1px solid "+border, width:"100%", maxWidth:"500px", padding:"40px", textAlign:"center" }}>
        <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"#00d4aa20", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style={{ fontSize:"20px", fontWeight:"700", color:text, marginBottom:"8px" }}>VPC Created!</div>
        <div style={{ fontSize:"13px", color:muted, marginBottom:"20px" }}>{form.name} created successfully in {form.region}</div>
        <div style={{ background:subtle, borderRadius:"10px", padding:"16px", textAlign:"left", marginBottom:"20px" }}>
          {[["VPC ID",result.vpc_id],["Subnets",result.subnets?.length+" created"],["IGW",result.igw_id||"Not created"],["NAT Gateway",result.nat_id||"Not created"],["Route Tables",result.route_tables?.length+" created"]].map(([k,v])=>(
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid "+border }}>
              <span style={{ fontSize:"12px", color:muted }}>{k}</span>
              <span style={{ fontSize:"12px", fontWeight:"600", color:"#00d4aa" }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={()=>{ onSuccess(); onClose() }} style={{ padding:"10px 28px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e" }}>Done</button>
      </div>
    </div>
  )

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:"16px" }}>
      <div style={{ background:surface, borderRadius:"18px", border:"1px solid "+border, width:"100%", maxWidth:"640px", maxHeight:"92vh", overflow:"auto" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:"17px", fontWeight:"700", color:text }}>Create VPC</div>
            <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Configure VPC with subnets, IGW, NAT and route tables</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"22px", color:muted }}>✕</button>
        </div>

        {/* Steps */}
        <div style={{ padding:"14px 24px", borderBottom:"1px solid "+border, display:"flex" }}>
          {STEPS.map((s,i) => (
            <div key={s} style={{ display:"flex", alignItems:"center", flex:i<STEPS.length-1?1:"auto" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <div style={{ width:"24px", height:"24px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:"700",
                  background:i<step?"#a78bfa":i===step?"#a78bfa20":subtle,
                  color:i<step?"#fff":i===step?"#a78bfa":muted,
                  border:i===step?"2px solid #a78bfa":"2px solid "+(i<step?"#a78bfa":border),
                }}>{i<step?"✓":i+1}</div>
                <span style={{ fontSize:"12px", fontWeight:i===step?"600":"400", color:i===step?text:muted }}>{s}</span>
              </div>
              {i<STEPS.length-1 && <div style={{ flex:1, height:"2px", background:i<step?"#a78bfa":border, margin:"0 8px" }}/>}
            </div>
          ))}
        </div>

        {error && <div style={{ margin:"12px 24px 0", background:"#f43f5e15", color:"#f43f5e", padding:"10px", borderRadius:"8px", fontSize:"13px" }}>{error}</div>}

        <div style={{ padding:"20px 24px" }}>

          {/* STEP 0: VPC Config */}
          {step===0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
                <div>
                  <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>VPC Name *</label>
                  <input style={inp} placeholder="my-vpc" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} autoFocus />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Region</label>
                  <select style={inp} value={form.region} onChange={e=>setForm(p=>({...p,region:e.target.value}))}>
                    {ALL_REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>CIDR Block</label>
                <input style={inp} placeholder="10.0.0.0/16" value={form.cidr} onChange={e=>setForm(p=>({...p,cidr:e.target.value}))} />
                <div style={{ fontSize:"11px", color:muted, marginTop:"3px" }}>Common: /16 = 65,536 IPs | /24 = 256 IPs</div>
                {parseCIDR(form.cidr)===null && form.cidr && <div style={{ fontSize:"11px", color:"#f43f5e", marginTop:"4px" }}>⚠ Invalid CIDR format</div>}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"12px", color:text, background:subtle, padding:"10px", borderRadius:"8px", border:"1px solid "+border }}>
                  <input type="checkbox" checked={form.enable_dns} onChange={e=>setForm(p=>({...p,enable_dns:e.target.checked}))} />Enable DNS
                </label>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"12px", color:text, background:form.create_igw?"#00d4aa10":subtle, padding:"10px", borderRadius:"8px", border:"1px solid "+(form.create_igw?"#00d4aa40":border) }}>
                  <input type="checkbox" checked={form.create_igw} onChange={e=>setForm(p=>({...p,create_igw:e.target.checked}))} />Internet Gateway
                </label>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"12px", color:text, background:form.create_nat?"#f59e0b10":subtle, padding:"10px", borderRadius:"8px", border:"1px solid "+(form.create_nat?"#f59e0b40":border) }}>
                  <input type="checkbox" checked={form.create_nat} onChange={e=>setForm(p=>({...p,create_nat:e.target.checked}))} />NAT Gateway ($)
                </label>
              </div>
              {form.create_nat && <div style={{ background:"#f59e0b10", border:"1px solid #f59e0b30", borderRadius:"8px", padding:"10px", fontSize:"12px", color:"#f59e0b" }}>NAT Gateway costs ~$0.045/hr + data transfer.</div>}
            </div>
          )}

          {/* STEP 1: Subnets */}
          {step===1 && (
            <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
              {/* Info bar */}
              <div style={{ background:"#a78bfa10", border:"1px solid #a78bfa30", borderRadius:"8px", padding:"8px 14px", fontSize:"12px", color:"#a78bfa" }}>
                VPC: <strong>{form.name}</strong> · CIDR: <strong>{form.cidr}</strong> · Region: <strong>{form.region}</strong>
              </div>

              <div>
                <div style={{ fontSize:"12px", color:muted, marginBottom:"8px" }}>Quick preset</div>
                <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                  {SUBNET_PRESETS.map((p,i) => (
                    <div key={i} onClick={() => applyPreset(i, form.cidr, form.name, form.region)}
                      style={{ padding:"10px 14px", borderRadius:"8px", cursor:"pointer", border:"1px solid "+(preset===i?"#a78bfa40":border), background:preset===i?"#a78bfa10":subtle }}>
                      <div style={{ fontSize:"12px", fontWeight:"600", color:preset===i?"#a78bfa":text }}>{p.label}</div>
                      {!p.custom && <div style={{ fontSize:"10px", color:muted, marginTop:"2px" }}>{p.pub} public + {p.priv} private</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop:"1px solid "+border, paddingTop:"14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                  <div style={{ fontSize:"12px", fontWeight:"600", color:text }}>Subnets ({subnets.length})</div>
                  <button onClick={addSubnet} style={{ padding:"4px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:"none", background:"#a78bfa", color:"#fff" }}>+ Add Subnet</button>
                </div>
                {subnets.length === 0 && (
                  <div style={{ padding:"24px", textAlign:"center", color:muted, border:"1px dashed "+border, borderRadius:"8px", fontSize:"13px" }}>Select a preset or add subnets manually</div>
                )}
                {subnets.map((s,i) => (
                  <div key={i} style={{ background:subtle, borderRadius:"10px", padding:"12px", marginBottom:"8px", border:"1px solid "+(s.public?"#00d4aa30":"#f59e0b20") }}>
                    <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr auto", gap:"8px", alignItems:"center", marginBottom:"6px" }}>
                      <input style={{ ...inp, padding:"6px 10px" }} value={s.name} onChange={e=>updateSubnet(i,"name",e.target.value)} placeholder="subnet name" />
                      <input style={{ ...inp, padding:"6px 10px" }} value={s.cidr} onChange={e=>updateSubnet(i,"cidr",e.target.value)} placeholder="10.0.1.0/24" />
                      <select style={{ ...inp, padding:"6px 10px" }} value={s.az} onChange={e=>updateSubnet(i,"az",e.target.value)}>
                        {azList.map(az => <option key={az} value={az}>{az}</option>)}
                      </select>
                      <button onClick={()=>removeSubnet(i)} style={{ padding:"5px 8px", borderRadius:"6px", fontSize:"11px", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>✕</button>
                    </div>
                    <div style={{ display:"flex", gap:"12px" }}>
                      <label style={{ display:"flex", alignItems:"center", gap:"6px", cursor:"pointer", fontSize:"11px", color:text }}>
                        <input type="radio" checked={s.public} onChange={()=>updateSubnet(i,"public",true)} />
                        <span style={{ color:"#00d4aa" }}>Public</span> (auto-assign public IP)
                      </label>
                      <label style={{ display:"flex", alignItems:"center", gap:"6px", cursor:"pointer", fontSize:"11px", color:text }}>
                        <input type="radio" checked={!s.public} onChange={()=>updateSubnet(i,"public",false)} />
                        <span style={{ color:"#f59e0b" }}>Private</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Tags */}
          {step===2 && <TagsStep tags={tags} setTags={setTags} />}

          {/* STEP 3: Review */}
          {step===3 && (
            <div style={{ background:subtle, borderRadius:"12px", padding:"18px", border:"1px solid "+border }}>
              <div style={{ fontSize:"14px", fontWeight:"600", color:text, marginBottom:"14px" }}>VPC Configuration Summary</div>
              {[["Name",form.name],["Region",form.region],["CIDR",form.cidr],["DNS",form.enable_dns?"Enabled":"Disabled"],["Internet Gateway",form.create_igw?"Yes":"No"],["NAT Gateway",form.create_nat?"Yes (~$0.045/hr)":"No"],["Subnets",subnets.length+" ("+subnets.filter(s=>s.public).length+" pub + "+subnets.filter(s=>!s.public).length+" priv)"]].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid "+border }}>
                  <span style={{ fontSize:"12px", color:muted }}>{k}</span>
                  <span style={{ fontSize:"12px", fontWeight:"600", color:text }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop:"14px" }}>
                <div style={{ fontSize:"12px", fontWeight:"600", color:muted, marginBottom:"6px" }}>Subnets:</div>
                {subnets.map((s,i) => (
                  <div key={i} style={{ display:"flex", gap:"8px", alignItems:"center", padding:"4px 0", fontSize:"11px", color:muted }}>
                    <span style={{ background:s.public?"#00d4aa20":"#f59e0b20", color:s.public?"#00d4aa":"#f59e0b", padding:"1px 6px", borderRadius:"4px", fontSize:"10px" }}>{s.public?"PUB":"PRIV"}</span>
                    <span style={{ fontWeight:"600", color:text }}>{s.name}</span>
                    <span>{s.cidr}</span>
                    <span>{s.az}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"16px 24px", borderTop:"1px solid "+border, display:"flex", justifyContent:"space-between" }}>
          <button onClick={step===0?onClose:()=>setStep(s=>s-1)} style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid "+border, background:"transparent", color:text }}>
            {step===0?"Cancel":"Back"}
          </button>
          <button onClick={step<STEPS.length-1?handleNext:handleCreate} disabled={creating}
            style={{ padding:"9px 22px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#a78bfa", color:"#fff", opacity:creating?0.7:1 }}>
            {creating?"Creating...":(step<STEPS.length-1?"Next →":"Create VPC")}
          </button>
        </div>
      </div>
    </div>
  )
}