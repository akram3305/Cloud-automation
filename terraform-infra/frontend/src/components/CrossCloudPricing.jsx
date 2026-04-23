import { useNavigate } from "react-router-dom"

// ── Instance catalogs (representative set, no GPU) ───────────────────────────
// AWS: ap-south-1 on-demand   Azure: East US on-demand   GCP: us-central1 on-demand

const AWS_INSTANCES = [
  { t:"t3.micro",     vcpu:2,  ram:1,    price:0.0114 },
  { t:"t3.small",     vcpu:2,  ram:2,    price:0.0228 },
  { t:"t3.medium",    vcpu:2,  ram:4,    price:0.0456 },
  { t:"t3.large",     vcpu:2,  ram:8,    price:0.0912 },
  { t:"t3.xlarge",    vcpu:4,  ram:16,   price:0.1824 },
  { t:"t3.2xlarge",   vcpu:8,  ram:32,   price:0.3648 },
  { t:"m5.large",     vcpu:2,  ram:8,    price:0.1070 },
  { t:"m5.xlarge",    vcpu:4,  ram:16,   price:0.2140 },
  { t:"m5.2xlarge",   vcpu:8,  ram:32,   price:0.4280 },
  { t:"m5.4xlarge",   vcpu:16, ram:64,   price:0.8560 },
  { t:"m6i.large",    vcpu:2,  ram:8,    price:0.1120 },
  { t:"m6i.xlarge",   vcpu:4,  ram:16,   price:0.2240 },
  { t:"m6i.2xlarge",  vcpu:8,  ram:32,   price:0.4480 },
  { t:"m6i.4xlarge",  vcpu:16, ram:64,   price:0.8960 },
  { t:"m6i.8xlarge",  vcpu:32, ram:128,  price:1.7920 },
  { t:"m6i.16xlarge", vcpu:64, ram:256,  price:3.5840 },
  { t:"c5.large",     vcpu:2,  ram:4,    price:0.0960 },
  { t:"c5.xlarge",    vcpu:4,  ram:8,    price:0.1920 },
  { t:"c5.2xlarge",   vcpu:8,  ram:16,   price:0.3840 },
  { t:"c5.4xlarge",   vcpu:16, ram:32,   price:0.7680 },
  { t:"c5.9xlarge",   vcpu:36, ram:72,   price:1.7280 },
  { t:"r5.large",     vcpu:2,  ram:16,   price:0.1410 },
  { t:"r5.xlarge",    vcpu:4,  ram:32,   price:0.2820 },
  { t:"r5.2xlarge",   vcpu:8,  ram:64,   price:0.5640 },
  { t:"r5.4xlarge",   vcpu:16, ram:128,  price:1.0080 },
  { t:"r5.8xlarge",   vcpu:32, ram:256,  price:2.0160 },
]

const AZURE_INSTANCES = [
  { t:"Standard_B1ms",    vcpu:1,  ram:2,    price:0.0207 },
  { t:"Standard_B2s",     vcpu:2,  ram:4,    price:0.0456 },
  { t:"Standard_B2ms",    vcpu:2,  ram:8,    price:0.0832 },
  { t:"Standard_B4ms",    vcpu:4,  ram:16,   price:0.1660 },
  { t:"Standard_B8ms",    vcpu:8,  ram:32,   price:0.3320 },
  { t:"Standard_B16ms",   vcpu:16, ram:64,   price:0.6640 },
  { t:"Standard_D2s_v5",  vcpu:2,  ram:8,    price:0.0960 },
  { t:"Standard_D4s_v5",  vcpu:4,  ram:16,   price:0.1920 },
  { t:"Standard_D8s_v5",  vcpu:8,  ram:32,   price:0.3840 },
  { t:"Standard_D16s_v5", vcpu:16, ram:64,   price:0.7680 },
  { t:"Standard_D32s_v5", vcpu:32, ram:128,  price:1.5360 },
  { t:"Standard_D64s_v5", vcpu:64, ram:256,  price:3.0720 },
  { t:"Standard_F2s_v2",  vcpu:2,  ram:4,    price:0.0846 },
  { t:"Standard_F4s_v2",  vcpu:4,  ram:8,    price:0.1690 },
  { t:"Standard_F8s_v2",  vcpu:8,  ram:16,   price:0.3380 },
  { t:"Standard_F16s_v2", vcpu:16, ram:32,   price:0.6760 },
  { t:"Standard_F32s_v2", vcpu:32, ram:64,   price:1.3520 },
  { t:"Standard_E2s_v5",  vcpu:2,  ram:16,   price:0.1260 },
  { t:"Standard_E4s_v5",  vcpu:4,  ram:32,   price:0.2520 },
  { t:"Standard_E8s_v5",  vcpu:8,  ram:64,   price:0.5040 },
  { t:"Standard_E16s_v5", vcpu:16, ram:128,  price:1.0080 },
  { t:"Standard_E32s_v5", vcpu:32, ram:256,  price:2.0160 },
]

const GCP_INSTANCES = [
  { t:"e2-micro",        vcpu:0.25, ram:1,    price:0.0084 },
  { t:"e2-small",        vcpu:0.5,  ram:2,    price:0.0168 },
  { t:"e2-medium",       vcpu:1,    ram:4,    price:0.0336 },
  { t:"e2-standard-2",   vcpu:2,    ram:8,    price:0.0671 },
  { t:"e2-standard-4",   vcpu:4,    ram:16,   price:0.1342 },
  { t:"e2-standard-8",   vcpu:8,    ram:32,   price:0.2684 },
  { t:"e2-standard-16",  vcpu:16,   ram:64,   price:0.5368 },
  { t:"e2-standard-32",  vcpu:32,   ram:128,  price:1.0736 },
  { t:"e2-highmem-2",    vcpu:2,    ram:16,   price:0.0900 },
  { t:"e2-highmem-4",    vcpu:4,    ram:32,   price:0.1800 },
  { t:"e2-highmem-8",    vcpu:8,    ram:64,   price:0.3601 },
  { t:"e2-highmem-16",   vcpu:16,   ram:128,  price:0.7201 },
  { t:"n2-standard-2",   vcpu:2,    ram:8,    price:0.0971 },
  { t:"n2-standard-4",   vcpu:4,    ram:16,   price:0.1942 },
  { t:"n2-standard-8",   vcpu:8,    ram:32,   price:0.3885 },
  { t:"n2-standard-16",  vcpu:16,   ram:64,   price:0.7769 },
  { t:"n2-standard-32",  vcpu:32,   ram:128,  price:1.5539 },
  { t:"n2-standard-64",  vcpu:64,   ram:256,  price:3.1077 },
  { t:"n2-highmem-2",    vcpu:2,    ram:16,   price:0.1310 },
  { t:"n2-highmem-4",    vcpu:4,    ram:32,   price:0.2620 },
  { t:"n2-highmem-8",    vcpu:8,    ram:64,   price:0.5241 },
  { t:"n2-highmem-16",   vcpu:16,   ram:128,  price:1.0482 },
  { t:"n2-highmem-32",   vcpu:32,   ram:256,  price:2.0963 },
  { t:"c2-standard-4",   vcpu:4,    ram:16,   price:0.2088 },
  { t:"c2-standard-8",   vcpu:8,    ram:32,   price:0.4176 },
  { t:"c2-standard-16",  vcpu:16,   ram:64,   price:0.8352 },
  { t:"c2-standard-30",  vcpu:30,   ram:120,  price:1.5660 },
  { t:"c2-standard-60",  vcpu:60,   ram:240,  price:3.1321 },
]

// ── Find closest instance by vCPU + RAM ratio distance ──────────────────────
function findClosest(catalog, targetVcpu, targetRam) {
  if (!catalog.length) return null
  const tv = Math.max(targetVcpu, 0.1)
  const tr = Math.max(targetRam, 0.1)
  const scored = catalog.map(inst => {
    const vRatio = inst.vcpu / tv
    const rRatio = inst.ram  / tr
    return { ...inst, _score: Math.abs(vRatio - 1) + Math.abs(rRatio - 1) }
  })
  scored.sort((a, b) => a._score - b._score || a.price - b.price)
  const best = scored[0]
  const isExact = best._score < 0.12 // within ~10% on both dimensions
  const meetsReqs = best.vcpu >= targetVcpu && best.ram >= targetRam
  return {
    ...best,
    matchType: isExact ? "exact" : meetsReqs ? "closest" : "lower",
  }
}

const CLOUDS = [
  {
    id:      "aws",
    name:    "Amazon Web Services",
    short:   "AWS",
    color:   "#FF9900",
    bgColor: "rgba(255,153,0,0.08)",
    bdColor: "rgba(255,153,0,0.25)",
    path:    "/compute",
    region:  "ap-south-1",
    catalog: AWS_INSTANCES,
    logo: (
      <svg width="22" height="22" viewBox="0 0 80 80" fill="none">
        <path d="M22 53c-6-2-10-6-10-12 0-7 6-12 13-13a16 16 0 0130-1c7 1 13 7 13 14 0 5-3 10-7 12" stroke="#FF9900" strokeWidth="5" strokeLinecap="round" fill="none"/>
        <path d="M28 62l-6 6M40 65v7M52 62l6 6" stroke="#FF9900" strokeWidth="5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id:      "azure",
    name:    "Microsoft Azure",
    short:   "Azure",
    color:   "#0078D4",
    bgColor: "rgba(0,120,212,0.08)",
    bdColor: "rgba(0,120,212,0.25)",
    path:    "/azure/compute/create",
    region:  "East US",
    catalog: AZURE_INSTANCES,
    logo: (
      <svg width="22" height="22" viewBox="0 0 96 96" fill="none">
        <path d="M34 8L6 62h24l32-54H34zM44 42L26 88h52L44 42z" fill="#0078D4"/>
      </svg>
    ),
  },
  {
    id:      "gcp",
    name:    "Google Cloud",
    short:   "GCP",
    color:   "#4285F4",
    bgColor: "rgba(66,133,244,0.08)",
    bdColor: "rgba(66,133,244,0.25)",
    path:    "/gcp/compute/create",
    region:  "us-central1",
    catalog: GCP_INSTANCES,
    logo: (
      <svg width="22" height="22" viewBox="0 0 92 92" fill="none">
        <path d="M46 20a26 26 0 010 52 26 26 0 010-52z" fill="none" stroke="#4285F4" strokeWidth="7"/>
        <path d="M46 10V4M46 88v-6M10 46H4M88 46h-6" stroke="#4285F4" strokeWidth="5" strokeLinecap="round"/>
        <circle cx="46" cy="46" r="8" fill="#4285F4"/>
      </svg>
    ),
  },
]

// ── Storage pricing (per GB/month) ────────────────────────────────────────────
const STORAGE_PRICING = [
  { id:"aws",   name:"Amazon S3",         color:"#FF9900", pricePerGb:0.023, unit:"Standard Storage",   path:"/storage" },
  { id:"azure", name:"Azure Blob Storage",color:"#0078D4", pricePerGb:0.018, unit:"LRS Hot Tier",       path:"/azure/storage" },
  { id:"gcp",   name:"Google Cloud Storage",color:"#4285F4",pricePerGb:0.020,unit:"Standard Class",     path:"/gcp/cost" },
]

export default function CrossCloudPricing({ isOpen, onClose, currentCloud, vcpu, ramGb, dark, resourceType = "compute" }) {
  const navigate = useNavigate()

  if (!isOpen) return null

  const bg      = dark ? "rgba(7,12,24,0.96)"  : "rgba(240,244,248,0.96)"
  const surface = dark ? "#0f172a"              : "#ffffff"
  const border  = dark ? "#1e293b"              : "#e2e8f0"
  const text     = dark ? "#f1f5f9"             : "#0f172a"
  const muted    = dark ? "#64748b"             : "#94a3b8"
  const sub      = dark ? "#334155"             : "#f1f5f9"

  // ── Compute comparison ──
  const results = CLOUDS.map(cloud => ({
    cloud,
    result: findClosest(cloud.catalog, vcpu, ramGb),
  }))

  const sortedByPrice = [...results].sort((a, b) => a.result.price - b.result.price)
  const cheapestId    = sortedByPrice[0]?.cloud.id

  function handleDeploy(cloud) {
    onClose()
    const state = cloud.id === "aws"
      ? { openCreate: true, prefill: { vcpu, ram_gb: ramGb } }
      : { prefill: { vcpu, ram_gb: ramGb } }
    navigate(cloud.path, { state })
  }

  const matchLabel = {
    exact:   { text: "Exact Match",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    closest: { text: "Closest Match ↑",color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    lower:   { text: "Lower Spec ↓",   color: "#f43f5e", bg: "rgba(244,63,94,0.12)"  },
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position:"fixed", inset:0, zIndex:9999,
        background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)",
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:16,
      }}
    >
      <div style={{
        background:surface, borderRadius:16, border:`1px solid ${border}`,
        width:"100%", maxWidth:720, maxHeight:"92vh", overflowY:"auto",
        boxShadow:"0 24px 80px rgba(0,0,0,0.5)",
        animation:"ccpSlideIn 0.22s ease both",
      }}>
        <style>{`@keyframes ccpSlideIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:`1px solid ${border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#667eea,#764ba2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:text }}>Compare Cloud Prices</div>
              <div style={{ fontSize:11, color:muted }}>Equivalent configurations across AWS · Azure · GCP</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:8, border:`1px solid ${border}`, background:"transparent", color:muted, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>✕</button>
        </div>

        {/* Config banner */}
        <div style={{ margin:"16px 24px 0", padding:"10px 16px", borderRadius:10, background:sub, border:`1px solid ${border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div style={{ fontSize:12, color:muted }}>
            Comparing for: <span style={{ fontFamily:"monospace", fontWeight:700, color:text }}>{resourceType === "compute" ? `${vcpu} vCPU · ${ramGb} GiB RAM` : resourceType}</span>
          </div>
          <div style={{ fontSize:11, color:muted }}>Sorted by price · On-demand rates</div>
        </div>

        {/* Cloud cards */}
        <div style={{ padding:"16px 24px", display:"grid", gap:12 }}>
          {sortedByPrice.map(({ cloud, result }, idx) => {
            const isCurrent  = cloud.id === currentCloud
            const isCheapest = cloud.id === cheapestId && !isCurrent
            const ml = matchLabel[result.matchType] || matchLabel.closest
            const monthly = (result.price * 730).toFixed(0)

            return (
              <div key={cloud.id} style={{
                borderRadius:12,
                border: isCurrent
                  ? `2px solid ${cloud.color}`
                  : `1px solid ${border}`,
                background: isCurrent ? cloud.bgColor : (dark ? "rgba(255,255,255,0.02)" : "#fafbfc"),
                padding:"16px 20px",
                transition:"border-color 0.15s",
                position:"relative",
                overflow:"hidden",
              }}>
                {/* Best value ribbon */}
                {isCheapest && (
                  <div style={{ position:"absolute", top:0, right:0, background:"linear-gradient(135deg,#10b981,#059669)", color:"#fff", fontSize:9, fontWeight:800, padding:"3px 10px", borderBottomLeftRadius:8, letterSpacing:"0.05em" }}>
                    BEST PRICE
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position:"absolute", top:0, right:0, background:cloud.color, color:"#fff", fontSize:9, fontWeight:800, padding:"3px 10px", borderBottomLeftRadius:8, letterSpacing:"0.05em" }}>
                    CURRENT
                  </div>
                )}

                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                  {/* Left: cloud info + instance */}
                  <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
                    <div style={{ width:42, height:42, borderRadius:10, background:cloud.bgColor, border:`1px solid ${cloud.bdColor}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {cloud.logo}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:text, marginBottom:2 }}>{cloud.name}</div>
                      <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:cloud.color, marginBottom:6 }}>{result.t}</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {[
                          { label:`${result.vcpu} vCPU` },
                          { label:`${result.ram} GiB RAM` },
                          { label:cloud.region, style:{ color:muted } },
                        ].map(({ label, style }) => (
                          <span key={label} style={{ fontSize:11, padding:"2px 8px", borderRadius:5, background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)", color:muted, ...style }}>{label}</span>
                        ))}
                        <span style={{ fontSize:11, padding:"2px 8px", borderRadius:5, background:ml.bg, color:ml.color, fontWeight:600 }}>{ml.text}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: price + action */}
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:24, fontWeight:800, color:cloud.color, lineHeight:1 }}>
                      ${result.price.toFixed(4)}
                      <span style={{ fontSize:12, fontWeight:400, color:muted }}>/hr</span>
                    </div>
                    <div style={{ fontSize:12, color:muted, marginBottom:12 }}>~${monthly}/month</div>

                    {isCurrent ? (
                      <div style={{ padding:"8px 16px", borderRadius:8, background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", border:`1px solid ${border}`, color:muted, fontSize:12, fontWeight:600 }}>
                        You are here
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDeploy(cloud)}
                        style={{
                          padding:"8px 16px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer",
                          background:cloud.bgColor, border:`1px solid ${cloud.bdColor}`,
                          color:cloud.color, transition:"all 0.15s",
                          display:"flex", alignItems:"center", gap:6,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = cloud.color; e.currentTarget.style.color = "#fff" }}
                        onMouseLeave={e => { e.currentTarget.style.background = cloud.bgColor; e.currentTarget.style.color = cloud.color }}
                      >
                        Deploy on {cloud.short}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Savings vs cheapest */}
                {!isCurrent && idx > 0 && (() => {
                  const cheapest = sortedByPrice[0].result.price
                  const pct = (((result.price - cheapest) / cheapest) * 100).toFixed(0)
                  if (pct <= 0) return null
                  return (
                    <div style={{ marginTop:12, paddingTop:10, borderTop:`1px dashed ${border}`, fontSize:11, color:muted }}>
                      {pct}% more expensive than cheapest option (${cheapest.toFixed(4)}/hr on {sortedByPrice[0].cloud.short})
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>

        {/* Storage pricing section */}
        <div style={{ margin:"0 24px 16px", padding:"14px 16px", borderRadius:12, background:sub, border:`1px solid ${border}` }}>
          <div style={{ fontSize:12, fontWeight:700, color:text, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Object Storage Pricing <span style={{ fontWeight:400, color:muted }}>(per GB/month · standard tier)</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {STORAGE_PRICING.map(s => (
              <div key={s.id} style={{ padding:"8px 12px", borderRadius:8, background:surface, border:`1px solid ${border}`, textAlign:"center" }}>
                <div style={{ fontSize:11, fontWeight:600, color:s.color, marginBottom:2 }}>{s.name}</div>
                <div style={{ fontSize:16, fontWeight:800, color:text }}>${s.pricePerGb.toFixed(3)}</div>
                <div style={{ fontSize:10, color:muted }}>{s.unit}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 24px", borderTop:`1px solid ${border}`, fontSize:10, color:muted, lineHeight:1.6 }}>
          Prices are on-demand estimates: AWS (ap-south-1), Azure (East US), GCP (us-central1). Actual costs vary by region, reserved pricing, and sustained-use discounts. Clicking "Deploy" navigates to that cloud's launch page with the closest available configuration pre-selected.
        </div>
      </div>
    </div>
  )
}
