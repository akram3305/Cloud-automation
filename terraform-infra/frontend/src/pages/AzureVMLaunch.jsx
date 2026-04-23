import { useState, useEffect, useMemo } from "react"
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { listAzureRGs, listAzureVNets, listAzureSubnets, createRequest } from "../api/api"
import CrossCloudPricing from "../components/CrossCloudPricing"

// ── VM Families — comprehensive 10-family catalog ──────────────────────────
const VM_FAMILIES = [
  {
    group:"Burstable (B-series)", id:"B", color:"#0078D4",
    desc:"Cost-effective for workloads with low-to-moderate baseline CPU. CPU credits accumulate when idle.",
    vms:[
      { size:"Standard_B1s",   vcpu:1,  ram:"1 GiB",   price:0.0104, disk:"4 GiB",   network:"160 Mbps" },
      { size:"Standard_B1ms",  vcpu:1,  ram:"2 GiB",   price:0.0207, disk:"4 GiB",   network:"160 Mbps", recommended:true },
      { size:"Standard_B2s",   vcpu:2,  ram:"4 GiB",   price:0.0456, disk:"8 GiB",   network:"800 Mbps" },
      { size:"Standard_B2ms",  vcpu:2,  ram:"8 GiB",   price:0.0832, disk:"16 GiB",  network:"800 Mbps" },
      { size:"Standard_B4ms",  vcpu:4,  ram:"16 GiB",  price:0.1660, disk:"32 GiB",  network:"1.6 Gbps" },
      { size:"Standard_B8ms",  vcpu:8,  ram:"32 GiB",  price:0.3320, disk:"64 GiB",  network:"3.2 Gbps" },
      { size:"Standard_B12ms", vcpu:12, ram:"48 GiB",  price:0.4980, disk:"96 GiB",  network:"3.2 Gbps" },
      { size:"Standard_B16ms", vcpu:16, ram:"64 GiB",  price:0.6640, disk:"128 GiB", network:"4 Gbps" },
      { size:"Standard_B20ms", vcpu:20, ram:"80 GiB",  price:0.8300, disk:"160 GiB", network:"4 Gbps" },
    ],
  },
  {
    group:"General Purpose Intel (Dv5)", id:"Dv5", color:"#50e6ff",
    desc:"Latest Intel Xeon Scalable. Balanced CPU-to-memory, ideal for production workloads, web servers, databases.",
    vms:[
      { size:"Standard_D2s_v5",  vcpu:2,  ram:"8 GiB",   price:0.0960, disk:"75 GiB",   network:"12.5 Gbps", recommended:true },
      { size:"Standard_D4s_v5",  vcpu:4,  ram:"16 GiB",  price:0.1920, disk:"150 GiB",  network:"12.5 Gbps" },
      { size:"Standard_D8s_v5",  vcpu:8,  ram:"32 GiB",  price:0.3840, disk:"300 GiB",  network:"12.5 Gbps" },
      { size:"Standard_D16s_v5", vcpu:16, ram:"64 GiB",  price:0.7680, disk:"600 GiB",  network:"12.5 Gbps" },
      { size:"Standard_D32s_v5", vcpu:32, ram:"128 GiB", price:1.5360, disk:"1200 GiB", network:"16 Gbps" },
      { size:"Standard_D48s_v5", vcpu:48, ram:"192 GiB", price:2.3040, disk:"1800 GiB", network:"16 Gbps" },
      { size:"Standard_D64s_v5", vcpu:64, ram:"256 GiB", price:3.0720, disk:"2400 GiB", network:"16 Gbps" },
      { size:"Standard_D96s_v5", vcpu:96, ram:"384 GiB", price:4.6080, disk:"3600 GiB", network:"16 Gbps" },
    ],
  },
  {
    group:"General Purpose AMD (Dasv5)", id:"Das", color:"#34A853",
    desc:"AMD EPYC Genoa. Same profile as Dv5 with ~10% better price-performance via AMD licensing.",
    vms:[
      { size:"Standard_D2as_v5",  vcpu:2,  ram:"8 GiB",   price:0.0888, disk:"75 GiB",   network:"12.5 Gbps" },
      { size:"Standard_D4as_v5",  vcpu:4,  ram:"16 GiB",  price:0.1776, disk:"150 GiB",  network:"12.5 Gbps" },
      { size:"Standard_D8as_v5",  vcpu:8,  ram:"32 GiB",  price:0.3552, disk:"300 GiB",  network:"12.5 Gbps" },
      { size:"Standard_D16as_v5", vcpu:16, ram:"64 GiB",  price:0.7104, disk:"600 GiB",  network:"12.5 Gbps" },
      { size:"Standard_D32as_v5", vcpu:32, ram:"128 GiB", price:1.4208, disk:"1200 GiB", network:"16 Gbps" },
      { size:"Standard_D48as_v5", vcpu:48, ram:"192 GiB", price:2.1312, disk:"1800 GiB", network:"16 Gbps" },
      { size:"Standard_D64as_v5", vcpu:64, ram:"256 GiB", price:2.8416, disk:"2400 GiB", network:"16 Gbps" },
      { size:"Standard_D96as_v5", vcpu:96, ram:"384 GiB", price:4.2624, disk:"3600 GiB", network:"16 Gbps" },
    ],
  },
  {
    group:"Memory Optimized Intel (Ev5)", id:"Ev5", color:"#a78bfa",
    desc:"High memory-to-CPU. Ideal for SAP HANA, relational databases, Redis, large caches.",
    vms:[
      { size:"Standard_E2s_v5",  vcpu:2,  ram:"16 GiB",  price:0.1260, disk:"75 GiB",   network:"12.5 Gbps" },
      { size:"Standard_E4s_v5",  vcpu:4,  ram:"32 GiB",  price:0.2520, disk:"150 GiB",  network:"12.5 Gbps", recommended:true },
      { size:"Standard_E8s_v5",  vcpu:8,  ram:"64 GiB",  price:0.5040, disk:"300 GiB",  network:"12.5 Gbps" },
      { size:"Standard_E16s_v5", vcpu:16, ram:"128 GiB", price:1.0080, disk:"600 GiB",  network:"12.5 Gbps" },
      { size:"Standard_E20s_v5", vcpu:20, ram:"160 GiB", price:1.2600, disk:"750 GiB",  network:"12.5 Gbps" },
      { size:"Standard_E32s_v5", vcpu:32, ram:"256 GiB", price:2.0160, disk:"1200 GiB", network:"16 Gbps" },
      { size:"Standard_E48s_v5", vcpu:48, ram:"384 GiB", price:3.0240, disk:"1800 GiB", network:"16 Gbps" },
      { size:"Standard_E64s_v5", vcpu:64, ram:"512 GiB", price:4.0320, disk:"2400 GiB", network:"16 Gbps" },
      { size:"Standard_E96s_v5", vcpu:96, ram:"672 GiB", price:5.4432, disk:"3600 GiB", network:"16 Gbps" },
    ],
  },
  {
    group:"Memory Optimized AMD (Easv5)", id:"Eas", color:"#f59e0b",
    desc:"AMD EPYC — same memory-optimized profile as Ev5 with better $/GiB at scale.",
    vms:[
      { size:"Standard_E2as_v5",  vcpu:2,  ram:"16 GiB",  price:0.1134, disk:"75 GiB",   network:"12.5 Gbps" },
      { size:"Standard_E4as_v5",  vcpu:4,  ram:"32 GiB",  price:0.2268, disk:"150 GiB",  network:"12.5 Gbps" },
      { size:"Standard_E8as_v5",  vcpu:8,  ram:"64 GiB",  price:0.4536, disk:"300 GiB",  network:"12.5 Gbps" },
      { size:"Standard_E16as_v5", vcpu:16, ram:"128 GiB", price:0.9072, disk:"600 GiB",  network:"12.5 Gbps" },
      { size:"Standard_E32as_v5", vcpu:32, ram:"256 GiB", price:1.8144, disk:"1200 GiB", network:"16 Gbps" },
      { size:"Standard_E48as_v5", vcpu:48, ram:"384 GiB", price:2.7216, disk:"1800 GiB", network:"16 Gbps" },
      { size:"Standard_E64as_v5", vcpu:64, ram:"512 GiB", price:3.6288, disk:"2400 GiB", network:"16 Gbps" },
      { size:"Standard_E96as_v5", vcpu:96, ram:"672 GiB", price:4.8960, disk:"3600 GiB", network:"16 Gbps" },
    ],
  },
  {
    group:"Compute Optimized (Fsv2)", id:"F", color:"#10b981",
    desc:"Highest vCPU-to-memory ratio. Best for web servers, batch processing, gaming servers, analytics.",
    vms:[
      { size:"Standard_F2s_v2",  vcpu:2,  ram:"4 GiB",   price:0.0846, disk:"16 GiB",  network:"875 Mbps" },
      { size:"Standard_F4s_v2",  vcpu:4,  ram:"8 GiB",   price:0.1690, disk:"32 GiB",  network:"1.75 Gbps", recommended:true },
      { size:"Standard_F8s_v2",  vcpu:8,  ram:"16 GiB",  price:0.3380, disk:"64 GiB",  network:"3.5 Gbps" },
      { size:"Standard_F16s_v2", vcpu:16, ram:"32 GiB",  price:0.6760, disk:"128 GiB", network:"7 Gbps" },
      { size:"Standard_F32s_v2", vcpu:32, ram:"64 GiB",  price:1.3520, disk:"256 GiB", network:"14 Gbps" },
      { size:"Standard_F48s_v2", vcpu:48, ram:"96 GiB",  price:2.0280, disk:"384 GiB", network:"21 Gbps" },
      { size:"Standard_F64s_v2", vcpu:64, ram:"128 GiB", price:2.7040, disk:"512 GiB", network:"28 Gbps" },
      { size:"Standard_F72s_v2", vcpu:72, ram:"144 GiB", price:3.0420, disk:"576 GiB", network:"30 Gbps" },
    ],
  },
  {
    group:"Storage Optimized (Lsv3)", id:"L", color:"#06b6d4",
    desc:"Local NVMe for highest disk throughput. For NoSQL, Cassandra, Elasticsearch, data warehousing.",
    vms:[
      { size:"Standard_L8s_v3",  vcpu:8,  ram:"64 GiB",  price:0.6240, disk:"1x1.92 TB NVMe",  network:"12.5 Gbps" },
      { size:"Standard_L16s_v3", vcpu:16, ram:"128 GiB", price:1.2480, disk:"2x1.92 TB NVMe",  network:"12.5 Gbps" },
      { size:"Standard_L32s_v3", vcpu:32, ram:"256 GiB", price:2.4960, disk:"4x1.92 TB NVMe",  network:"16 Gbps" },
      { size:"Standard_L48s_v3", vcpu:48, ram:"384 GiB", price:3.7440, disk:"6x1.92 TB NVMe",  network:"16 Gbps" },
      { size:"Standard_L64s_v3", vcpu:64, ram:"512 GiB", price:4.9920, disk:"8x1.92 TB NVMe",  network:"16 Gbps" },
      { size:"Standard_L80s_v3", vcpu:80, ram:"640 GiB", price:6.2400, disk:"10x1.92 TB NVMe", network:"16 Gbps" },
    ],
  },
  {
    group:"GPU — Tesla T4 (NC T4v3)", id:"NCT4", color:"#f43f5e",
    desc:"NVIDIA Tesla T4 — cost-effective GPU for ML inference, video encoding, and light training.",
    vms:[
      { size:"Standard_NC4as_T4_v3",  vcpu:4,  ram:"28 GiB",  price:0.5280, disk:"176 GiB",  network:"8 Gbps",  gpu:"1x NVIDIA T4 (16 GB VRAM)" },
      { size:"Standard_NC8as_T4_v3",  vcpu:8,  ram:"56 GiB",  price:0.7520, disk:"352 GiB",  network:"8 Gbps",  gpu:"1x NVIDIA T4 (16 GB VRAM)" },
      { size:"Standard_NC16as_T4_v3", vcpu:16, ram:"110 GiB", price:1.2040, disk:"352 GiB",  network:"8 Gbps",  gpu:"1x NVIDIA T4 (16 GB VRAM)" },
      { size:"Standard_NC64as_T4_v3", vcpu:64, ram:"440 GiB", price:4.3520, disk:"2880 GiB", network:"32 Gbps", gpu:"4x NVIDIA T4 (64 GB total)" },
    ],
  },
  {
    group:"GPU — NVIDIA V100 (NCv3)", id:"NCv3", color:"#7c3aed",
    desc:"NVIDIA V100 — deep learning training, HPC, scientific simulations.",
    vms:[
      { size:"Standard_NC6s_v3",  vcpu:6,  ram:"112 GiB", price:3.0600, disk:"736 GiB",  network:"10 Gbps", gpu:"1x NVIDIA V100 (16 GB)" },
      { size:"Standard_NC12s_v3", vcpu:12, ram:"224 GiB", price:6.1200, disk:"1474 GiB", network:"10 Gbps", gpu:"2x NVIDIA V100 (32 GB)" },
      { size:"Standard_NC24s_v3", vcpu:24, ram:"448 GiB", price:12.240, disk:"2948 GiB", network:"10 Gbps", gpu:"4x NVIDIA V100 (64 GB)" },
    ],
  },
  {
    group:"Large Memory (M-series)", id:"M", color:"#ec4899",
    desc:"Extreme memory for mission-critical SAP HANA, Tier-1 databases, high-memory analytics.",
    vms:[
      { size:"Standard_M8ms",   vcpu:8,   ram:"218 GiB",  price:2.1400,  disk:"256 GiB",  network:"2 Gbps" },
      { size:"Standard_M16ms",  vcpu:16,  ram:"437 GiB",  price:4.2800,  disk:"512 GiB",  network:"4 Gbps" },
      { size:"Standard_M32ms",  vcpu:32,  ram:"875 GiB",  price:8.5600,  disk:"1024 GiB", network:"8 Gbps" },
      { size:"Standard_M64ms",  vcpu:64,  ram:"1750 GiB", price:17.1200, disk:"2048 GiB", network:"16 Gbps" },
      { size:"Standard_M128ms", vcpu:128, ram:"3800 GiB", price:34.2400, disk:"4096 GiB", network:"30 Gbps" },
    ],
  },
]

const OS_IMAGES = [
  { id:"ubuntu2204",  name:"Ubuntu Server 22.04 LTS",  publisher:"Canonical",              offer:"0001-com-ubuntu-server-jammy", sku:"22_04-lts-gen2",       icon:"🟠" },
  { id:"ubuntu2004",  name:"Ubuntu Server 20.04 LTS",  publisher:"Canonical",              offer:"0001-com-ubuntu-server-focal", sku:"20_04-lts-gen2",       icon:"🟠" },
  { id:"debian12",    name:"Debian 12",                 publisher:"Debian",                 offer:"debian-12",                   sku:"12-gen2",              icon:"🔴" },
  { id:"rhel9",       name:"RHEL 9",                    publisher:"RedHat",                 offer:"RHEL",                        sku:"9-lvm-gen2",           icon:"🎩" },
  { id:"win2022",     name:"Windows Server 2022",       publisher:"MicrosoftWindowsServer", offer:"WindowsServer",               sku:"2022-Datacenter-gen2", icon:"🪟", windows:true },
  { id:"win2019",     name:"Windows Server 2019",       publisher:"MicrosoftWindowsServer", offer:"WindowsServer",               sku:"2019-Datacenter-gen2", icon:"🪟", windows:true },
]

const DISK_TYPES = [
  { id:"Premium_LRS",     name:"Premium SSD LRS",  price:0.135, desc:"High throughput, low latency — production workloads" },
  { id:"StandardSSD_LRS", name:"Standard SSD LRS", price:0.085, desc:"Cost-effective SSD — dev/test and light prod" },
  { id:"Standard_LRS",    name:"Standard HDD LRS", price:0.040, desc:"Lowest cost — non-critical, infrequent access" },
  { id:"UltraSSD_LRS",    name:"Ultra Disk",        price:0.300, desc:"Sub-ms latency — I/O-intensive databases" },
]

const SUBSCRIPTIONS = ["nonprod", "prod"]
const MANDATORY_TAGS = ["Application Name", "Application Owner", "Business Criticality", "Email ID", "Environment", "Start Date"]
const STEPS = ["Basics", "OS & Size", "Networking", "Disk & Auth", "Tags", "Review"]

// All Azure regions — formatted exactly as Azure Portal: "(Geography) Display Name"
const AZURE_LOCATIONS = [
  // ── United States ─────────────────────────────────────────────────────────
  { name:"eastus",             display:"(US) East US" },
  { name:"eastus2",            display:"(US) East US 2" },
  { name:"southcentralus",     display:"(US) South Central US" },
  { name:"westus2",            display:"(US) West US 2" },
  { name:"westus3",            display:"(US) West US 3" },
  { name:"centralus",          display:"(US) Central US" },
  { name:"northcentralus",     display:"(US) North Central US" },
  { name:"westcentralus",      display:"(US) West Central US" },
  { name:"westus",             display:"(US) West US" },
  // ── Canada ────────────────────────────────────────────────────────────────
  { name:"canadacentral",      display:"(Canada) Canada Central" },
  { name:"canadaeast",         display:"(Canada) Canada East" },
  // ── South America ─────────────────────────────────────────────────────────
  { name:"brazilsouth",        display:"(South America) Brazil South" },
  { name:"brazilsoutheast",    display:"(South America) Brazil Southeast" },
  // ── Europe ────────────────────────────────────────────────────────────────
  { name:"northeurope",        display:"(Europe) North Europe" },
  { name:"westeurope",         display:"(Europe) West Europe" },
  { name:"uksouth",            display:"(UK) UK South" },
  { name:"ukwest",             display:"(UK) UK West" },
  { name:"francecentral",      display:"(France) France Central" },
  { name:"francesouth",        display:"(France) France South" },
  { name:"germanywestcentral", display:"(Germany) Germany West Central" },
  { name:"germanynorth",       display:"(Germany) Germany North" },
  { name:"switzerlandnorth",   display:"(Switzerland) Switzerland North" },
  { name:"switzerlandwest",    display:"(Switzerland) Switzerland West" },
  { name:"norwayeast",         display:"(Norway) Norway East" },
  { name:"norwaywest",         display:"(Norway) Norway West" },
  { name:"swedencentral",      display:"(Sweden) Sweden Central" },
  { name:"polandcentral",      display:"(Poland) Poland Central" },
  { name:"italynorth",         display:"(Italy) Italy North" },
  { name:"spaincentral",       display:"(Spain) Spain Central" },
  // ── Asia Pacific ──────────────────────────────────────────────────────────
  { name:"southeastasia",      display:"(Asia Pacific) Southeast Asia" },
  { name:"eastasia",           display:"(Asia Pacific) East Asia" },
  { name:"centralindia",       display:"(Asia Pacific) Central India" },
  { name:"southindia",         display:"(Asia Pacific) South India" },
  { name:"westindia",          display:"(Asia Pacific) West India" },
  { name:"japaneast",          display:"(Asia Pacific) Japan East" },
  { name:"japanwest",          display:"(Asia Pacific) Japan West" },
  { name:"koreacentral",       display:"(Asia Pacific) Korea Central" },
  { name:"koreasouth",         display:"(Asia Pacific) Korea South" },
  { name:"australiaeast",      display:"(Australia) Australia East" },
  { name:"australiasoutheast", display:"(Australia) Australia Southeast" },
  { name:"australiacentral",   display:"(Australia) Australia Central" },
  { name:"australiacentral2",  display:"(Australia) Australia Central 2" },
  { name:"newzealandnorth",    display:"(New Zealand) New Zealand North" },
  // ── Middle East ───────────────────────────────────────────────────────────
  { name:"uaenorth",           display:"(UAE) UAE North" },
  { name:"uaecentral",         display:"(UAE) UAE Central" },
  { name:"israelcentral",      display:"(Israel) Israel Central" },
  { name:"qatarcentral",       display:"(Qatar) Qatar Central" },
  // ── Africa ────────────────────────────────────────────────────────────────
  { name:"southafricanorth",   display:"(Africa) South Africa North" },
  { name:"southafricawest",    display:"(Africa) South Africa West" },
]

const AVAILABILITY_OPTIONS = [
  { value:"zone",     label:"Availability zone",                  desc:"Protect from datacenter failures by deploying to a specific zone" },
  { value:"set",      label:"Availability set",                   desc:"Group VMs to avoid correlated failures during maintenance events" },
  { value:"none",     label:"No infrastructure redundancy required", desc:"Single VM — no high-availability configuration" },
]

const KEYFRAMES = `
@keyframes fadeUp {
  from { opacity:0; transform:translateY(16px); }
  to   { opacity:1; transform:translateY(0); }
}
`

export default function AzureVMLaunch() {
  const { dark } = useTheme()
  const navigate     = useNavigate()
  const { state: routerState } = useRouterLocation()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"

  const [step,      setStep]      = useState(routerState?.prefill ? 1 : 0)
  const [sub,       setSub]       = useState("nonprod")
  const [rg,        setRg]        = useState("")
  const [newRg,     setNewRg]     = useState("")
  const [isNewRg,   setIsNewRg]   = useState(false)
  const [location,  setLocation]  = useState("eastus")
  const [availOpt,  setAvailOpt]  = useState("zone")
  const [availZone, setAvailZone] = useState("1")
  const [vmName,    setVmName]    = useState("")
  const [os,        setOs]        = useState(OS_IMAGES[0])
  const [familyIdx, setFamilyIdx] = useState(() => {
    const p = routerState?.prefill
    if (!p) return 0
    let bestFi = 0, bestScore = Infinity
    VM_FAMILIES.forEach((fam, fi) => {
      fam.vms.forEach(vm => {
        const score = Math.abs(vm.vcpu / Math.max(p.vcpu, 0.1) - 1) + Math.abs(parseFloat(vm.ram) / Math.max(p.ram_gb, 0.1) - 1)
        if (score < bestScore) { bestScore = score; bestFi = fi }
      })
    })
    return bestFi
  })
  const [vmSize,    setVmSize]    = useState(() => {
    const p = routerState?.prefill
    if (!p) return VM_FAMILIES[0].vms[1]
    let best = VM_FAMILIES[0].vms[1], bestScore = Infinity
    VM_FAMILIES.forEach(fam => {
      fam.vms.forEach(vm => {
        const score = Math.abs(vm.vcpu / Math.max(p.vcpu, 0.1) - 1) + Math.abs(parseFloat(vm.ram) / Math.max(p.ram_gb, 0.1) - 1)
        if (score < bestScore) { bestScore = score; best = vm }
      })
    })
    return best
  })
  const [vmSearch,  setVmSearch]  = useState("")
  const [vnet,      setVnet]      = useState(null)
  const [subnet,    setSubnet]    = useState(null)
  const [publicIP,  setPublicIP]  = useState(false)
  const [allowPorts,setAllowPorts]= useState({ ssh:true, rdp:false, http:false, https:false })
  const [diskType,  setDiskType]  = useState(DISK_TYPES[0])
  const [diskGB,    setDiskGB]    = useState(128)
  const [authType,  setAuthType]  = useState("ssh")
  const [adminUser, setAdminUser] = useState("azureuser")
  const [sshKey,    setSshKey]    = useState("")
  const [password,  setPassword]  = useState("")
  const [tags,      setTags]      = useState({})
  const [rgs,       setRgs]       = useState([])
  const [vnets,     setVnets]     = useState([])
  const [subnets,   setSubnets]   = useState([])
  const [submitting,setSubmitting]= useState(false)
  const [error,     setError]     = useState("")
  const [success,   setSuccess]   = useState(false)
  const [showCompare, setShowCompare] = useState(!!routerState?.prefill)


  useEffect(() => {
    listAzureRGs(sub)
      .then(r => { const d = r.data || []; setRgs(d); if (d[0]) setRg(d[0].name) })
      .catch(() => {})
  }, [sub])

  useEffect(() => {
    listAzureVNets("connectivity")
      .then(r => { const d = r.data || []; setVnets(d); if (d[0]) setVnet(d[0]) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!vnet) return
    listAzureSubnets(vnet.resource_group, vnet.name, "connectivity")
      .then(r => { const d = r.data || []; setSubnets(d); if (d[0]) setSubnet(d[0]) })
      .catch(() => {})
  }, [vnet])

  const filteredVms = useMemo(() => {
    const family = VM_FAMILIES[familyIdx]
    if (!vmSearch.trim()) return family.vms
    const q = vmSearch.toLowerCase()
    return family.vms.filter(v =>
      v.size.toLowerCase().includes(q) ||
      String(v.vcpu).includes(q) ||
      v.ram.toLowerCase().includes(q) ||
      v.network.toLowerCase().includes(q)
    )
  }, [familyIdx, vmSearch])

  const tagsComplete  = MANDATORY_TAGS.every(t => tags[t]?.trim())
  const tagsFilledCnt = MANDATORY_TAGS.filter(t => tags[t]?.trim()).length
  const diskPerMonth  = (diskType.price * diskGB).toFixed(2)
  const totalHr       = vmSize.price.toFixed(4)
  const totalMonth    = (vmSize.price * 730 + diskType.price * diskGB).toFixed(0)

  async function handleLaunch() {
    if (!tagsComplete) { setError("All mandatory tags are required."); return }
    setSubmitting(true); setError("")
    const name = vmName || `vm-${Date.now()}`
    try {
      await createRequest({
        resource_name:  name,
        resource_type:  "azure_vm",
        cloud_provider: "azure",
        region:         location,
        payload: {
          subscription:                   sub,
          resource_group_name:            isNewRg ? newRg : rg,
          create_resource_group:          isNewRg,
          location,
          vm_size:                        vmSize.size,
          os_type:                        os.windows ? "Windows" : "Linux",
          image_publisher:                os.publisher,
          image_offer:                    os.offer,
          image_sku:                      os.sku,
          admin_username:                 adminUser,
          admin_password:                 authType === "password" ? password : "",
          ssh_public_key:                 authType === "ssh" ? sshKey : "",
          disable_password_authentication: authType === "ssh",
          subnet_id:                      subnet?.id || "",
          enable_public_ip:               publicIP,
          allowed_ports: [
            ...(allowPorts.ssh   ? [22]   : []),
            ...(allowPorts.rdp   ? [3389] : []),
            ...(allowPorts.http  ? [80]   : []),
            ...(allowPorts.https ? [443]  : []),
          ],
          os_disk_type:    diskType.id,
          os_disk_size_gb: diskGB,
          // Mandatory tags — include both display-name and snake_case forms
          tags: Object.fromEntries(MANDATORY_TAGS.map(t => [t, tags[t] || ""])),
          application_name:     tags["Application Name"]     || "",
          application_owner:    tags["Application Owner"]    || "",
          business_criticality: tags["Business Criticality"] || "",
          email_id:             tags["Email ID"]             || "",
          start_date:           tags["Start Date"]           || "",
        },
      })
      setSuccess(true)
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to submit Azure VM request")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:bg }}>
        <div style={{ textAlign:"center", padding:48, animation:"fadeUp 0.5s ease both" }}>
          <style>{KEYFRAMES}</style>
          <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#0078D4,#50e6ff)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", boxShadow:"0 0 32px rgba(0,120,212,0.4)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h2 style={{ fontSize:22, fontWeight:700, color:text, marginBottom:8 }}>Request submitted for approval!</h2>
          <p style={{ color:muted, marginBottom:28, maxWidth:420, margin:"0 auto 28px" }}>Your Azure VM request is pending admin approval. Once approved, Terraform will provision the VM automatically. Track progress in the Approvals page.</p>
          <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
            <button onClick={() => navigate("/approvals")} style={{ padding:"11px 28px", borderRadius:10, background:"linear-gradient(135deg,#0078D4,#50e6ff)", border:"none", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", boxShadow:"0 4px 16px rgba(0,120,212,0.4)" }}>View Approvals</button>
            <button onClick={() => navigate("/azure/compute")} style={{ padding:"11px 24px", borderRadius:10, background:"transparent", border:`1px solid ${border}`, color:text, fontSize:14, cursor:"pointer" }}>View VMs</button>
            <button onClick={() => navigate("/azure")} style={{ padding:"11px 24px", borderRadius:10, background:"transparent", border:`1px solid ${border}`, color:text, fontSize:14, cursor:"pointer" }}>Azure Dashboard</button>
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

  // ── Step Progress Bar ─────────────────────────────────────────────────────
  function StepBar() {
    return (
      <div style={{ display:"flex", alignItems:"center", marginBottom:32, position:"relative" }}>
        {STEPS.map((s, i) => {
          const done    = i < step
          const current = i === step
          const color   = done ? "#0078D4" : current ? "#0078D4" : border
          const textClr = done || current ? "#fff" : muted
          const bgClr   = done || current ? (done ? "#0078D4" : "#0078D4") : surface
          return (
            <div key={s} style={{ display:"flex", alignItems:"center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
              <div
                onClick={() => done && setStep(i)}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, cursor: done ? "pointer" : "default", flexShrink:0 }}
              >
                <div style={{
                  width:32, height:32, borderRadius:"50%",
                  background: done ? "#0078D4" : current ? "#0078D4" : "transparent",
                  border: done || current ? "none" : `2px solid ${border}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:12, fontWeight:700, color: done || current ? "#fff" : muted,
                  transition:"all 0.2s", boxShadow: current ? "0 0 0 4px rgba(0,120,212,0.2)" : "none",
                }}>
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : i + 1}
                </div>
                <div style={{ fontSize:10, fontWeight:600, color: done || current ? "#0078D4" : muted, whiteSpace:"nowrap", textAlign:"center", maxWidth:64 }}>{s}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex:1, height:2, background: done ? "#0078D4" : border, margin:"0 4px", marginBottom:18, transition:"background 0.3s" }} />
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
        <span style={{ fontSize:13, color:muted }}>Azure</span>
        <span style={{ color:muted }}>/</span>
        <span style={{ fontSize:13, fontWeight:600, color:"#0078D4" }}>Create Virtual Machine</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 308px", maxWidth:1320, margin:"0 auto" }}>
        {/* ── Left: wizard ── */}
        <div style={{ padding:32, animation:"fadeUp 0.4s ease both" }}>
          <StepBar />

          {/* Step 0 — Basics */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Basics</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:28 }}>Configure the subscription, resource group, and instance details for your virtual machine.</p>

              {/* ── Project details ─────────────────────────────────────────── */}
              <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:12, padding:"22px 24px", marginBottom:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:text, marginBottom:4 }}>Project details</div>
                <div style={{ fontSize:12, color:muted, marginBottom:20 }}>Select the subscription to manage deployed resources and costs. Use resource groups like folders to organize and manage all your resources.</div>

                {/* Subscription */}
                <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:0, alignItems:"start", marginBottom:16, paddingBottom:16, borderBottom:`1px solid ${border}` }}>
                  <div style={{ fontSize:13, fontWeight:500, color:text, paddingTop:10 }}>
                    Subscription <span style={{ color:"#f43f5e" }}>*</span>
                  </div>
                  <div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      {[
                        { id:"nonprod", label:"Non-Production", desc:"Dev, staging, test workloads", badgeColor:"#10b981", badgeBg:"rgba(16,185,129,0.1)", badgeBorder:"rgba(16,185,129,0.25)" },
                        { id:"prod",    label:"Production",     desc:"Live customer-facing workloads", badgeColor:"#f59e0b", badgeBg:"rgba(245,158,11,0.1)", badgeBorder:"rgba(245,158,11,0.25)" },
                      ].map(s => (
                        <div key={s.id} onClick={() => setSub(s.id)} style={{
                          padding:"14px 16px", borderRadius:10, cursor:"pointer",
                          background: sub === s.id ? "rgba(0,120,212,0.07)" : dark ? "rgba(255,255,255,0.02)" : "#f8fafc",
                          border: sub === s.id ? "2px solid #0078D4" : `1px solid ${border}`,
                          transition:"all 0.15s",
                          boxShadow: sub === s.id ? "0 0 0 3px rgba(0,120,212,0.12)" : "none",
                        }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                            <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${sub === s.id ? "#0078D4" : border}`, background:sub === s.id ? "#0078D4" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              {sub === s.id && <div style={{ width:5, height:5, borderRadius:"50%", background:"#fff" }} />}
                            </div>
                            <span style={{ fontSize:13, fontWeight:700, color:text }}>{s.label}</span>
                            <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20, color:s.badgeColor, background:s.badgeBg, border:`1px solid ${s.badgeBorder}`, letterSpacing:"0.06em", marginLeft:"auto" }}>
                              {s.id === "prod" ? "PROD" : "NON-PROD"}
                            </span>
                          </div>
                          <div style={{ fontSize:11, color:muted, paddingLeft:26 }}>{s.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Resource Group */}
                <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:0, alignItems:"start" }}>
                  <div style={{ paddingTop:10 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:text }}>Resource group <span style={{ color:"#f43f5e" }}>*</span></div>
                    <div style={{ fontSize:11, color:"#0078D4", marginTop:2, cursor:"pointer" }} onClick={() => setIsNewRg(true)}>Create new</div>
                  </div>
                  <div>
                    <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                      {[{ v:false, l:"Use existing" }, { v:true, l:"Create new" }].map(opt => (
                        <button key={String(opt.v)} onClick={() => setIsNewRg(opt.v)} style={{ padding:"6px 14px", borderRadius:7, fontSize:12, fontWeight:600, cursor:"pointer", background:isNewRg === opt.v ? "rgba(0,120,212,0.12)" : "transparent", border:`1px solid ${isNewRg === opt.v ? "#0078D4" : border}`, color:isNewRg === opt.v ? "#0078D4" : muted }}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                    {isNewRg ? (
                      <input value={newRg} onChange={e => setNewRg(e.target.value)} placeholder="rg-myapp-dev-eastus" style={inp} />
                    ) : (
                      <select value={rg} onChange={e => setRg(e.target.value)} style={{ ...inp }}>
                        {rgs.length > 0
                          ? rgs.map(r => <option key={r.name} value={r.name}>{r.name} ({r.location})</option>)
                          : <option value="">(New) Resource group</option>
                        }
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Instance details ─────────────────────────────────────────── */}
              <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:12, padding:"22px 24px" }}>
                <div style={{ fontSize:14, fontWeight:700, color:text, marginBottom:20 }}>Instance details</div>

                {/* VM Name */}
                <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:0, alignItems:"start", marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${border}` }}>
                  <label style={{ fontSize:13, fontWeight:500, color:text, paddingTop:10 }}>Virtual machine name <span style={{ color:"#f43f5e" }}>*</span></label>
                  <div>
                    <input value={vmName} onChange={e => setVmName(e.target.value)} placeholder="vm-myapp-eastus-01" style={inp} />
                    <div style={{ fontSize:11, color:muted, marginTop:4 }}>1–15 chars for Windows, 1–64 for Linux. Letters, digits, and hyphens only.</div>
                  </div>
                </div>

                {/* Region */}
                <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:0, alignItems:"start", marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${border}` }}>
                  <label style={{ fontSize:13, fontWeight:500, color:text, paddingTop:10 }}>Region <span style={{ color:"#f43f5e" }}>*</span></label>
                  <div>
                    <select value={location} onChange={e => setLocation(e.target.value)} style={{ ...inp }}>
                      {AZURE_LOCATIONS.map(l => <option key={l.name} value={l.name}>{l.display}</option>)}
                    </select>
                    <div style={{ fontSize:11, color:"#0078D4", marginTop:4, cursor:"pointer" }}>Deploy to an Azure Extended Zone</div>
                  </div>
                </div>

                {/* Availability options */}
                <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:0, alignItems:"start", marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${border}` }}>
                  <label style={{ fontSize:13, fontWeight:500, color:text, paddingTop:10 }}>Availability options</label>
                  <div>
                    <select value={availOpt} onChange={e => setAvailOpt(e.target.value)} style={{ ...inp, marginBottom:8 }}>
                      {AVAILABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <div style={{ fontSize:11, color:muted }}>
                      {AVAILABILITY_OPTIONS.find(o => o.value === availOpt)?.desc}
                    </div>
                  </div>
                </div>

                {/* Availability zone — only show when zone option selected */}
                {availOpt === "zone" && (
                  <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:0, alignItems:"start", marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${border}` }}>
                    <label style={{ fontSize:13, fontWeight:500, color:text, paddingTop:10 }}>Availability zone <span style={{ color:"#f43f5e" }}>*</span></label>
                    <div>
                      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                        {["1","2","3"].map(z => (
                          <button key={z} onClick={() => setAvailZone(z)} style={{
                            flex:1, padding:"9px 0", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
                            background: availZone === z ? "rgba(0,120,212,0.1)" : dark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                            border: availZone === z ? "2px solid #0078D4" : `1px solid ${border}`,
                            color: availZone === z ? "#0078D4" : muted,
                            transition:"all 0.15s",
                          }}>
                            Zone {z}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize:11, color:muted, padding:"8px 12px", borderRadius:8, background:dark?"rgba(0,120,212,0.05)":"rgba(0,120,212,0.04)", border:`1px solid rgba(0,120,212,0.15)` }}>
                        <span style={{ color:"#0078D4", marginRight:6 }}>ℹ</span>
                        You can now select multiple zones. Selecting multiple zones will create one VM per zone.
                      </div>
                    </div>
                  </div>
                )}

                {/* Availability set name — only show when set option selected */}
                {availOpt === "set" && (
                  <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:0, alignItems:"start", marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${border}` }}>
                    <label style={{ fontSize:13, fontWeight:500, color:text, paddingTop:10 }}>Availability set <span style={{ color:"#f43f5e" }}>*</span></label>
                    <div>
                      <input placeholder="avset-myapp-prod" style={inp} />
                      <div style={{ fontSize:11, color:"#0078D4", marginTop:4, cursor:"pointer" }}>Create new</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 1 — OS & Size */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>OS Image & VM Size</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:20 }}>Choose an operating system image and VM size for your workload requirements.</p>

              {/* OS selection */}
              <div style={{ fontSize:13, fontWeight:600, color:text, marginBottom:10 }}>Operating System</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:28 }}>
                {OS_IMAGES.map(img => (
                  <button key={img.id} onClick={() => setOs(img)} style={{
                    padding:14, borderRadius:10, cursor:"pointer", textAlign:"left",
                    background: os.id === img.id ? "rgba(0,120,212,0.1)" : surface,
                    outline: os.id === img.id ? "2px solid #0078D4" : `1px solid ${border}`,
                    border:"none", transition:"all 0.15s",
                  }}>
                    <div style={{ fontSize:20, marginBottom:6 }}>{img.icon}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:text }}>{img.name}</div>
                    <div style={{ fontSize:10, color:muted, marginTop:2 }}>{img.publisher}</div>
                    {img.windows && <div style={{ fontSize:10, color:"#0078D4", marginTop:3, fontWeight:600 }}>Windows License</div>}
                  </button>
                ))}
              </div>

              {/* VM Size */}
              <div style={{ fontSize:13, fontWeight:600, color:text, marginBottom:10 }}>VM Size</div>

              {/* Family tabs with count badges */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                {VM_FAMILIES.map((f, i) => {
                  const matchCount = vmSearch.trim()
                    ? f.vms.filter(v => {
                        const q = vmSearch.toLowerCase()
                        return v.size.toLowerCase().includes(q) || String(v.vcpu).includes(q) || v.ram.toLowerCase().includes(q)
                      }).length
                    : f.vms.length
                  return (
                    <button key={f.group} onClick={() => { setFamilyIdx(i); setVmSearch("") }} style={{
                      padding:"5px 11px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer",
                      background: familyIdx === i ? f.color : "transparent",
                      border:`1px solid ${familyIdx === i ? f.color : border}`,
                      color: familyIdx === i ? "#fff" : muted,
                      display:"flex", alignItems:"center", gap:5,
                    }}>
                      {f.id}
                      {vmSearch.trim() && (
                        <span style={{ fontSize:9, padding:"1px 5px", borderRadius:8, background: familyIdx === i ? "rgba(255,255,255,0.25)" : border, color: familyIdx === i ? "#fff" : muted }}>{matchCount}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Family description */}
              <div style={{ fontSize:12, color:muted, marginBottom:12, padding:"8px 12px", borderRadius:8, background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)", borderLeft:`3px solid ${VM_FAMILIES[familyIdx].color}` }}>
                {VM_FAMILIES[familyIdx].desc}
              </div>

              {/* Search input */}
              <div style={{ position:"relative", marginBottom:10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  value={vmSearch}
                  onChange={e => setVmSearch(e.target.value)}
                  placeholder="Search VM sizes... e.g. D4s, 16 vCPU, 64 GiB"
                  style={{ ...inp, paddingLeft:34 }}
                />
              </div>

              {vmSearch.trim() && (
                <div style={{ fontSize:11, color:muted, marginBottom:8 }}>
                  {filteredVms.length} size{filteredVms.length !== 1 ? "s" : ""} found in {VM_FAMILIES[familyIdx].group}
                </div>
              )}

              {/* VM table */}
              <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)" }}>
                      {["","Size","vCPU","RAM","Temp Storage","Network","$/hr"].map(h => (
                        <th key={h} style={{ padding:"9px 12px", fontSize:11, fontWeight:600, color:muted, textAlign:"left", borderBottom:`1px solid ${border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVms.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding:24, textAlign:"center", color:muted, fontSize:13 }}>No sizes match your search. Try a different term.</td></tr>
                    ) : filteredVms.map(v => (
                      <tr key={v.size} onClick={() => setVmSize(v)} style={{ cursor:"pointer", background:vmSize.size===v.size?"rgba(0,120,212,0.08)":"transparent", transition:"background 0.1s" }}
                        onMouseEnter={e => { if (vmSize.size !== v.size) e.currentTarget.style.background = dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)" }}
                        onMouseLeave={e => { if (vmSize.size !== v.size) e.currentTarget.style.background = "transparent" }}
                      >
                        <td style={{ padding:"9px 12px", borderBottom:`1px solid ${border}` }}>
                          <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${vmSize.size===v.size?"#0078D4":border}`, background:vmSize.size===v.size?"#0078D4":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {vmSize.size === v.size && <div style={{ width:6, height:6, borderRadius:"50%", background:"#fff" }} />}
                          </div>
                        </td>
                        <td style={{ padding:"9px 12px", borderBottom:`1px solid ${border}` }}>
                          <div style={{ fontSize:12, fontWeight:600, color:text, fontFamily:"monospace" }}>{v.size}</div>
                          {v.recommended && <div style={{ fontSize:9, color:"#0078D4", fontWeight:700, letterSpacing:"0.06em" }}>RECOMMENDED</div>}
                          {v.gpu && <div style={{ fontSize:10, color:"#f43f5e" }}>{v.gpu}</div>}
                        </td>
                        <td style={{ padding:"9px 12px", fontSize:13, color:text, borderBottom:`1px solid ${border}` }}>{v.vcpu}</td>
                        <td style={{ padding:"9px 12px", fontSize:13, color:text, borderBottom:`1px solid ${border}` }}>{v.ram}</td>
                        <td style={{ padding:"9px 12px", fontSize:12, color:muted, borderBottom:`1px solid ${border}` }}>{v.disk}</td>
                        <td style={{ padding:"9px 12px", fontSize:12, color:muted, borderBottom:`1px solid ${border}` }}>{v.network}</td>
                        <td style={{ padding:"9px 12px", borderBottom:`1px solid ${border}` }}>
                          <span style={{ fontSize:13, fontWeight:700, color:"#0078D4" }}>${v.price.toFixed(4)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 2 — Networking */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Networking</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:8 }}>Network resources are managed from the <strong style={{ color:"#0078D4" }}>Connectivity subscription</strong> (Hub-and-Spoke model).</p>
              <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(0,120,212,0.06)", border:"1px solid rgba(0,120,212,0.2)", fontSize:12, color:muted, marginBottom:24, display:"flex", gap:10, alignItems:"flex-start" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginTop:1 }}>
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                <span>VMs deploy to the <strong style={{ color:text }}>{sub === "prod" ? "Production" : "Non-Production"}</strong> subscription but attach to VNets hosted in the <strong style={{ color:"#50e6ff" }}>Connectivity</strong> subscription (hub).</span>
              </div>
              <div style={{ display:"grid", gap:16 }}>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Virtual Network (Hub)</label>
                  {vnets.length > 0 ? (
                    <select value={vnet?.name} onChange={e => setVnet(vnets.find(v => v.name === e.target.value))} style={{ ...inp }}>
                      {vnets.map(v => <option key={v.name} value={v.name}>{v.name} ({v.location}) — {v.address_space?.join(", ")}</option>)}
                    </select>
                  ) : (
                    <div style={{ fontSize:12, color:muted, padding:14, background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)", borderRadius:8, border:`1px solid ${border}` }}>Configure Connectivity subscription credentials to load VNets.</div>
                  )}
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Subnet</label>
                  {subnets.length > 0 ? (
                    <select value={subnet?.name} onChange={e => setSubnet(subnets.find(s => s.name === e.target.value))} style={{ ...inp }}>
                      {subnets.map(s => <option key={s.name} value={s.name}>{s.name} — {s.address_prefix}</option>)}
                    </select>
                  ) : (
                    <div style={{ fontSize:12, color:muted, padding:14, background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)", borderRadius:8, border:`1px solid ${border}` }}>Select a VNet to load subnets.</div>
                  )}
                </div>
                <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, padding:20 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:text, marginBottom:14 }}>Inbound Port Rules</div>
                  {[
                    { key:"ssh",   label:"SSH (22)",    desc:"Linux remote access" },
                    { key:"rdp",   label:"RDP (3389)",  desc:"Windows remote desktop" },
                    { key:"http",  label:"HTTP (80)",   desc:"Web traffic — unencrypted" },
                    { key:"https", label:"HTTPS (443)", desc:"Secure web traffic" },
                  ].map(p => (
                    <label key={p.key} style={{ display:"flex", gap:10, alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${border}`, cursor:"pointer" }}>
                      <input type="checkbox" checked={allowPorts[p.key]} onChange={e => setAllowPorts(prev => ({ ...prev, [p.key]:e.target.checked }))} style={{ accentColor:"#0078D4", width:15, height:15 }} />
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:text }}>{p.label}</div>
                        <div style={{ fontSize:11, color:muted }}>{p.desc}</div>
                      </div>
                    </label>
                  ))}
                  <label style={{ display:"flex", gap:10, alignItems:"center", paddingTop:10, cursor:"pointer" }}>
                    <input type="checkbox" checked={publicIP} onChange={e => setPublicIP(e.target.checked)} style={{ accentColor:"#0078D4", width:15, height:15 }} />
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:text }}>Public IP Address</div>
                      <div style={{ fontSize:11, color:muted }}>Assign a static public IP for internet access (+~$3.65/mo)</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Disk & Auth */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Disk & Authentication</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:24 }}>Configure the OS managed disk and administrator credentials.</p>
              <div style={{ display:"grid", gap:20 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:text, marginBottom:10 }}>OS Disk Type</div>
                  {DISK_TYPES.map(dt => (
                    <label key={dt.id} style={{
                      display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:10, marginBottom:6, cursor:"pointer",
                      background:diskType.id===dt.id?"rgba(0,120,212,0.08)":"transparent",
                      border:diskType.id===dt.id?`1px solid rgba(0,120,212,0.4)`:`1px solid ${border}`,
                    }}>
                      <input type="radio" checked={diskType.id === dt.id} onChange={() => setDiskType(dt)} style={{ accentColor:"#0078D4", flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:text }}>{dt.name}</div>
                        <div style={{ fontSize:11, color:muted }}>{dt.desc}</div>
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#0078D4", whiteSpace:"nowrap" }}>${dt.price}/GiB·mo</div>
                    </label>
                  ))}
                </div>

                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <label style={{ fontSize:12, fontWeight:600, color:text }}>OS Disk Size</label>
                    <span style={{ fontSize:13, fontWeight:700, color:"#0078D4" }}>{diskGB} GiB — ~${diskPerMonth}/mo</span>
                  </div>
                  <input type="range" min={32} max={4096} step={16} value={diskGB} onChange={e => setDiskGB(+e.target.value)} style={{ width:"100%", accentColor:"#0078D4" }} />
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:muted, marginTop:4 }}>
                    <span>32 GiB</span><span>512 GiB</span><span>1024 GiB</span><span>4096 GiB</span>
                  </div>
                </div>

                <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, padding:20 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:text, marginBottom:14 }}>Administrator Account</div>
                  <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                    {[{ v:"ssh", l:"SSH Public Key" }, { v:"password", l:"Password" }].map(a => (
                      <button key={a.v} onClick={() => setAuthType(a.v)} style={{ flex:1, padding:"9px", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:12, background:authType===a.v?"rgba(0,120,212,0.12)":"transparent", border:`1px solid ${authType===a.v?"#0078D4":border}`, color:authType===a.v?"#0078D4":muted }}>
                        {a.l}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Admin Username</label>
                    <input value={adminUser} onChange={e => setAdminUser(e.target.value)} style={inp} />
                  </div>
                  {authType === "ssh" ? (
                    <div>
                      <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>SSH Public Key</label>
                      <textarea value={sshKey} onChange={e => setSshKey(e.target.value)} placeholder="ssh-rsa AAAA..." rows={5}
                        style={{ ...inp, resize:"vertical", fontFamily:"monospace", fontSize:11 }} />
                    </div>
                  ) : (
                    <div>
                      <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Password</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} />
                      <div style={{ fontSize:10, color:muted, marginTop:4 }}>Min 12 characters. Must include uppercase, lowercase, digit, and symbol.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Mandatory Tags */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Mandatory Tags</h2>
              <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", fontSize:12, color:"#fca5a5", marginBottom:20, display:"flex", gap:10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginTop:1 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                All tags are required by AIonOS governance policy. Resource creation is blocked without all 6 tags.
              </div>

              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <div style={{ fontSize:12, color:muted }}>{tagsFilledCnt} of {MANDATORY_TAGS.length} tags completed</div>
                <div style={{ display:"flex", gap:3 }}>
                  {MANDATORY_TAGS.map((t, i) => (
                    <div key={t} style={{ width:20, height:5, borderRadius:3, background:tags[t]?.trim()?"#0078D4":border, transition:"background 0.2s" }} />
                  ))}
                </div>
              </div>

              <div style={{ display:"grid", gap:14 }}>
                {MANDATORY_TAGS.map(tag => (
                  <div key={tag}>
                    <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>
                      {tag} <span style={{ color:"#f43f5e" }}>*</span>
                    </label>
                    <input
                      value={tags[tag] || ""}
                      onChange={e => setTags(prev => ({ ...prev, [tag]:e.target.value }))}
                      placeholder={
                        tag === "Email ID" ? "owner@company.com" :
                        tag === "Start Date" ? "2025-01-01" :
                        tag === "Environment" ? "dev / staging / prod" :
                        tag === "Business Criticality" ? "low / medium / high / critical" :
                        `Enter ${tag.toLowerCase()}`
                      }
                      style={{ ...inp, borderColor:tags[tag]?.trim()?"#0078D4":"rgba(239,68,68,0.4)" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5 — Review */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Review + Create</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:20 }}>Review your configuration. The VM will be deployed via Terraform using the Connectivity subscription for networking.</p>

              {[
                { section:"Identity", rows:[
                  { l:"VM Name",        v:vmName || "(auto-generated)" },
                  { l:"Subscription",   v:sub === "prod" ? "Production" : "Non-Production" },
                  { l:"Location",       v:AZURE_LOCATIONS.find(l=>l.name===location)?.display || location },
                  { l:"Resource Group", v:isNewRg ? `New: ${newRg}` : rg },
                ]},
                { section:"Compute", rows:[
                  { l:"OS Image",       v:os.name },
                  { l:"VM Size",        v:`${vmSize.size} (${vmSize.vcpu} vCPU, ${vmSize.ram})` },
                  { l:"CPU Family",     v:VM_FAMILIES[familyIdx].group },
                ]},
                { section:"Storage", rows:[
                  { l:"Disk Type",      v:diskType.name },
                  { l:"Disk Size",      v:`${diskGB} GiB` },
                ]},
                { section:"Networking", rows:[
                  { l:"VNet",           v:vnet?.name || "(not configured)" },
                  { l:"Subnet",         v:subnet?.name || "(not configured)" },
                  { l:"Public IP",      v:publicIP ? "Enabled" : "Disabled" },
                ]},
                { section:"Authentication", rows:[
                  { l:"Method",         v:authType === "ssh" ? "SSH Public Key" : "Password" },
                  { l:"Admin Username", v:adminUser },
                ]},
              ].map(sec => (
                <div key={sec.section} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>{sec.section}</div>
                  <div style={{ background:surface, borderRadius:10, border:`1px solid ${border}`, overflow:"hidden" }}>
                    {sec.rows.map((r, i) => (
                      <div key={r.l} style={{ display:"flex", justifyContent:"space-between", padding:"9px 14px", borderBottom: i < sec.rows.length - 1 ? `1px solid ${border}` : "none" }}>
                        <span style={{ fontSize:12, color:muted }}>{r.l}</span>
                        <span style={{ fontSize:12, color:text, fontWeight:600, textAlign:"right", maxWidth:260 }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {!tagsComplete && (
                <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", color:"#fca5a5", fontSize:13, marginBottom:12 }}>
                  Mandatory tags are incomplete ({tagsFilledCnt}/{MANDATORY_TAGS.length}). Go back to Tags step to complete them.
                </div>
              )}
              {error && (
                <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", color:"#fca5a5", fontSize:13 }}>{error}</div>
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
              <button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !vmName}
                style={{ padding:"10px 28px", borderRadius:10, fontSize:14, fontWeight:600, cursor:(step===0&&!vmName)?"not-allowed":"pointer", border:"none", color:"#fff",
                  background:(step===0&&!vmName)?"rgba(0,120,212,0.4)":"linear-gradient(135deg,#0078D4,#50e6ff)",
                  boxShadow:"0 4px 12px rgba(0,120,212,0.35)", opacity:(step===0&&!vmName)?0.7:1 }}>
                Next Step →
              </button>
            ) : (
              <button onClick={handleLaunch} disabled={submitting || !tagsComplete}
                style={{ padding:"10px 32px", borderRadius:10, fontSize:14, fontWeight:700, cursor:(submitting||!tagsComplete)?"not-allowed":"pointer", border:"none", color:"#fff",
                  background:(!tagsComplete||submitting)?"rgba(0,120,212,0.4)":"linear-gradient(135deg,#0078D4,#50e6ff)",
                  boxShadow:"0 4px 16px rgba(0,120,212,0.4)", opacity:submitting?0.7:1 }}>
                {submitting ? "Creating VM..." : "Create Virtual Machine"}
              </button>
            )}
          </div>
        </div>

        {/* ── Right: cost sidebar ── */}
        <div style={{ background:surface, borderLeft:`1px solid ${border}`, padding:24, position:"sticky", top:0, height:"100vh", overflowY:"auto", boxSizing:"border-box" }}>
          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#0078D4,#50e6ff)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:text }}>Cost Estimate</div>
          </div>

          <div style={{ fontSize:10, padding:"3px 10px", borderRadius:20, background:"rgba(0,120,212,0.1)", border:"1px solid rgba(0,120,212,0.3)", color:"#0078D4", fontWeight:600, display:"inline-block", marginBottom:16 }}>
            Azure — Pay As You Go
          </div>

          {/* Config summary */}
          <div style={{ marginBottom:16, display:"grid", gap:5 }}>
            {[
              { l:"Subscription", v:sub === "prod" ? "Production" : "Non-Prod" },
              { l:"Location",     v:AZURE_LOCATIONS.find(l=>l.name===location)?.display || location },
              { l:"VM Size",      v:vmSize.size },
              { l:"vCPU / RAM",   v:`${vmSize.vcpu} vCPU / ${vmSize.ram}` },
              { l:"OS",           v:os.name.split(" ").slice(0,2).join(" ") },
              { l:"Disk",         v:`${diskGB} GiB ${diskType.id.split("_")[0]}` },
            ].map(r => (
              <div key={r.l} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                <span style={{ color:muted }}>{r.l}</span>
                <span style={{ color:text, fontWeight:500, textAlign:"right", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.v}</span>
              </div>
            ))}
          </div>

          <div style={{ height:1, background:border, margin:"14px 0" }} />

          {/* Pricing breakdown */}
          <div style={{ display:"grid", gap:10, marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <span style={{ fontSize:12, color:muted }}>Compute</span>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:600, color:text }}>${totalHr}/hr</div>
                <div style={{ fontSize:10, color:muted }}>${(vmSize.price * 730).toFixed(2)}/mo</div>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <span style={{ fontSize:12, color:muted }}>Managed Disk</span>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:600, color:text }}>—</div>
                <div style={{ fontSize:10, color:muted }}>${diskPerMonth}/mo</div>
              </div>
            </div>
            {publicIP && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <span style={{ fontSize:12, color:muted }}>Public IP</span>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:600, color:text }}>—</div>
                  <div style={{ fontSize:10, color:muted }}>~$3.65/mo</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ height:1, background:border, marginBottom:14 }} />

          {/* Total */}
          <div style={{ background:"rgba(0,120,212,0.07)", border:"1px solid rgba(0,120,212,0.2)", borderRadius:10, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:11, color:muted, marginBottom:4 }}>Estimated total</div>
            <div style={{ fontSize:26, fontWeight:800, color:"#0078D4", lineHeight:1 }}>${totalHr}<span style={{ fontSize:13, fontWeight:400 }}>/hr</span></div>
            <div style={{ fontSize:13, fontWeight:600, color:text, marginTop:6 }}>~${totalMonth}<span style={{ fontSize:11, fontWeight:400, color:muted }}>/month</span></div>
          </div>

          {/* AHB note */}
          <div style={{ padding:"8px 12px", borderRadius:8, background:"rgba(80,230,255,0.06)", border:"1px solid rgba(80,230,255,0.2)", fontSize:10, color:"#50e6ff", lineHeight:1.5, marginBottom:12 }}>
            Azure Hybrid Benefit available — save up to 40% on Windows Server and RHEL with existing licences.
          </div>

          {/* Compare across clouds */}
          <button
            onClick={() => setShowCompare(true)}
            style={{
              marginBottom:14, width:"100%", padding:"10px 0", borderRadius:10, fontSize:12, fontWeight:700,
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

          {/* Tags tracker */}
          <div style={{ padding:"10px 12px", borderRadius:8, background:tagsComplete?"rgba(0,212,170,0.08)":"rgba(239,68,68,0.08)", border:`1px solid ${tagsComplete?"rgba(0,212,170,0.25)":"rgba(239,68,68,0.25)"}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <div style={{ fontSize:11, fontWeight:600, color:tagsComplete?"#00d4aa":"#fca5a5" }}>Mandatory Tags</div>
              <div style={{ fontSize:11, fontWeight:700, color:tagsComplete?"#00d4aa":"#fca5a5" }}>{tagsFilledCnt}/{MANDATORY_TAGS.length}</div>
            </div>
            <div style={{ display:"flex", gap:3 }}>
              {MANDATORY_TAGS.map(t => (
                <div key={t} style={{ flex:1, height:4, borderRadius:2, background:tags[t]?.trim()?"#00d4aa":"rgba(239,68,68,0.3)", transition:"background 0.2s" }} />
              ))}
            </div>
            {!tagsComplete && <div style={{ fontSize:10, color:muted, marginTop:5 }}>Required before deployment</div>}
          </div>
        </div>
      </div>
    </div>

    <CrossCloudPricing
      isOpen={showCompare}
      onClose={() => setShowCompare(false)}
      currentCloud="azure"
      vcpu={vmSize.vcpu}
      ramGb={parseFloat(vmSize.ram)}
      dark={dark}
    />
    </>
  )
}
