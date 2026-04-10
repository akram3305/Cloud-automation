content = """import { useState, useEffect, useCallback } from "react"
import { useTheme } from "../context/ThemeContext"
import { createRequest, listRequests, listVMs, listBuckets } from "../api/api"
import CreateVMModal from "../components/CreateVMModal"

const SERVICES = [
  {
    id:"ec2", category:"Compute", name:"EC2 Instance", desc:"Virtual servers in the cloud",
    icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
    color:"#FF9900", tags:["compute","vm","server"],
  },
  {
    id:"s3", category:"Storage", name:"S3 Bucket", desc:"Scalable object storage",
    icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
    color:"#00d4aa", tags:["storage","bucket","files"],
  },
  {
    id:"rds", category:"Database", name:"RDS Database", desc:"Managed relational database",
    icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
    color:"#3b82f6", tags:["database","mysql","postgres","rds"],
  },
  {
    id:"vpc", category:"Networking", name:"VPC", desc:"Isolated virtual network",
    icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064",
    color:"#a78bfa", tags:["network","vpc","subnet"],
  },
  {
    id:"elb", category:"Networking", name:"Load Balancer", desc:"Distribute incoming traffic",
    icon:"M8 9l4-4 4 4m0 6l-4 4-4-4",
    color:"#f59e0b", tags:["load balancer","elb","alb","traffic"],
  },
  {
    id:"lambda", category:"Compute", name:"Lambda Function", desc:"Run code without servers",
    icon:"M13 10V3L4 14h7v7l9-11h-7z",
    color:"#f59e0b", tags:["serverless","lambda","function"],
  },
  {
    id:"cloudfront", category:"Networking", name:"CloudFront CDN", desc:"Global content delivery",
    icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064",
    color:"#06b6d4", tags:["cdn","cloudfront","distribution"],
  },
  {
    id:"elasticache", category:"Database", name:"ElastiCache", desc:"In-memory caching",
    icon:"M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
    color:"#ec4899", tags:["redis","memcached","cache"],
  },
  {
    id:"eks", category:"Compute", name:"EKS Cluster", desc:"Managed Kubernetes",
    icon:"M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    color:"#00d4aa", tags:["kubernetes","k8s","eks","container"],
  },
  {
    id:"sns", category:"Messaging", name:"SNS Topic", desc:"Push notification service",
    icon:"M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    color:"#f43f5e", tags:["sns","notification","push"],
  },
  {
    id:"sqs", category:"Messaging", name:"SQS Queue", desc:"Managed message queuing",
    icon:"M4 6h16M4 10h16M4 14h16M4 18h16",
    color:"#a78bfa", tags:["sqs","queue","message"],
  },
  {
    id:"iam", category:"Security", name:"IAM Role", desc:"Identity and access management",
    icon:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    color:"#f59e0b", tags:["iam","role","policy","security"],
  },
]

const CATEGORIES = ["All", "Compute", "Storage", "Database", "Networking", "Messaging", "Security"]

const S3_REGIONS = [
  "ap-south-1","ap-south-2","ap-southeast-1","ap-southeast-2","ap-northeast-1",
  "ap-northeast-2","us-east-1","us-east-2","us-west-1","us-west-2",
  "eu-west-1","eu-west-2","eu-central-1","eu-north-1","sa-east-1","ca-central-1",
]

export default function Resources() {
  const { dark } = useTheme()
  const [category,  setCat]      = useState("All")
  const [search,    setSearch]   = useState("")
  const [selected,  setSelected] = useState(null)
  const [showVMModal, setVMModal] = useState(false)
  const [showS3Modal, setS3Modal] = useState(false)
  const [resources, setResources] = useState([])
  const [loading,   setLoading]  = useState(true)
  const [success,   setSuccess]  = useState("")

  // S3 form
  const [s3Form, setS3Form] = useState({ name:"", region:"ap-south-1", versioning:false, public:false })
  const [s3Creating, setS3Creating] = useState(false)
  const [s3Error, setS3Error] = useState("")

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const inp     = { padding:"8px 12px", border:"1px solid "+border, borderRadius:"8px", fontSize:"13px", width:"100%", background:surface, color:text }

  const fetchResources = useCallback(async () => {
    try {
      const [vms, buckets, reqs] = await Promise.all([listVMs(), listBuckets(), listRequests()])
      const all = [
        ...vms.data.map(v => ({ ...v, _type:"ec2", _label: v.name, _status: v.state, _region: v.region, _detail: v.instance_type })),
        ...buckets.data.map(b => ({ ...b, _type:"s3", _label: b.name, _status:"active", _region: b.region, _detail: b.objects+" objects" })),
        ...reqs.data.filter(r => !["completed","rejected"].includes(r.status)).map(r => ({ ...r, _type:"request", _label: r.resource_name, _status: r.status, _region:"-", _detail: r.resource_type })),
      ]
      setResources(all)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchResources() }, [fetchResources])

  const filtered = SERVICES.filter(s => {
    const matchCat = category === "All" || s.category === category
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.tags.some(t => t.includes(search.toLowerCase()))
    return matchCat && matchSearch
  })

  function handleServiceClick(service) {
    setSelected(service)
    if (service.id === "ec2") { setVMModal(true) }
    else if (service.id === "s3") { setS3Modal(true) }
    else { alert(service.name + " provisioning coming soon! Currently EC2 and S3 are fully supported.") }
  }

  async function handleS3Create() {
    if (!s3Form.name.trim()) { setS3Error("Bucket name is required"); return }
    setS3Creating(true)
    setS3Error("")
    try {
      const { createBucket } = await import("../api/api")
      await createBucket(s3Form)
      setSuccess("S3 bucket " + s3Form.name + " created successfully")
      setS3Modal(false)
      setS3Form({ name:"", region:"ap-south-1", versioning:false, public:false })
      fetchResources()
      setTimeout(() => setSuccess(""), 4000)
    } catch(e) {
      setS3Error(e.response?.data?.detail || e.message)
    } finally { setS3Creating(false) }
  }

  const STATUS_COLORS = {
    running: "#00d4aa", active: "#00d4aa", completed: "#00d4aa",
    stopped: "#f59e0b", pending: "#3b82f6", provisioning: "#a78bfa",
    failed: "#f43f5e",
  }

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"all 0.3s ease" }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}"}</style>

      {/* Header */}
      <div style={{ marginBottom:"28px", animation:"fadeUp 0.4s ease both" }}>
        <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>Resources</h1>
        <p style={{ fontSize:"14px", color:muted, marginTop:"4px" }}>Select a service to deploy, or view your running resources below</p>
      </div>

      {success && (
        <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", color:"#00d4aa", padding:"12px 16px", borderRadius:"10px", marginBottom:"20px", fontSize:"13px" }}>
          {success}
        </div>
      )}

      {/* Service catalog */}
      <div style={{ background:surface, border:"1px solid "+border, borderRadius:"16px", padding:"24px", marginBottom:"24px", animation:"fadeUp 0.4s ease 0.1s both", transition:"all 0.3s" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
          <div style={{ fontSize:"15px", fontWeight:"600", color:text }}>AWS Service Catalog</div>
          <input type="text" placeholder="Search services..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ ...inp, width:"220px" }} />
        </div>

        {/* Category tabs */}
        <div style={{ display:"flex", gap:"6px", marginBottom:"20px", flexWrap:"wrap" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCat(cat)} style={{
              padding:"6px 14px", borderRadius:"20px", fontSize:"12px", fontWeight:"500", cursor:"pointer",
              border:"1px solid "+(category===cat?"#00d4aa40":border),
              background: category===cat ? "#00d4aa15" : surface,
              color: category===cat ? "#00d4aa" : muted,
              transition:"all 0.15s"
            }}>{cat}</button>
          ))}
        </div>

        {/* Service grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:"12px" }}>
          {filtered.map((svc, i) => (
            <div key={svc.id} onClick={() => handleServiceClick(svc)}
              style={{ border:"1px solid "+border, borderRadius:"12px", padding:"16px", cursor:"pointer", transition:"all 0.2s", animation:"fadeUp 0.4s ease "+(i*30)+"ms both", position:"relative", overflow:"hidden" }}
              onMouseEnter={e => { e.currentTarget.style.border="1px solid "+svc.color+"60"; e.currentTarget.style.background=svc.color+"08"; e.currentTarget.style.transform="translateY(-2px)" }}
              onMouseLeave={e => { e.currentTarget.style.border="1px solid "+border; e.currentTarget.style.background="transparent"; e.currentTarget.style.transform="translateY(0)" }}>
              <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:svc.color+"20", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"10px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={svc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={svc.icon}/>
                </svg>
              </div>
              <div style={{ fontSize:"13px", fontWeight:"600", color:text, marginBottom:"3px" }}>{svc.name}</div>
              <div style={{ fontSize:"11px", color:muted, lineHeight:"1.4" }}>{svc.desc}</div>
              <div style={{ fontSize:"10px", color:svc.color, fontWeight:"500", marginTop:"8px" }}>{svc.category}</div>
              {(svc.id==="ec2"||svc.id==="s3") && (
                <div style={{ position:"absolute", top:"10px", right:"10px", fontSize:"9px", background:svc.color+"20", color:svc.color, padding:"2px 6px", borderRadius:"4px", fontWeight:"600" }}>READY</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Running resources */}
      <div style={{ background:surface, border:"1px solid "+border, borderRadius:"16px", overflow:"hidden", animation:"fadeUp 0.4s ease 0.3s both", transition:"all 0.3s" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:"15px", fontWeight:"600", color:text }}>Your Resources</div>
          <div style={{ fontSize:"12px", color:muted }}>{resources.length} total</div>
        </div>
        {loading ? (
          <div style={{ padding:"48px", textAlign:"center", color:muted }}>Loading resources...</div>
        ) : resources.length === 0 ? (
          <div style={{ padding:"64px", textAlign:"center" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>??</div>
            <div style={{ fontSize:"15px", fontWeight:"500", color:text, marginBottom:"6px" }}>No resources yet</div>
            <div style={{ fontSize:"13px", color:muted }}>Click a service above to deploy your first resource</div>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:subtle, borderBottom:"1px solid "+border }}>
                {["Type","Name","Status","Region","Details"].map(h => (
                  <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((r, i) => {
                const svc = SERVICES.find(s => s.id === r._type)
                const statusColor = STATUS_COLORS[r._status] || "#64748b"
                return (
                  <tr key={i} style={{ borderBottom:"1px solid "+border, transition:"background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        {svc && (
                          <div style={{ width:"28px", height:"28px", borderRadius:"7px", background:svc.color+"20", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={svc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d={svc.icon}/>
                            </svg>
                          </div>
                        )}
                        <span style={{ fontSize:"12px", fontWeight:"500", color:muted }}>{r._type==="ec2"?"EC2":r._type==="s3"?"S3":r._type.toUpperCase()}</span>
                      </div>
                    </td>
                    <td style={{ padding:"14px 16px", fontSize:"13px", fontWeight:"600", color:text }}>{r._label}</td>
                    <td style={{ padding:"14px 16px" }}>
                      <span style={{ background:statusColor+"15", color:statusColor, padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600" }}>{r._status}</span>
                    </td>
                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{r._region}</td>
                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{r._detail}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* EC2 Modal */}
      {showVMModal && (
        <CreateVMModal
          onClose={() => setVMModal(false)}
          onSuccess={() => { setVMModal(false); setSuccess("EC2 request submitted - awaiting approval"); fetchResources() }}
        />
      )}

      {/* S3 Modal */}
      {showS3Modal && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"20px" }}>
          <div style={{ background:surface, borderRadius:"14px", border:"1px solid "+border, width:"100%", maxWidth:"480px" }}>
            <div style={{ padding:"20px 24px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:"16px", fontWeight:"600", color:text }}>Create S3 Bucket</div>
                <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Scalable object storage on AWS</div>
              </div>
              <button onClick={() => setS3Modal(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"20px", color:muted }}>x</button>
            </div>
            <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:"14px" }}>
              {s3Error && <div style={{ background:"#f43f5e15", color:"#f43f5e", padding:"10px", borderRadius:"8px", fontSize:"13px" }}>{s3Error}</div>}
              <div>
                <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"5px" }}>Bucket name</label>
                <input style={inp} placeholder="my-aionos-bucket" value={s3Form.name}
                  onChange={e => setS3Form(p=>({...p, name:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")}))} />
                <div style={{ fontSize:"11px", color:muted, marginTop:"3px" }}>Lowercase, numbers and hyphens only</div>
              </div>
              <div>
                <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"5px" }}>Region</label>
                <select style={inp} value={s3Form.region} onChange={e => setS3Form(p=>({...p, region:e.target.value}))}>
                  {S3_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display:"flex", gap:"20px" }}>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"13px", color:text }}>
                  <input type="checkbox" checked={s3Form.versioning} onChange={e => setS3Form(p=>({...p, versioning:e.target.checked}))} />
                  Enable versioning
                </label>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"13px", color:text }}>
                  <input type="checkbox" checked={s3Form.public} onChange={e => setS3Form(p=>({...p, public:e.target.checked}))} />
                  Public access
                </label>
              </div>
              <div style={{ background:subtle, border:"1px solid "+border, borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color:muted }}>
                Storage: $0.023/GB-month - GET: $0.0004/10K - PUT: $0.005/1K
              </div>
            </div>
            <div style={{ padding:"16px 24px", borderTop:"1px solid "+border, display:"flex", justifyContent:"flex-end", gap:"10px" }}>
              <button onClick={() => setS3Modal(false)} style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid "+border, background:"transparent", color:text }}>Cancel</button>
              <button onClick={handleS3Create} disabled={s3Creating}
                style={{ padding:"9px 18px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e", opacity:s3Creating?0.7:1 }}>
                {s3Creating ? "Creating..." : "Create Bucket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
"""
with open("src/pages/Resources.jsx", "w", newline="\n", encoding="utf-8") as f:
    f.write(content)
print("Done")
