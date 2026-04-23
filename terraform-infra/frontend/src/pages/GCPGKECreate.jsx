import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { createGKECluster, listGCPNetworks, listGCPSubnetworks } from "../api/api"

const STEPS = ["Basics", "Node Pool", "Networking", "Review"]

const GCP_REGIONS = [
  { name:"us-central1",           display:"Iowa, USA" },
  { name:"us-east1",              display:"South Carolina, USA" },
  { name:"us-east4",              display:"N. Virginia, USA" },
  { name:"us-west1",              display:"Oregon, USA" },
  { name:"us-west2",              display:"Los Angeles, USA" },
  { name:"europe-west1",          display:"Belgium" },
  { name:"europe-west2",          display:"London, UK" },
  { name:"europe-west3",          display:"Frankfurt, Germany" },
  { name:"europe-west4",          display:"Netherlands" },
  { name:"europe-west6",          display:"Zurich, Switzerland" },
  { name:"asia-south1",           display:"Mumbai, India" },
  { name:"asia-south2",           display:"Delhi, India" },
  { name:"asia-east1",            display:"Taiwan" },
  { name:"asia-northeast1",       display:"Tokyo, Japan" },
  { name:"asia-northeast3",       display:"Seoul, South Korea" },
  { name:"asia-southeast1",       display:"Singapore" },
  { name:"australia-southeast1",  display:"Sydney, Australia" },
]

const RELEASE_CHANNELS = [
  { id:"RAPID",   label:"Rapid",   color:"#f43f5e", desc:"Latest features, updated frequently. Use for testing." },
  { id:"REGULAR", label:"Regular", color:"#00d4aa", desc:"Recommended. Balanced stability and features." },
  { id:"STABLE",  label:"Stable",  color:"#3b82f6", desc:"Maximum stability. Slowest updates." },
]

const NODE_MACHINE_GROUPS = [
  { group:"General Purpose", color:"#34A853", types:[
    { t:"e2-standard-2",  vcpu:2,  ram:"8 GiB",   price:"$0.067/hr" },
    { t:"e2-standard-4",  vcpu:4,  ram:"16 GiB",  price:"$0.134/hr" },
    { t:"e2-standard-8",  vcpu:8,  ram:"32 GiB",  price:"$0.268/hr" },
    { t:"e2-standard-16", vcpu:16, ram:"64 GiB",  price:"$0.537/hr" },
    { t:"n2-standard-2",  vcpu:2,  ram:"8 GiB",   price:"$0.097/hr" },
    { t:"n2-standard-4",  vcpu:4,  ram:"16 GiB",  price:"$0.194/hr" },
    { t:"n2-standard-8",  vcpu:8,  ram:"32 GiB",  price:"$0.389/hr" },
    { t:"n2-standard-16", vcpu:16, ram:"64 GiB",  price:"$0.777/hr" },
  ]},
  { group:"Compute Optimized", color:"#f59e0b", types:[
    { t:"c2-standard-4",  vcpu:4,  ram:"16 GiB",  price:"$0.209/hr" },
    { t:"c2-standard-8",  vcpu:8,  ram:"32 GiB",  price:"$0.418/hr" },
    { t:"c2-standard-16", vcpu:16, ram:"64 GiB",  price:"$0.835/hr" },
    { t:"c2-standard-30", vcpu:30, ram:"120 GiB", price:"$1.566/hr" },
  ]},
  { group:"Memory Optimized", color:"#a78bfa", types:[
    { t:"n2-highmem-2",   vcpu:2,  ram:"16 GiB",  price:"$0.131/hr" },
    { t:"n2-highmem-4",   vcpu:4,  ram:"32 GiB",  price:"$0.262/hr" },
    { t:"n2-highmem-8",   vcpu:8,  ram:"64 GiB",  price:"$0.524/hr" },
    { t:"n2-highmem-16",  vcpu:16, ram:"128 GiB", price:"$1.048/hr" },
  ]},
  { group:"ARM (Tau T2A)", color:"#10b981", types:[
    { t:"t2a-standard-1", vcpu:1,  ram:"4 GiB",   price:"$0.035/hr" },
    { t:"t2a-standard-2", vcpu:2,  ram:"8 GiB",   price:"$0.070/hr" },
    { t:"t2a-standard-4", vcpu:4,  ram:"16 GiB",  price:"$0.141/hr" },
    { t:"t2a-standard-8", vcpu:8,  ram:"32 GiB",  price:"$0.282/hr" },
  ]},
]

const DISK_TYPES = [
  { id:"pd-ssd",      label:"SSD",      desc:"High IOPS, low latency" },
  { id:"pd-balanced", label:"Balanced", desc:"Balance of cost & performance" },
  { id:"pd-standard", label:"Standard", desc:"Cost-effective HDD" },
]

const IMAGE_TYPES = [
  { id:"COS_CONTAINERD",    label:"Container-Optimized OS", desc:"Hardened, minimal GKE image (recommended)" },
  { id:"UBUNTU_CONTAINERD", label:"Ubuntu",                 desc:"Ubuntu 22.04 with containerd" },
]

const ENVIRONMENTS = ["dev", "staging", "prod"]

export default function GCPGKECreate() {
  const { dark }  = useTheme()
  const navigate  = useNavigate()

  // ── Step 0: Basics ────────────────────────────────────────
  const [step,           setStep]           = useState(0)
  const [clusterName,    setClusterName]    = useState("")
  const [region,         setRegion]         = useState(GCP_REGIONS[0])
  const [releaseChannel, setReleaseChannel] = useState("REGULAR")
  const [regionalCluster,setRegionalCluster]= useState(true)
  const [environment,    setEnvironment]    = useState("dev")

  // ── Step 1: Node Pool ────────────────────────────────────
  const [machineGroup,   setMachineGroup]   = useState("General Purpose")
  const [machineType,    setMachineType]    = useState("e2-standard-2")
  const [initialNodes,   setInitialNodes]   = useState(3)
  const [minNodes,       setMinNodes]       = useState(1)
  const [maxNodes,       setMaxNodes]       = useState(5)
  const [diskType,       setDiskType]       = useState("pd-ssd")
  const [diskSize,       setDiskSize]       = useState(100)
  const [spotVMs,        setSpotVMs]        = useState(false)
  const [imageType,      setImageType]      = useState("COS_CONTAINERD")

  // ── Step 2: Networking & Features ────────────────────────
  const [network,        setNetwork]        = useState("default")
  const [subnetwork,     setSubnetwork]     = useState("default")
  const [networks,       setNetworks]       = useState([])
  const [subnetworks,    setSubnetworks]    = useState([])
  const [privateCluster, setPrivateCluster] = useState(false)
  const [masterCIDR,     setMasterCIDR]     = useState("172.16.0.32/28")
  const [enableHTTPLB,   setEnableHTTPLB]   = useState(true)
  const [enableHPA,      setEnableHPA]      = useState(true)
  const [enableNetPol,   setEnableNetPol]   = useState(true)
  const [enableWI,       setEnableWI]       = useState(true)
  const [enableLogging,  setEnableLogging]  = useState(true)
  const [enableMonitor,  setEnableMonitor]  = useState(true)

  // ── Labels ────────────────────────────────────────────────
  const [labelTeam,      setLabelTeam]      = useState("")
  const [labelProject,   setLabelProject]   = useState("")

  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState("")
  const [success,     setSuccess]     = useState(false)

  // ── Theme tokens ─────────────────────────────────────────
  const bg     = dark ? "#070c18"  : "#f0f4f8"
  const surf   = dark ? "#0f172a"  : "#ffffff"
  const border = dark ? "#1e293b"  : "#e2e8f0"
  const txt    = dark ? "#f1f5f9"  : "#0f172a"
  const muted  = dark ? "#475569"  : "#64748b"
  const subtle = dark ? "#1e293b"  : "#f8fafc"
  const GCP    = "#4285F4"
  const inp    = { width:"100%", boxSizing:"border-box", background:surf, border:`1px solid ${border}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:txt, outline:"none" }

  // ── Load networks when on step 2 ─────────────────────────
  useEffect(() => {
    if (step !== 2) return
    listGCPNetworks().then(r => {
      const nets = r.data || []
      setNetworks(nets)
    }).catch(() => {})
  }, [step])

  useEffect(() => {
    if (step !== 2 || !network || network === "default") return
    listGCPSubnetworks({ network, region: region.name }).then(r => {
      const subs = r.data || []
      setSubnetworks(subs)
    }).catch(() => {})
  }, [step, network, region])

  // ── Validation ───────────────────────────────────────────
  function canNext() {
    if (step === 0) return clusterName.trim().length >= 3
    if (step === 1) return minNodes <= initialNodes && initialNodes <= maxNodes && diskSize >= 10
    return true
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    setError("")
    if (privateCluster && !masterCIDR.trim().endsWith("/28")) {
      setError("Master CIDR block must be a /28 network (e.g. 172.16.0.32/28)")
      setSubmitting(false)
      return
    }
    try {
      const labels = {
        environment: environment,
        ...(labelTeam    ? { team:    labelTeam    } : {}),
        ...(labelProject ? { project: labelProject } : {}),
      }
      await createGKECluster({
        resource_name:                     clusterName.trim(),
        region:                            region.name,
        environment,
        release_channel:                   releaseChannel,
        regional_cluster:                  regionalCluster,
        machine_type:                      machineType,
        node_pool_name:                    "default",
        initial_node_count:                initialNodes,
        min_node_count:                    minNodes,
        max_node_count:                    maxNodes,
        disk_type:                         diskType,
        disk_size_gb:                      diskSize,
        image_type:                        imageType,
        spot:                              spotVMs,
        network,
        subnetwork,
        private_cluster:                   privateCluster,
        master_ipv4_cidr_block:            masterCIDR,
        enable_http_load_balancing:        enableHTTPLB,
        enable_horizontal_pod_autoscaling: enableHPA,
        enable_network_policy:             enableNetPol,
        enable_workload_identity:          enableWI,
        enable_logging:                    enableLogging,
        enable_monitoring:                 enableMonitor,
        labels,
        tags: { environment, project: labelProject, team: labelTeam },
      })
      setSuccess(true)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selBtn = (active, color) => ({
    padding:"10px 12px", borderRadius:10, cursor:"pointer",
    border:`1px solid ${active ? color : border}`,
    background: active ? color+"18" : "transparent",
    transition:"all 0.15s",
  })

  const toggle = (val, setter, label, desc) => (
    <div onClick={() => setter(!val)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:10, border:`1px solid ${val ? GCP+"50" : border}`, background: val ? GCP+"08" : "transparent", cursor:"pointer", marginBottom:8 }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:val ? GCP : txt }}>{label}</div>
        {desc && <div style={{ fontSize:11, color:muted, marginTop:2 }}>{desc}</div>}
      </div>
      <div style={{ width:36, height:20, borderRadius:10, background: val ? GCP : border, position:"relative", transition:"all 0.2s", flexShrink:0 }}>
        <div style={{ position:"absolute", top:2, left: val ? 18 : 2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"all 0.2s" }} />
      </div>
    </div>
  )

  const curGroup = NODE_MACHINE_GROUPS.find(g => g.group === machineGroup)
  const selectedMachine = NODE_MACHINE_GROUPS.flatMap(g => g.types).find(t => t.t === machineType)

  // ── Success screen ────────────────────────────────────────
  if (success) return (
    <div style={{ padding:28, background:bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:16, padding:40, textAlign:"center", maxWidth:480 }}>
        <div style={{ width:64, height:64, borderRadius:"50%", background:"#00d4aa15", border:"2px solid #00d4aa40", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", fontSize:28 }}>✓</div>
        <div style={{ fontSize:20, fontWeight:700, color:txt, marginBottom:8 }}>Cluster Request Submitted</div>
        <div style={{ fontSize:13, color:muted, marginBottom:24 }}>
          <strong style={{ color:"#00d4aa" }}>{clusterName}</strong> has been submitted for admin approval.<br/>
          Once approved, the GKE cluster will be provisioned via Terraform.
        </div>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <button onClick={() => navigate("/gcp/kubernetes")} style={{ padding:"10px 20px", borderRadius:8, background:GCP, color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer" }}>View Clusters</button>
          <button onClick={() => navigate("/approvals")} style={{ padding:"10px 20px", borderRadius:8, background:"transparent", color:muted, border:`1px solid ${border}`, fontSize:13, cursor:"pointer" }}>Approvals</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ padding:28, background:bg, minHeight:"100vh" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom:28, animation:"fadeUp 0.35s ease both" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <button onClick={() => step > 0 ? setStep(s => s-1) : navigate("/gcp/kubernetes")} style={{ background:"none", border:"none", color:muted, cursor:"pointer", fontSize:13 }}>← Back</button>
        </div>
        <h1 style={{ fontSize:22, fontWeight:700, color:txt, margin:0 }}>Create GKE Cluster</h1>
        <p style={{ fontSize:13, color:muted, margin:"4px 0 0" }}>Google Kubernetes Engine — standard cluster with managed node pool</p>
      </div>

      {/* Step pills */}
      <div style={{ display:"flex", gap:6, marginBottom:28 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600,
              background: i === step ? GCP+"20" : i < step ? "#00d4aa15" : subtle,
              color: i === step ? GCP : i < step ? "#00d4aa" : muted,
              border:`1px solid ${i === step ? GCP+"50" : i < step ? "#00d4aa30" : border}` }}>
              <span style={{ width:18, height:18, borderRadius:"50%", background: i < step ? "#00d4aa" : i === step ? GCP : border, color:"#fff", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {i < step ? "✓" : i + 1}
              </span>
              {s}
            </div>
            {i < STEPS.length - 1 && <div style={{ width:24, height:1, background:border }} />}
          </div>
        ))}
      </div>

      <div style={{ maxWidth:780, animation:"fadeUp 0.3s ease 0.1s both" }}>

        {/* ── STEP 0: BASICS ─────────────────────────────────── */}
        {step === 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:txt, marginBottom:16 }}>Cluster Identity</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div>
                  <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Cluster Name *</label>
                  <input value={clusterName} onChange={e => setClusterName(e.target.value)} placeholder="my-gke-cluster" style={inp} />
                  <div style={{ fontSize:11, color:muted, marginTop:4 }}>Lowercase letters, numbers, hyphens. Min 3 chars.</div>
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Environment</label>
                  <select value={environment} onChange={e => setEnvironment(e.target.value)} style={inp}>
                    {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:txt, marginBottom:16 }}>Region & Topology</div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Region</label>
                <select value={region.name} onChange={e => setRegion(GCP_REGIONS.find(r => r.name === e.target.value))} style={inp}>
                  {GCP_REGIONS.map(r => <option key={r.name} value={r.name}>{r.display} ({r.name})</option>)}
                </select>
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={{ display:"block", fontSize:12, color:muted, marginBottom:8 }}>Cluster Type</label>
                <div style={{ display:"flex", gap:10 }}>
                  {[
                    { val:true,  label:"Regional",  desc:"Replicated across 3 zones — high availability" },
                    { val:false, label:"Zonal",     desc:"Single zone — lower cost, less resilience" },
                  ].map(opt => (
                    <div key={String(opt.val)} onClick={() => setRegionalCluster(opt.val)}
                      style={{ ...selBtn(regionalCluster === opt.val, GCP), flex:1, padding:"12px 16px" }}>
                      <div style={{ fontSize:13, fontWeight:600, color: regionalCluster === opt.val ? GCP : txt }}>{opt.label}</div>
                      <div style={{ fontSize:11, color:muted, marginTop:3 }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:txt, marginBottom:6 }}>Release Channel</div>
              <div style={{ fontSize:12, color:muted, marginBottom:14 }}>Controls how often the cluster receives Kubernetes version updates.</div>
              <div style={{ display:"flex", gap:10 }}>
                {RELEASE_CHANNELS.map(ch => (
                  <div key={ch.id} onClick={() => setReleaseChannel(ch.id)}
                    style={{ ...selBtn(releaseChannel === ch.id, ch.color), flex:1, padding:"12px 16px" }}>
                    <div style={{ fontSize:13, fontWeight:700, color: releaseChannel === ch.id ? ch.color : txt }}>{ch.label}</div>
                    <div style={{ fontSize:11, color:muted, marginTop:4 }}>{ch.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: NODE POOL ──────────────────────────────── */}
        {step === 1 && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:txt, marginBottom:16 }}>Machine Type</div>
              <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
                {NODE_MACHINE_GROUPS.map(g => (
                  <button key={g.group} onClick={() => setMachineGroup(g.group)}
                    style={{ padding:"5px 14px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer",
                      border:`1px solid ${machineGroup === g.group ? g.color+"60" : border}`,
                      background: machineGroup === g.group ? g.color+"18" : "transparent",
                      color: machineGroup === g.group ? g.color : muted }}>
                    {g.group}
                  </button>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                {curGroup?.types.map(t => (
                  <div key={t.t} onClick={() => setMachineType(t.t)} style={{ ...selBtn(machineType === t.t, curGroup.color), padding:"10px 12px" }}>
                    <div style={{ fontSize:12, fontWeight:700, color: machineType === t.t ? curGroup.color : txt }}>{t.t}</div>
                    <div style={{ fontSize:10, color:muted, marginTop:2 }}>{t.vcpu} vCPU · {t.ram}</div>
                    <div style={{ fontSize:10, color:"#f59e0b", marginTop:2 }}>{t.price}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:txt, marginBottom:16 }}>Node Count & Autoscaling</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
                {[
                  { label:"Initial Nodes", val:initialNodes, set:setInitialNodes, min:1, max:100 },
                  { label:"Min Nodes",     val:minNodes,     set:setMinNodes,     min:0, max:100 },
                  { label:"Max Nodes",     val:maxNodes,     set:setMaxNodes,     min:1, max:1000 },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>{f.label}</label>
                    <input type="number" value={f.val} min={f.min} max={f.max}
                      onChange={e => f.set(Math.max(f.min, parseInt(e.target.value) || f.min))} style={inp} />
                  </div>
                ))}
              </div>
              {minNodes > initialNodes && <div style={{ fontSize:11, color:"#f59e0b", marginTop:8 }}>Min nodes should be ≤ initial nodes</div>}
              {initialNodes > maxNodes  && <div style={{ fontSize:11, color:"#f43f5e", marginTop:8 }}>Initial nodes cannot exceed max nodes</div>}
            </div>

            <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:txt, marginBottom:16 }}>Boot Disk</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div>
                  <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Disk Type</label>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {DISK_TYPES.map(d => (
                      <div key={d.id} onClick={() => setDiskType(d.id)}
                        style={{ ...selBtn(diskType === d.id, GCP), padding:"9px 12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <div>
                          <span style={{ fontSize:12, fontWeight:600, color: diskType === d.id ? GCP : txt }}>{d.label}</span>
                          <span style={{ fontSize:11, color:muted, marginLeft:8 }}>{d.desc}</span>
                        </div>
                        {diskType === d.id && <span style={{ color:GCP, fontSize:14 }}>✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Disk Size (GB)</label>
                  <input type="number" value={diskSize} min={10} max={65536}
                    onChange={e => setDiskSize(Math.max(10, parseInt(e.target.value) || 100))} style={{ ...inp, marginBottom:14 }} />
                  <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Node Image</label>
                  {IMAGE_TYPES.map(img => (
                    <div key={img.id} onClick={() => setImageType(img.id)}
                      style={{ ...selBtn(imageType === img.id, GCP), padding:"9px 12px", marginBottom:6 }}>
                      <div style={{ fontSize:12, fontWeight:600, color: imageType === img.id ? GCP : txt }}>{img.label}</div>
                      <div style={{ fontSize:11, color:muted }}>{img.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div onClick={() => setSpotVMs(!spotVMs)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:10, border:`1px solid ${spotVMs ? "#f59e0b50" : border}`, background: spotVMs ? "#f59e0b08" : "transparent", cursor:"pointer" }}>
                <div style={{ width:36, height:20, borderRadius:10, background: spotVMs ? "#f59e0b" : border, position:"relative", transition:"all 0.2s", flexShrink:0 }}>
                  <div style={{ position:"absolute", top:2, left: spotVMs ? 18 : 2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"all 0.2s" }} />
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color: spotVMs ? "#f59e0b" : txt }}>Spot VMs</div>
                  <div style={{ fontSize:11, color:muted }}>Up to 91% cheaper — nodes may be preempted at any time</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: NETWORKING & FEATURES ──────────────────── */}
        {step === 2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:txt, marginBottom:16 }}>VPC Networking</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div>
                  <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Network</label>
                  {networks.length > 0 ? (
                    <select value={network} onChange={e => setNetwork(e.target.value)} style={inp}>
                      <option value="default">default</option>
                      {networks.map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
                    </select>
                  ) : (
                    <input value={network} onChange={e => setNetwork(e.target.value)} placeholder="default" style={inp} />
                  )}
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Subnetwork</label>
                  {subnetworks.length > 0 ? (
                    <select value={subnetwork} onChange={e => setSubnetwork(e.target.value)} style={inp}>
                      <option value="default">default</option>
                      {subnetworks.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  ) : (
                    <input value={subnetwork} onChange={e => setSubnetwork(e.target.value)} placeholder="default" style={inp} />
                  )}
                </div>
              </div>

              <div onClick={() => setPrivateCluster(!privateCluster)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:10, border:`1px solid ${privateCluster ? GCP+"50" : border}`, background: privateCluster ? GCP+"08" : "transparent", cursor:"pointer", marginBottom: privateCluster ? 12 : 0 }}>
                <div style={{ width:36, height:20, borderRadius:10, background: privateCluster ? GCP : border, position:"relative", transition:"all 0.2s", flexShrink:0 }}>
                  <div style={{ position:"absolute", top:2, left: privateCluster ? 18 : 2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"all 0.2s" }} />
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color: privateCluster ? GCP : txt }}>Private Cluster</div>
                  <div style={{ fontSize:11, color:muted }}>Nodes get only internal IPs — no direct internet access</div>
                </div>
              </div>
              {privateCluster && (
                <div>
                  <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Master CIDR Block</label>
                  <input value={masterCIDR} onChange={e => setMasterCIDR(e.target.value)} placeholder="172.16.0.32/28"
                    style={{ ...inp, borderColor: masterCIDR && !masterCIDR.trim().endsWith("/28") ? "#ef4444" : undefined }} />
                  {masterCIDR && !masterCIDR.trim().endsWith("/28")
                    ? <div style={{ fontSize:11, color:"#ef4444", marginTop:4 }}>Must be a /28 network — e.g. 172.16.0.32/28</div>
                    : <div style={{ fontSize:11, color:muted, marginTop:4 }}>Must be /28, e.g. 172.16.0.32/28</div>}
                </div>
              )}
            </div>

            <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:txt, marginBottom:6 }}>Add-ons & Features</div>
              <div style={{ fontSize:12, color:muted, marginBottom:16 }}>All features can be changed after cluster creation.</div>
              {toggle(enableHTTPLB,  setEnableHTTPLB,  "HTTP Load Balancing",         "Enables GKE Ingress via Cloud Load Balancing")}
              {toggle(enableHPA,     setEnableHPA,     "Horizontal Pod Autoscaling",   "Automatically scales pods based on CPU/memory")}
              {toggle(enableNetPol,  setEnableNetPol,  "Network Policy (Calico)",      "Enforce Kubernetes NetworkPolicy objects")}
              {toggle(enableWI,      setEnableWI,      "Workload Identity",            "Bind Kubernetes service accounts to GCP IAM roles")}
            </div>

            <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:txt, marginBottom:16 }}>Observability</div>
              {toggle(enableLogging, setEnableLogging,  "Cloud Logging",   "Send cluster and workload logs to Google Cloud Logging")}
              {toggle(enableMonitor, setEnableMonitor,  "Cloud Monitoring","Send metrics to Google Cloud Monitoring")}
            </div>

            <div style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:txt, marginBottom:16 }}>Labels</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div>
                  <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Team</label>
                  <input value={labelTeam} onChange={e => setLabelTeam(e.target.value)} placeholder="platform" style={inp} />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, color:muted, marginBottom:6 }}>Project</label>
                  <input value={labelProject} onChange={e => setLabelProject(e.target.value)} placeholder="my-project" style={inp} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: REVIEW ─────────────────────────────────── */}
        {step === 3 && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {[
              { title:"Cluster", rows:[
                ["Name",          clusterName],
                ["Region",        `${region.display} (${region.name})`],
                ["Type",          regionalCluster ? "Regional (3-zone HA)" : "Zonal"],
                ["Release Channel", releaseChannel],
                ["Environment",   environment],
              ]},
              { title:"Node Pool", rows:[
                ["Machine Type",  machineType],
                ["vCPU / RAM",    selectedMachine ? `${selectedMachine.vcpu} vCPU · ${selectedMachine.ram}` : "—"],
                ["Initial Nodes", initialNodes],
                ["Autoscaling",   `${minNodes} – ${maxNodes} nodes`],
                ["Disk",          `${diskSize} GB ${diskType}`],
                ["Node Image",    imageType],
                ["Spot VMs",      spotVMs ? "Enabled (preemptible)" : "Disabled"],
              ]},
              { title:"Networking", rows:[
                ["Network",         network],
                ["Subnetwork",      subnetwork],
                ["Private Cluster", privateCluster ? `Yes (master CIDR ${masterCIDR})` : "No"],
              ]},
              { title:"Features", rows:[
                ["HTTP Load Balancing",  enableHTTPLB  ? "✓ Enabled" : "✗ Disabled"],
                ["HPA",                  enableHPA     ? "✓ Enabled" : "✗ Disabled"],
                ["Network Policy",       enableNetPol  ? "✓ Enabled" : "✗ Disabled"],
                ["Workload Identity",    enableWI      ? "✓ Enabled" : "✗ Disabled"],
                ["Logging",              enableLogging ? "✓ Enabled" : "✗ Disabled"],
                ["Monitoring",           enableMonitor ? "✓ Enabled" : "✗ Disabled"],
              ]},
            ].map(sec => (
              <div key={sec.title} style={{ background:surf, border:`1px solid ${border}`, borderRadius:14, padding:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:12 }}>{sec.title}</div>
                {sec.rows.map(([k, v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${border}` }}>
                    <span style={{ fontSize:12, color:muted }}>{k}</span>
                    <span style={{ fontSize:12, color:txt, fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ background:"#4285F415", border:"1px solid #4285F430", borderRadius:10, padding:"12px 16px", fontSize:12, color:"#4285F4" }}>
              This cluster will be submitted for admin approval. Once approved, Terraform will provision the GKE cluster (~5–10 min).
            </div>

            {error && <div style={{ background:"#f43f5e15", border:"1px solid #f43f5e30", color:"#f43f5e", padding:"10px 14px", borderRadius:8, fontSize:13 }}>{error}</div>}
          </div>
        )}

        {/* ── Navigation ─────────────────────────────────────── */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:24 }}>
          <button onClick={() => step > 0 ? setStep(s => s-1) : navigate("/gcp/kubernetes")}
            style={{ padding:"10px 20px", borderRadius:8, background:"transparent", color:muted, border:`1px solid ${border}`, fontSize:13, cursor:"pointer" }}>
            {step === 0 ? "Cancel" : "← Previous"}
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s+1)} disabled={!canNext()}
              style={{ padding:"10px 22px", borderRadius:8, background: canNext() ? GCP : border, color: canNext() ? "#fff" : muted, border:"none", fontSize:13, fontWeight:600, cursor: canNext() ? "pointer" : "not-allowed" }}>
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              style={{ padding:"10px 24px", borderRadius:8, background: submitting ? border : GCP, color: submitting ? muted : "#fff", border:"none", fontSize:13, fontWeight:600, cursor: submitting ? "not-allowed" : "pointer" }}>
              {submitting ? "Submitting..." : "Submit for Approval"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
