import { useState, useEffect, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import api, { getPriceEstimate, createRequest } from "../api/api"
import CrossCloudPricing from "../components/CrossCloudPricing"

// ── Instance families — on-demand pricing (ap-south-1) ───────────────────
const INSTANCE_FAMILIES = [
  {
    group:"General Purpose", color:"#3b82f6", desc:"Balanced compute, memory, and networking for a wide range of workloads",
    types:[
      { t:"t3.micro",    vcpu:2,  ram:"1 GiB",    price:0.0114, network:"Up to 5 Gbps",   free:true },
      { t:"t3.small",    vcpu:2,  ram:"2 GiB",    price:0.0228, network:"Up to 5 Gbps" },
      { t:"t3.medium",   vcpu:2,  ram:"4 GiB",    price:0.0456, network:"Up to 5 Gbps" },
      { t:"t3.large",    vcpu:2,  ram:"8 GiB",    price:0.0912, network:"Up to 5 Gbps" },
      { t:"t3.xlarge",   vcpu:4,  ram:"16 GiB",   price:0.1824, network:"Up to 5 Gbps" },
      { t:"t3.2xlarge",  vcpu:8,  ram:"32 GiB",   price:0.3648, network:"Up to 5 Gbps" },
      { t:"m5.large",    vcpu:2,  ram:"8 GiB",    price:0.1070, network:"Up to 10 Gbps" },
      { t:"m5.xlarge",   vcpu:4,  ram:"16 GiB",   price:0.2140, network:"Up to 10 Gbps" },
      { t:"m5.2xlarge",  vcpu:8,  ram:"32 GiB",   price:0.4280, network:"Up to 10 Gbps" },
      { t:"m5.4xlarge",  vcpu:16, ram:"64 GiB",   price:0.8560, network:"Up to 10 Gbps" },
      { t:"m6i.large",   vcpu:2,  ram:"8 GiB",    price:0.1120, network:"Up to 12.5 Gbps" },
      { t:"m6i.xlarge",  vcpu:4,  ram:"16 GiB",   price:0.2240, network:"Up to 12.5 Gbps" },
      { t:"m6i.2xlarge", vcpu:8,  ram:"32 GiB",   price:0.4480, network:"Up to 12.5 Gbps" },
      { t:"m6i.4xlarge", vcpu:16, ram:"64 GiB",   price:0.8960, network:"12.5 Gbps" },
    ],
  },
  {
    group:"Compute Optimised", color:"#f59e0b", desc:"High performance processors for compute-intensive workloads — web servers, HPC, batch",
    types:[
      { t:"c5.large",    vcpu:2,  ram:"4 GiB",    price:0.0960, network:"Up to 10 Gbps" },
      { t:"c5.xlarge",   vcpu:4,  ram:"8 GiB",    price:0.1920, network:"Up to 10 Gbps" },
      { t:"c5.2xlarge",  vcpu:8,  ram:"16 GiB",   price:0.3840, network:"Up to 10 Gbps" },
      { t:"c5.4xlarge",  vcpu:16, ram:"32 GiB",   price:0.7680, network:"10 Gbps" },
      { t:"c6i.large",   vcpu:2,  ram:"4 GiB",    price:0.0952, network:"Up to 12.5 Gbps" },
      { t:"c6i.xlarge",  vcpu:4,  ram:"8 GiB",    price:0.1904, network:"Up to 12.5 Gbps" },
      { t:"c6i.2xlarge", vcpu:8,  ram:"16 GiB",   price:0.3808, network:"Up to 12.5 Gbps" },
      { t:"c6i.4xlarge", vcpu:16, ram:"32 GiB",   price:0.7616, network:"12.5 Gbps" },
      { t:"c5n.large",   vcpu:2,  ram:"5.25 GiB", price:0.1260, network:"Up to 25 Gbps" },
      { t:"c5n.xlarge",  vcpu:4,  ram:"10.5 GiB", price:0.2520, network:"Up to 25 Gbps" },
      { t:"c5n.2xlarge", vcpu:8,  ram:"21 GiB",   price:0.5040, network:"Up to 25 Gbps" },
    ],
  },
  {
    group:"Memory Optimised", color:"#a78bfa", desc:"Fast performance for workloads that process large in-memory datasets — databases, caches",
    types:[
      { t:"r5.large",       vcpu:2,  ram:"16 GiB",   price:0.1410, network:"Up to 10 Gbps" },
      { t:"r5.xlarge",      vcpu:4,  ram:"32 GiB",   price:0.2820, network:"Up to 10 Gbps" },
      { t:"r5.2xlarge",     vcpu:8,  ram:"64 GiB",   price:0.5640, network:"Up to 10 Gbps" },
      { t:"r5.4xlarge",     vcpu:16, ram:"128 GiB",  price:1.0080, network:"Up to 10 Gbps" },
      { t:"r6i.large",      vcpu:2,  ram:"16 GiB",   price:0.1470, network:"Up to 12.5 Gbps" },
      { t:"r6i.xlarge",     vcpu:4,  ram:"32 GiB",   price:0.2940, network:"Up to 12.5 Gbps" },
      { t:"r6i.2xlarge",    vcpu:8,  ram:"64 GiB",   price:0.5880, network:"Up to 12.5 Gbps" },
      { t:"r6i.4xlarge",    vcpu:16, ram:"128 GiB",  price:1.1760, network:"12.5 Gbps" },
      { t:"x2idn.16xlarge", vcpu:64, ram:"1024 GiB", price:6.6690, network:"50 Gbps" },
    ],
  },
  {
    group:"GPU / ML", color:"#f43f5e", desc:"Accelerated computing with NVIDIA GPUs for machine learning, AI inference, and graphics",
    types:[
      { t:"g4dn.xlarge",  vcpu:4,  ram:"16 GiB", price:0.7360, network:"Up to 25 Gbps", gpu:"1x NVIDIA T4" },
      { t:"g4dn.2xlarge", vcpu:8,  ram:"32 GiB", price:1.1760, network:"Up to 25 Gbps", gpu:"1x NVIDIA T4" },
      { t:"g4dn.4xlarge", vcpu:16, ram:"64 GiB", price:1.5040, network:"Up to 25 Gbps", gpu:"1x NVIDIA T4" },
      { t:"p3.2xlarge",   vcpu:8,  ram:"61 GiB", price:3.0600, network:"Up to 10 Gbps", gpu:"1x NVIDIA V100" },
      { t:"p3.8xlarge",   vcpu:32, ram:"244 GiB",price:12.240, network:"10 Gbps",        gpu:"4x NVIDIA V100" },
    ],
  },
  {
    group:"ARM / Graviton", color:"#00d4aa", desc:"Best price-performance for a wide variety of workloads using AWS Graviton3 processors",
    types:[
      { t:"t4g.micro",   vcpu:2, ram:"1 GiB",  price:0.0091, network:"Up to 5 Gbps", free:true },
      { t:"t4g.small",   vcpu:2, ram:"2 GiB",  price:0.0183, network:"Up to 5 Gbps" },
      { t:"t4g.medium",  vcpu:2, ram:"4 GiB",  price:0.0365, network:"Up to 5 Gbps" },
      { t:"t4g.large",   vcpu:2, ram:"8 GiB",  price:0.0730, network:"Up to 5 Gbps" },
      { t:"m6g.large",   vcpu:2, ram:"8 GiB",  price:0.0770, network:"Up to 10 Gbps" },
      { t:"m6g.xlarge",  vcpu:4, ram:"16 GiB", price:0.1540, network:"Up to 10 Gbps" },
      { t:"m6g.2xlarge", vcpu:8, ram:"32 GiB", price:0.3080, network:"Up to 10 Gbps" },
      { t:"c6g.large",   vcpu:2, ram:"4 GiB",  price:0.0680, network:"Up to 10 Gbps" },
      { t:"c6g.xlarge",  vcpu:4, ram:"8 GiB",  price:0.1360, network:"Up to 10 Gbps" },
    ],
  },
  {
    group:"Network Optimized", color:"#06b6d4", desc:"Enhanced networking up to 100 Gbps for latency-sensitive, HPC, and data-intensive workloads",
    types:[
      { t:"c5n.4xlarge",  vcpu:16, ram:"42 GiB",   price:1.0080, network:"25 Gbps" },
      { t:"c5n.9xlarge",  vcpu:36, ram:"96 GiB",   price:2.2680, network:"50 Gbps" },
      { t:"c5n.18xlarge", vcpu:72, ram:"192 GiB",  price:4.5360, network:"100 Gbps" },
      { t:"p4d.24xlarge", vcpu:96, ram:"1152 GiB", price:32.773, network:"400 Gbps", gpu:"8x NVIDIA A100 40GB" },
    ],
  },
]

const AMIS = [
  { id:"ami-amazon-linux-2023", name:"Amazon Linux 2023",    desc:"AWS-optimised, latest security patches",       icon:"🐧", arch:"x86_64 / ARM64" },
  { id:"ami-ubuntu-22-04",      name:"Ubuntu 22.04 LTS",     desc:"Most popular Linux distribution",              icon:"🟠", arch:"x86_64 / ARM64" },
  { id:"ami-ubuntu-20-04",      name:"Ubuntu 20.04 LTS",     desc:"Stable long-term support release",             icon:"🟠", arch:"x86_64 / ARM64" },
  { id:"ami-debian-12",         name:"Debian 12",            desc:"Rock-solid stability for servers",              icon:"🔴", arch:"x86_64" },
  { id:"ami-rhel-9",            name:"RHEL 9",               desc:"Enterprise Linux, fully supported",             icon:"🎩", arch:"x86_64" },
  { id:"ami-windows-2022",      name:"Windows Server 2022",  desc:"Microsoft Windows for cloud workloads",        icon:"🪟", arch:"x86_64" },
]

const REGIONS = [
  "ap-south-1","ap-south-2","ap-southeast-1","ap-southeast-2","ap-northeast-1",
  "us-east-1","us-east-2","us-west-1","us-west-2",
  "eu-west-1","eu-west-2","eu-central-1","eu-north-1",
  "ca-central-1","sa-east-1",
]

const EBS_TYPES = [
  { id:"gp3", name:"gp3 — General Purpose SSD",       price:0.080, desc:"Default — 3000 IOPS baseline, up to 16000 IOPS. Best price-performance." },
  { id:"gp2", name:"gp2 — General Purpose SSD",       price:0.100, desc:"Previous gen — 3 IOPS/GiB, up to 16000 IOPS" },
  { id:"io1", name:"io1 — Provisioned IOPS SSD",      price:0.125, desc:"High performance — up to 64000 IOPS, for latency-sensitive workloads" },
  { id:"st1", name:"st1 — Throughput Optimised HDD",  price:0.045, desc:"Big data, log processing, sequential I/O workloads" },
  { id:"sc1", name:"sc1 — Cold HDD (lowest cost)",    price:0.025, desc:"Infrequently accessed data — lowest storage cost" },
]

const APP_PURPOSES = ["Web Server", "Database", "ML Training", "Data Processing", "General", "Custom"]

const STEPS = ["Name & Tags", "OS / AMI", "Instance Type", "Network & Security", "Storage", "Review & Launch"]

const KEYFRAMES = `
@keyframes fadeUp {
  from { opacity:0; transform:translateY(16px); }
  to   { opacity:1; transform:translateY(0); }
}
`

export default function EC2Launch() {
  const { dark } = useTheme()
  const navigate     = useNavigate()
  const { state: routerState } = useLocation()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"

  const [step,           setStep]          = useState(0)
  const [name,           setName]          = useState("")
  const [region,         setRegion]        = useState("ap-south-1")
  const [env,            setEnv]           = useState("dev")
  const [project,        setProject]       = useState("")
  const [owner,          setOwner]         = useState("")
  const [appPurpose,     setAppPurpose]    = useState("General")
  const [ami,            setAmi]           = useState(AMIS[0])
  const [familyIdx,      setFamilyIdx]     = useState(0)
  const [instance,       setInstance]      = useState(INSTANCE_FAMILIES[0].types[0])
  const [instanceSearch, setInstanceSearch]= useState("")
  const [keyPair,        setKeyPair]       = useState("")
  const [keypairs,       setKeypairs]      = useState([])
  const [allowSSH,       setAllowSSH]      = useState(true)
  const [allowHTTP,      setAllowHTTP]     = useState(false)
  const [allowHTTPS,     setAllowHTTPS]    = useState(false)
  const [publicIP,       setPublicIP]      = useState(true)
  const [rootGB,         setRootGB]        = useState(20)
  const [ebsType,        setEbsType]       = useState(EBS_TYPES[0])
  const [submitting,     setSubmitting]    = useState(false)
  const [error,          setError]         = useState("")
  const [success,        setSuccess]       = useState(false)
  const [showCompare,    setShowCompare]   = useState(false)

  // Pre-select instance when redirected from cross-cloud comparison
  useEffect(() => {
    const prefill = routerState?.prefill
    if (!prefill) return
    const { vcpu: pv, ram_gb: pr } = prefill
    let best = null, bestScore = Infinity, bestFi = 0
    INSTANCE_FAMILIES.forEach((fam, fi) => {
      fam.types.forEach(t => {
        const tRam = parseFloat(t.ram)
        const vRatio = t.vcpu / Math.max(pv, 0.1)
        const rRatio = tRam  / Math.max(pr, 0.1)
        const score = Math.abs(vRatio - 1) + Math.abs(rRatio - 1)
        if (score < bestScore) { bestScore = score; best = t; bestFi = fi }
      })
    })
    if (best) { setFamilyIdx(bestFi); setInstance(best); setStep(2) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get(`/iam/keypairs?region=${region}`).then(r => setKeypairs(r.data || [])).catch(() => {})
  }, [region])

  const filteredTypes = useMemo(() => {
    const fam = INSTANCE_FAMILIES[familyIdx]
    if (!instanceSearch.trim()) return fam.types
    const q = instanceSearch.toLowerCase()
    return fam.types.filter(t =>
      t.t.toLowerCase().includes(q) ||
      String(t.vcpu).includes(q) ||
      t.ram.toLowerCase().includes(q) ||
      t.network.toLowerCase().includes(q)
    )
  }, [familyIdx, instanceSearch])

  const ebsPerMonth = (ebsType.price * rootGB).toFixed(2)
  const totalHr     = instance.price.toFixed(4)
  const totalMonth  = (instance.price * 730).toFixed(2)
  const totalFull   = (instance.price * 730 + Number(ebsPerMonth)).toFixed(0)

  const reserved1yr  = (instance.price * 730 * 0.64).toFixed(0)
  const reserved3yr  = (instance.price * 730 * 0.40).toFixed(0)

  async function handleLaunch() {
    setSubmitting(true); setError("")
    try {
      await createRequest({
        resource_type:"ec2",
        region,
        payload:{
          name:                name || `instance-${Date.now()}`,
          instance_type:       instance.t,
          ami_id:              ami.id,
          environment:         env,
          project,
          owner,
          app_purpose:         appPurpose,
          key_pair:            keyPair,
          allow_ssh:           allowSSH,
          allow_http:          allowHTTP,
          allow_https:         allowHTTPS,
          associate_public_ip: publicIP,
          root_volume_size:    rootGB,
          root_volume_type:    ebsType.id,
        }
      })
      setSuccess(true)
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to submit request")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:bg }}>
        <style>{KEYFRAMES}</style>
        <div style={{ textAlign:"center", padding:48, animation:"fadeUp 0.5s ease both" }}>
          <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#FF9900,#FFB347)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", boxShadow:"0 0 32px rgba(255,153,0,0.4)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h2 style={{ fontSize:22, fontWeight:700, color:text, marginBottom:8 }}>Instance request submitted!</h2>
          <p style={{ color:muted, marginBottom:28, maxWidth:380, margin:"0 auto 28px" }}>Your EC2 instance will be provisioned shortly. Track progress in the Activity Log.</p>
          <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
            <button onClick={() => navigate("/activity")} style={{ padding:"11px 28px", borderRadius:10, background:"linear-gradient(135deg,#FF9900,#FFB347)", border:"none", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", boxShadow:"0 4px 16px rgba(255,153,0,0.4)" }}>View Activity</button>
            <button onClick={() => navigate("/compute")} style={{ padding:"11px 24px", borderRadius:10, background:"transparent", border:`1px solid ${border}`, color:text, fontSize:14, cursor:"pointer" }}>EC2 Instances</button>
          </div>
        </div>
      </div>
    )
  }

  const inp = {
    width:"100%", boxSizing:"border-box",
    background:surface, border:`1px solid ${border}`,
    borderRadius:8, padding:"9px 12px",
    fontSize:13, color:text, fontFamily:"inherit", outline:"none",
  }

  // ── AWS-style step progress bar ─────────────────────────────────────────
  function StepBar() {
    return (
      <div style={{ display:"flex", alignItems:"center", marginBottom:32 }}>
        {STEPS.map((s, i) => {
          const done    = i < step
          const current = i === step
          return (
            <div key={s} style={{ display:"flex", alignItems:"center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
              <div
                onClick={() => done && setStep(i)}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, cursor:done?"pointer":"default", flexShrink:0 }}
              >
                <div style={{
                  width:32, height:32, borderRadius:"50%",
                  background: done ? "#10b981" : current ? "#FF9900" : "transparent",
                  border: done ? "none" : current ? "none" : `2px solid ${border}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:12, fontWeight:700, color: (done || current) ? "#fff" : muted,
                  transition:"all 0.2s",
                  boxShadow: current ? "0 0 0 4px rgba(255,153,0,0.2)" : done ? "0 0 0 4px rgba(16,185,129,0.15)" : "none",
                }}>
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : i + 1}
                </div>
                <div style={{ fontSize:10, fontWeight:600, color:done?"#10b981":current?"#FF9900":muted, whiteSpace:"nowrap", textAlign:"center", maxWidth:60 }}>{s}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex:1, height:2, background:done?"#10b981":border, margin:"0 4px", marginBottom:18, transition:"background 0.3s" }} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
    <div style={{ background:bg, minHeight:"100vh" }}>
      <style>{KEYFRAMES}</style>

      {/* Top bar */}
      <div style={{ background:surface, borderBottom:`1px solid ${border}`, padding:"14px 32px", display:"flex", alignItems:"center", gap:14 }}>
        <button onClick={() => navigate("/services")} style={{ background:"transparent", border:"none", cursor:"pointer", color:muted, display:"flex", alignItems:"center", gap:6, fontSize:13 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Services
        </button>
        <span style={{ color:muted }}>/</span>
        <span style={{ fontSize:13, color:muted }}>EC2</span>
        <span style={{ color:muted }}>/</span>
        <span style={{ fontSize:13, fontWeight:600, color:"#FF9900" }}>Launch Instance</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 308px", maxWidth:1320, margin:"0 auto" }}>
        {/* ── Left: wizard ── */}
        <div style={{ padding:32, animation:"fadeUp 0.4s ease both" }}>
          <StepBar />

          {/* Step 0 — Name & Tags */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Name and Tags</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:24 }}>Provide a name and metadata to identify and organise your instance.</p>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Instance Name <span style={{ color:"#f43f5e" }}>*</span></label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="my-web-server-01"
                    style={{ ...inp, borderColor: name ? border : "rgba(255,153,0,0.4)" }} />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Region</label>
                  <select value={region} onChange={e => setRegion(e.target.value)} style={{ ...inp }}>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:16 }}>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Environment</label>
                  <select value={env} onChange={e => setEnv(e.target.value)} style={{ ...inp }}>
                    {["dev","staging","prod"].map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Project Tag</label>
                  <input value={project} onChange={e => setProject(e.target.value)} placeholder="my-project"
                    style={{ ...inp }} />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Owner Tag</label>
                  <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="team@company.com"
                    style={{ ...inp }} />
                </div>
              </div>

              <div>
                <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Application Purpose</label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
                  {APP_PURPOSES.map(p => (
                    <button key={p} onClick={() => setAppPurpose(p)} style={{
                      padding:"9px 12px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600,
                      background: appPurpose === p ? "rgba(255,153,0,0.12)" : "transparent",
                      border: appPurpose === p ? "1px solid #FF9900" : `1px solid ${border}`,
                      color: appPurpose === p ? "#FF9900" : muted,
                      transition:"all 0.15s",
                    }}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — AMI */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Application and OS Image (AMI)</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:24 }}>Choose an operating system image for your instance.</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {AMIS.map(a => (
                  <button key={a.id} onClick={() => setAmi(a)} style={{
                    padding:16, borderRadius:12, cursor:"pointer", textAlign:"left",
                    background: ami.id === a.id ? "rgba(255,153,0,0.1)" : surface,
                    border: ami.id === a.id ? "2px solid #FF9900" : `1px solid ${border}`,
                    transition:"all 0.15s",
                  }}>
                    <div style={{ fontSize:24, marginBottom:8 }}>{a.icon}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:text, marginBottom:3 }}>{a.name}</div>
                    <div style={{ fontSize:11, color:muted, marginBottom:4 }}>{a.desc}</div>
                    <div style={{ fontSize:10, color:muted, fontFamily:"monospace" }}>{a.arch}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Instance Type */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Instance Type</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:16 }}>Select the CPU, memory, storage, and networking capacity for your instance.</p>

              {/* Family tabs with count badges */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                {INSTANCE_FAMILIES.map((fam, idx) => {
                  const matchCount = instanceSearch.trim()
                    ? fam.types.filter(t => {
                        const q = instanceSearch.toLowerCase()
                        return t.t.toLowerCase().includes(q) || String(t.vcpu).includes(q) || t.ram.toLowerCase().includes(q)
                      }).length
                    : fam.types.length
                  return (
                    <button key={fam.group} onClick={() => { setFamilyIdx(idx); setInstanceSearch("") }} style={{
                      padding:"6px 12px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer",
                      background: familyIdx === idx ? fam.color : "transparent",
                      border:`1px solid ${familyIdx === idx ? fam.color : border}`,
                      color: familyIdx === idx ? "#fff" : muted,
                      display:"flex", alignItems:"center", gap:5,
                    }}>
                      {fam.group}
                      {instanceSearch.trim() && (
                        <span style={{ fontSize:9, padding:"1px 5px", borderRadius:8, background: familyIdx === idx ? "rgba(255,255,255,0.25)" : border, color: familyIdx === idx ? "#fff" : muted }}>{matchCount}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div style={{ fontSize:12, color:muted, marginBottom:12, padding:"7px 12px", borderRadius:7, background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)", borderLeft:`3px solid ${INSTANCE_FAMILIES[familyIdx].color}` }}>
                {INSTANCE_FAMILIES[familyIdx].desc}
              </div>

              {/* Search */}
              <div style={{ position:"relative", marginBottom:10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  value={instanceSearch}
                  onChange={e => setInstanceSearch(e.target.value)}
                  placeholder="Filter by type name, vCPU count, or memory (e.g. 'm5', '16', '64 GiB')"
                  style={{ ...inp, paddingLeft:34 }}
                />
              </div>

              {instanceSearch.trim() && (
                <div style={{ fontSize:11, color:muted, marginBottom:8 }}>
                  {filteredTypes.length} type{filteredTypes.length !== 1 ? "s" : ""} found in {INSTANCE_FAMILIES[familyIdx].group}
                </div>
              )}

              <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)" }}>
                      {["","Instance Type","vCPU","Memory","Network","Price/hr"].map(h => (
                        <th key={h} style={{ padding:"10px 12px", fontSize:11, fontWeight:600, color:muted, textAlign:"left", borderBottom:`1px solid ${border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTypes.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding:24, textAlign:"center", color:muted, fontSize:13 }}>No types match your search. Try a different term.</td></tr>
                    ) : filteredTypes.map(t => (
                      <tr key={t.t} onClick={() => setInstance(t)}
                        style={{ cursor:"pointer", background:instance.t===t.t?"rgba(255,153,0,0.08)":"transparent", transition:"background 0.1s" }}
                        onMouseEnter={e => { if (instance.t !== t.t) e.currentTarget.style.background = dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)" }}
                        onMouseLeave={e => { if (instance.t !== t.t) e.currentTarget.style.background = "transparent" }}
                      >
                        <td style={{ padding:"10px 12px", borderBottom:`1px solid ${border}` }}>
                          <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${instance.t===t.t?"#FF9900":border}`, background:instance.t===t.t?"#FF9900":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {instance.t === t.t && <div style={{ width:6, height:6, borderRadius:"50%", background:"#fff" }} />}
                          </div>
                        </td>
                        <td style={{ padding:"10px 12px", borderBottom:`1px solid ${border}` }}>
                          <div style={{ fontSize:12, fontWeight:600, color:text, fontFamily:"monospace" }}>{t.t}</div>
                          {t.gpu && <div style={{ fontSize:10, color:"#f43f5e", marginTop:2 }}>{t.gpu}</div>}
                          {t.free && <div style={{ fontSize:9, padding:"1px 6px", borderRadius:4, background:"rgba(0,212,170,0.15)", color:"#00d4aa", display:"inline-block", marginTop:3 }}>Free Tier</div>}
                        </td>
                        <td style={{ padding:"10px 12px", fontSize:13, color:text, borderBottom:`1px solid ${border}` }}>{t.vcpu}</td>
                        <td style={{ padding:"10px 12px", fontSize:13, color:text, borderBottom:`1px solid ${border}` }}>{t.ram}</td>
                        <td style={{ padding:"10px 12px", fontSize:12, color:muted, borderBottom:`1px solid ${border}` }}>{t.network}</td>
                        <td style={{ padding:"10px 12px", borderBottom:`1px solid ${border}` }}>
                          <span style={{ fontSize:13, fontWeight:700, color:"#FF9900" }}>${t.price.toFixed(4)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3 — Network & Security */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Network & Security Settings</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:24 }}>Configure network access, SSH key pair, and security group rules.</p>
              <div style={{ display:"grid", gap:20 }}>
                <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:text, marginBottom:12 }}>Key Pair (SSH Authentication)</div>
                  {keypairs.length > 0 ? (
                    <select value={keyPair} onChange={e => setKeyPair(e.target.value)} style={{ ...inp }}>
                      <option value="">None (no SSH key — use password or SSM)</option>
                      {keypairs.map(k => <option key={k.name} value={k.name}>{k.name} ({region})</option>)}
                    </select>
                  ) : (
                    <div style={{ fontSize:12, color:muted, padding:14, background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)", borderRadius:8, border:`1px solid ${border}` }}>
                      No key pairs found in {region}. Create one in IAM → Key Pairs before launching.
                    </div>
                  )}
                </div>

                <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:text, marginBottom:14 }}>Firewall (Security Group Rules)</div>
                  {[
                    { label:"Allow SSH (port 22)",    desc:"Required for Linux remote access", val:allowSSH,   set:setAllowSSH },
                    { label:"Allow HTTP (port 80)",   desc:"Public web traffic — unencrypted", val:allowHTTP,  set:setAllowHTTP },
                    { label:"Allow HTTPS (port 443)", desc:"Public web traffic — encrypted",   val:allowHTTPS, set:setAllowHTTPS },
                  ].map(rule => (
                    <label key={rule.label} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${border}`, cursor:"pointer" }}>
                      <input type="checkbox" checked={rule.val} onChange={e => rule.set(e.target.checked)} style={{ width:16, height:16, accentColor:"#FF9900" }} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:text }}>{rule.label}</div>
                        <div style={{ fontSize:11, color:muted }}>{rule.desc}</div>
                      </div>
                    </label>
                  ))}
                  <label style={{ display:"flex", alignItems:"center", gap:12, paddingTop:10, cursor:"pointer" }}>
                    <input type="checkbox" checked={publicIP} onChange={e => setPublicIP(e.target.checked)} style={{ width:16, height:16, accentColor:"#FF9900" }} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:text }}>Auto-assign public IP</div>
                      <div style={{ fontSize:11, color:muted }}>Instance will be reachable from the internet</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Storage */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Configure Storage</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:24 }}>Configure the root EBS volume for your instance. Additional volumes can be attached post-launch.</p>
              <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, padding:24 }}>
                <div style={{ fontSize:14, fontWeight:600, color:text, marginBottom:16 }}>Root Volume (EBS)</div>
                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:text, display:"block", marginBottom:8 }}>Volume Type</label>
                  {EBS_TYPES.map(et => (
                    <label key={et.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 12px", borderRadius:8, marginBottom:6, cursor:"pointer",
                      background:ebsType.id===et.id?"rgba(255,153,0,0.08)":"transparent",
                      border:ebsType.id===et.id?"1px solid rgba(255,153,0,0.4)":`1px solid ${border}` }}>
                      <input type="radio" checked={ebsType.id===et.id} onChange={() => setEbsType(et)} style={{ marginTop:2, accentColor:"#FF9900" }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:text }}>{et.name}</div>
                        <div style={{ fontSize:11, color:muted, marginTop:2 }}>{et.desc}</div>
                      </div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#FF9900", whiteSpace:"nowrap" }}>${et.price}/GiB·mo</div>
                    </label>
                  ))}
                </div>
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <label style={{ fontSize:12, fontWeight:600, color:text }}>Volume Size</label>
                    <span style={{ fontSize:13, fontWeight:700, color:"#FF9900" }}>{rootGB} GiB — ${ebsPerMonth}/mo</span>
                  </div>
                  <input type="range" min={8} max={2048} value={rootGB} onChange={e => setRootGB(+e.target.value)}
                    style={{ width:"100%", accentColor:"#FF9900" }} />
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:muted, marginTop:4 }}>
                    <span>8 GiB</span><span>256 GiB</span><span>1 TiB</span><span>2 TiB</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5 — Review */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Review and Launch</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:20 }}>Review your configuration before submitting the provisioning request.</p>

              {[
                { section:"Identity & Tags", rows:[
                  { label:"Instance Name",   value:name || "(auto-generated)" },
                  { label:"Region",          value:region },
                  { label:"Environment",     value:env },
                  { label:"Application",     value:appPurpose },
                  { label:"Project",         value:project || "—" },
                  { label:"Owner",           value:owner || "—" },
                ]},
                { section:"Compute", rows:[
                  { label:"AMI",             value:ami.name },
                  { label:"Instance Type",   value:`${instance.t} (${instance.vcpu} vCPU, ${instance.ram})` },
                ]},
                { section:"Network", rows:[
                  { label:"Key Pair",        value:keyPair || "None" },
                  { label:"Public IP",       value:publicIP ? "Enabled" : "Disabled" },
                  { label:"SSH (22)",        value:allowSSH ? "Allowed" : "Blocked" },
                  { label:"HTTP (80)",       value:allowHTTP ? "Allowed" : "Blocked" },
                ]},
                { section:"Storage", rows:[
                  { label:"Root Volume",     value:`${rootGB} GiB ${ebsType.id}` },
                  { label:"Storage Cost",    value:`$${ebsPerMonth}/mo` },
                ]},
              ].map(sec => (
                <div key={sec.section} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>{sec.section}</div>
                  <div style={{ background:surface, borderRadius:10, border:`1px solid ${border}`, overflow:"hidden" }}>
                    {sec.rows.map((r, i) => (
                      <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"9px 14px", borderBottom:i<sec.rows.length-1?`1px solid ${border}`:"none" }}>
                        <span style={{ fontSize:12, color:muted }}>{r.label}</span>
                        <span style={{ fontSize:12, color:text, fontWeight:600 }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {error && (
                <div style={{ marginTop:8, padding:"10px 14px", borderRadius:8, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", color:"#fca5a5", fontSize:13 }}>{error}</div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:32, paddingTop:24, borderTop:`1px solid ${border}` }}>
            <button onClick={() => step === 0 ? navigate(-1) : setStep(s => s - 1)}
              style={{ padding:"10px 24px", borderRadius:10, background:"transparent", border:`1px solid ${border}`, color:text, fontSize:14, cursor:"pointer" }}>
              {step === 0 ? "Cancel" : "← Previous"}
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !name}
                style={{ padding:"10px 28px", borderRadius:10, fontSize:14, fontWeight:600, cursor:(step===0&&!name)?"not-allowed":"pointer",
                  background:(step===0&&!name)?"rgba(255,153,0,0.4)":"linear-gradient(135deg,#FF9900,#FFB347)",
                  border:"none", color:"#fff", boxShadow:"0 4px 12px rgba(255,153,0,0.35)", opacity:(step===0&&!name)?0.7:1 }}>
                Next Step →
              </button>
            ) : (
              <button onClick={handleLaunch} disabled={submitting}
                style={{ padding:"10px 32px", borderRadius:10, fontSize:14, fontWeight:700, cursor:submitting?"not-allowed":"pointer",
                  background:"linear-gradient(135deg,#FF9900,#FFB347)", border:"none", color:"#fff",
                  boxShadow:"0 4px 16px rgba(255,153,0,0.4)", opacity:submitting?0.7:1 }}>
                {submitting ? "Launching..." : "Launch Instance"}
              </button>
            )}
          </div>
        </div>

        {/* ── Right: cost panel ── */}
        <div style={{ background:surface, borderLeft:`1px solid ${border}`, padding:24, position:"sticky", top:0, height:"100vh", overflowY:"auto", boxSizing:"border-box" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#FF9900,#FFB347)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:text }}>Cost Estimate</div>
          </div>

          <div style={{ fontSize:10, padding:"3px 10px", borderRadius:20, background:"rgba(255,153,0,0.1)", border:"1px solid rgba(255,153,0,0.3)", color:"#FF9900", fontWeight:600, display:"inline-block", marginBottom:16 }}>
            AWS — On-Demand ({region})
          </div>

          {/* Config summary */}
          <div style={{ marginBottom:16, display:"grid", gap:5 }}>
            {[
              { label:"Region",    value:region },
              { label:"Instance",  value:instance.t },
              { label:"vCPU",      value:instance.vcpu },
              { label:"Memory",    value:instance.ram },
              { label:"OS",        value:ami.name.split(" ").slice(0,2).join(" ") },
              { label:"Storage",   value:`${rootGB} GiB ${ebsType.id}` },
            ].map(r => (
              <div key={r.label} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                <span style={{ color:muted }}>{r.label}</span>
                <span style={{ color:text, fontWeight:500, textAlign:"right", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.value}</span>
              </div>
            ))}
          </div>

          <div style={{ height:1, background:border, marginBottom:14 }} />

          {/* Pricing breakdown */}
          <div style={{ marginBottom:14, display:"grid", gap:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <span style={{ fontSize:12, color:muted }}>Compute</span>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:600, color:text }}>${totalHr}/hr</div>
                <div style={{ fontSize:10, color:muted }}>${totalMonth}/mo</div>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <span style={{ fontSize:12, color:muted }}>EBS Storage</span>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:600, color:text }}>—</div>
                <div style={{ fontSize:10, color:muted }}>${ebsPerMonth}/mo</div>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <span style={{ fontSize:12, color:muted }}>Data Transfer</span>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:600, color:text }}>—</div>
                <div style={{ fontSize:10, color:muted }}>Usage-based</div>
              </div>
            </div>
          </div>

          <div style={{ height:1, background:border, marginBottom:14 }} />

          {/* Total */}
          <div style={{ background:"rgba(255,153,0,0.07)", border:"1px solid rgba(255,153,0,0.2)", borderRadius:10, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:11, color:muted, marginBottom:4 }}>Estimated total</div>
            <div style={{ fontSize:26, fontWeight:800, color:"#FF9900", lineHeight:1 }}>${totalHr}<span style={{ fontSize:13, fontWeight:400 }}>/hr</span></div>
            <div style={{ fontSize:13, fontWeight:600, color:text, marginTop:6 }}>~${totalFull}<span style={{ fontSize:11, fontWeight:400, color:muted }}>/month</span></div>
          </div>

          {/* Savings section */}
          <div style={{ background:dark?"rgba(16,185,129,0.06)":"rgba(16,185,129,0.04)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:10, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#10b981", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
              Reserved Instance Savings
            </div>
            <div style={{ display:"grid", gap:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:11, color:muted }}>Reserved (1yr) — save 36%</span>
                <span style={{ fontSize:12, fontWeight:700, color:"#10b981" }}>${reserved1yr}/mo</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:11, color:muted }}>Reserved (3yr) — save 60%</span>
                <span style={{ fontSize:12, fontWeight:700, color:"#10b981" }}>${reserved3yr}/mo</span>
              </div>
            </div>
          </div>

          {instance.free && (
            <div style={{ padding:"8px 12px", borderRadius:8, background:"rgba(0,212,170,0.1)", border:"1px solid rgba(0,212,170,0.25)", color:"#00d4aa", fontSize:11, fontWeight:600 }}>
              Free Tier eligible — 750 hrs/mo for 12 months
            </div>
          )}

          <div style={{ fontSize:10, color:muted, marginTop:12, lineHeight:1.5 }}>
            Prices are on-demand rates for {region}. Savings Plans can reduce cost by up to 72%.
          </div>

          {/* Compare across clouds */}
          <button
            onClick={() => setShowCompare(true)}
            style={{
              marginTop:14, width:"100%", padding:"10px 0", borderRadius:10, fontSize:12, fontWeight:700,
              cursor:"pointer", border:"1px solid rgba(102,126,234,0.4)",
              background:"linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1))",
              color:"#a78bfa", display:"flex", alignItems:"center", justifyContent:"center", gap:7,
              transition:"all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(102,126,234,0.2),rgba(118,75,162,0.2))"; e.currentTarget.style.borderColor = "rgba(102,126,234,0.7)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1))"; e.currentTarget.style.borderColor = "rgba(102,126,234,0.4)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            Compare Cloud Prices
          </button>
        </div>
      </div>
    </div>

    <CrossCloudPricing
      isOpen={showCompare}
      onClose={() => setShowCompare(false)}
      currentCloud="aws"
      vcpu={instance.vcpu}
      ramGb={parseFloat(instance.ram)}
      dark={dark}
    />
    </>
  )
}
