import { useState, useEffect, useCallback } from "react"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"

const ROLE_TYPES = [
  { id:"eks-cluster", label:"EKS Cluster Role",   color:"#00d4aa", desc:"For EKS control plane. Attaches AmazonEKSClusterPolicy + AmazonEKSVPCResourceController" },
  { id:"eks-node",    label:"EKS Node Role",       color:"#FF9900", desc:"For EC2 worker nodes. Attaches EKSWorkerNodePolicy + EKS_CNI_Policy + ECRReadOnly" },
  { id:"ec2",         label:"EC2 Instance Role",   color:"#3b82f6", desc:"For EC2 instances. Attaches AmazonSSMManagedInstanceCore" },
]

export default function IAMPage() {
  const { dark } = useTheme()
  const [roles, setRoles]         = useState([])
  const [keypairs, setKPs]        = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState("roles")
  const [showCreate, setCreate]   = useState(false)
  const [creating, setCreating]   = useState(false)
  const [success, setSuccess]     = useState("")
  const [error, setError]         = useState("")
  const [form, setForm]           = useState({ name:"", role_type:"eks-cluster", description:"Created by AIonOS Platform" })
  const [region, setRegion]       = useState("ap-south-1")
  const [newKPName, setNewKPName] = useState("")
  const [creatingKP, setCreatingKP]= useState(false)

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const inp     = { padding:"8px 12px", border:"1px solid "+border, borderRadius:"8px", fontSize:"13px", width:"100%", background:surface, color:text }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rr, kpr] = await Promise.all([
        api.get("/iam/roles").catch(()=>({data:[]})),
        api.get(`/iam/keypairs?region=${region}`).catch(()=>({data:[]})),
      ])
      setRoles(rr.data)
      setKPs(kpr.data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [region])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleCreateRole() {
    if (!form.name) { setError("Role name required"); return }
    setCreating(true); setError("")
    try {
      const { data } = await api.post("/iam/roles/create", form)
      setSuccess(data.message)
      setCreate(false)
      fetchAll()
      setTimeout(() => setSuccess(""), 5000)
    } catch(e) { setError(e.response?.data?.detail || e.message) }
    finally { setCreating(false) }
  }

  async function handleDeleteRole(name) {
    if (!window.confirm(`Delete role ${name}?`)) return
    try {
      await api.delete(`/iam/roles/${name}`)
      setSuccess(`Role ${name} deleted`)
      fetchAll()
      setTimeout(() => setSuccess(""), 3000)
    } catch(e) { alert(e.response?.data?.detail || e.message) }
  }

  async function handleCreateKP() {
    if (!newKPName.trim()) { setError("Key pair name required"); return }
    setCreatingKP(true); setError("")
    try {
      const { data } = await api.post(`/iam/keypairs/create?name=${newKPName}&region=${region}`)
      const blob = new Blob([data.private_key], { type:"text/plain" })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = newKPName+".pem"; a.click()
      URL.revokeObjectURL(url)
      setSuccess(`Key pair ${newKPName} created and downloaded as ${newKPName}.pem`)
      setNewKPName("")
      fetchAll()
      setTimeout(() => setSuccess(""), 5000)
    } catch(e) { setError(e.response?.data?.detail || e.message) }
    finally { setCreatingKP(false) }
  }

  async function handleDeleteKP(name) {
    if (!window.confirm(`Delete key pair ${name}?`)) return
    try {
      await api.delete(`/iam/keypairs/${name}?region=${region}`)
      setSuccess(`Key pair ${name} deleted`)
      fetchAll()
      setTimeout(() => setSuccess(""), 3000)
    } catch(e) { alert(e.response?.data?.detail || e.message) }
  }

  const TYPE_COLORS = { "eks-cluster":"#00d4aa", "eks-node":"#FF9900", "ec2":"#3b82f6", "custom":"#a78bfa" }

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px" }}>
        <div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0 }}>IAM & Key Pairs</h1>
          <p style={{ fontSize:"13px", color:muted, marginTop:"4px" }}>Roles, policies, and EC2 key pairs</p>
        </div>
        <button onClick={()=>setCreate(true)} style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#f59e0b", color:"#fff" }}>+ Create Role</button>
      </div>

      {success && <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", color:"#00d4aa", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{success}</div>}
      {error && <div style={{ background:"#f43f5e15", border:"1px solid #f43f5e30", color:"#f43f5e", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"16px" }}>
        {[["roles","IAM Roles"],["keypairs","Key Pairs"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ padding:"7px 16px", borderRadius:"8px", fontSize:"13px", fontWeight:"500", cursor:"pointer", border:"1px solid "+(tab===id?"#f59e0b40":border), background:tab===id?"#f59e0b15":surface, color:tab===id?"#f59e0b":muted }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding:"48px", textAlign:"center", color:muted }}>Loading...</div>
      ) : (
        <>
          {tab==="roles" && (
            <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden" }}>
              <div style={{ padding:"14px 20px", borderBottom:"1px solid "+border, fontSize:"13px", fontWeight:"600", color:text }}>IAM Roles ({roles.length})</div>
              {roles.length===0 ? (
                <div style={{ padding:"48px", textAlign:"center" }}>
                  <div style={{ fontSize:"36px", marginBottom:"12px" }}>🔐</div>
                  <div style={{ fontSize:"14px", color:muted, marginBottom:"16px" }}>No IAM roles found</div>
                  <button onClick={()=>setCreate(true)} style={{ padding:"8px 20px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#f59e0b", color:"#fff" }}>Create First Role</button>
                </div>
              ) : (
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr style={{ background:subtle }}>{["Name","Type","ARN","Policies","Actions"].map(h=><th key={h} style={{ padding:"8px 16px", textAlign:"left", fontSize:"10px", fontWeight:"600", color:muted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {roles.map((r,i)=>{
                      const tc = TYPE_COLORS[r.type]||"#64748b"
                      return (
                        <tr key={i} style={{ borderTop:"1px solid "+border }}
                          onMouseEnter={e=>e.currentTarget.style.background=dark?"#ffffff04":"#f8fafc"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"12px 16px", fontSize:"13px", fontWeight:"600", color:text }}>{r.name}</td>
                          <td style={{ padding:"12px 16px" }}><span style={{ background:tc+"20", color:tc, padding:"2px 8px", borderRadius:"10px", fontSize:"11px", fontWeight:"600" }}>{r.type}</span></td>
                          <td style={{ padding:"12px 16px", fontSize:"11px", color:muted, maxWidth:"220px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.arn}</td>
                          <td style={{ padding:"12px 16px", fontSize:"11px", color:muted }}>{r.policies?.length||0} policies</td>
                          <td style={{ padding:"12px 16px" }}>
                            <button onClick={()=>handleDeleteRole(r.name)} style={{ padding:"3px 10px", borderRadius:"6px", fontSize:"11px", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>Delete</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab==="keypairs" && (
            <div>
              <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"20px", marginBottom:"16px" }}>
                <div style={{ fontSize:"13px", fontWeight:"600", color:text, marginBottom:"12px" }}>Create New Key Pair</div>
                <div style={{ display:"flex", gap:"10px" }}>
                  <select style={{ ...inp, width:"160px" }} value={region} onChange={e=>setRegion(e.target.value)}>
                    {["ap-south-1","us-east-1","us-east-2","eu-west-1"].map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                  <input style={inp} placeholder="key-pair-name" value={newKPName} onChange={e=>setNewKPName(e.target.value.replace(/[^a-zA-Z0-9-_]/g,""))} onKeyDown={e=>e.key==="Enter"&&handleCreateKP()} />
                  <button onClick={handleCreateKP} disabled={creatingKP}
                    style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#3b82f6", color:"#fff", whiteSpace:"nowrap", opacity:creatingKP?0.7:1 }}>
                    {creatingKP?"Creating...":"Create & Download .pem"}
                  </button>
                </div>
                <div style={{ fontSize:"11px", color:muted, marginTop:"8px" }}>The .pem private key will automatically download to your browser. Store it securely — it cannot be retrieved again.</div>
              </div>

              <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden" }}>
                <div style={{ padding:"14px 20px", borderBottom:"1px solid "+border, fontSize:"13px", fontWeight:"600", color:text }}>Key Pairs in {region} ({keypairs.length})</div>
                {keypairs.length===0 ? (
                  <div style={{ padding:"32px", textAlign:"center", color:muted }}>No key pairs found in this region</div>
                ) : (
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead><tr style={{ background:subtle }}>{["Name","ID","Type","Actions"].map(h=><th key={h} style={{ padding:"8px 16px", textAlign:"left", fontSize:"10px", fontWeight:"600", color:muted, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {keypairs.map((kp,i)=>(
                        <tr key={i} style={{ borderTop:"1px solid "+border }}
                          onMouseEnter={e=>e.currentTarget.style.background=dark?"#ffffff04":"#f8fafc"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"12px 16px", fontSize:"13px", fontWeight:"600", color:text }}>{kp.name}</td>
                          <td style={{ padding:"12px 16px", fontSize:"11px", fontFamily:"monospace", color:muted }}>{kp.id}</td>
                          <td style={{ padding:"12px 16px", fontSize:"11px", color:muted }}>{kp.type||"rsa"}</td>
                          <td style={{ padding:"12px 16px" }}>
                            <button onClick={()=>handleDeleteKP(kp.name)} style={{ padding:"3px 10px", borderRadius:"6px", fontSize:"11px", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Role Modal */}
      {showCreate && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:"16px" }}>
          <div style={{ background:surface, borderRadius:"14px", border:"1px solid "+border, width:"100%", maxWidth:"480px" }}>
            <div style={{ padding:"18px 24px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between" }}>
              <div style={{ fontSize:"16px", fontWeight:"600", color:text }}>Create IAM Role</div>
              <button onClick={()=>setCreate(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"20px", color:muted }}>x</button>
            </div>
            <div style={{ padding:"18px 24px", display:"flex", flexDirection:"column", gap:"14px" }}>
              {error && <div style={{ background:"#f43f5e15", color:"#f43f5e", padding:"10px", borderRadius:"8px", fontSize:"13px" }}>{error}</div>}
              <div>
                <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Role name</label>
                <input style={inp} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="eks-cluster-role" />
              </div>
              <div>
                <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"8px" }}>Role type</label>
                {ROLE_TYPES.map(rt=>(
                  <div key={rt.id} onClick={()=>setForm(p=>({...p,role_type:rt.id}))}
                    style={{ padding:"12px 14px", borderRadius:"8px", cursor:"pointer", border:"1px solid "+(form.role_type===rt.id?rt.color+"40":border), background:form.role_type===rt.id?rt.color+"10":"transparent", marginBottom:"6px" }}>
                    <div style={{ fontSize:"13px", fontWeight:"600", color:form.role_type===rt.id?rt.color:text }}>{rt.label}</div>
                    <div style={{ fontSize:"11px", color:muted, marginTop:"2px" }}>{rt.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding:"14px 24px", borderTop:"1px solid "+border, display:"flex", justifyContent:"flex-end", gap:"10px" }}>
              <button onClick={()=>setCreate(false)} style={{ padding:"8px 16px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid "+border, background:"transparent", color:text }}>Cancel</button>
              <button onClick={handleCreateRole} disabled={creating} style={{ padding:"8px 16px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#f59e0b", color:"#fff", opacity:creating?0.7:1 }}>{creating?"Creating...":"Create Role"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
