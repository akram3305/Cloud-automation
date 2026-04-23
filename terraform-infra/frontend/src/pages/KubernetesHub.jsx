import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { listEKSClusters, listGKEClusters } from "../api/api"
import ResourceGuide from "../components/HowToGuide"

function SvgIcon({ d, size=16, color="currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

// ── Static data ───────────────────────────────────────────────────────────────
const PRICING_ROWS = [
  { config:"2 vCPU / 8 GB",          aws:"m5.large — $0.096",        azure:"Standard_D2s_v3 — $0.096", gcp:"e2-standard-2 — $0.067" },
  { config:"4 vCPU / 16 GB",         aws:"m5.xlarge — $0.192",       azure:"Standard_D4s_v3 — $0.192", gcp:"e2-standard-4 — $0.134" },
  { config:"8 vCPU / 32 GB",         aws:"m5.2xlarge — $0.384",      azure:"Standard_D8s_v3 — $0.384", gcp:"e2-standard-8 — $0.268" },
  { config:"4 vCPU / 8 GB (Compute)",aws:"c5.xlarge — $0.170",       azure:"Standard_F4s_v2 — $0.169", gcp:"c2-standard-4 — $0.209" },
]

const FEATURE_ROWS = [
  { feature:"Managed control plane",  aws:"✓", azure:"✓",      gcp:"✓" },
  { feature:"Control plane cost",     aws:"$0.10/hr", azure:"Free", gcp:"$0.10/hr" },
  { feature:"Auto-scaling",           aws:"✓", azure:"✓",      gcp:"✓" },
  { feature:"Spot / Preemptible nodes",aws:"✓",azure:"✓",     gcp:"✓" },
  { feature:"Private cluster",        aws:"✓", azure:"✓",      gcp:"✓" },
  { feature:"Workload identity",      aws:"IAM for SA", azure:"OIDC / AAD", gcp:"Workload Identity" },
  { feature:"Release channels",       aws:"Manual / Managed", azure:"Auto upgrade", gcp:"Rapid / Regular / Stable" },
  { feature:"Max nodes",              aws:"450", azure:"5,000", gcp:"15,000" },
  { feature:"Multi-AZ / Regional",    aws:"Multi-AZ", azure:"Multi-zone", gcp:"Regional" },
  { feature:"GPU support",            aws:"✓", azure:"✓",      gcp:"✓" },
  { feature:"ARM nodes",              aws:"Graviton3", azure:"Ampere", gcp:"Tau T2A" },
]

const MONTHLY_ESTIMATES = [
  { cloud:"AWS EKS",   color:"#FF9900", calc:"(3 × $0.192 + $0.10) × 730", result:"~$494/mo" },
  { cloud:"Azure AKS", color:"#0078D4", calc:"(3 × $0.192 + $0) × 730",   result:"~$421/mo" },
  { cloud:"GCP GKE",   color:"#4285F4", calc:"(3 × $0.134 + $0.10) × 730", result:"~$366/mo" },
]

// ── Feature cell renderer ────────────────────────────────────────────────────
function FeatureCell({ value, muted, dark }) {
  if (value === "✓") return <span style={{ color:"#22c55e", fontWeight:700, fontSize:16 }}>✓</span>
  if (value === "✗") return <span style={{ color:"#ef4444", fontWeight:700, fontSize:16 }}>✗</span>
  return <span style={{ fontSize:12, color: dark ? "#94a3b8" : "#475569" }}>{value}</span>
}

// ── Cloud card ───────────────────────────────────────────────────────────────
function CloudCard({ cloud, dark, card, border, txt, muted }) {
  const navigate = useNavigate()
  const { label, service, color, gradient, features, cpCost, viewPath, createPath, soon } = cloud

  return (
    <div style={{ background:card, borderRadius:16, border:`1px solid ${color}30`,
      padding:"20px", display:"flex", flexDirection:"column", gap:16,
      boxShadow:dark?`0 0 24px ${color}10`:"none",
      position:"relative", overflow:"hidden" }}>

      {/* Subtle accent glow */}
      <div style={{ position:"absolute", top:-30, right:-20, width:120, height:120,
        background:`radial-gradient(circle, ${color}18 0%, transparent 70%)`, pointerEvents:"none" }} />

      {/* Header row */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:12, flexShrink:0,
          background:gradient,
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:`0 4px 12px ${color}40` }}>
          <span style={{ fontSize:10, fontWeight:800, color:"#fff", letterSpacing:"-0.3px" }}>{service}</span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:txt }}>{label}</div>
          <div style={{ fontSize:12, color:muted, marginTop:2 }}>Managed Kubernetes</div>
        </div>
        {soon ? (
          <span style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6,
            background:`${color}18`, color:color, border:`1px solid ${color}30` }}>SOON</span>
        ) : cloud.status === "connected" ? (
          <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:700, color:"#22c55e" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e",
              boxShadow:"0 0 6px #22c55e" }} />
            Connected
          </span>
        ) : (
          <span style={{ fontSize:11, fontWeight:700, color:muted }}>Not Configured</span>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <div style={{ padding:"10px 12px", borderRadius:10, background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)",
          border:`1px solid ${border}` }}>
          <div style={{ fontSize:10, color:muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Clusters</div>
          <div style={{ fontSize:22, fontWeight:800, color:color }}>
            {soon ? "—" : cloud.clusterCount ?? "—"}
          </div>
        </div>
        <div style={{ padding:"10px 12px", borderRadius:10, background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)",
          border:`1px solid ${border}` }}>
          <div style={{ fontSize:10, color:muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Control Plane</div>
          <div style={{ fontSize:14, fontWeight:800, color:txt }}>{cpCost}</div>
        </div>
      </div>

      {/* Feature tags */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {features.map(f => (
          <span key={f} style={{ fontSize:11, padding:"3px 9px", borderRadius:6, fontWeight:600,
            background:`${color}12`, color:color, border:`1px solid ${color}25` }}>
            {f}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display:"flex", gap:8 }}>
        <button
          disabled={soon}
          onClick={() => !soon && navigate(viewPath)}
          style={{ flex:1, padding:"8px 0", borderRadius:9, fontSize:12, fontWeight:700, cursor:soon?"default":"pointer",
            border:`1px solid ${color}40`,
            background:soon?"transparent":`${color}15`,
            color:soon?muted:color,
            opacity:soon?0.5:1, transition:"all 0.15s" }}>
          View Clusters
        </button>
        <button
          disabled={soon}
          onClick={() => !soon && navigate(createPath)}
          style={{ flex:1, padding:"8px 0", borderRadius:9, fontSize:12, fontWeight:700, cursor:soon?"default":"pointer",
            border:"none",
            background:soon?`${color}20`:`linear-gradient(135deg, ${color}, ${color}cc)`,
            color:soon?muted:"#fff",
            opacity:soon?0.5:1, transition:"all 0.15s",
            boxShadow:soon?"none":`0 4px 12px ${color}35` }}>
          Create Cluster
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function KubernetesHub() {
  const { dark } = useTheme()
  const navigate = useNavigate()

  const [eksCount,    setEksCount]    = useState(null)
  const [gkeCount,    setGkeCount]    = useState(null)
  const [eksStatus,   setEksStatus]   = useState("loading")
  const [gkeStatus,   setGkeStatus]   = useState("loading")

  const bg     = dark ? "#070c18"                : "#f0f4f8"
  const card   = dark ? "rgba(255,255,255,0.03)" : "#ffffff"
  const border = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const txt    = dark ? "#e2e8f0"                : "#1e293b"
  const muted  = dark ? "#64748b"                : "#94a3b8"
  const subtle = dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"

  useEffect(() => {
    listEKSClusters()
      .then(r => { setEksCount(Array.isArray(r.data) ? r.data.length : 0); setEksStatus("connected") })
      .catch(() => { setEksCount(null); setEksStatus("error") })

    listGKEClusters()
      .then(r => { setGkeCount(Array.isArray(r.data) ? r.data.length : 0); setGkeStatus("connected") })
      .catch(() => { setGkeCount(null); setGkeStatus("error") })
  }, [])

  const clouds = [
    {
      label:"Amazon EKS", service:"EKS", color:"#FF9900",
      gradient:"linear-gradient(135deg,#FF9900,#FFB347)",
      cpCost:"$0.10/hr", soon:false,
      status: eksStatus === "connected" ? "connected" : eksStatus === "error" ? "error" : "loading",
      clusterCount: eksCount,
      features:["Multi-AZ", "Auto-scale", "Spot nodes"],
      viewPath:"/eks", createPath:"/eks",
    },
    {
      label:"Azure AKS", service:"AKS", color:"#0078D4",
      gradient:"linear-gradient(135deg,#0078D4,#50e6ff)",
      cpCost:"Free", soon:true,
      status:"soon",
      clusterCount:null,
      features:["Multi-zone", "Auto upgrade", "Free CP"],
      viewPath:"/kubernetes", createPath:"/kubernetes",
    },
    {
      label:"Google GKE", service:"GKE", color:"#4285F4",
      gradient:"linear-gradient(135deg,#4285F4,#34A853)",
      cpCost:"$0.10/hr", soon:false,
      status: gkeStatus === "connected" ? "connected" : gkeStatus === "error" ? "error" : "loading",
      clusterCount: gkeCount,
      features:["Regional HA", "Autopilot", "Spot VMs"],
      viewPath:"/gcp/kubernetes", createPath:"/gcp/kubernetes/create",
    },
  ]

  return (
    <div style={{ minHeight:"100vh", background:bg, color:txt, fontFamily:"system-ui,sans-serif" }}>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ padding:"28px 28px 0", display:"flex", alignItems:"center",
        justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:46, height:46, borderRadius:13,
            background:"linear-gradient(135deg,#FF9900 0%,#0078D4 50%,#4285F4 100%)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 16px rgba(66,133,244,0.35)" }}>
            <SvgIcon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, letterSpacing:"-0.4px" }}>Kubernetes Hub</h1>
            <p style={{ margin:"3px 0 0", fontSize:12, color:muted }}>
              Manage clusters across AWS · Azure · GCP
            </p>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <ResourceGuide cloud="aws" resource="eks" dark={dark} />
          <button onClick={() => navigate("/gcp/kubernetes")}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9,
              background:card, border:`1px solid ${border}`, color:muted,
              fontSize:12, fontWeight:600, cursor:"pointer" }}>
            <SvgIcon d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" size={13} color={muted} />
            GKE Clusters
          </button>
          <button onClick={() => navigate("/eks")}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9,
              background:card, border:`1px solid ${border}`, color:muted,
              fontSize:12, fontWeight:600, cursor:"pointer" }}>
            <SvgIcon d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" size={13} color={muted} />
            EKS Clusters
          </button>
        </div>
      </div>

      <div style={{ padding:"20px 28px", display:"flex", flexDirection:"column", gap:24 }}>

        {/* ── Cloud cards ─────────────────────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
          {clouds.map(c => (
            <CloudCard key={c.service} cloud={c} dark={dark}
              card={card} border={border} txt={txt} muted={muted} />
          ))}
        </div>

        {/* ── Pricing comparison table ────────────────────────────────────── */}
        <div style={{ background:card, border:`1px solid ${border}`, borderRadius:16, overflow:"hidden" }}>
          <div style={{ padding:"18px 22px", borderBottom:`1px solid ${border}`,
            background:dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)" }}>
            <div style={{ fontSize:15, fontWeight:800, color:txt }}>Node Pricing Comparison (per hour)</div>
            <div style={{ fontSize:12, color:muted, marginTop:4 }}>
              Control plane: <span style={{ color:"#FF9900", fontWeight:600 }}>AWS EKS $0.10/hr</span>
              {" · "}
              <span style={{ color:"#0078D4", fontWeight:600 }}>Azure AKS Free</span>
              {" · "}
              <span style={{ color:"#4285F4", fontWeight:600 }}>GCP GKE $0.10/hr</span>
            </div>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:dark?"rgba(255,255,255,0.025)":"rgba(0,0,0,0.025)" }}>
                  {["Node Config","AWS EKS","Azure AKS","GCP GKE"].map((h, i) => (
                    <th key={h} style={{ padding:"11px 18px", fontSize:11, fontWeight:700,
                      color: i === 0 ? muted : i === 1 ? "#FF9900" : i === 2 ? "#0078D4" : "#4285F4",
                      textAlign:"left", borderBottom:`1px solid ${border}`,
                      textTransform:"uppercase", letterSpacing:"0.06em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICING_ROWS.map((row, idx) => (
                  <tr key={idx}
                    style={{ background:idx % 2 === 0 ? "transparent" : (dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)"),
                      borderBottom:`1px solid ${border}` }}>
                    <td style={{ padding:"13px 18px", fontSize:13, fontWeight:700, color:txt }}>{row.config}</td>
                    <td style={{ padding:"13px 18px" }}>
                      <code style={{ fontSize:12, color:dark?"#ffb347":"#e67e00", background:dark?"rgba(255,153,0,0.08)":"rgba(255,153,0,0.08)",
                        padding:"2px 7px", borderRadius:5 }}>{row.aws}</code>
                    </td>
                    <td style={{ padding:"13px 18px" }}>
                      <code style={{ fontSize:12, color:dark?"#50e6ff":"#0066bb", background:dark?"rgba(0,120,212,0.08)":"rgba(0,120,212,0.08)",
                        padding:"2px 7px", borderRadius:5 }}>{row.azure}</code>
                    </td>
                    <td style={{ padding:"13px 18px" }}>
                      <code style={{ fontSize:12, color:dark?"#82b4ff":"#2a67c9", background:dark?"rgba(66,133,244,0.08)":"rgba(66,133,244,0.08)",
                        padding:"2px 7px", borderRadius:5 }}>{row.gcp}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:"12px 18px", borderTop:`1px solid ${border}`,
            fontSize:11, color:muted, display:"flex", alignItems:"center", gap:6,
            background:dark?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.01)" }}>
            <SvgIcon d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13} color={muted} />
            Spot/Preemptible nodes save ~60–70%. These are list prices; actual prices vary by region.
          </div>
        </div>

        {/* ── Monthly estimate helper ─────────────────────────────────────── */}
        <div style={{ background:card, border:`1px solid ${border}`, borderRadius:16, padding:"20px 22px" }}>
          <div style={{ fontSize:14, fontWeight:800, color:txt, marginBottom:4 }}>Monthly Cost Estimate</div>
          <div style={{ fontSize:12, color:muted, marginBottom:16 }}>
            Running 3 nodes of 4 vCPU / 16 GB (730 hrs/month)
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {MONTHLY_ESTIMATES.map(e => (
              <div key={e.cloud} style={{ padding:"14px 16px", borderRadius:12,
                border:`1px solid ${e.color}25`, background:`${e.color}08` }}>
                <div style={{ fontSize:12, fontWeight:700, color:e.color, marginBottom:8 }}>{e.cloud}</div>
                <div style={{ fontSize:11, color:muted, fontFamily:"'Courier New',monospace",
                  marginBottom:10, lineHeight:1.5 }}>{e.calc}</div>
                <div style={{ fontSize:22, fontWeight:800, color:e.color }}>{e.result}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:12, fontSize:11, color:muted }}>
            GCP is cheapest (~26% less than AWS) due to lower per-node pricing. Azure has no control plane fee, making it cheapest for small clusters.
          </div>
        </div>

        {/* ── Feature comparison table ────────────────────────────────────── */}
        <div style={{ background:card, border:`1px solid ${border}`, borderRadius:16, overflow:"hidden" }}>
          <div style={{ padding:"18px 22px", borderBottom:`1px solid ${border}`,
            background:dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)" }}>
            <div style={{ fontSize:15, fontWeight:800, color:txt }}>Feature Comparison</div>
            <div style={{ fontSize:12, color:muted, marginTop:4 }}>Capabilities across EKS · AKS · GKE</div>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:dark?"rgba(255,255,255,0.025)":"rgba(0,0,0,0.025)" }}>
                  {["Feature","AWS EKS","Azure AKS","GCP GKE"].map((h, i) => (
                    <th key={h} style={{ padding:"11px 18px", fontSize:11, fontWeight:700,
                      color: i === 0 ? muted : i === 1 ? "#FF9900" : i === 2 ? "#0078D4" : "#4285F4",
                      textAlign:"left", borderBottom:`1px solid ${border}`,
                      textTransform:"uppercase", letterSpacing:"0.06em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row, idx) => (
                  <tr key={idx}
                    style={{ background:idx % 2 === 0 ? "transparent" : (dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)"),
                      borderBottom:`1px solid ${border}` }}>
                    <td style={{ padding:"12px 18px", fontSize:12, fontWeight:600, color:txt }}>{row.feature}</td>
                    <td style={{ padding:"12px 18px" }}><FeatureCell value={row.aws}   muted={muted} dark={dark} /></td>
                    <td style={{ padding:"12px 18px" }}><FeatureCell value={row.azure} muted={muted} dark={dark} /></td>
                    <td style={{ padding:"12px 18px" }}><FeatureCell value={row.gcp}   muted={muted} dark={dark} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:"12px 18px", borderTop:`1px solid ${border}`,
            fontSize:11, color:muted,
            background:dark?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.01)" }}>
            <span style={{ color:"#22c55e", fontWeight:700 }}>✓</span> = Available
            {" · "}
            <span style={{ color:"#ef4444", fontWeight:700 }}>✗</span> = Not available
            {" · "}
            Text = specific implementation
          </div>
        </div>

        {/* ── Quick links ─────────────────────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {[
            { label:"Create EKS Cluster", path:"/eks", color:"#FF9900", icon:"M12 4v16m8-8H4" },
            { label:"Create GKE Cluster", path:"/gcp/kubernetes/create", color:"#4285F4", icon:"M12 4v16m8-8H4" },
            { label:"View Approvals",     path:"/approvals", color:"#f59e0b", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              style={{ padding:"14px 16px", borderRadius:12, cursor:"pointer",
                background:card, border:`1px solid ${item.color}30`,
                display:"flex", alignItems:"center", gap:10,
                transition:"all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = `${item.color}10` }}
              onMouseLeave={e => { e.currentTarget.style.background = card }}>
              <div style={{ width:32, height:32, borderRadius:9, flexShrink:0,
                background:`${item.color}18`, border:`1px solid ${item.color}30`,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <SvgIcon d={item.icon} size={14} color={item.color} />
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:txt }}>{item.label}</span>
              <SvgIcon d="M9 18l6-6-6-6" size={14} color={muted} />
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
