import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { listVMs, listBuckets, listVPCs, listLambdas, listLoadBalancers } from "../api/api"
import CreateVMModal from "../components/CreateVMModal"

// ── Service catalogue ─────────────────────────────────────────────────────
const SERVICES = [
  {
    key:"ec2", name:"EC2 Instance", desc:"Virtual servers in the cloud",
    cat:"Compute", color:"#FF9900", bgColor:"#FFF3E0", ready:true,
    createPath:"/compute/create", viewPath:"/compute",
    icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
  },
  {
    key:"s3", name:"S3 Bucket", desc:"Scalable object storage",
    cat:"Storage", color:"#00C853", bgColor:"#E8F5E9", ready:true,
    createPath:"/storage", viewPath:"/storage",
    icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
  },
  {
    key:"rds", name:"RDS Database", desc:"Managed relational database",
    cat:"Database", color:"#2196F3", bgColor:"#E3F2FD", ready:false,
    createPath:null, viewPath:null,
    icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  },
  {
    key:"vpc", name:"VPC", desc:"Isolated virtual network",
    cat:"Networking", color:"#9C27B0", bgColor:"#F3E5F5", ready:true,
    createPath:"/network", viewPath:"/network",
    icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    key:"elb", name:"Load Balancer", desc:"Distribute incoming traffic",
    cat:"Networking", color:"#00BCD4", bgColor:"#E0F7FA", ready:false,
    createPath:null, viewPath:null,
    icon:"M8 9l4-4 4 4m0 6l-4 4-4-4",
  },
  {
    key:"lambda", name:"Lambda Function", desc:"Run code without servers",
    cat:"Compute", color:"#FF5722", bgColor:"#FBE9E7", ready:false,
    createPath:null, viewPath:null,
    icon:"M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  },
  {
    key:"cloudfront", name:"CloudFront CDN", desc:"Global content delivery",
    cat:"Networking", color:"#FF9800", bgColor:"#FFF3E0", ready:false,
    createPath:null, viewPath:null,
    icon:"M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9",
  },
  {
    key:"elasticache", name:"ElastiCache", desc:"In-memory caching",
    cat:"Database", color:"#E91E63", bgColor:"#FCE4EC", ready:false,
    createPath:null, viewPath:null,
    icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  },
  {
    key:"eks", name:"EKS Cluster", desc:"Managed Kubernetes",
    cat:"Compute", color:"#FF9900", bgColor:"#FFF8E1", ready:true,
    createPath:"/eks", viewPath:"/eks",
    icon:"M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
  },
  {
    key:"sns", name:"SNS Topic", desc:"Push notification service",
    cat:"Messaging", color:"#FF5722", bgColor:"#FBE9E7", ready:false,
    createPath:null, viewPath:null,
    icon:"M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    key:"sqs", name:"SQS Queue", desc:"Managed message queuing",
    cat:"Messaging", color:"#9C27B0", bgColor:"#F3E5F5", ready:false,
    createPath:null, viewPath:null,
    icon:"M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  },
  {
    key:"iam", name:"IAM Role", desc:"Identity and access management",
    cat:"Security", color:"#F59E0B", bgColor:"#FFFBEB", ready:true,
    createPath:"/iam", viewPath:"/iam",
    icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
  },
]

const CATS = ["All", "Compute", "Storage", "Networking", "Database", "Messaging", "Security"]

const CAT_COLOR = {
  Compute:"#FF9900", Storage:"#00C853", Networking:"#9C27B0",
  Database:"#2196F3", Messaging:"#FF5722", Security:"#F59E0B", default:"#64748b",
}

// ── Resource type config ──────────────────────────────────────────────────
const RES_TYPES = [
  { key:"ec2",    label:"EC2", color:"#FF9900", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
  { key:"s3",     label:"S3",  color:"#00C853", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { key:"vpc",    label:"VPC", color:"#9C27B0", icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945" },
  { key:"lambda", label:"λ",   color:"#FF5722", icon:"M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { key:"elb",    label:"ELB", color:"#00BCD4", icon:"M8 9l4-4 4 4m0 6l-4 4-4-4" },
]

const STATUS_COLOR = {
  running:"#00C853", active:"#00C853", available:"#00C853",
  stopped:"#F59E0B", pending:"#2196F3", failed:"#f43f5e",
}

export default function ServiceCatalog() {
  const { dark } = useTheme()
  const navigate  = useNavigate()

  const bg      = dark ? "#070c18" : "#f8fafc"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e8edf2"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#64748b" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f1f5f9"

  const [cat,         setCat]         = useState("All")
  const [search,      setSearch]      = useState("")
  const [showEC2Modal,setShowEC2Modal]= useState(false)

  // Resources state
  const [vms,     setVms]     = useState([])
  const [buckets, setBuckets] = useState([])
  const [vpcs,    setVpcs]    = useState([])
  const [lambdas, setLambdas] = useState([])
  const [lbs,     setLbs]     = useState([])
  const [resLoading, setResLoading] = useState(true)

  const fetchResources = useCallback(async () => {
    try {
      const [vr, br, vpcr, lr, lbr] = await Promise.allSettled([
        listVMs(), listBuckets(),
        listVPCs().catch(()=>({data:[]})),
        listLambdas().catch(()=>({data:[]})),
        listLoadBalancers().catch(()=>({data:[]})),
      ])
      if (vr.status === "fulfilled")   setVms(vr.value.data || [])
      if (br.status === "fulfilled")   setBuckets(br.value.data || [])
      if (vpcr.status === "fulfilled") setVpcs(vpcr.value.data || [])
      if (lr.status === "fulfilled")   setLambdas(lr.value.data || [])
      if (lbr.status === "fulfilled")  setLbs(lbr.value.data || [])
    } catch {}
    finally { setResLoading(false) }
  }, [])

  useEffect(() => { fetchResources() }, [fetchResources])

  // Flatten all resources into one list
  const allResources = [
    ...vms.map(r => ({ type:"EC2", name:r.name||r.id, status:r.state||"unknown", region:r.region||"ap-south-1", details:`${r.instance_type||""}`, typeKey:"ec2" })),
    ...buckets.map(r => ({ type:"S3", name:r.name, status:"active", region:r.region||r.location||"global", details:`${r.size_bytes !== undefined ? fmtSize(r.size_bytes) : ""}`, typeKey:"s3" })),
    ...vpcs.map(r => ({ type:"VPC", name:r.name||r.id, status:r.state||"available", region:r.region||"ap-south-1", details:`CIDR: ${r.cidr||"—"}`, typeKey:"vpc" })),
    ...lambdas.map(r => ({ type:"Lambda", name:r.name||r.id, status:"active", region:r.region||"ap-south-1", details:`Runtime: ${r.runtime||"—"}`, typeKey:"lambda" })),
    ...lbs.map(r => ({ type:"ELB", name:r.name||r.id, status:r.state||"active", region:r.region||"ap-south-1", details:r.dns||"", typeKey:"elb" })),
  ]

  const filtered = SERVICES.filter(s => {
    const matchCat  = cat === "All" || s.cat === cat
    const matchSrch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSrch
  })

  return (
    <div style={{ background:bg, minHeight:"100vh" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .svc-card:hover { box-shadow:0 4px 20px rgba(0,0,0,0.10) !important; transform:translateY(-2px) !important; }
        .res-row:hover td { background:${dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)"} !important; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ background:surface, borderBottom:`1px solid ${border}`, padding:"16px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:800, color:text, margin:0 }}>AWS Service Catalog</h1>
          <p style={{ fontSize:12, color:muted, margin:"3px 0 0" }}>
            {SERVICES.filter(s=>s.ready).length} ready · {SERVICES.filter(s=>!s.ready).length} coming soon
          </p>
        </div>
        <div style={{ position:"relative" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search services..."
            style={{ padding:"8px 12px 8px 32px", borderRadius:8, border:`1px solid ${border}`, background:surface, color:text, fontSize:13, outline:"none", width:220 }}
            onFocus={e=>e.currentTarget.style.borderColor="#FF9900"}
            onBlur={e=>e.currentTarget.style.borderColor=border}
          />
        </div>
      </div>

      <div style={{ padding:"20px 28px" }}>

        {/* ── Category pills ── */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{
                padding:"5px 16px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", border:"1px solid",
                borderColor: cat===c ? "#FF9900" : border,
                background:  cat===c ? (dark?"rgba(255,153,0,0.15)":"rgba(255,153,0,0.08)") : "transparent",
                color:       cat===c ? "#FF9900" : muted,
                transition:"all 0.15s",
              }}>
              {c}
            </button>
          ))}
        </div>

        {/* ── Service cards grid ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))", gap:12, marginBottom:32 }}>
          {filtered.map((svc, i) => (
            <ServiceCard
              key={svc.key} svc={svc} dark={dark}
              surface={surface} border={border} text={text} muted={muted}
              navigate={navigate} i={i}
              onLaunchEC2={() => setShowEC2Modal(true)}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"48px 0", color:muted, fontSize:13 }}>
              No services match your search.
            </div>
          )}
        </div>

        {/* ── Your Resources ── */}
        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden", animation:"fadeUp 0.4s ease 0.2s both" }}>
          <div style={{ padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:`1px solid ${border}` }}>
            <div style={{ fontSize:15, fontWeight:700, color:text }}>Your Resources</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {!resLoading && (
                <span style={{ fontSize:12, color:muted, fontWeight:500 }}>
                  {allResources.length} total
                </span>
              )}
              {buckets.some(b => b.locked) && (
                <span style={{ fontSize:11, padding:"2px 10px", borderRadius:6, background:"rgba(245,158,11,0.12)", color:"#F59E0B", border:"1px solid rgba(245,158,11,0.3)", fontWeight:600 }}>
                  🔒 S3 Locked
                </span>
              )}
              <button onClick={fetchResources}
                style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${border}`, background:"transparent", color:muted, fontSize:11, cursor:"pointer", fontWeight:600 }}>
                Refresh
              </button>
            </div>
          </div>

          {resLoading ? (
            <div style={{ padding:"40px 0", textAlign:"center", color:muted, fontSize:13 }}>Loading resources…</div>
          ) : allResources.length === 0 ? (
            <div style={{ padding:"48px 0", textAlign:"center", color:muted, fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>☁️</div>
              No resources found. Launch a service above to get started.
            </div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }}>
                  {["TYPE","NAME","STATUS","REGION","DETAILS","ACTIONS"].map(h => (
                    <th key={h} style={{ padding:"9px 16px", fontSize:10, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", textAlign:"left", borderBottom:`1px solid ${border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allResources.map((r, i) => {
                  const typeConf = RES_TYPES.find(t=>t.key===r.typeKey) || RES_TYPES[0]
                  const stColor  = STATUS_COLOR[r.status] || muted
                  const isLast   = i === allResources.length - 1
                  return (
                    <tr key={i} className="res-row">
                      <td style={{ padding:"10px 16px", borderBottom: isLast?"none":`1px solid ${border}` }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:26, height:26, borderRadius:6, background:`${typeConf.color}15`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={typeConf.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d={typeConf.icon}/>
                            </svg>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:typeConf.color }}>{r.type}</span>
                        </div>
                      </td>
                      <td style={{ padding:"10px 16px", fontSize:13, fontWeight:600, color:text, borderBottom:isLast?"none":`1px solid ${border}`, maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {r.name}
                      </td>
                      <td style={{ padding:"10px 16px", borderBottom:isLast?"none":`1px solid ${border}` }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, padding:"2px 10px", borderRadius:20, background:`${stColor}15`, color:stColor, border:`1px solid ${stColor}30` }}>
                          <span style={{ width:5, height:5, borderRadius:"50%", background:stColor }} />
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding:"10px 16px", fontSize:12, color:muted, borderBottom:isLast?"none":`1px solid ${border}` }}>{r.region}</td>
                      <td style={{ padding:"10px 16px", fontSize:12, color:muted, borderBottom:isLast?"none":`1px solid ${border}`, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.details || "—"}</td>
                      <td style={{ padding:"10px 16px", borderBottom:isLast?"none":`1px solid ${border}` }}>
                        <button
                          onClick={() => navigate(RES_TYPES.find(t=>t.key===r.typeKey)?.key === "ec2" ? "/compute" : r.typeKey==="s3" ? "/storage" : r.typeKey==="vpc" ? "/network" : r.typeKey==="lambda" ? "#" : "#")}
                          style={{ padding:"4px 12px", borderRadius:6, border:`1px solid ${border}`, background:"transparent", color:muted, fontSize:11, cursor:"pointer", fontWeight:600, transition:"all 0.15s" }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor="#FF9900";e.currentTarget.style.color="#FF9900"}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=border;e.currentTarget.style.color=muted}}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showEC2Modal && (
        <CreateVMModal
          onClose={() => setShowEC2Modal(false)}
          onSuccess={() => { setShowEC2Modal(false); fetchResources() }}
        />
      )}
    </div>
  )
}

// ── Service Card ─────────────────────────────────────────────────────────
function ServiceCard({ svc, dark, surface, border, text, muted, navigate, i, onLaunchEC2 }) {
  const catColor = CAT_COLOR[svc.cat] || CAT_COLOR.default
  const iconBg   = dark ? `${svc.color}18` : svc.bgColor

  return (
    <div
      className="svc-card"
      onClick={() => { if (!svc.ready) return; if (svc.key === "ec2") { onLaunchEC2(); } else if (svc.createPath) { navigate(svc.createPath); } }}
      style={{
        background: surface,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: "16px 14px 14px",
        position: "relative",
        cursor: svc.ready ? "pointer" : "default",
        transition: "box-shadow 0.18s ease, transform 0.18s ease",
        animation: `fadeUp 0.35s ease ${i * 30}ms both`,
        opacity: svc.ready ? 1 : 0.75,
      }}
    >
      {/* READY badge */}
      {svc.ready && (
        <div style={{ position:"absolute", top:10, right:10, fontSize:8, fontWeight:800, padding:"2px 7px", borderRadius:10, background:"rgba(0,200,83,0.12)", color:"#00C853", border:"1px solid rgba(0,200,83,0.3)", letterSpacing:"0.06em" }}>
          READY
        </div>
      )}

      {/* Icon */}
      <div style={{ width:44, height:44, borderRadius:12, background:iconBg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={svc.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={svc.icon}/>
        </svg>
      </div>

      <div style={{ fontSize:13, fontWeight:700, color:text, marginBottom:4 }}>{svc.name}</div>
      <div style={{ fontSize:11, color:muted, lineHeight:1.5, marginBottom:12, minHeight:32 }}>{svc.desc}</div>

      {/* Category label */}
      <div style={{ fontSize:10, fontWeight:700, color:catColor }}>{svc.cat}</div>

      {/* Action on ready */}
      {svc.ready && svc.viewPath && (
        <div style={{ display:"flex", gap:5, marginTop:10 }}>
          <button
            onClick={e => { e.stopPropagation(); if (svc.key === "ec2") { onLaunchEC2(); } else { navigate(svc.createPath); } }}
            style={{ flex:1, padding:"5px 0", borderRadius:6, border:"none", background:`linear-gradient(135deg,${svc.color},${svc.color}cc)`, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}
          >
            Launch
          </button>
          <button
            onClick={e => { e.stopPropagation(); navigate(svc.viewPath) }}
            style={{ padding:"5px 10px", borderRadius:6, border:`1px solid ${border}`, background:"transparent", color:muted, fontSize:11, cursor:"pointer" }}
          >
            View
          </button>
        </div>
      )}
    </div>
  )
}

function fmtSize(bytes) {
  if (!bytes) return "0 B"
  const u = ["B","KB","MB","GB","TB"]
  let i = 0, v = bytes
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(i > 0 ? 1 : 0)} ${u[i]}`
}
