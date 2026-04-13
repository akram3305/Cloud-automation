import { useState, useEffect, useCallback } from "react"
import { useTheme } from "../context/ThemeContext"
import api, { updateSGRules } from "../api/api"
import { useToast } from "../context/ToastContext"

const REGIONS = ["ap-south-1","us-east-1","us-east-2","eu-west-1","ap-southeast-1"]

const AZS_BY_REGION = {
  "ap-south-1":    ["ap-south-1a","ap-south-1b","ap-south-1c"],
  "us-east-1":     ["us-east-1a","us-east-1b","us-east-1c","us-east-1d"],
  "us-east-2":     ["us-east-2a","us-east-2b","us-east-2c"],
  "eu-west-1":     ["eu-west-1a","eu-west-1b","eu-west-1c"],
  "ap-southeast-1":["ap-southeast-1a","ap-southeast-1b","ap-southeast-1c"],
}

const STEPS = ["VPC Config","Subnets","Tags","Review"]

function parseCIDR(cidr) {
  try {
    const [ip, prefix] = cidr.split("/")
    const parts = ip.split(".").map(Number)
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null
    if (isNaN(Number(prefix)) || Number(prefix) < 8 || Number(prefix) > 28) return null
    return { parts, prefix: Number(prefix) }
  } catch { return null }
}

function generateSubnetCIDRs(vpcCidr, count = 2) {
  const parsed = parseCIDR(vpcCidr)
  if (!parsed) return []
  const { parts, prefix } = parsed
  const subPrefix = prefix <= 16 ? 24 : prefix <= 22 ? 26 : 28
  const baseInt = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  const blockSize = Math.pow(2, 32 - subPrefix)
  const subnets = []
  for (let i = 0; i < count; i++) {
    const subInt = (baseInt + i * blockSize) >>> 0
    const o1 = (subInt >>> 24) & 0xff
    const o2 = (subInt >>> 16) & 0xff
    const o3 = (subInt >>> 8)  & 0xff
    const o4 =  subInt         & 0xff
    subnets.push(`${o1}.${o2}.${o3}.${o4}/${subPrefix}`)
  }
  return subnets
}

const SUBNET_PRESETS = [
  { label:"2 subnets (1 public + 1 private)",        sub:"1 public + 1 private",  counts:{ pub:1, priv:1 } },
  { label:"4 subnets (2 public + 2 private)",        sub:"2 public + 2 private",  counts:{ pub:2, priv:2 } },
  { label:"6 subnets (2 public + 2 private + 2 data)", sub:"2 public + 4 private", counts:{ pub:2, priv:4 } },
  { label:"Custom", sub:"", counts:null },
]

// Always called with explicit cidr/name/region — never reads from stale state
function buildSubnetsFromPreset(preset, vpcCidr, vpcName, region) {
  if (!preset.counts) return []
  const azs    = AZS_BY_REGION[region] || AZS_BY_REGION["ap-south-1"]
  const total  = preset.counts.pub + preset.counts.priv
  const cidrs  = generateSubnetCIDRs(vpcCidr, total)
  const result = []
  let idx = 0
  for (let i = 0; i < preset.counts.pub; i++) {
    const az = azs[i % azs.length]
    result.push({ name:`${vpcName}-public-${az.split("-").pop()}`, cidr:cidrs[idx++]||"", az, public:true })
  }
  for (let i = 0; i < preset.counts.priv; i++) {
    const az = azs[i % azs.length]
    result.push({ name:`${vpcName}-private-${az.split("-").pop()}`, cidr:cidrs[idx++]||"", az, public:false })
  }
  return result
}

export default function Network() {
  const { dark } = useTheme()
  const toast = useToast()
  const [region, setRegion]       = useState("ap-south-1")
  const [vpcs, setVpcs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeVpc, setActiveVpc] = useState(null)
  const [tab, setTab]             = useState("subnets")
  const [success, setSuccess]     = useState("")
  const [error, setError]         = useState("")
  const [creating, setCreating]   = useState(false)

  // SG inline-editing state
  const [editingSG,    setEditingSG]    = useState(null)   // sg.id being edited
  const [editRules,    setEditRules]    = useState([])     // draft inbound rules
  const [savingSG,     setSavingSG]     = useState(false)

  const [showCreateVPC,    setCreateVPC]    = useState(false)
  const [showCreateSG,     setCreateSG]     = useState(false)
  const [showCreateSubnet, setCreateSubnet] = useState(false)

  const [vpcStep,        setVpcStep]   = useState(0)
  const [vpcForm,        setVpcForm]   = useState({ name:"", cidr:"10.0.0.0/16", region:"ap-south-1", enable_dns:true, create_igw:true, create_nat:false })
  const [vpcSubnets,     setVpcSubnets]   = useState([])
  const [selectedPreset, setPreset]       = useState(0)
  const [vpcTags,        setVpcTags]      = useState({ project:"", owner:"", environment:"dev" })
  const [submitted,      setSubmitted]    = useState(false)

  const [sgForm,  setSgForm]  = useState({ name:"", description:"Managed by AIonOS", rules_in:[
    { protocol:"tcp", from_port:22,  to_port:22,  cidr:"0.0.0.0/0", desc:"SSH" },
    { protocol:"tcp", from_port:80,  to_port:80,  cidr:"0.0.0.0/0", desc:"HTTP" },
    { protocol:"tcp", from_port:443, to_port:443, cidr:"0.0.0.0/0", desc:"HTTPS" },
  ]})
  const [subForm, setSubForm] = useState({ name:"", cidr:"", az:"", public:false })

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const inp     = { padding:"8px 12px", border:"1px solid "+border, borderRadius:"8px", fontSize:"13px", width:"100%", background:surface, color:text }

  const fetchVPCs = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/vpc/list?region=${region}`)
      setVpcs(data)
      if (data.length > 0 && !activeVpc) setActiveVpc(data[0].id)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [region])

  useEffect(() => { fetchVPCs() }, [fetchVPCs])

  const selectedVPC = vpcs.find(v => v.id === activeVpc)
  const azs         = AZS_BY_REGION[region] || AZS_BY_REGION["ap-south-1"]

  function resetVpcWizard() {
    setVpcStep(0)
    setVpcForm({ name:"", cidr:"10.0.0.0/16", region:"ap-south-1", enable_dns:true, create_igw:true, create_nat:false })
    setVpcSubnets([])
    setPreset(0)
    setVpcTags({ project:"", owner:"", environment:"dev" })
    setSubmitted(false)
    setError("")
    setCreateVPC(false)
  }

  // ✅ KEY FIX: when moving step 0→1, generate subnets immediately
  // using the form values we already have in hand — no stale state
  function handleVpcNext() {
    setError("")
    if (vpcStep === 0) {
      if (!vpcForm.name.trim()) { setError("VPC name required"); return }
      if (!parseCIDR(vpcForm.cidr)) { setError("Invalid CIDR block. Example: 10.0.0.0/16"); return }
      // Generate subnets NOW, before step changes, with live values
      const preset = SUBNET_PRESETS[selectedPreset]
      if (preset.counts) {
        setVpcSubnets(buildSubnetsFromPreset(preset, vpcForm.cidr, vpcForm.name, vpcForm.region))
      }
    }
    if (vpcStep === 1) {
      if (vpcSubnets.length === 0) { setError("Add at least one subnet"); return }
      for (const s of vpcSubnets) {
        if (!s.name.trim()) { setError("All subnets need a name"); return }
        if (!parseCIDR(s.cidr)) { setError(`Invalid CIDR for subnet "${s.name}"`); return }
        if (!s.az) { setError(`Select an AZ for subnet "${s.name}"`); return }
      }
    }
    if (vpcStep === 2) {
      if (!vpcTags.project.trim()) { setError("Project name required"); return }
      if (!vpcTags.owner.trim())   { setError("Project owner required"); return }
    }
    setVpcStep(s => s + 1)
  }

  async function handleCreateVPC() {
    setCreating(true); setError("")
    try {
      await api.post("/vpc/create", {
        name: vpcForm.name, region: vpcForm.region, cidr: vpcForm.cidr,
        subnets: vpcSubnets, create_igw: vpcForm.create_igw, create_nat: vpcForm.create_nat,
        tags: { project: vpcTags.project, owner: vpcTags.owner, environment: vpcTags.environment, CreatedBy:"AIonOS-Platform" },
      })
      setSubmitted(true)
    } catch(e) { setError(e.response?.data?.detail || e.message) }
    finally { setCreating(false) }
  }

  function addSubnet() {
    const az = azs[vpcSubnets.length % azs.length]
    const cidrs = generateSubnetCIDRs(vpcForm.cidr, vpcSubnets.length + 1)
    setVpcSubnets(p => [...p, { name:`${vpcForm.name}-subnet-${az.split("-").pop()}`, cidr:cidrs[vpcSubnets.length]||"", az, public:false }])
  }
  function updateSubnet(i, field, value) { setVpcSubnets(p => p.map((s, idx) => idx===i ? {...s,[field]:value} : s)) }
  function removeSubnet(i) { setVpcSubnets(p => p.filter((_,idx) => idx!==i)) }

  async function handleCreateSG() {
    if (!sgForm.name) { setError("Security group name required"); return }
    setCreating(true); setError("")
    try {
      await api.post("/vpc/security-groups/create", { name:sgForm.name, description:sgForm.description, vpc_id:activeVpc, region, rules_in:sgForm.rules_in })
      setSuccess("Security group created"); setCreateSG(false); fetchVPCs()
      setTimeout(() => setSuccess(""), 3000)
    } catch(e) { setError(e.response?.data?.detail || e.message) }
    finally { setCreating(false) }
  }

  async function handleCreateSubnet() {
    if (!subForm.name) { setError("Subnet name required"); return }
    if (!subForm.az)   { setError("Select an availability zone"); return }
    if (!parseCIDR(subForm.cidr)) { setError("Invalid CIDR block"); return }
    setCreating(true); setError("")
    try {
      await api.post("/vpc/subnet/create", { name:subForm.name, cidr:subForm.cidr, az:subForm.az, public:subForm.public, vpc_id:activeVpc, region })
      setSuccess("Subnet created"); setCreateSubnet(false); fetchVPCs()
      setTimeout(() => setSuccess(""), 3000)
    } catch(e) { setError(e.response?.data?.detail || e.message) }
    finally { setCreating(false) }
  }

  async function handleDeleteVPC(id) {
    if (!window.confirm("Delete VPC? This will delete all resources inside.")) return
    try { await api.delete(`/vpc/${id}?region=${region}`); setSuccess("VPC deleted"); fetchVPCs(); setTimeout(()=>setSuccess(""),3000) }
    catch(e) { alert(e.response?.data?.detail || e.message) }
  }

  async function handleDeleteSG(id) {
    if (!window.confirm(`Delete security group ${id}?`)) return
    try {
      await api.delete(`/vpc/security-groups/${id}?region=${region}`)
      toast.success("Security group deleted")
      fetchVPCs()
    } catch(e) { toast.error(e.response?.data?.detail || e.message) }
  }

  function startEditSG(sg) {
    setEditingSG(sg.id)
    setEditRules(sg.rules_in?.length
      ? sg.rules_in.map(r => ({ ...r }))
      : [{ protocol:"tcp", from_port:22, to_port:22, cidr:"0.0.0.0/0", desc:"SSH" }]
    )
  }

  function cancelEditSG() { setEditingSG(null); setEditRules([]) }

  function addRule() {
    setEditRules(p => [...p, { protocol:"tcp", from_port:80, to_port:80, cidr:"0.0.0.0/0", desc:"" }])
  }

  function removeRule(i) { setEditRules(p => p.filter((_,idx) => idx !== i)) }

  function updateRule(i, field, value) {
    setEditRules(p => p.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  async function handleSaveRules(sgId) {
    setSavingSG(true)
    const loadId = toast.loading("Updating security group rules…")
    try {
      await updateSGRules(sgId, region, editRules.map(r => ({
        ...r,
        from_port: parseInt(r.from_port) || 0,
        to_port:   parseInt(r.to_port)   || parseInt(r.from_port) || 0,
      })))
      toast.dismiss(loadId)
      toast.success("Rules updated successfully")
      setEditingSG(null)
      setEditRules([])
      fetchVPCs()
    } catch(e) {
      toast.dismiss(loadId)
      toast.error(e.response?.data?.detail || e.message)
    } finally { setSavingSG(false) }
  }

  const tabBtn = (t) => ({ padding:"6px 14px", borderRadius:"8px", fontSize:"12px", fontWeight:"500", cursor:"pointer", border:"none", background:tab===t?"#00d4aa20":"transparent", color:tab===t?"#00d4aa":muted })

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px" }}>
        <div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0 }}>Network & Security</h1>
          <p style={{ fontSize:"13px", color:muted, marginTop:"4px" }}>VPCs, Subnets, Security Groups</p>
        </div>
        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          <select style={{ ...inp, width:"160px" }} value={region} onChange={e=>setRegion(e.target.value)}>
            {REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={()=>setCreateVPC(true)} style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#a78bfa", color:"#fff" }}>+ VPC</button>
        </div>
      </div>

      {success && <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", color:"#00d4aa", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{success}</div>}
      {error   && <div style={{ background:"#f43f5e15", border:"1px solid #f43f5e30", color:"#f43f5e", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{error}</div>}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
        {[
          { label:"VPCs",            value:vpcs.length,                             color:"#a78bfa" },
          { label:"Subnets",         value:vpcs.reduce((a,v)=>a+v.subnet_count,0),  color:"#3b82f6" },
          { label:"Security Groups", value:vpcs.reduce((a,v)=>a+(v.sg_count||0),0), color:"#f59e0b" },
          { label:"Custom VPCs",     value:vpcs.filter(v=>!v.default).length,        color:"#00d4aa" },
        ].map(s => (
          <div key={s.label} style={{ background:surface, border:"1px solid "+border, borderLeft:"3px solid "+s.color, borderRadius:"12px", padding:"16px" }}>
            <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"6px" }}>{s.label}</div>
            <div style={{ fontSize:"24px", fontWeight:"700", color:text }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding:"48px", textAlign:"center", color:muted }}>Loading network resources...</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:"16px" }}>
          <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden" }}>
            <div style={{ padding:"14px 16px", borderBottom:"1px solid "+border, fontSize:"13px", fontWeight:"600", color:text }}>VPCs ({vpcs.length})</div>
            {vpcs.length === 0 ? (
              <div style={{ padding:"32px", textAlign:"center", color:muted, fontSize:"13px" }}>No VPCs found</div>
            ) : vpcs.map(vpc => (
              <div key={vpc.id} onClick={() => setActiveVpc(vpc.id)}
                style={{ padding:"12px 16px", cursor:"pointer", borderBottom:"1px solid "+border, background:activeVpc===vpc.id?(dark?"#a78bfa10":"#f3f0ff"):"transparent" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:"13px", fontWeight:"600", color:activeVpc===vpc.id?"#a78bfa":text }}>{vpc.name}</span>
                  {vpc.default && <span style={{ fontSize:"9px", background:"#3b82f620", color:"#3b82f6", padding:"1px 5px", borderRadius:"4px" }}>DEFAULT</span>}
                </div>
                <div style={{ fontSize:"11px", color:muted, marginTop:"2px" }}>{vpc.cidr}</div>
                <div style={{ fontSize:"10px", color:muted, marginTop:"1px" }}>{vpc.subnet_count} subnets · {vpc.sg_count} SGs</div>
              </div>
            ))}
          </div>

          {selectedVPC && (
            <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden" }}>
              <div style={{ padding:"16px 20px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:"16px", fontWeight:"700", color:text }}>{selectedVPC.name}</div>
                  <div style={{ fontSize:"12px", color:muted }}>{selectedVPC.id} · {selectedVPC.cidr} · {selectedVPC.region}</div>
                </div>
                {!selectedVPC.default && (
                  <button onClick={() => handleDeleteVPC(selectedVPC.id)} style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"11px", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>Delete VPC</button>
                )}
              </div>
              <div style={{ padding:"0 20px", borderBottom:"1px solid "+border, display:"flex", gap:"4px" }}>
                {["subnets","security-groups","info"].map(t => (
                  <button key={t} onClick={() => setTab(t)} style={tabBtn(t)}>{t.replace("-"," ").replace(/\b\w/g,c=>c.toUpperCase())}</button>
                ))}
              </div>
              <div style={{ padding:"16px 20px" }}>
                {tab === "subnets" && (
                  <>
                    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"12px" }}>
                      <button onClick={() => {
                        const az = azs[0]
                        const cidrs = generateSubnetCIDRs(selectedVPC.cidr, (selectedVPC.subnets?.length||0)+1)
                        setSubForm({ name:"", cidr:cidrs[selectedVPC.subnets?.length||0]||"", az, public:false })
                        setCreateSubnet(true)
                      }} style={{ padding:"6px 14px", borderRadius:"8px", fontSize:"12px", fontWeight:"600", cursor:"pointer", border:"none", background:"#3b82f6", color:"#fff" }}>+ Add Subnet</button>
                    </div>
                    {!selectedVPC.subnets?.length ? (
                      <div style={{ padding:"32px", textAlign:"center", color:muted }}>No subnets</div>
                    ) : (
                      <table style={{ width:"100%", borderCollapse:"collapse" }}>
                        <thead><tr style={{ background:subtle }}>{["Name","ID","CIDR","AZ","Type","IPs Free"].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:"10px", fontWeight:"600", color:muted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                        <tbody>{selectedVPC.subnets.map(s=>(
                          <tr key={s.id} style={{ borderTop:"1px solid "+border }}>
                            <td style={{ padding:"10px 12px", fontSize:"12px", fontWeight:"600", color:text }}>{s.name}</td>
                            <td style={{ padding:"10px 12px", fontSize:"11px", fontFamily:"monospace", color:muted }}>{s.id}</td>
                            <td style={{ padding:"10px 12px", fontSize:"11px", color:muted }}>{s.cidr}</td>
                            <td style={{ padding:"10px 12px", fontSize:"11px", color:muted }}>{s.az}</td>
                            <td style={{ padding:"10px 12px" }}><span style={{ fontSize:"10px", background:s.public?"#00d4aa20":"#f59e0b20", color:s.public?"#00d4aa":"#f59e0b", padding:"2px 8px", borderRadius:"10px" }}>{s.public?"Public":"Private"}</span></td>
                            <td style={{ padding:"10px 12px", fontSize:"11px", color:muted }}>{s.available_ips}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </>
                )}
                {tab === "security-groups" && (
                  <>
                    <style>{`
                      @keyframes sg-slide { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
                      @keyframes sg-spin  { to{transform:rotate(360deg)} }
                      .sg-rule-row:hover { background: ${dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)"} !important; }
                    `}</style>

                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
                      <div style={{ fontSize:"12px", color:muted }}>
                        {selectedVPC.security_groups?.length || 0} security group{selectedVPC.security_groups?.length !== 1 ? "s" : ""}
                      </div>
                      <button onClick={() => setCreateSG(true)}
                        style={{ padding:"7px 16px", borderRadius:"8px", fontSize:"12px", fontWeight:"600", cursor:"pointer", border:"none", background:"linear-gradient(90deg,#f59e0b,#fbbf24)", color:"#1a0a00", boxShadow:"0 2px 8px rgba(245,158,11,0.3)", transition:"all 0.15s" }}
                        onMouseEnter={e=>e.currentTarget.style.transform="translateY(-1px)"}
                        onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}
                      >+ Security Group</button>
                    </div>

                    {(!selectedVPC.security_groups || selectedVPC.security_groups.length === 0) && (
                      <div style={{ padding:"32px", textAlign:"center", color:muted, fontSize:"13px", border:"1px dashed "+border, borderRadius:"10px" }}>
                        No security groups in this VPC
                      </div>
                    )}

                    {selectedVPC.security_groups?.map((sg, idx) => {
                      const isEditing = editingSG === sg.id
                      const rules = isEditing ? editRules : (sg.rules_in || [])
                      return (
                        <div key={sg.id}
                          style={{ border:`1px solid ${isEditing?"rgba(245,158,11,0.4)":border}`, borderRadius:"12px", marginBottom:"10px", overflow:"hidden", transition:"all 0.2s ease", boxShadow:isEditing?"0 0 0 1px rgba(245,158,11,0.2), 0 4px 16px rgba(0,0,0,0.15)":"none", animation:`sg-slide 0.25s ease ${idx*40}ms both` }}>

                          {/* SG Header */}
                          <div style={{ padding:"12px 16px", background:isEditing?(dark?"rgba(245,158,11,0.06)":"rgba(245,158,11,0.04)"):(dark?"rgba(255,255,255,0.02)":"#fafafa"), display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:isEditing?`1px solid rgba(245,158,11,0.2)`:rules.length>0?`1px solid ${border}`:"none" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                              <div style={{ width:"30px", height:"30px", borderRadius:"8px", background:isEditing?"rgba(245,158,11,0.15)":(dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)"), display:"flex", alignItems:"center", justifyContent:"center" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isEditing?"#f59e0b":muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                </svg>
                              </div>
                              <div>
                                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                                  <span style={{ fontSize:"13px", fontWeight:"600", color:text }}>{sg.name}</span>
                                  {sg.name === "default" && <span style={{ fontSize:"9px", background:"#3b82f620", color:"#3b82f6", padding:"1px 6px", borderRadius:"4px", fontWeight:"600" }}>DEFAULT</span>}
                                  {isEditing && <span style={{ fontSize:"9px", background:"rgba(245,158,11,0.2)", color:"#f59e0b", padding:"1px 6px", borderRadius:"4px", fontWeight:"600" }}>EDITING</span>}
                                </div>
                                <div style={{ fontSize:"11px", color:muted, marginTop:"1px" }}>{sg.id} · {rules.length} inbound rule{rules.length!==1?"s":""}</div>
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                              {!isEditing && (
                                <button onClick={() => startEditSG(sg)}
                                  style={{ padding:"4px 10px", borderRadius:"7px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:"1px solid rgba(245,158,11,0.3)", background:"rgba(245,158,11,0.1)", color:"#f59e0b", transition:"all 0.15s" }}
                                  onMouseEnter={e=>e.currentTarget.style.background="rgba(245,158,11,0.2)"}
                                  onMouseLeave={e=>e.currentTarget.style.background="rgba(245,158,11,0.1)"}>
                                  ✏ Edit Rules
                                </button>
                              )}
                              {isEditing && (
                                <>
                                  <button onClick={cancelEditSG}
                                    style={{ padding:"4px 10px", borderRadius:"7px", fontSize:"11px", cursor:"pointer", border:`1px solid ${border}`, background:"transparent", color:muted }}>
                                    Cancel
                                  </button>
                                  <button onClick={() => handleSaveRules(sg.id)} disabled={savingSG}
                                    style={{ padding:"4px 12px", borderRadius:"7px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:"none", background:"#f59e0b", color:"#1a0a00", opacity:savingSG?0.7:1, display:"flex", alignItems:"center", gap:"5px" }}>
                                    {savingSG
                                      ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{animation:"sg-spin 0.7s linear infinite"}}><path d="M21 12a9 9 0 11-18 0"/></svg> Saving…</>
                                      : "✓ Save Rules"
                                    }
                                  </button>
                                </>
                              )}
                              {!isEditing && sg.name !== "default" && (
                                <button onClick={() => handleDeleteSG(sg.id)}
                                  style={{ padding:"4px 8px", borderRadius:"7px", fontSize:"11px", cursor:"pointer", border:"1px solid rgba(244,63,94,0.3)", background:"rgba(244,63,94,0.08)", color:"#f43f5e", transition:"all 0.15s" }}
                                  onMouseEnter={e=>e.currentTarget.style.background="rgba(244,63,94,0.18)"}
                                  onMouseLeave={e=>e.currentTarget.style.background="rgba(244,63,94,0.08)"}>
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Rules view / edit */}
                          {(rules.length > 0 || isEditing) && (
                            <div style={{ padding:"10px 16px 12px" }}>

                              {/* Quick presets (only in edit mode) */}
                              {isEditing && (
                                <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"10px" }}>
                                  <span style={{ fontSize:"10px", color:muted, alignSelf:"center", marginRight:"2px" }}>Quick add:</span>
                                  {[
                                    { label:"SSH",   protocol:"tcp", port:22,   cidr:"0.0.0.0/0" },
                                    { label:"HTTP",  protocol:"tcp", port:80,   cidr:"0.0.0.0/0" },
                                    { label:"HTTPS", protocol:"tcp", port:443,  cidr:"0.0.0.0/0" },
                                    { label:"RDP",   protocol:"tcp", port:3389, cidr:"0.0.0.0/0" },
                                    { label:"MySQL", protocol:"tcp", port:3306, cidr:"0.0.0.0/0" },
                                    { label:"PostgreSQL", protocol:"tcp", port:5432, cidr:"0.0.0.0/0" },
                                    { label:"All traffic", protocol:"-1", port:0, cidr:"0.0.0.0/0" },
                                  ].map(p => (
                                    <button key={p.label}
                                      onClick={() => setEditRules(prev => [...prev, { protocol:p.protocol, from_port:p.port, to_port:p.port, cidr:p.cidr, desc:p.label }])}
                                      style={{ padding:"3px 9px", borderRadius:"6px", fontSize:"10px", fontWeight:"600", cursor:"pointer", border:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)", color:muted, transition:"all 0.12s" }}
                                      onMouseEnter={e=>{ e.currentTarget.style.borderColor="#f59e0b50"; e.currentTarget.style.color="#f59e0b" }}
                                      onMouseLeave={e=>{ e.currentTarget.style.borderColor=border; e.currentTarget.style.color=muted }}>
                                      +{p.label}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Column headers */}
                              <div style={{ display:"grid", gridTemplateColumns:"80px 70px 70px 1fr 1fr"+(isEditing?" 28px":""), gap:"6px", padding:"4px 8px", marginBottom:"4px" }}>
                                {["Protocol","From","To","CIDR","Description",...(isEditing?[""]:[])]
                                  .map(h => <div key={h} style={{ fontSize:"9px", fontWeight:"700", color:muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>)}
                              </div>

                              {/* Rule rows */}
                              {(isEditing ? editRules : rules).map((r, ri) => (
                                <div key={ri} className="sg-rule-row"
                                  style={{ display:"grid", gridTemplateColumns:"80px 70px 70px 1fr 1fr"+(isEditing?" 28px":""), gap:"6px", padding:"5px 8px", borderRadius:"6px", marginBottom:"2px", transition:"background 0.12s", alignItems:"center" }}>
                                  {isEditing ? (
                                    <>
                                      <select value={r.protocol} onChange={e=>updateRule(ri,"protocol",e.target.value)}
                                        style={{ ...inp, fontSize:"11px", padding:"4px 6px" }}>
                                        <option value="tcp">TCP</option>
                                        <option value="udp">UDP</option>
                                        <option value="icmp">ICMP</option>
                                        <option value="-1">All</option>
                                      </select>
                                      <input type="number" value={r.from_port} onChange={e=>updateRule(ri,"from_port",e.target.value)}
                                        style={{ ...inp, fontSize:"11px", padding:"4px 6px" }} placeholder="0" />
                                      <input type="number" value={r.to_port} onChange={e=>updateRule(ri,"to_port",e.target.value)}
                                        style={{ ...inp, fontSize:"11px", padding:"4px 6px" }} placeholder="0" />
                                      <input value={r.cidr} onChange={e=>updateRule(ri,"cidr",e.target.value)}
                                        style={{ ...inp, fontSize:"11px", padding:"4px 6px" }} placeholder="0.0.0.0/0" />
                                      <input value={r.desc||""} onChange={e=>updateRule(ri,"desc",e.target.value)}
                                        style={{ ...inp, fontSize:"11px", padding:"4px 6px" }} placeholder="Description" />
                                      <button onClick={()=>removeRule(ri)}
                                        style={{ width:"24px", height:"24px", borderRadius:"6px", cursor:"pointer", border:"1px solid rgba(244,63,94,0.3)", background:"rgba(244,63,94,0.1)", color:"#f43f5e", fontSize:"12px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
                                    </>
                                  ) : (
                                    <>
                                      <span style={{ fontSize:"11px", fontFamily:"monospace", color:"#a78bfa", background:"rgba(167,139,250,0.1)", padding:"2px 6px", borderRadius:"4px", textAlign:"center" }}>{r.protocol === "-1" ? "All" : r.protocol.toUpperCase()}</span>
                                      <span style={{ fontSize:"11px", color:muted, fontFamily:"monospace" }}>{r.from_port || "–"}</span>
                                      <span style={{ fontSize:"11px", color:muted, fontFamily:"monospace" }}>{r.to_port || "–"}</span>
                                      <span style={{ fontSize:"11px", color:"#00d4aa", fontFamily:"monospace" }}>{r.cidr}</span>
                                      <span style={{ fontSize:"11px", color:muted }}>{r.desc || "—"}</span>
                                    </>
                                  )}
                                </div>
                              ))}

                              {/* Add rule button (edit mode) */}
                              {isEditing && (
                                <button onClick={addRule}
                                  style={{ marginTop:"6px", padding:"5px 14px", borderRadius:"7px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:`1px dashed ${border}`, background:"transparent", color:muted, width:"100%", transition:"all 0.15s" }}
                                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="#f59e0b50"; e.currentTarget.style.color="#f59e0b" }}
                                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=border; e.currentTarget.style.color=muted }}>
                                  + Add Rule
                                </button>
                              )}

                              {!isEditing && rules.length === 0 && (
                                <div style={{ fontSize:"12px", color:muted, padding:"8px", textAlign:"center" }}>No inbound rules — click Edit Rules to add</div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
                {tab === "info" && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                    {[["VPC ID",selectedVPC.id],["CIDR Block",selectedVPC.cidr],["Region",selectedVPC.region],["State",selectedVPC.state],["Default VPC",selectedVPC.default?"Yes":"No"],["Subnets",selectedVPC.subnet_count],["Security Groups",selectedVPC.sg_count]].map(([k,v])=>(
                      <div key={k} style={{ background:subtle, borderRadius:"8px", padding:"12px" }}>
                        <div style={{ fontSize:"11px", color:muted, marginBottom:"3px" }}>{k}</div>
                        <div style={{ fontSize:"13px", fontWeight:"600", color:text, wordBreak:"break-all" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CREATE VPC WIZARD ── */}
      {showCreateVPC && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:"16px" }}>
          <div style={{ background:surface, borderRadius:"18px", border:"1px solid "+border, width:"100%", maxWidth:"660px", maxHeight:"92vh", overflow:"auto" }}>
            <div style={{ padding:"20px 24px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:"17px", fontWeight:"700", color:text }}>Create VPC</div>
                <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Configure VPC with subnets, IGW, NAT and route tables</div>
              </div>
              <button onClick={resetVpcWizard} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"22px", color:muted }}>✕</button>
            </div>

            {!submitted && (
              <div style={{ padding:"14px 24px", borderBottom:"1px solid "+border, display:"flex" }}>
                {STEPS.map((s,i) => (
                  <div key={s} style={{ display:"flex", alignItems:"center", flex:i<STEPS.length-1?1:"auto" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <div style={{ width:"22px", height:"22px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", fontWeight:"700",
                        background:i<vpcStep?"#a78bfa":i===vpcStep?"#a78bfa20":subtle,
                        color:i<vpcStep?"#fff":i===vpcStep?"#a78bfa":muted,
                        border:i===vpcStep?"2px solid #a78bfa":"2px solid "+(i<vpcStep?"#a78bfa":border),
                      }}>{i<vpcStep?"✓":i+1}</div>
                      <span style={{ fontSize:"11px", fontWeight:i===vpcStep?"600":"400", color:i===vpcStep?text:muted }}>{s}</span>
                    </div>
                    {i<STEPS.length-1 && <div style={{ flex:1, height:"2px", background:i<vpcStep?"#a78bfa":border, margin:"0 6px" }}/>}
                  </div>
                ))}
              </div>
            )}

            {error && <div style={{ margin:"12px 24px 0", background:"#f43f5e15", color:"#f43f5e", padding:"10px", borderRadius:"8px", fontSize:"13px" }}>{error}</div>}

            <div style={{ padding:"20px 24px" }}>
              {submitted && (
                <div style={{ textAlign:"center", padding:"20px 0" }}>
                  <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"#a78bfa20", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ fontSize:"20px", fontWeight:"700", color:text, marginBottom:"8px" }}>VPC Request Submitted!</div>
                  <div style={{ fontSize:"13px", color:muted, marginBottom:"20px" }}>
                    <strong style={{ color:text }}>{vpcForm.name}</strong> is pending admin approval. Once approved, Terraform will create the VPC with {vpcSubnets.length} subnet(s).
                  </div>
                  <button onClick={resetVpcWizard} style={{ padding:"10px 28px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", cursor:"pointer", border:"none", background:"#a78bfa", color:"#fff" }}>Done</button>
                </div>
              )}

              {/* STEP 0 */}
              {!submitted && vpcStep === 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
                    <div>
                      <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>VPC Name *</label>
                      <input style={inp} placeholder="my-vpc" value={vpcForm.name} onChange={e=>setVpcForm(p=>({...p,name:e.target.value}))} autoFocus />
                    </div>
                    <div>
                      <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Region</label>
                      <select style={inp} value={vpcForm.region} onChange={e=>setVpcForm(p=>({...p,region:e.target.value}))}>
                        {REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>CIDR Block</label>
                    <input style={inp} placeholder="10.0.0.0/16" value={vpcForm.cidr} onChange={e=>setVpcForm(p=>({...p,cidr:e.target.value}))} />
                    <div style={{ fontSize:"11px", color:muted, marginTop:"4px" }}>Common: /16 = 65,536 IPs | /24 = 256 IPs</div>
                    {parseCIDR(vpcForm.cidr)===null && vpcForm.cidr && <div style={{ fontSize:"11px", color:"#f43f5e", marginTop:"4px" }}>⚠ Invalid CIDR format</div>}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px" }}>
                    {[
                      { key:"enable_dns", label:"Enable DNS",       desc:"DNS hostnames & support" },
                      { key:"create_igw", label:"Internet Gateway", desc:"Required for public subnets" },
                      { key:"create_nat", label:"NAT Gateway ($)",  desc:"Required for private subnets" },
                    ].map(opt => (
                      <label key={opt.key} onClick={()=>setVpcForm(p=>({...p,[opt.key]:!p[opt.key]}))}
                        style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", padding:"10px 12px", borderRadius:"8px", border:"1px solid "+(vpcForm[opt.key]?"#a78bfa40":border), background:vpcForm[opt.key]?"#a78bfa10":surface }}>
                        <input type="checkbox" checked={vpcForm[opt.key]} onChange={()=>{}} style={{ pointerEvents:"none" }} />
                        <div>
                          <div style={{ fontSize:"12px", fontWeight:"600", color:vpcForm[opt.key]?"#a78bfa":text }}>{opt.label}</div>
                          <div style={{ fontSize:"10px", color:muted }}>{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 1 */}
              {!submitted && vpcStep === 1 && (
                <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                  {/* Info bar showing what was entered on step 0 */}
                  <div style={{ background:"#a78bfa10", border:"1px solid #a78bfa30", borderRadius:"8px", padding:"8px 14px", fontSize:"12px", color:"#a78bfa" }}>
                    VPC: <strong>{vpcForm.name}</strong> · CIDR: <strong>{vpcForm.cidr}</strong> · Region: <strong>{vpcForm.region}</strong>
                  </div>

                  <div>
                    <div style={{ fontSize:"12px", color:muted, marginBottom:"8px", fontWeight:"500" }}>Quick preset</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {SUBNET_PRESETS.map((p, i) => (
                        <div key={i} onClick={() => {
                          setPreset(i)
                          // ✅ Use vpcForm values directly — they are current at render time
                          if (p.counts) setVpcSubnets(buildSubnetsFromPreset(p, vpcForm.cidr, vpcForm.name, vpcForm.region))
                          else setVpcSubnets([])
                        }}
                          style={{ padding:"10px 14px", borderRadius:"8px", cursor:"pointer", border:"1px solid "+(selectedPreset===i?"#a78bfa40":border), background:selectedPreset===i?"#a78bfa10":surface }}>
                          <div style={{ fontSize:"13px", fontWeight:"600", color:selectedPreset===i?"#a78bfa":text }}>{p.label}</div>
                          {p.sub && <div style={{ fontSize:"11px", color:muted, marginTop:"2px" }}>{p.sub}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                      <div style={{ fontSize:"12px", fontWeight:"500", color:text }}>Subnets ({vpcSubnets.length})</div>
                      <button onClick={addSubnet} style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:"none", background:"#a78bfa", color:"#fff" }}>+ Add Subnet</button>
                    </div>
                    {vpcSubnets.length === 0 ? (
                      <div style={{ padding:"24px", textAlign:"center", color:muted, border:"1px dashed "+border, borderRadius:"8px", fontSize:"13px" }}>Select a preset or add subnets manually</div>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                        {vpcSubnets.map((s,i) => (
                          <div key={i} style={{ border:"1px solid "+border, borderRadius:"10px", padding:"12px 14px", background:subtle }}>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 140px 140px auto", gap:"8px", alignItems:"center" }}>
                              <input style={{ ...inp, fontSize:"12px" }} placeholder="subnet-name" value={s.name} onChange={e=>updateSubnet(i,"name",e.target.value)} />
                              <input style={{ ...inp, fontSize:"12px" }} placeholder="10.0.1.0/24" value={s.cidr} onChange={e=>updateSubnet(i,"cidr",e.target.value)} />
                              <select style={{ ...inp, fontSize:"12px" }} value={s.az} onChange={e=>updateSubnet(i,"az",e.target.value)}>
                                <option value="">Select AZ</option>
                                {(AZS_BY_REGION[vpcForm.region]||azs).map(az=><option key={az} value={az}>{az}</option>)}
                              </select>
                              <button onClick={()=>removeSubnet(i)} style={{ padding:"6px 8px", borderRadius:"6px", background:"#f43f5e15", border:"1px solid #f43f5e30", color:"#f43f5e", cursor:"pointer", fontSize:"12px" }}>✕</button>
                            </div>
                            <div style={{ display:"flex", gap:"12px", marginTop:"8px" }}>
                              <label style={{ display:"flex", alignItems:"center", gap:"6px", cursor:"pointer", fontSize:"12px" }} onClick={()=>updateSubnet(i,"public",true)}>
                                <div style={{ width:"14px", height:"14px", borderRadius:"50%", border:"2px solid "+(s.public?"#00d4aa":border), background:s.public?"#00d4aa":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                                  {s.public && <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#fff" }}/>}
                                </div>
                                <span style={{ color:s.public?"#00d4aa":muted }}>Public</span>
                                <span style={{ fontSize:"10px", color:muted }}>(auto-assign public IP)</span>
                              </label>
                              <label style={{ display:"flex", alignItems:"center", gap:"6px", cursor:"pointer", fontSize:"12px" }} onClick={()=>updateSubnet(i,"public",false)}>
                                <div style={{ width:"14px", height:"14px", borderRadius:"50%", border:"2px solid "+(!s.public?"#f59e0b":border), background:!s.public?"#f59e0b":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                                  {!s.public && <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#fff" }}/>}
                                </div>
                                <span style={{ color:!s.public?"#f59e0b":muted }}>Private</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {!submitted && vpcStep === 2 && (
                <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                  <div>
                    <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Project Name *</label>
                    <input style={inp} placeholder="AIonOS-Platform" value={vpcTags.project} onChange={e=>setVpcTags(p=>({...p,project:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Project Owner *</label>
                    <input style={inp} placeholder="akram-khan" value={vpcTags.owner} onChange={e=>setVpcTags(p=>({...p,owner:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"8px" }}>Environment *</label>
                    <div style={{ display:"flex", gap:"8px" }}>
                      {["dev","staging","prod"].map(env => (
                        <button key={env} onClick={()=>setVpcTags(p=>({...p,environment:env}))}
                          style={{ flex:1, padding:"8px", borderRadius:"8px", cursor:"pointer", fontSize:"12px", fontWeight:"600", border:"1px solid "+(vpcTags.environment===env?"#a78bfa40":border), background:vpcTags.environment===env?"#a78bfa15":surface, color:vpcTags.environment===env?"#a78bfa":muted }}>
                          {env}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {!submitted && vpcStep === 3 && (
                <div>
                  <div style={{ background:subtle, borderRadius:"12px", padding:"20px", border:"1px solid "+border }}>
                    <div style={{ fontSize:"14px", fontWeight:"600", color:text, marginBottom:"14px" }}>Configuration Summary</div>
                    {[["VPC Name",vpcForm.name],["CIDR",vpcForm.cidr],["Region",vpcForm.region],["IGW",vpcForm.create_igw?"Yes":"No"],["NAT",vpcForm.create_nat?"Yes ($)":"No"],["Subnets",vpcSubnets.length+" configured"],["Project",vpcTags.project],["Owner",vpcTags.owner],["Env",vpcTags.environment]].map(([k,v])=>(
                      <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid "+border }}>
                        <span style={{ fontSize:"12px", color:muted }}>{k}</span>
                        <span style={{ fontSize:"12px", fontWeight:"600", color:text }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:"12px" }}>
                    <div style={{ fontSize:"12px", fontWeight:"600", color:muted, marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.06em" }}>Subnets</div>
                    {vpcSubnets.map((s,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", borderRadius:"6px", background:subtle, marginBottom:"4px", fontSize:"12px" }}>
                        <span style={{ fontWeight:"600", color:text }}>{s.name}</span>
                        <span style={{ color:muted }}>{s.cidr} · {s.az}</span>
                        <span style={{ color:s.public?"#00d4aa":"#f59e0b", fontWeight:"600" }}>{s.public?"Public":"Private"}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:"#f59e0b10", border:"1px solid #f59e0b30", borderRadius:"8px", padding:"10px 14px", marginTop:"12px", fontSize:"12px", color:"#f59e0b" }}>
                    An admin must approve this request before the VPC is created in AWS.
                  </div>
                </div>
              )}
            </div>

            {!submitted && (
              <div style={{ padding:"16px 24px", borderTop:"1px solid "+border, display:"flex", justifyContent:"space-between" }}>
                <button onClick={vpcStep===0?resetVpcWizard:()=>setVpcStep(s=>s-1)} style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid "+border, background:"transparent", color:text }}>
                  {vpcStep===0?"Cancel":"Back"}
                </button>
                <button onClick={vpcStep<STEPS.length-1?handleVpcNext:handleCreateVPC} disabled={creating}
                  style={{ padding:"9px 22px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#a78bfa", color:"#fff", opacity:creating?0.7:1 }}>
                  {creating?"Submitting...":(vpcStep<STEPS.length-1?"Next →":"Submit Request")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD SUBNET MODAL */}
      {showCreateSubnet && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:"16px" }}>
          <div style={{ background:surface, borderRadius:"14px", border:"1px solid "+border, width:"100%", maxWidth:"440px" }}>
            <div style={{ padding:"18px 24px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between" }}>
              <div style={{ fontSize:"16px", fontWeight:"600", color:text }}>Add Subnet to {selectedVPC?.name}</div>
              <button onClick={()=>setCreateSubnet(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"20px", color:muted }}>✕</button>
            </div>
            <div style={{ padding:"18px 24px", display:"flex", flexDirection:"column", gap:"12px" }}>
              {error && <div style={{ background:"#f43f5e15", color:"#f43f5e", padding:"10px", borderRadius:"8px", fontSize:"13px" }}>{error}</div>}
              <div><label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Subnet Name *</label><input style={inp} value={subForm.name} onChange={e=>setSubForm(p=>({...p,name:e.target.value}))} placeholder="my-subnet-1a" /></div>
              <div><label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>CIDR Block *</label><input style={inp} value={subForm.cidr} onChange={e=>setSubForm(p=>({...p,cidr:e.target.value}))} placeholder="10.0.1.0/24" /><div style={{ fontSize:"11px", color:muted, marginTop:"3px" }}>Must be within VPC CIDR: {selectedVPC?.cidr}</div></div>
              <div><label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Availability Zone *</label>
                <select style={inp} value={subForm.az} onChange={e=>setSubForm(p=>({...p,az:e.target.value}))}>
                  <option value="">Select AZ</option>
                  {azs.map(az=><option key={az} value={az}>{az}</option>)}
                </select>
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"13px", color:text }}>
                <input type="checkbox" checked={subForm.public} onChange={e=>setSubForm(p=>({...p,public:e.target.checked}))} />
                Public subnet (auto-assign public IP)
              </label>
            </div>
            <div style={{ padding:"14px 24px", borderTop:"1px solid "+border, display:"flex", justifyContent:"flex-end", gap:"10px" }}>
              <button onClick={()=>setCreateSubnet(false)} style={{ padding:"8px 16px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid "+border, background:"transparent", color:text }}>Cancel</button>
              <button onClick={handleCreateSubnet} disabled={creating} style={{ padding:"8px 16px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#3b82f6", color:"#fff", opacity:creating?0.7:1 }}>{creating?"Creating...":"Create Subnet"}</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE SG MODAL */}
      {showCreateSG && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:"16px" }}>
          <div style={{ background:surface, borderRadius:"14px", border:"1px solid "+border, width:"100%", maxWidth:"500px" }}>
            <div style={{ padding:"18px 24px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between" }}>
              <div style={{ fontSize:"16px", fontWeight:"600", color:text }}>Create Security Group</div>
              <button onClick={()=>setCreateSG(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"20px", color:muted }}>✕</button>
            </div>
            <div style={{ padding:"18px 24px", display:"flex", flexDirection:"column", gap:"12px" }}>
              <div><label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Name *</label><input style={inp} value={sgForm.name} onChange={e=>setSgForm(p=>({...p,name:e.target.value}))} placeholder="my-sg" /></div>
              <div><label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Description</label><input style={inp} value={sgForm.description} onChange={e=>setSgForm(p=>({...p,description:e.target.value}))} /></div>
              <div>
                <div style={{ fontSize:"12px", color:muted, marginBottom:"6px" }}>Inbound rules</div>
                {sgForm.rules_in.map((r,i) => (
                  <div key={i} style={{ display:"flex", gap:"6px", marginBottom:"6px", alignItems:"center" }}>
                    <select style={{ ...inp, width:"80px" }} value={r.protocol} onChange={e=>{const rules=[...sgForm.rules_in];rules[i]={...rules[i],protocol:e.target.value};setSgForm(p=>({...p,rules_in:rules}))}}>
                      <option value="tcp">TCP</option><option value="udp">UDP</option><option value="-1">All</option>
                    </select>
                    <input style={{ ...inp, width:"70px" }} type="number" value={r.from_port} onChange={e=>{const rules=[...sgForm.rules_in];rules[i]={...rules[i],from_port:parseInt(e.target.value),to_port:parseInt(e.target.value)};setSgForm(p=>({...p,rules_in:rules}))}} placeholder="Port" />
                    <input style={inp} value={r.cidr} onChange={e=>{const rules=[...sgForm.rules_in];rules[i]={...rules[i],cidr:e.target.value};setSgForm(p=>({...p,rules_in:rules}))}} placeholder="0.0.0.0/0" />
                    <button onClick={()=>setSgForm(p=>({...p,rules_in:p.rules_in.filter((_,j)=>j!==i)}))} style={{ padding:"4px 8px", borderRadius:"6px", fontSize:"11px", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e", flexShrink:0 }}>✕</button>
                  </div>
                ))}
                <button onClick={()=>setSgForm(p=>({...p,rules_in:[...p.rules_in,{protocol:"tcp",from_port:8080,to_port:8080,cidr:"0.0.0.0/0",desc:""}]}))} style={{ padding:"4px 12px", borderRadius:"6px", fontSize:"11px", cursor:"pointer", border:"1px solid #3b82f640", background:"#3b82f615", color:"#3b82f6" }}>+ Add Rule</button>
              </div>
            </div>
            <div style={{ padding:"14px 24px", borderTop:"1px solid "+border, display:"flex", justifyContent:"flex-end", gap:"10px" }}>
              <button onClick={()=>setCreateSG(false)} style={{ padding:"8px 16px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid "+border, background:"transparent", color:text }}>Cancel</button>
              <button onClick={handleCreateSG} disabled={creating} style={{ padding:"8px 16px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#f59e0b", color:"#fff", opacity:creating?0.7:1 }}>{creating?"Creating...":"Create SG"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}