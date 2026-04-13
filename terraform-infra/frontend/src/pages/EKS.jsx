import { useState, useEffect, useCallback } from "react"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"
import { setupEKSRoles } from "../api/api"

const K8S_VERSIONS    = ["1.35","1.34","1.33","1.32"]
const REGIONS         = ["ap-south-1","us-east-1","us-east-2","eu-west-1","ap-southeast-1"]
const INSTANCE_TYPES  = [
  { type:"t3.medium",  vcpu:2, ram:"4 GiB",  desc:"Dev/test" },
  { type:"t3.large",   vcpu:2, ram:"8 GiB",  desc:"Small" },
  { type:"t3.xlarge",  vcpu:4, ram:"16 GiB", desc:"Medium" },
  { type:"m5.large",   vcpu:2, ram:"8 GiB",  desc:"General" },
  { type:"m5.xlarge",  vcpu:4, ram:"16 GiB", desc:"General" },
  { type:"m5.2xlarge", vcpu:8, ram:"32 GiB", desc:"Large" },
  { type:"c5.large",   vcpu:2, ram:"4 GiB",  desc:"Compute" },
  { type:"c5.xlarge",  vcpu:4, ram:"8 GiB",  desc:"Compute" },
]

const STATUS_COLORS = {
  pending:      "#f59e0b",
  provisioning: "#a78bfa",
  completed:    "#00d4aa",
  failed:       "#f43f5e",
  rejected:     "#64748b",
  ACTIVE:       "#00d4aa",
  CREATING:     "#3b82f6",
  DELETING:     "#f43f5e",
  FAILED:       "#f43f5e",
}

export default function EKS() {
  const { dark } = useTheme()
  const [requests,    setRequests]    = useState([])
  const [clusters,    setClusters]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [success,        setSuccess]        = useState("")
  const [error,          setError]          = useState("")
  const [prereqs,        setPrereqs]        = useState(null)
  const [settingUpRoles, setSettingUpRoles] = useState(false)
  const [setupResult,    setSetupResult]    = useState(null)
  const [form, setForm] = useState({
    name: "", region: "ap-south-1",
    kubernetes_version: "1.32",
    node_instance_type: "t3.medium",
    node_count: 2, min_nodes: 1, max_nodes: 5,
    cluster_role_arn: "", node_role_arn: "",
    subnet_ids: [],
    tags: { project: "", owner: "", environment: "dev" },
  })

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const inp     = { padding:"8px 12px", border:"1px solid "+border, borderRadius:"8px", fontSize:"13px", width:"100%", background:surface, color:text }

  const fetchData = useCallback(async () => {
    try {
      const [reqRes, clsRes] = await Promise.allSettled([
        api.get("/requests"),
        api.get("/eks/clusters"),
      ])
      if (reqRes.status === "fulfilled") {
        setRequests(reqRes.value.data.filter(r => r.resource_type === "eks"))
      }
      if (clsRes.status === "fulfilled") {
        setClusters(clsRes.value.data)
      }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const id = setInterval(fetchData, 15000)
    return () => clearInterval(id)
  }, [fetchData])

  async function loadPrereqs(region) {
    try {
      const { data } = await api.get(`/eks/prerequisites?region=${region}`)
      setPrereqs(data)
      setSetupResult(null)
      setForm(p => ({
        ...p,
        cluster_role_arn: data.cluster_roles?.[0]?.arn || "",
        node_role_arn:    data.node_roles?.[0]?.arn    || "",
      }))
    } catch(e) { console.error("Prereqs load failed:", e) }
  }

  async function handleSetupRoles() {
    setSettingUpRoles(true)
    setSetupResult(null)
    try {
      const { data } = await setupEKSRoles()
      setSetupResult(data.roles)
      // Reload prereqs so dropdowns populate with the new roles
      await loadPrereqs(form.region)
    } catch(e) {
      setSetupResult([{ name: "Error", status: e.response?.data?.detail || e.message }])
    } finally {
      setSettingUpRoles(false)
    }
  }

  function openModal() {
    setShowModal(true)
    setError("")
    loadPrereqs(form.region)
  }

  function toggleSubnet(id) {
    setForm(p => ({
      ...p,
      subnet_ids: p.subnet_ids.includes(id)
        ? p.subnet_ids.filter(s => s !== id)
        : [...p.subnet_ids, id],
    }))
  }

  async function handleSubmit() {
    if (!form.name.trim())           { setError("Cluster name required"); return }
    if (!form.cluster_role_arn)      { setError("Cluster IAM Role ARN required"); return }
    if (!form.node_role_arn)         { setError("Node IAM Role ARN required"); return }
    if (form.subnet_ids.length < 2)  { setError("Select at least 2 subnets in different AZs"); return }
    if (!form.tags.project.trim())   { setError("Project tag required"); return }
    if (!form.tags.owner.trim())     { setError("Owner tag required"); return }

    setSubmitting(true); setError("")
    try {
      await api.post("/requests", {
        resource_name: form.name,
        resource_type: "eks",
        region:        form.region,
        payload: {
          name:               form.name,
          region:             form.region,
          kubernetes_version: form.kubernetes_version,
          node_instance_type: form.node_instance_type,
          node_count:         form.node_count,
          min_nodes:          form.min_nodes,
          max_nodes:          form.max_nodes,
          cluster_role_arn:   form.cluster_role_arn,
          node_role_arn:      form.node_role_arn,
          subnet_ids:         form.subnet_ids,
          tags:               form.tags,
        },
      })
      setSuccess(`EKS cluster "${form.name}" submitted — pending admin approval`)
      setShowModal(false)
      setForm({ name:"", region:"ap-south-1", kubernetes_version:"1.29", node_instance_type:"t3.medium", node_count:2, min_nodes:1, max_nodes:5, cluster_role_arn:"", node_role_arn:"", subnet_ids:[], tags:{ project:"", owner:"", environment:"dev" } })
      fetchData()
      setTimeout(() => setSuccess(""), 8000)
    } catch(e) { setError(e.response?.data?.detail || e.message) }
    finally { setSubmitting(false) }
  }

  const counts = {
    pending:      requests.filter(r => r.status === "pending").length,
    provisioning: requests.filter(r => r.status === "provisioning").length,
    completed:    requests.filter(r => r.status === "completed").length,
    failed:       requests.filter(r => r.status === "failed").length,
  }

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh" }}>
      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}"}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px" }}>
        <div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0 }}>EKS Clusters</h1>
          <p style={{ fontSize:"13px", color:muted, marginTop:"4px" }}>
            Managed Kubernetes via Terraform approval pipeline
          </p>
        </div>
        <button onClick={openModal}
          style={{ padding:"10px 20px", borderRadius:"10px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e" }}>
          + Request Cluster
        </button>
      </div>

      {success && <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", color:"#00d4aa", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{success}</div>}
      {error   && <div style={{ background:"#f43f5e15", border:"1px solid #f43f5e30", color:"#f43f5e", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{error}</div>}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
        {[
          { label:"Pending",      value:counts.pending,      color:"#f59e0b" },
          { label:"Provisioning", value:counts.provisioning, color:"#a78bfa" },
          { label:"Completed",    value:counts.completed,    color:"#00d4aa" },
          { label:"Live Clusters",value:clusters.length,     color:"#3b82f6" },
        ].map(s => (
          <div key={s.label} style={{ background:surface, border:"1px solid "+border, borderLeft:"3px solid "+s.color, borderRadius:"12px", padding:"16px" }}>
            <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"6px" }}>{s.label}</div>
            <div style={{ fontSize:"24px", fontWeight:"700", color:text }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pipeline info */}
      <div style={{ background:"#3b82f610", border:"1px solid #3b82f630", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", fontSize:"12px", color:"#3b82f6" }}>
        <strong>Pipeline:</strong> Submit Request → Admin Approves → terraform init → terraform plan → terraform apply → Cluster Ready
      </div>

      {loading ? (
        <div style={{ padding:"48px", textAlign:"center", color:muted }}>Loading...</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>

          {/* Pending requests */}
          {requests.length > 0 && (
            <div>
              <div style={{ fontSize:"13px", fontWeight:"600", color:muted, marginBottom:"10px", textTransform:"uppercase", letterSpacing:"0.06em" }}>
                Requests ({requests.length})
              </div>
              {requests.map(req => {
                const sc = STATUS_COLORS[req.status] || "#64748b"
                return (
                  <div key={req.id} style={{ background:surface, border:"1px solid "+border, borderLeft:"3px solid "+sc, borderRadius:"12px", padding:"16px 20px", marginBottom:"8px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"4px" }}>
                          <span style={{ fontSize:"14px", fontWeight:"600", color:text }}>⚙️ {req.resource_name}</span>
                          <span style={{ background:sc+"20", color:sc, padding:"2px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600" }}>{req.status}</span>
                          {req.status === "provisioning" && (
                            <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:sc, animation:"pulse 1.5s infinite" }} />
                          )}
                        </div>
                        <div style={{ fontSize:"12px", color:muted }}>
                          {req.region} · Submitted by {req.username} · #{req.id}
                        </div>
                      </div>
                      <div style={{ fontSize:"11px", color:muted, textAlign:"right" }}>
                        {req.status === "pending" && <div style={{ color:"#f59e0b" }}>⏳ Awaiting approval</div>}
                        {req.status === "provisioning" && <div style={{ color:"#a78bfa" }}>🔄 Terraform running...</div>}
                        {req.status === "completed" && <div style={{ color:"#00d4aa" }}>✓ Cluster created</div>}
                        {req.status === "failed" && <div style={{ color:"#f43f5e" }}>✗ Failed</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Live clusters */}
          {clusters.length > 0 && (
            <div>
              <div style={{ fontSize:"13px", fontWeight:"600", color:muted, marginBottom:"10px", textTransform:"uppercase", letterSpacing:"0.06em" }}>
                Live Clusters ({clusters.length})
              </div>
              {clusters.map((c, i) => {
                const sc = STATUS_COLORS[c.status] || "#64748b"
                return (
                  <div key={i} style={{ background:surface, border:"1px solid "+border, borderRadius:"12px", padding:"16px 20px", marginBottom:"8px" }}>
                    {/* Cluster header */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ display:"flex", gap:"14px", alignItems:"center" }}>
                        <div style={{ width:"40px", height:"40px", borderRadius:"10px", background:"#00d4aa20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px" }}>⚙️</div>
                        <div>
                          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px", flexWrap:"wrap" }}>
                            <span style={{ fontSize:"14px", fontWeight:"700", color:text }}>{c.name}</span>
                            <span style={{ background:sc+"20", color:sc, padding:"2px 8px", borderRadius:"10px", fontSize:"11px", fontWeight:"600" }}>{c.status}</span>
                            <span style={{ background:"#3b82f620", color:"#3b82f6", padding:"2px 8px", borderRadius:"10px", fontSize:"11px" }}>K8s {c.version}</span>
                            <span style={{ background:"#a78bfa20", color:"#a78bfa", padding:"2px 8px", borderRadius:"10px", fontSize:"11px" }}>
                              {c.total_nodes || 0} nodes
                            </span>
                          </div>
                          <div style={{ fontSize:"12px", color:muted }}>
                            📍 {c.region}
                            {c.endpoint && <span style={{ marginLeft:"8px", fontFamily:"monospace", fontSize:"11px" }}>🔗 {c.endpoint?.slice(0,50)}...</span>}
                          </div>
                        </div>
                      </div>
                      {c.status === "CREATING" && (
                        <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#3b82f6", animation:"pulse 1.5s infinite", marginTop:"6px" }} />
                      )}
                    </div>

                    {/* Node groups */}
                    {c.node_groups && c.node_groups.length > 0 ? (
                      <div style={{ marginTop:"14px", paddingTop:"14px", borderTop:"1px solid "+border }}>
                        <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"8px" }}>
                          Node Groups ({c.node_groups.length})
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                          {c.node_groups.map((ng, ni) => {
                            const ngColor = STATUS_COLORS[ng.status] || "#64748b"
                            return (
                              <div key={ni} style={{ background:subtle, border:"1px solid "+border, borderRadius:"8px", padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"8px" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                                  <span style={{ fontSize:"13px" }}>🖥</span>
                                  <div>
                                    <div style={{ fontSize:"13px", fontWeight:"600", color:text }}>{ng.name}</div>
                                    <div style={{ fontSize:"11px", color:muted }}>{ng.instance_type} · {ng.capacity_type || "ON_DEMAND"}</div>
                                  </div>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
                                  <span style={{ background:ngColor+"20", color:ngColor, padding:"2px 8px", borderRadius:"8px", fontSize:"11px", fontWeight:"600" }}>{ng.status}</span>
                                  <div style={{ fontSize:"12px", color:muted }}>
                                    Desired <strong style={{ color:text }}>{ng.desired}</strong>
                                    <span style={{ margin:"0 4px" }}>·</span>
                                    Min <strong style={{ color:text }}>{ng.min}</strong>
                                    <span style={{ margin:"0 4px" }}>·</span>
                                    Max <strong style={{ color:text }}>{ng.max}</strong>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : c.status === "ACTIVE" ? (
                      <div style={{ marginTop:"10px", paddingTop:"10px", borderTop:"1px solid "+border, fontSize:"12px", color:muted }}>
                        No node groups found — they may still be provisioning. Refreshing every 15s.
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {requests.length === 0 && clusters.length === 0 && (
            <div style={{ background:surface, border:"1px solid "+border, borderRadius:"16px", padding:"64px", textAlign:"center" }}>
              <div style={{ fontSize:"48px", marginBottom:"16px" }}>⚙️</div>
              <div style={{ fontSize:"18px", fontWeight:"600", color:text, marginBottom:"8px" }}>No EKS Clusters</div>
              <div style={{ fontSize:"13px", color:muted, marginBottom:"24px" }}>Request a cluster — admin approves — Terraform provisions it</div>
              <button onClick={openModal}
                style={{ padding:"10px 24px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e" }}>
                Request First Cluster
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"16px" }}>
          <div style={{ background:surface, borderRadius:"18px", border:"1px solid "+border, width:"100%", maxWidth:"620px", maxHeight:"90vh", overflow:"auto" }}>

            <div style={{ padding:"20px 24px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:"17px", fontWeight:"700", color:text }}>Request EKS Cluster</div>
                <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Submits for admin approval → Terraform provisions</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"22px", color:muted }}>✕</button>
            </div>

            <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:"16px" }}>
              {error && <div style={{ background:"#f43f5e15", color:"#f43f5e", padding:"10px", borderRadius:"8px", fontSize:"13px" }}>{error}</div>}

              {/* Basic */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
                <div>
                  <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Cluster Name *</label>
                  <input style={inp} placeholder="my-cluster" value={form.name}
                    onChange={e => setForm(p => ({...p, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")}))} />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Region</label>
                  <select style={inp} value={form.region} onChange={e => { setForm(p=>({...p,region:e.target.value,subnet_ids:[]})); loadPrereqs(e.target.value) }}>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* K8s version */}
              <div>
                <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"6px" }}>Kubernetes Version</label>
                <div style={{ display:"flex", gap:"8px" }}>
                  {K8S_VERSIONS.map(v => (
                    <button key={v} onClick={() => setForm(p=>({...p,kubernetes_version:v}))}
                      style={{ flex:1, padding:"8px", borderRadius:"8px", cursor:"pointer", border:"1px solid "+(form.kubernetes_version===v?"#00d4aa40":border), background:form.kubernetes_version===v?"#00d4aa15":surface, color:form.kubernetes_version===v?"#00d4aa":text, fontWeight:"600", fontSize:"12px" }}>
                      {v}
                      <div style={{ fontSize:"9px", fontWeight:"400", color:form.kubernetes_version===v?"#00d4aa":muted, marginTop:"2px" }}>
                        {v==="1.35"?"latest":""}{v==="1.32"?"LTS":""}
                        {" Standard"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Setup EKS Roles banner — shown when no eligible roles exist yet */}
              {prereqs && prereqs.cluster_roles?.length === 0 && prereqs.node_roles?.length === 0 && (
                <div style={{ background:"#f59e0b10", border:"1px solid #f59e0b40", borderRadius:"10px", padding:"14px 16px" }}>
                  <div style={{ fontSize:"13px", fontWeight:"600", color:"#f59e0b", marginBottom:"6px" }}>
                    No EKS IAM roles found in your account
                  </div>
                  <div style={{ fontSize:"12px", color:muted, marginBottom:"10px" }}>
                    You need an EKS cluster role (<code>AmazonEKSClusterPolicy</code>) and a node role (<code>AmazonEKSWorkerNodePolicy</code>).
                    Click below to create both automatically.
                  </div>
                  {setupResult && (
                    <div style={{ marginBottom:"10px", display:"flex", flexDirection:"column", gap:"4px" }}>
                      {setupResult.map((r, i) => (
                        <div key={i} style={{ fontSize:"11px", fontFamily:"monospace", color: r.status === "created" ? "#00d4aa" : r.status === "already_exists" ? "#3b82f6" : "#f43f5e" }}>
                          {r.status === "created" ? "✓ Created: " : r.status === "already_exists" ? "— Exists: " : "✗ "}{r.name}
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={handleSetupRoles} disabled={settingUpRoles} style={{
                    padding:"8px 16px", borderRadius:"8px", fontSize:"12px", fontWeight:"600",
                    border:"none", background:"#f59e0b", color:"#0a0f1e", cursor:"pointer", opacity: settingUpRoles ? 0.7 : 1
                  }}>
                    {settingUpRoles ? "Creating roles…" : "Create EKS IAM Roles"}
                  </button>
                </div>
              )}

              {/* IAM Roles */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
                <div>
                  <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Cluster Role ARN *</label>
                  {prereqs?.cluster_roles?.length > 0 ? (
                    <select style={inp} value={form.cluster_role_arn} onChange={e=>setForm(p=>({...p,cluster_role_arn:e.target.value}))}>
                      <option value="">Select cluster role...</option>
                      {prereqs.cluster_roles.map(r=><option key={r.arn} value={r.arn}>{r.name}</option>)}
                    </select>
                  ) : (
                    <input style={inp} placeholder="arn:aws:iam::xxx:role/eks-cluster-role" value={form.cluster_role_arn} onChange={e=>setForm(p=>({...p,cluster_role_arn:e.target.value}))} />
                  )}
                </div>
                <div>
                  <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Node Role ARN *</label>
                  {prereqs?.node_roles?.length > 0 ? (
                    <select style={inp} value={form.node_role_arn} onChange={e=>setForm(p=>({...p,node_role_arn:e.target.value}))}>
                      <option value="">Select node role...</option>
                      {prereqs.node_roles.map(r=><option key={r.arn} value={r.arn}>{r.name}</option>)}
                    </select>
                  ) : (
                    <input style={inp} placeholder="arn:aws:iam::xxx:role/eks-node-role" value={form.node_role_arn} onChange={e=>setForm(p=>({...p,node_role_arn:e.target.value}))} />
                  )}
                </div>
              </div>

              {/* Subnets */}
              <div>
                <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"5px" }}>Subnets * (select 2+ in different AZs)</label>
                {prereqs?.subnets?.length > 0 ? (
                  <div style={{ border:"1px solid "+border, borderRadius:"8px", padding:"8px", maxHeight:"150px", overflowY:"auto" }}>
                    {prereqs.subnets.map(s => (
                      <label key={s.id} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"6px 8px", borderRadius:"6px", cursor:"pointer", background:form.subnet_ids.includes(s.id)?"#00d4aa10":"transparent" }}>
                        <input type="checkbox" checked={form.subnet_ids.includes(s.id)} onChange={() => toggleSubnet(s.id)} />
                        <span style={{ fontSize:"12px", color:text }}>{s.name || s.id}</span>
                        <span style={{ fontSize:"11px", color:muted, marginLeft:"auto" }}>{s.az} · {s.cidr}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input style={inp} placeholder="subnet-xxx,subnet-yyy (comma separated)" value={form.subnet_ids.join(",")}
                    onChange={e=>setForm(p=>({...p,subnet_ids:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)}))} />
                )}
              </div>

              {/* Node config */}
              <div style={{ background:subtle, borderRadius:"10px", padding:"14px", border:"1px solid "+border }}>
                <div style={{ fontSize:"13px", fontWeight:"600", color:text, marginBottom:"10px" }}>Node Group</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"6px", marginBottom:"10px" }}>
                  {INSTANCE_TYPES.map(t => (
                    <button key={t.type} onClick={() => setForm(p=>({...p,node_instance_type:t.type}))}
                      style={{ padding:"8px", borderRadius:"8px", cursor:"pointer", border:"1px solid "+(form.node_instance_type===t.type?"#00d4aa40":border), background:form.node_instance_type===t.type?"#00d4aa15":surface, textAlign:"left" }}>
                      <div style={{ fontSize:"11px", fontWeight:"600", color:form.node_instance_type===t.type?"#00d4aa":text }}>{t.type}</div>
                      <div style={{ fontSize:"10px", color:muted }}>{t.vcpu} CPU / {t.ram}</div>
                    </button>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px" }}>
                  {[["node_count","Desired",2],["min_nodes","Min",1],["max_nodes","Max",5]].map(([k,l,ph]) => (
                    <div key={k}>
                      <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"4px" }}>{l} nodes</label>
                      <input type="number" style={inp} value={form[k]} min={1} max={20}
                        onChange={e=>setForm(p=>({...p,[k]:parseInt(e.target.value)||1}))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                <div>
                  <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"4px" }}>Project *</label>
                  <input style={inp} placeholder="my-project" value={form.tags.project} onChange={e=>setForm(p=>({...p,tags:{...p.tags,project:e.target.value}}))} />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"4px" }}>Owner *</label>
                  <input style={inp} placeholder="your-name" value={form.tags.owner} onChange={e=>setForm(p=>({...p,tags:{...p.tags,owner:e.target.value}}))} />
                </div>
              </div>

              {/* Environment */}
              <div>
                <label style={{ display:"block", fontSize:"12px", color:muted, marginBottom:"6px" }}>Environment *</label>
                <div style={{ display:"flex", gap:"8px" }}>
                  {["dev","staging","prod"].map(env => (
                    <button key={env} type="button"
                      onClick={() => setForm(p=>({...p, tags:{...p.tags, environment:env}}))}
                      style={{ flex:1, padding:"8px", borderRadius:"8px", cursor:"pointer", fontSize:"12px", fontWeight:"600",
                        border:"1px solid "+(form.tags.environment===env?"#00d4aa40":border),
                        background: form.tags.environment===env?"#00d4aa15":surface,
                        color:       form.tags.environment===env?"#00d4aa":muted }}>
                      {env}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:"11px", color:muted, marginTop:"4px" }}>Cluster will be provisioned in this environment workspace.</div>
              </div>

              <div style={{ background:"#f59e0b10", border:"1px solid #f59e0b30", borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color:"#f59e0b" }}>
                ⚠ This request requires admin approval before Terraform provisions the cluster. EKS takes 10–15 minutes to create.
              </div>
            </div>

            <div style={{ padding:"16px 24px", borderTop:"1px solid "+border, display:"flex", justifyContent:"flex-end", gap:"10px" }}>
              <button onClick={() => setShowModal(false)} style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid "+border, background:"transparent", color:text }}>Cancel</button>
              <button onClick={handleSubmit} disabled={submitting}
                style={{ padding:"9px 20px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e", opacity:submitting?0.7:1 }}>
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}