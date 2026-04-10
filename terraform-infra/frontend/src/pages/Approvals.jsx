import { useState, useEffect, useCallback } from "react"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"

const STATUS_COLORS = {
  pending:      "#f59e0b",
  plan_ready:   "#3b82f6",
  plan_failed:  "#f43f5e",
  provisioning: "#a78bfa",
  completed:    "#00d4aa",
  failed:       "#f43f5e",
  rejected:     "#64748b",
  generating:   "#a78bfa",
  initializing: "#a78bfa",
  validating:   "#3b82f6",
  planning:     "#f59e0b",
}

function timeAgo(iso) {
  if (!iso) return "--"
  const d = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (d < 1)    return "just now"
  if (d < 60)   return `${d}m ago`
  if (d < 1440) return `${Math.floor(d/60)}h ago`
  return `${Math.floor(d/1440)}d ago`
}

export default function Approvals() {
  const { dark } = useTheme()
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState("pending")
  const [selected, setSelected] = useState(null)
  const [tfPreview, setTFPreview]= useState("")
  const [planOutput, setPlanOut] = useState("")
  const [planLoading, setPlanL] = useState(false)
  const [submitting, setSub]    = useState(false)
  const [note, setNote]         = useState("")
  const [success, setSuccess]   = useState("")
  const [error, setError]       = useState("")
  const [activeTab, setActiveTab]= useState("details")

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const inp     = { padding:"8px 12px", border:"1px solid "+border, borderRadius:"8px", fontSize:"13px", width:"100%", background:surface, color:text }

  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/requests")
      setRequests(data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])
  useEffect(() => {
    const id = setInterval(fetchRequests, 15000)
    return () => clearInterval(id)
  }, [fetchRequests])

  async function loadTFPreview(req) {
    setSelected(req)
    setTFPreview("")
    setPlanOut("")
    setActiveTab("details")
    try {
      const { data } = await api.get(`/terraform/${req.id}/preview`)
      setTFPreview(data.content || "")
    } catch(e) { setTFPreview("Preview not available") }
  }

  async function handlePlan() {
    if (!selected) return
    setPlanL(true); setError(""); setPlanOut("")
    try {
      const { data } = await api.post(`/terraform/${selected.id}/plan`)
      setPlanOut(data.output || data.error || "")
      setActiveTab("plan")
      fetchRequests()
      if (data.success) {
        setSuccess("Plan ready — review and approve")
        setTimeout(() => setSuccess(""), 4000)
      }
    } catch(e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setPlanL(false)
    }
  }

  async function handleApprove() {
    if (!selected) return
    setSub(true); setError("")
    try {
      await api.patch(`/requests/${selected.id}/approve`, { note })
      setSuccess(`Terraform apply started for ${selected.resource_name}`)
      setSelected(null)
      setNote("")
      fetchRequests()
      setTimeout(() => setSuccess(""), 6000)
    } catch(e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setSub(false)
    }
  }

  async function handleReject() {
    if (!selected) return
    setSub(true); setError("")
    try {
      await api.patch(`/requests/${selected.id}/reject`, { note })
      setSuccess(`Request ${selected.resource_name} rejected`)
      setSelected(null)
      setNote("")
      fetchRequests()
      setTimeout(() => setSuccess(""), 3000)
    } catch(e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setSub(false)
    }
  }

  const filtered = requests.filter(r =>
    filter === "all" ? true : r.status === filter
  )

  const counts = {
    pending:      requests.filter(r => r.status === "pending").length,
    plan_ready:   requests.filter(r => r.status === "plan_ready").length,
    provisioning: requests.filter(r => r.status === "provisioning").length,
    completed:    requests.filter(r => r.status === "completed").length,
    failed:       requests.filter(r => r.status === "failed").length,
  }

  // Terraform pipeline steps for the details tab
  const pipelineSteps = (s) => [
    { label:"1. Preview .tf file",       done: true },
    { label:"2. Admin approves",          done: ["generating","initializing","validating","planning","provisioning","completed"].includes(s) },
    { label:"3. terraform init",          done: ["initializing","validating","planning","provisioning","completed"].includes(s), active: s === "initializing" },
    { label:"4. terraform validate",      done: ["validating","planning","provisioning","completed"].includes(s),                active: s === "validating" },
    { label:"5. terraform plan",          done: ["planning","provisioning","completed"].includes(s),                            active: s === "planning" },
    { label:"6. terraform apply",         done: s === "completed",                                                              active: s === "provisioning" },
    { label:"7. Resource created on AWS", done: s === "completed" },
  ]

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh" }}>
      <div style={{ marginBottom:"24px" }}>
        <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0 }}>Approvals</h1>
        <p style={{ fontSize:"13px", color:muted, marginTop:"4px" }}>
          Review terraform plans before approving resource creation
        </p>
      </div>

      {success && <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", color:"#00d4aa", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{success}</div>}
      {error   && <div style={{ background:"#f43f5e15", border:"1px solid #f43f5e30", color:"#f43f5e", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{error}</div>}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"12px", marginBottom:"20px" }}>
        {Object.entries(counts).map(([k,v]) => (
          <div key={k} onClick={() => setFilter(k)} style={{ background:surface, border:"1px solid "+(filter===k ? STATUS_COLORS[k]+"50" : border), borderLeft:"3px solid "+(STATUS_COLORS[k]||"#64748b"), borderRadius:"10px", padding:"14px", cursor:"pointer" }}>
            <div style={{ fontSize:"10px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{k.replace("_"," ")}</div>
            <div style={{ fontSize:"24px", fontWeight:"700", color:STATUS_COLORS[k]||text, marginTop:"4px" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"16px" }}>
        {["all","pending","plan_ready","provisioning","completed","failed","rejected"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:"6px 14px", borderRadius:"8px", fontSize:"12px", fontWeight:"500", cursor:"pointer", border:"1px solid "+(filter===f?"#3b82f640":border), background:filter===f?"#3b82f615":surface, color:filter===f?"#3b82f6":muted }}>
            {f.replace("_"," ")}
          </button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.6fr", gap:"16px" }}>
        {/* Left — Request list */}
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid "+border, fontSize:"13px", fontWeight:"600", color:text }}>
            Requests ({filtered.length})
          </div>
          {loading ? (
            <div style={{ padding:"32px", textAlign:"center", color:muted }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center", color:muted }}>No requests</div>
          ) : (
            <div style={{ maxHeight:"600px", overflowY:"auto" }}>
              {filtered.map(req => {
                const sc = STATUS_COLORS[req.status] || "#64748b"
                const isSelected = selected?.id === req.id
                return (
                  <div key={req.id} onClick={() => loadTFPreview(req)}
                    style={{ padding:"14px 16px", borderBottom:"1px solid "+border, cursor:"pointer", background:isSelected?(dark?sc+"10":sc+"08"):"transparent", borderLeft:isSelected?`3px solid ${sc}`:"3px solid transparent" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" }}>
                      <div>
                        <div style={{ fontSize:"13px", fontWeight:"600", color:text }}>{req.resource_name}</div>
                        <div style={{ fontSize:"11px", color:muted, marginTop:"2px" }}>
                          {req.resource_type?.toUpperCase()} · {req.region} · by {req.username}
                        </div>
                      </div>
                      <span style={{ background:sc+"20", color:sc, padding:"2px 8px", borderRadius:"10px", fontSize:"10px", fontWeight:"600", whiteSpace:"nowrap" }}>{req.status}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:"10px", color:muted }}>
                      <span>{req.instance_type}</span>
                      <span>{timeAgo(req.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right — Detail panel */}
        {selected ? (
          <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", borderBottom:"1px solid "+border }}>
              <div style={{ fontSize:"16px", fontWeight:"700", color:text }}>{selected.resource_name}</div>
              <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>
                {selected.resource_type?.toUpperCase()} · {selected.region} · Submitted by {selected.username} · {timeAgo(selected.created_at)}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ padding:"0 20px", borderBottom:"1px solid "+border, display:"flex", gap:"4px" }}>
              {[["details","Details"],["tf","Terraform Plan"],["plan","Plan Output"]].map(([id,label]) => (
                <button key={id} onClick={() => setActiveTab(id)} style={{ padding:"8px 14px", borderRadius:"8px", fontSize:"12px", fontWeight:"500", cursor:"pointer", border:"none", background:activeTab===id?"#3b82f620":"transparent", color:activeTab===id?"#3b82f6":muted }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ padding:"16px 20px" }}>
              {/* DETAILS TAB */}
              {activeTab==="details" && (
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"16px" }}>
                    {[
                      ["Request ID",    `#${selected.id}`],
                      ["Status",        selected.status],
                      ["Resource Type", selected.resource_type],
                      ["Region",        selected.region],
                      ["Instance Type", selected.instance_type || "--"],
                      ["AMI",           selected.ami_id || "--"],
                      ["Key Pair",      selected.key_name || "--"],
                      ["Subnet",        selected.subnet_id || "Default"],
                      ["Project",       selected.tags?.project || "--"],
                      ["Owner",         selected.tags?.owner || "--"],
                      ["Environment",   selected.tags?.environment || "--"],
                      ["Instance ID",   selected.instance_id || "Not created yet"],
                    ].map(([k,v]) => (
                      <div key={k} style={{ background:subtle, borderRadius:"8px", padding:"10px 12px" }}>
                        <div style={{ fontSize:"10px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"3px" }}>{k}</div>
                        <div style={{ fontSize:"12px", fontWeight:"600", color:text, wordBreak:"break-all" }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Terraform pipeline steps */}
                  <div style={{ background:"#3b82f610", border:"1px solid #3b82f630", borderRadius:"8px", padding:"12px 14px", marginBottom:"16px" }}>
                    <div style={{ fontWeight:"600", color:"#3b82f6", marginBottom:"8px", fontSize:"12px" }}>Terraform Pipeline</div>
                    {pipelineSteps(selected.status).map(s => (
                      <div key={s.label} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"3px 0", color: s.active ? "#f59e0b" : s.done ? "#00d4aa" : muted }}>
                        <span style={{ fontSize:"14px" }}>{s.active ? "⟳" : s.done ? "✓" : "○"}</span>
                        <span style={{ fontSize:"12px", fontWeight: s.active ? "600" : "400" }}>{s.label}</span>
                        {s.active && <span style={{ fontSize:"10px", color:"#f59e0b" }}>running...</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TF FILE TAB */}
              {activeTab==="tf" && (
                <div>
                  <div style={{ fontSize:"12px", color:muted, marginBottom:"8px" }}>Generated Terraform configuration:</div>
                  <pre style={{ background:dark?"#0a0f1e":"#f0fdf4", border:"1px solid "+(dark?"#00d4aa20":"#00d4aa30"), borderRadius:"8px", padding:"14px", fontSize:"11px", color:"#00d4aa", fontFamily:"monospace", overflowX:"auto", maxHeight:"300px", overflowY:"auto", margin:0, lineHeight:"1.5", whiteSpace:"pre-wrap" }}>
                    {tfPreview || "Loading..."}
                  </pre>
                </div>
              )}

              {/* PLAN OUTPUT TAB */}
              {activeTab==="plan" && (
                <div>
                  {planOutput ? (
                    <pre style={{ background:dark?"#0a0f1e":"#f8fafc", border:"1px solid "+border, borderRadius:"8px", padding:"14px", fontSize:"11px", color:text, fontFamily:"monospace", overflowX:"auto", maxHeight:"300px", overflowY:"auto", margin:0, lineHeight:"1.5", whiteSpace:"pre-wrap" }}>
                      {planOutput}
                    </pre>
                  ) : (
                    <div style={{ padding:"32px", textAlign:"center", color:muted }}>
                      <div style={{ fontSize:"32px", marginBottom:"10px" }}>📋</div>
                      Run terraform plan first to see output
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            {["pending","plan_ready","plan_failed","failed"].includes(selected.status) && (
              <div style={{ padding:"16px 20px", borderTop:"1px solid "+border, background:subtle }}>
                <div style={{ marginBottom:"10px" }}>
                  <input style={inp} placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)} />
                </div>
                <div style={{ display:"flex", gap:"8px" }}>
                  <button onClick={handleApprove} disabled={submitting} style={{ flex:1, padding:"10px", borderRadius:"8px", fontSize:"13px", fontWeight:"700", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e", opacity:submitting?0.7:1 }}>
                    {submitting ? "Starting pipeline..." : "Approve & Apply"}
                  </button>
                  <button onClick={handleReject} disabled={submitting} style={{ padding:"10px 16px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e", opacity:submitting?0.7:1 }}>
                    Reject
                  </button>
                </div>
                <div style={{ fontSize:"11px", color:muted, marginTop:"8px", textAlign:"center" }}>
                  Clicking Approve will automatically run: init → validate → plan → apply
                </div>
              </div>
            )}

            {selected.status === "provisioning" && (
              <div style={{ padding:"16px 20px", borderTop:"1px solid "+border, background:"#a78bfa10" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", fontSize:"13px", color:"#a78bfa" }}>
                  <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#a78bfa", animation:"pulse 1.5s infinite" }} />
                  Terraform apply running in background... This may take 2–5 minutes
                </div>
              </div>
            )}

            {selected.status === "completed" && (
              <div style={{ padding:"16px 20px", borderTop:"1px solid "+border, background:"#00d4aa10" }}>
                <div style={{ fontSize:"13px", fontWeight:"600", color:"#00d4aa", marginBottom:"6px" }}>Resource Created Successfully</div>
                <div style={{ fontSize:"12px", color:muted }}>
                  Instance ID: <code style={{ color:"#00d4aa" }}>{selected.instance_id || "--"}</code>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", display:"flex", alignItems:"center", justifyContent:"center", minHeight:"400px" }}>
            <div style={{ textAlign:"center", color:muted }}>
              <div style={{ fontSize:"36px", marginBottom:"12px" }}>📋</div>
              <div style={{ fontSize:"14px" }}>Select a request to review</div>
              <div style={{ fontSize:"12px", marginTop:"6px" }}>You can preview the Terraform plan before approving</div>
            </div>
          </div>
        )}
      </div>
      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}"}</style>
    </div>
  )
}