content = """import { useEffect, useState, useCallback } from "react"
import { listBuckets, createBucket, deleteBucket, listObjects, deleteObject, getDownloadUrl, getS3Stats } from "../api/api"
import { useTheme } from "../context/ThemeContext"

const REGION_LABELS = {
  "ap-south-1":"Mumbai","ap-southeast-1":"Singapore","us-east-1":"N. Virginia",
  "us-east-2":"Ohio","us-west-2":"Oregon","eu-west-1":"Ireland",
  "eu-central-1":"Frankfurt","ap-northeast-1":"Tokyo","sa-east-1":"Sao Paulo",
}

const FILE_ICONS = {
  pdf:"??", png:"??", jpg:"??", jpeg:"??", gif:"??", mp4:"??", mp3:"??",
  zip:"??", tar:"??", gz:"??", json:"??", csv:"??", xlsx:"??", txt:"??",
  js:"??", py:"??", sh:"??", tf:"??", yml:"?", yaml:"?", folder:"??",
}

const ALL_REGIONS = [
  "ap-south-1","ap-south-2","ap-southeast-1","ap-southeast-2","ap-northeast-1",
  "ap-northeast-2","us-east-1","us-east-2","us-west-1","us-west-2",
  "eu-west-1","eu-west-2","eu-west-3","eu-central-1","eu-north-1",
  "sa-east-1","ca-central-1","me-south-1","af-south-1",
]

function formatSize(mb) {
  if (mb < 1) return (mb * 1024).toFixed(1) + " KB"
  if (mb < 1024) return mb.toFixed(2) + " MB"
  return (mb / 1024).toFixed(2) + " GB"
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
}

export default function Storage() {
  const { dark } = useTheme()
  const [buckets,       setBuckets]       = useState([])
  const [stats,         setStats]         = useState(null)
  const [selectedBucket,setSel]           = useState(null)
  const [objects,       setObjects]       = useState(null)
  const [prefix,        setPrefix]        = useState("")
  const [loading,       setLoading]       = useState(true)
  const [loadingObjs,   setLoadingObjs]   = useState(false)
  const [showCreate,    setShowCreate]    = useState(false)
  const [actionKey,     setActionKey]     = useState(null)
  const [form,          setForm]          = useState({ name:"", region:"ap-south-1", versioning:false, public:false })
  const [creating,      setCreating]      = useState(false)
  const [error,         setError]         = useState("")
  const [success,       setSuccess]       = useState("")

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text     = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const inp     = { padding:"8px 12px", border:"1px solid "+border, borderRadius:"8px", fontSize:"13px", width:"100%", background:surface, color:text }

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
    setSel(bucket)
    setPrefix("")
    setLoadingObjs(true)
    try {
      const { data } = await listObjects(bucket.name, "")
      setObjects(data)
    } catch(e) { console.error(e) }
    finally { setLoadingObjs(false) }
  }

  async function navigatePrefix(p) {
    setPrefix(p)
    setLoadingObjs(true)
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

  async function handleCreate() {
    if (!form.name.trim()) { setError("Bucket name is required"); return }
    setCreating(true)
    setError("")
    try {
      await createBucket(form)
      setSuccess("Bucket " + form.name + " created")
      setShowCreate(false)
      setForm({ name:"", region:"ap-south-1", versioning:false, public:false })
      fetchBuckets()
      setTimeout(() => setSuccess(""), 3000)
    } catch(e) { setError(e.response?.data?.detail || e.message) }
    finally { setCreating(false) }
  }

  const breadcrumbs = prefix ? prefix.split("/").filter(Boolean) : []

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"all 0.3s ease" }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}"}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", animation:"fadeUp 0.4s ease both" }}>
        <div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>Storage</h1>
          <p style={{ fontSize:"14px", color:muted, marginTop:"4px" }}>
            {stats ? stats.total_buckets + " buckets - " + formatSize(stats.total_size_mb) + " total - " + stats.total_objects + " objects" : "Amazon S3 Buckets"}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display:"flex", alignItems:"center", gap:"8px", background:"#00d4aa", color:"#0a0f1e", border:"none", padding:"10px 18px", borderRadius:"10px", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
          + Create Bucket
        </button>
      </div>

      {success && <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", color:"#00d4aa", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{success}</div>}
      {error   && <div style={{ background:"#f43f5e15", border:"1px solid #f43f5e30", color:"#f43f5e", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px" }}>{error}<button onClick={()=>setError("")} style={{ float:"right", background:"none", border:"none", color:"#f43f5e", cursor:"pointer" }}>x</button></div>}

      {/* Stats cards */}
      {stats && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
          {[
            { label:"Total Buckets",  value:stats.total_buckets,                 color:"#00d4aa" },
            { label:"Total Objects",  value:stats.total_objects.toLocaleString(),color:"#3b82f6" },
            { label:"Total Size",     value:formatSize(stats.total_size_mb),      color:"#a78bfa" },
            { label:"Est. Monthly",   value:"$"+(stats.total_size_gb*0.023).toFixed(3), color:"#f59e0b" },
          ].map(({ label, value, color }, i) => (
            <div key={label} style={{ background:surface, border:"1px solid "+border, borderLeft:"3px solid "+color, borderRadius:"12px", padding:"16px", animation:"fadeUp 0.4s ease "+(i*60)+"ms both", transition:"all 0.3s" }}>
              <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"6px" }}>{label}</div>
              <div style={{ fontSize:"22px", fontWeight:"700", color:text }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:"20px" }}>

        {/* Bucket list */}
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden", animation:"fadeUp 0.4s ease 0.2s both", transition:"all 0.3s", height:"fit-content" }}>
          <div style={{ padding:"14px 18px", borderBottom:"1px solid "+border, fontSize:"13px", fontWeight:"600", color:text, display:"flex", justifyContent:"space-between" }}>
            <span>S3 Buckets</span>
            <span style={{ fontSize:"11px", color:muted, fontWeight:"400" }}>{buckets.length} total</span>
          </div>
          {loading ? (
            <div style={{ padding:"32px", textAlign:"center", color:muted }}>Loading...</div>
          ) : buckets.length === 0 ? (
            <div style={{ padding:"40px", textAlign:"center" }}>
              <div style={{ fontSize:"32px", marginBottom:"8px" }}>??</div>
              <div style={{ fontSize:"13px", color:muted }}>No buckets yet</div>
            </div>
          ) : (
            <div style={{ maxHeight:"600px", overflowY:"auto" }}>
              {buckets.map(b => (
                <div key={b.name} onClick={() => openBucket(b)}
                  style={{ padding:"14px 18px", borderBottom:"1px solid "+border, cursor:"pointer", background: selectedBucket?.name===b.name ? (dark?"#00d4aa10":"#f0fdf4") : "transparent", borderLeft: selectedBucket?.name===b.name ? "3px solid #00d4aa" : "3px solid transparent", transition:"all 0.15s" }}
                  onMouseEnter={e => { if(selectedBucket?.name!==b.name) e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc" }}
                  onMouseLeave={e => { if(selectedBucket?.name!==b.name) e.currentTarget.style.background="transparent" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
                        <span style={{ fontSize:"14px" }}>??</span>
                        <span style={{ fontSize:"13px", fontWeight:"600", color:text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.name}</span>
                      </div>
                      <div style={{ fontSize:"11px", color:muted }}>
                        {REGION_LABELS[b.region]||b.region} - {b.objects} objects - {formatSize(b.size_mb)}
                      </div>
                      {b.versioning && <span style={{ fontSize:"10px", background:"#3b82f615", color:"#3b82f6", padding:"1px 6px", borderRadius:"4px", marginTop:"4px", display:"inline-block" }}>Versioning</span>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDeleteBucket(b.name) }}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#f43f5e", padding:"2px 6px", fontSize:"14px", flexShrink:0 }}>
                      ??
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Object browser */}
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", overflow:"hidden", animation:"fadeUp 0.4s ease 0.3s both", transition:"all 0.3s" }}>
          {!selectedBucket ? (
            <div style={{ padding:"80px", textAlign:"center" }}>
              <div style={{ fontSize:"48px", marginBottom:"12px" }}>??</div>
              <div style={{ fontSize:"16px", fontWeight:"500", color:text, marginBottom:"6px" }}>Select a bucket</div>
              <div style={{ fontSize:"13px", color:muted }}>Click a bucket on the left to browse its contents</div>
            </div>
          ) : (
            <>
              {/* Bucket header */}
              <div style={{ padding:"14px 20px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center", background:subtle }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"13px", color:text, flexWrap:"wrap" }}>
                  <span style={{ cursor:"pointer", color:"#00d4aa", fontWeight:"500" }} onClick={() => navigatePrefix("")}>{selectedBucket.name}</span>
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <span style={{ color:muted }}>/</span>
                      <span style={{ cursor:"pointer", color: i===breadcrumbs.length-1 ? text : "#00d4aa" }}
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

              {/* Object list */}
              {loadingObjs ? (
                <div style={{ padding:"48px", textAlign:"center", color:muted }}>Loading objects...</div>
              ) : !objects ? null : (objects.folders.length + objects.files.length === 0) ? (
                <div style={{ padding:"64px", textAlign:"center" }}>
                  <div style={{ fontSize:"40px", marginBottom:"8px" }}>??</div>
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
                        <tr style={{ borderBottom:"1px solid "+border, cursor:"pointer" }} onClick={() => { const parts = prefix.split("/").filter(Boolean); navigatePrefix(parts.slice(0,-1).join("/")+"/") }}>
                          <td style={{ padding:"12px 16px", fontSize:"13px", color:"#00d4aa" }} colSpan={4}>.. (back)</td>
                        </tr>
                      )}
                      {objects.folders.map(f => (
                        <tr key={f.key} style={{ borderBottom:"1px solid "+border, cursor:"pointer" }}
                          onClick={() => navigatePrefix(f.key)}
                          onMouseEnter={e => e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc"}
                          onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"12px 16px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                              <span>??</span>
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
                        const icon  = FILE_ICONS[f.ext] || "??"
                        return (
                          <tr key={f.key} style={{ borderBottom:"1px solid "+border }}
                            onMouseEnter={e => e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.background="transparent"}>
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

      {/* Create bucket modal */}
      {showCreate && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"20px" }}>
          <div style={{ background:surface, borderRadius:"14px", border:"1px solid "+border, width:"100%", maxWidth:"480px" }}>
            <div style={{ padding:"20px 24px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:"16px", fontWeight:"600", color:text }}>Create S3 Bucket</div>
                <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Configure your new bucket</div>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"20px", color:muted }}>x</button>
            </div>

            <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:"16px" }}>
              {error && <div style={{ background:"#f43f5e15", color:"#f43f5e", padding:"10px 14px", borderRadius:"8px", fontSize:"13px" }}>{error}</div>}

              <div>
                <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"6px" }}>Bucket name</label>
                <input style={inp} placeholder="my-aionos-bucket" value={form.name} onChange={e => setForm(p=>({...p, name:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")})} />
                <div style={{ fontSize:"11px", color:muted, marginTop:"4px" }}>Lowercase letters, numbers and hyphens only</div>
              </div>

              <div>
                <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"6px" }}>Region</label>
                <select style={inp} value={form.region} onChange={e => setForm(p=>({...p, region:e.target.value}))}>
                  {ALL_REGIONS.map(r => <option key={r} value={r}>{r} {REGION_LABELS[r] ? "("+REGION_LABELS[r]+")" : ""}</option>)}
                </select>
              </div>

              <div style={{ display:"flex", gap:"16px" }}>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"13px", color:text }}>
                  <input type="checkbox" checked={form.versioning} onChange={e => setForm(p=>({...p, versioning:e.target.checked}))} />
                  Enable versioning
                </label>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"13px", color:text }}>
                  <input type="checkbox" checked={form.public} onChange={e => setForm(p=>({...p, public:e.target.checked}))} />
                  Public access
                </label>
              </div>

              <div style={{ background: dark?"#0a0f1e":"#f8fafc", border:"1px solid "+border, borderRadius:"8px", padding:"12px 14px", fontSize:"12px", color:muted }}>
                <div style={{ fontWeight:"500", color:text, marginBottom:"4px" }}>Estimated cost</div>
                Storage: $0.023/GB-month - Requests: $0.0004/1K PUT - $0.00004/1K GET
              </div>
            </div>

            <div style={{ padding:"16px 24px", borderTop:"1px solid "+border, display:"flex", justifyContent:"flex-end", gap:"10px" }}>
              <button onClick={() => setShowCreate(false)} style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid "+border, background:"transparent", color:text }}>Cancel</button>
              <button onClick={handleCreate} disabled={creating}
                style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e", opacity:creating?0.7:1 }}>
                {creating ? "Creating..." : "Create Bucket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
"""
with open("src/pages/Storage.jsx", "w", newline="\n", encoding="utf-8") as f:
    f.write(content)
print("Done")
