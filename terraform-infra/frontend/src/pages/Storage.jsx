import { useEffect, useState, useCallback } from "react"
import { listBuckets, deleteBucket, listObjects, deleteObject, getDownloadUrl, getS3Stats } from "../api/api"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"

const REGION_LABELS = {
  "ap-south-1":"Mumbai","ap-southeast-1":"Singapore","us-east-1":"N. Virginia",
  "us-east-2":"Ohio","us-west-2":"Oregon","eu-west-1":"Ireland",
  "eu-central-1":"Frankfurt","ap-northeast-1":"Tokyo","sa-east-1":"Sao Paulo",
}

const FILE_ICONS = {
  pdf:"📄", png:"🖼️", jpg:"🖼️", jpeg:"🖼️", gif:"🖼️", mp4:"🎬", mp3:"🎵",
  zip:"🗜️", tar:"🗜️", gz:"🗜️", json:"📋", csv:"📊", xlsx:"📊", txt:"📝",
  js:"⚙️", py:"🐍", sh:"⚙️", tf:"🔧", yml:"⚙️", yaml:"⚙️", folder:"📁",
}

const ALL_REGIONS = [
  "ap-south-1","ap-south-2","ap-southeast-1","ap-southeast-2","ap-northeast-1",
  "ap-northeast-2","us-east-1","us-east-2","us-west-1","us-west-2",
  "eu-west-1","eu-west-2","eu-west-3","eu-central-1","eu-north-1",
  "sa-east-1","ca-central-1","me-south-1","af-south-1",
]

const ENVIRONMENTS = ["dev","staging","prod"]

function formatSize(mb) {
  if (mb < 1) return (mb * 1024).toFixed(1) + " KB"
  if (mb < 1024) return mb.toFixed(2) + " MB"
  return (mb / 1024).toFixed(2) + " GB"
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("en-IN", {
    day:"2-digit", month:"short", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  })
}

const CORRECT_PIN = "AIONOS"

export default function Storage() {
  const { dark } = useTheme()
  const [revealed,       setRevealed]      = useState(false)
  const [pin,            setPin]           = useState("")
  const [pinError,       setPinError]      = useState("")
  const [buckets,        setBuckets]       = useState([])
  const [stats,          setStats]         = useState(null)
  const [selectedBucket, setSel]           = useState(null)
  const [objects,        setObjects]       = useState(null)
  const [prefix,         setPrefix]        = useState("")
  const [loading,        setLoading]       = useState(true)
  const [loadingObjs,    setLoadingObjs]   = useState(false)
  const [showCreate,     setShowCreate]    = useState(false)
  const [actionKey,      setActionKey]     = useState(null)
  const [creating,       setCreating]      = useState(false)
  const [error,          setError]         = useState("")
  const [success,        setSuccess]       = useState("")
  const [submitted,      setSubmitted]     = useState(false) // ← NEW

  // ── Form state with tags ──────────────────────────────────────────────
  const [form, setForm] = useState({
    name:        "",
    region:      "ap-south-1",
    versioning:  false,
    encryption:  "AES256",
    // Tags
    project:     "",
    owner:       "",
    environment: "dev",
  })

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const inp     = {
    padding:"8px 12px", border:"1px solid "+border, borderRadius:"8px",
    fontSize:"13px", width:"100%", background:surface, color:text
  }

  const fetchBuckets = useCallback(async () => {
    try {
      const [bl, sl] = await Promise.all([listBuckets(), getS3Stats()])
      setBuckets(bl.data)
      setStats(sl.data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchBuckets() }, [fetchBuckets])

  async function openBucket(bucket) {
    setSel(bucket); setPrefix(""); setLoadingObjs(true)
    try {
      const { data } = await listObjects(bucket.name, "")
      setObjects(data)
    } catch(e) { console.error(e) }
    finally { setLoadingObjs(false) }
  }

  async function navigatePrefix(p) {
    setPrefix(p); setLoadingObjs(true)
    try {
      const { data } = await listObjects(selectedBucket.name, p)
      setObjects(data)
    } catch(e) { console.error(e) }
    finally { setLoadingObjs(false) }
  }

  async function handleDeleteBucket(name) {
    if (!window.confirm("Delete bucket " + name + "? This will permanently delete all objects inside.")) return
    try {
      await deleteBucket(name, true)
      setSuccess("Bucket " + name + " deleted")
      if (selectedBucket?.name === name) { setSel(null); setObjects(null) }
      fetchBuckets()
      setTimeout(() => setSuccess(""), 3000)
    } catch(e) { setError(e.response?.data?.detail || e.message) }
  }

  async function handleDeleteObject(key) {
    if (!window.confirm("Delete " + key + "?")) return
    setActionKey(key)
    try {
      await deleteObject(selectedBucket.name, key)
      navigatePrefix(prefix)
    } catch(e) { alert(e.response?.data?.detail || e.message) }
    finally { setActionKey(null) }
  }

  async function handleDownload(key) {
    setActionKey(key)
    try {
      const { data } = await getDownloadUrl(selectedBucket.name, key)
      window.open(data.url, "_blank")
    } catch(e) { alert(e.response?.data?.detail || e.message) }
    finally { setActionKey(null) }
  }

  // ── FIXED: Submit as request → pending approval ───────────────────────
  async function handleCreate() {
    if (!form.name.trim()) { setError("Bucket name is required"); return }
    if (!form.project.trim()) { setError("Project name is required"); return }
    if (!form.owner.trim()) { setError("Project owner is required"); return }

    setCreating(true); setError("")
    try {
      await api.post("/requests", {
        resource_name: form.name,
        resource_type: "s3",
        region:        form.region,
        payload: {
          name:              form.name,
          region:            form.region,
          versioning:        form.versioning,
          encryption:        form.encryption,
          tags: {
            project:     form.project,
            owner:       form.owner,
            environment: form.environment,
            CreatedBy:   "AIonOS-Platform",
          }
        }
      })
      setSubmitted(true)  // show success screen
    } catch(e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setForm({ name:"", region:"ap-south-1", versioning:false, encryption:"AES256", project:"", owner:"", environment:"dev" })
    setError("")
    setSubmitted(false)
    setShowCreate(false)
  }

  const breadcrumbs = prefix ? prefix.split("/").filter(Boolean) : []

  // ── PIN GATE ──────────────────────────────────────────────────────────
  if (!revealed) {
    return (
      <div style={{ minHeight:"100vh", background:bg, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"16px", padding:"40px", maxWidth:"400px", width:"100%", textAlign:"center" }}>
          <div style={{ width:"64px", height:"64px", borderRadius:"16px", background:"#f43f5e15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <div style={{ fontSize:"20px", fontWeight:"700", color:text, marginBottom:"8px" }}>Storage Access</div>
          <div style={{ fontSize:"13px", color:muted, marginBottom:"28px" }}>Enter your access code to view S3 buckets</div>
          {pinError && <div style={{ background:"#f43f5e15", color:"#f43f5e", padding:"10px", borderRadius:"8px", fontSize:"13px", marginBottom:"16px" }}>{pinError}</div>}
          <input
            type="password" placeholder="Enter access code" value={pin}
            onChange={e => { setPin(e.target.value.toUpperCase()); setPinError("") }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (pin === CORRECT_PIN) { setRevealed(true); fetchBuckets() }
                else setPinError("Incorrect access code. Try again.")
              }
            }}
            style={{ width:"100%", padding:"12px 16px", border:"1px solid "+border, borderRadius:"10px", fontSize:"15px", background:surface, color:text, textAlign:"center", letterSpacing:"0.2em", marginBottom:"12px", outline:"none" }}
          />
          <button
            onClick={() => {
              if (pin === CORRECT_PIN) { setRevealed(true); fetchBuckets() }
              else setPinError("Incorrect access code. Try again.")
            }}
            style={{ width:"100%", padding:"12px", borderRadius:"10px", background:"#00d4aa", color:"#0a0f1e", border:"none", fontSize:"14px", fontWeight:"600", cursor:"pointer" }}>
            Unlock Storage
          </button>
          <div style={{ fontSize:"11px", color:muted, marginTop:"16px" }}>Hint: company name in capitals</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"all 0.3s ease" }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}"}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", animation:"fadeUp 0.4s ease both" }}>
        <div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>Storage</h1>
          <p style={{ fontSize:"14px", color:muted, marginTop:"4px" }}>
            {stats ? stats.total_buckets + " buckets" : "Amazon S3 Buckets"}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ display:"flex", alignItems:"center", gap:"8px", background:"#00d4aa", color:"#0a0f1e", border:"none", padding:"10px 18px", borderRadius:"10px", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
          + Create Bucket
        </button>
      </div>

      {success && <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", color:"#00d4aa", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{success}</div>}
      {error   && <div style={{ background:"#f43f5e15", border:"1px solid #f43f5e30", color:"#f43f5e", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>
        {error}
        <button onClick={()=>setError("")} style={{ float:"right", background:"none", border:"none", color:"#f43f5e", cursor:"pointer" }}>✕</button>
      </div>}

      {/* Stats */}
      {stats && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
          {[
            { label:"Total Buckets", value:stats.total_buckets,                          color:"#00d4aa" },
            { label:"Total Objects", value:stats.total_objects?.toLocaleString()||"0",   color:"#3b82f6" },
            { label:"Total Size",    value:formatSize(stats.total_size_mb||0),            color:"#a78bfa" },
            { label:"Est. Monthly",  value:"$"+(((stats.total_size_gb||0)*0.023).toFixed(3)), color:"#f59e0b" },
          ].map(({ label, value, color }, i) => (
            <div key={label} style={{ background:surface, border:"1px solid "+border, borderLeft:"3px solid "+color, borderRadius:"12px", padding:"16px", animation:"fadeUp 0.4s ease "+(i*60)+"ms both" }}>
              <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"6px" }}>{label}</div>
              <div style={{ fontSize:"22px", fontWeight:"700", color:text }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:"20px" }}>

        {/* Bucket list */}
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden", animation:"fadeUp 0.4s ease 0.2s both", height:"fit-content" }}>
          <div style={{ padding:"14px 18px", borderBottom:"1px solid "+border, fontSize:"13px", fontWeight:"600", color:text, display:"flex", justifyContent:"space-between" }}>
            <span>S3 Buckets</span>
            <span style={{ fontSize:"11px", color:muted, fontWeight:"400" }}>{buckets.length} total</span>
          </div>
          {loading ? (
            <div style={{ padding:"32px", textAlign:"center", color:muted }}>Loading...</div>
          ) : buckets.length === 0 ? (
            <div style={{ padding:"40px", textAlign:"center" }}>
              <div style={{ fontSize:"32px", marginBottom:"8px" }}>🪣</div>
              <div style={{ fontSize:"13px", color:muted }}>No buckets yet</div>
            </div>
          ) : (
            <div style={{ maxHeight:"600px", overflowY:"auto" }}>
              {buckets.map(b => (
                <div key={b.name} onClick={() => openBucket(b)}
                  style={{ padding:"14px 18px", borderBottom:"1px solid "+border, cursor:"pointer",
                    background: selectedBucket?.name===b.name?(dark?"#00d4aa10":"#f0fdf4"):"transparent",
                    borderLeft: selectedBucket?.name===b.name?"3px solid #00d4aa":"3px solid transparent",
                    transition:"all 0.15s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
                        <span style={{ fontSize:"14px" }}>🪣</span>
                        <span style={{ fontSize:"13px", fontWeight:"600", color:text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.name}</span>
                      </div>
                      <div style={{ fontSize:"11px", color:muted }}>
                        {REGION_LABELS[b.region]||b.region}
                      </div>
                      <div style={{ display:"flex", gap:"4px", marginTop:"4px", flexWrap:"wrap" }}>
                        {b.versioning && <span style={{ fontSize:"10px", background:"#3b82f615", color:"#3b82f6", padding:"1px 6px", borderRadius:"4px" }}>Versioning</span>}
                        {b.encryption && b.encryption !== "none" && <span style={{ fontSize:"10px", background:"#00d4aa15", color:"#00d4aa", padding:"1px 6px", borderRadius:"4px" }}>{b.encryption==="AES256"?"SSE-S3":"SSE-KMS"}</span>}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDeleteBucket(b.name) }}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#f43f5e", padding:"2px 6px", fontSize:"14px", flexShrink:0 }}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Object browser */}
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden", animation:"fadeUp 0.4s ease 0.3s both" }}>
          {!selectedBucket ? (
            <div style={{ padding:"80px", textAlign:"center" }}>
              <div style={{ fontSize:"48px", marginBottom:"12px" }}>🪣</div>
              <div style={{ fontSize:"16px", fontWeight:"500", color:text, marginBottom:"6px" }}>Select a bucket</div>
              <div style={{ fontSize:"13px", color:muted }}>Click a bucket on the left to browse its contents</div>
            </div>
          ) : (
            <>
              <div style={{ padding:"14px 20px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center", background:subtle }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"13px", color:text, flexWrap:"wrap" }}>
                  <span style={{ cursor:"pointer", color:"#00d4aa", fontWeight:"500" }} onClick={() => navigatePrefix("")}>{selectedBucket.name}</span>
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <span style={{ color:muted }}>/</span>
                      <span style={{ cursor:"pointer", color: i===breadcrumbs.length-1?text:"#00d4aa" }}
                        onClick={() => navigatePrefix(breadcrumbs.slice(0,i+1).join("/")+"/")}>
                        {crumb}
                      </span>
                    </span>
                  ))}
                </div>
                <div style={{ fontSize:"12px", color:muted }}>
                  {objects ? objects.folders.length + " folders, " + objects.files.length + " files" : ""}
                </div>
              </div>

              {loadingObjs ? (
                <div style={{ padding:"48px", textAlign:"center", color:muted }}>Loading objects...</div>
              ) : !objects ? null : (objects.folders.length + objects.files.length === 0) ? (
                <div style={{ padding:"64px", textAlign:"center" }}>
                  <div style={{ fontSize:"40px", marginBottom:"8px" }}>📭</div>
                  <div style={{ fontSize:"14px", color:muted }}>Empty {prefix ? "folder" : "bucket"}</div>
                </div>
              ) : (
                <div style={{ maxHeight:"520px", overflowY:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:subtle, borderBottom:"1px solid "+border }}>
                        {["Name","Size","Last Modified","Actions"].map(h => (
                          <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prefix && (
                        <tr style={{ borderBottom:"1px solid "+border, cursor:"pointer" }}
                          onClick={() => { const parts = prefix.split("/").filter(Boolean); navigatePrefix(parts.slice(0,-1).join("/")+"/") }}>
                          <td style={{ padding:"12px 16px", fontSize:"13px", color:"#00d4aa" }} colSpan={4}>.. (back)</td>
                        </tr>
                      )}
                      {objects.folders.map(f => (
                        <tr key={f.key} style={{ borderBottom:"1px solid "+border, cursor:"pointer" }}
                          onClick={() => navigatePrefix(f.key)}>
                          <td style={{ padding:"12px 16px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                              <span>📁</span>
                              <span style={{ fontSize:"13px", fontWeight:"500", color:text }}>{f.key.replace(prefix,"").replace("/","")}</span>
                            </div>
                          </td>
                          <td style={{ padding:"12px 16px", fontSize:"12px", color:muted }}>-</td>
                          <td style={{ padding:"12px 16px", fontSize:"12px", color:muted }}>-</td>
                          <td style={{ padding:"12px 16px", fontSize:"12px", color:muted }}>-</td>
                        </tr>
                      ))}
                      {objects.files.map(f => {
                        const fname = f.key.split("/").pop()
                        const icon  = FILE_ICONS[f.ext] || "📄"
                        return (
                          <tr key={f.key} style={{ borderBottom:"1px solid "+border }}>
                            <td style={{ padding:"12px 16px" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                                <span>{icon}</span>
                                <span style={{ fontSize:"13px", color:text, wordBreak:"break-all" }}>{fname}</span>
                              </div>
                            </td>
                            <td style={{ padding:"12px 16px", fontSize:"12px", color:muted }}>{f.size_kb} KB</td>
                            <td style={{ padding:"12px 16px", fontSize:"12px", color:muted }}>{formatDate(f.modified)}</td>
                            <td style={{ padding:"12px 16px" }}>
                              <div style={{ display:"flex", gap:"6px" }}>
                                <button onClick={() => handleDownload(f.key)} disabled={actionKey===f.key}
                                  style={{ padding:"4px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #00d4aa40", background:"#00d4aa15", color:"#00d4aa" }}>
                                  {actionKey===f.key?"...":"Download"}
                                </button>
                                <button onClick={() => handleDeleteObject(f.key)} disabled={actionKey===f.key}
                                  style={{ padding:"4px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Create Bucket Modal ─────────────────────────────────────────── */}
      {showCreate && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"20px" }}>
          <div style={{ background:surface, borderRadius:"14px", border:"1px solid "+border, width:"100%", maxWidth:"500px", maxHeight:"90vh", overflow:"auto" }}>

            {/* ── Success Screen ── */}
            {submitted ? (
              <div style={{ padding:"48px 32px", textAlign:"center" }}>
                <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"#00d4aa20", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ fontSize:"20px", fontWeight:"700", color:text, marginBottom:"8px" }}>Request Submitted!</div>
                <div style={{ fontSize:"13px", color:muted, marginBottom:"20px" }}>
                  <strong style={{ color:text }}>{form.name}</strong> is pending admin approval.
                  Once approved, Terraform will create the S3 bucket automatically.
                </div>
                <div style={{ background:subtle, borderRadius:"10px", padding:"14px", textAlign:"left", marginBottom:"24px", fontSize:"12px" }}>
                  {[
                    ["Bucket Name",  form.name],
                    ["Region",       form.region],
                    ["Versioning",   form.versioning?"Enabled":"Disabled"],
                    ["Encryption",   form.encryption],
                    ["Project",      form.project],
                    ["Owner",        form.owner],
                    ["Environment",  form.environment],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid "+border }}>
                      <span style={{ color:muted }}>{k}</span>
                      <span style={{ fontWeight:"600", color:text }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:"#f59e0b10", border:"1px solid #f59e0b30", borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color:"#f59e0b", marginBottom:"20px" }}>
                  An admin must approve this request in the Approvals section before the bucket is created.
                </div>
                <button onClick={resetForm}
                  style={{ padding:"10px 28px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e" }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ padding:"20px 24px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:"16px", fontWeight:"600", color:text }}>Create S3 Bucket</div>
                    <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Request will go for admin approval</div>
                  </div>
                  <button onClick={resetForm} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"20px", color:muted }}>✕</button>
                </div>

                <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:"16px" }}>
                  {error && <div style={{ background:"#f43f5e15", color:"#f43f5e", padding:"10px 14px", borderRadius:"8px", fontSize:"13px" }}>{error}</div>}

                  {/* Bucket name */}
                  <div>
                    <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"6px" }}>Bucket name *</label>
                    <input style={inp} placeholder="my-aionos-bucket-unique"
                      value={form.name}
                      onChange={e => setForm(p=>({...p, name:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")}))} />
                    <div style={{ fontSize:"11px", color:muted, marginTop:"4px" }}>
                      Must be globally unique across all AWS accounts. Add a suffix like your account ID or date.
                    </div>
                  </div>

                  {/* Region */}
                  <div>
                    <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"6px" }}>Region *</label>
                    <select style={inp} value={form.region} onChange={e => setForm(p=>({...p, region:e.target.value}))}>
                      {ALL_REGIONS.map(r => <option key={r} value={r}>{r}{REGION_LABELS[r]?" ("+REGION_LABELS[r]+")":""}</option>)}
                    </select>
                  </div>

                  {/* Options */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                    <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"13px", color:text }}>
                      <input type="checkbox" checked={form.versioning} onChange={e => setForm(p=>({...p, versioning:e.target.checked}))} />
                      Enable versioning
                    </label>
                    <div>
                      <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"5px" }}>Encryption</label>
                      <select style={inp} value={form.encryption} onChange={e => setForm(p=>({...p, encryption:e.target.value}))}>
                        <option value="AES256">AES-256 (SSE-S3)</option>
                        <option value="aws:kms">AWS KMS (SSE-KMS)</option>
                      </select>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop:"1px solid "+border, paddingTop:"16px" }}>
                    <div style={{ fontSize:"13px", fontWeight:"600", color:text, marginBottom:"12px" }}>Tags</div>

                    {/* Project */}
                    <div style={{ marginBottom:"10px" }}>
                      <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"5px" }}>Project Name *</label>
                      <input style={inp} placeholder="AIonOS-Platform"
                        value={form.project}
                        onChange={e => setForm(p=>({...p, project:e.target.value}))} />
                    </div>

                    {/* Owner */}
                    <div style={{ marginBottom:"10px" }}>
                      <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"5px" }}>Project Owner *</label>
                      <input style={inp} placeholder="akram-khan"
                        value={form.owner}
                        onChange={e => setForm(p=>({...p, owner:e.target.value}))} />
                    </div>

                    {/* Environment */}
                    <div>
                      <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"5px" }}>Environment *</label>
                      <div style={{ display:"flex", gap:"8px" }}>
                        {ENVIRONMENTS.map(env => (
                          <button key={env} onClick={() => setForm(p=>({...p, environment:env}))}
                            style={{ flex:1, padding:"8px", borderRadius:"8px", cursor:"pointer", fontSize:"12px", fontWeight:"600",
                              border:"1px solid "+(form.environment===env?"#00d4aa40":border),
                              background:form.environment===env?"#00d4aa15":surface,
                              color:form.environment===env?"#00d4aa":muted }}>
                            {env}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Cost estimate */}
                  <div style={{ background:dark?"#0a0f1e":"#f8fafc", border:"1px solid "+border, borderRadius:"8px", padding:"12px 14px", fontSize:"12px", color:muted }}>
                    <div style={{ fontWeight:"500", color:text, marginBottom:"4px" }}>Estimated cost</div>
                    Storage: $0.023/GB-month · Requests: $0.0004/1K PUT · $0.00004/1K GET
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding:"16px 24px", borderTop:"1px solid "+border, display:"flex", justifyContent:"flex-end", gap:"10px" }}>
                  <button onClick={resetForm}
                    style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid "+border, background:"transparent", color:text }}>
                    Cancel
                  </button>
                  <button onClick={handleCreate} disabled={creating}
                    style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e", opacity:creating?0.7:1 }}>
                    {creating ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}