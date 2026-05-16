import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { listBlueprints, createBlueprint, deleteBlueprint, launchBlueprint } from "../api/api"

const CLOUD_META = {
  aws:   { label:"AWS",   color:"#FF9900", bg:"rgba(255,153,0,0.12)",  border:"rgba(255,153,0,0.3)",  gradient:"linear-gradient(135deg,#FF9900,#FFB347)" },
  azure: { label:"Azure", color:"#0078D4", bg:"rgba(0,120,212,0.12)",  border:"rgba(0,120,212,0.3)",  gradient:"linear-gradient(135deg,#0078D4,#50e6ff)" },
  gcp:   { label:"GCP",   color:"#4285F4", bg:"rgba(66,133,244,0.12)", border:"rgba(66,133,244,0.3)", gradient:"linear-gradient(135deg,#4285F4,#34A853)" },
}

const LAUNCH_ROUTES = {
  aws:   { vm: "/compute/create",       storage: "/storage",       network: "/network" },
  azure: { vm: "/azure/compute/create", storage: "/azure/storage", network: "/azure/network" },
  gcp:   { vm: "/gcp/compute/create",   storage: "/gcp/storage/create", network: "/gcp/network" },
}

const TYPE_ICONS = {
  vm:         "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
  storage:    "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  network:    "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  kubernetes: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
}

const PRESET_BLUEPRINTS = [
  {
    id:"preset-1", name:"Web Server (t3.medium)", description:"Ubuntu 22.04, HTTP+HTTPS open, gp3 20 GiB, us-east-1",
    cloud:"aws", resource_type:"vm", use_count:0, created_by:"AIonOS", icon:"🌐",
    config:{ name:"web-server", region:"ap-south-1", instance:{ t:"t3.medium", vcpu:2, ram:"4 GiB", price:0.0456 }, ami:{ id:"ami-ubuntu-22-04", name:"Ubuntu 22.04 LTS" }, rootGB:20, ebsType:{ id:"gp3" }, allowSSH:true, allowHTTP:true, allowHTTPS:true, publicIP:true },
  },
  {
    id:"preset-2", name:"Dev Instance (t3.micro)", description:"Amazon Linux 2023, SSH only, free-tier eligible",
    cloud:"aws", resource_type:"vm", use_count:0, created_by:"AIonOS", icon:"🛠",
    config:{ name:"dev-instance", region:"ap-south-1", instance:{ t:"t3.micro", vcpu:2, ram:"1 GiB", price:0.0114 }, ami:{ id:"ami-amazon-linux-2023", name:"Amazon Linux 2023" }, rootGB:8, ebsType:{ id:"gp3" }, allowSSH:true, allowHTTP:false, allowHTTPS:false, publicIP:true },
  },
  {
    id:"preset-3", name:"GCP E2 Standard (e2-standard-4)", description:"Debian 12, balanced workloads, asia-south1",
    cloud:"gcp", resource_type:"vm", use_count:0, created_by:"AIonOS", icon:"⚡",
    config:{ name:"standard-vm", region:"asia-south1", zone:"asia-south1-a", machineFamily:"e2", machineType:{ name:"e2-standard-4", vcpu:4, ram:"16 GiB", price:0.1342 }, bootImage:{ id:"debian-cloud/debian-12", name:"Debian 12 (Bookworm)" }, diskType:{ id:"pd-balanced" }, diskGB:50 },
  },
  {
    id:"preset-4", name:"GCP N2 High-Mem (n2-highmem-8)", description:"Ubuntu 22.04, high-memory for databases",
    cloud:"gcp", resource_type:"vm", use_count:0, created_by:"AIonOS", icon:"🗄",
    config:{ name:"db-server", region:"us-central1", zone:"us-central1-a", machineFamily:"n2", machineType:{ name:"n2-highmem-8", vcpu:8, ram:"64 GiB", price:0.5241 }, bootImage:{ id:"ubuntu-os-cloud/ubuntu-2204-lts", name:"Ubuntu 22.04 LTS" }, diskType:{ id:"pd-ssd" }, diskGB:100 },
  },
]

// ── Save Blueprint Modal ────────────────────────────────────────────────────
function SaveModal({ dark, surface, border, text, muted, onSave, onClose, saving }) {
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [cloud, setCloud] = useState("aws")
  const [type, setType]   = useState("vm")
  const inp = { width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${border}`, background: dark?"#1e293b":"#f8faff", color:text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
      <div style={{ background:surface, borderRadius:16, padding:28, width:420, border:`1px solid ${border}`, boxShadow:"0 24px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ fontSize:17, fontWeight:800, color:text, marginBottom:4 }}>Save as Blueprint</div>
        <p style={{ fontSize:12, color:muted, marginBottom:20 }}>Blueprints let you relaunch this exact configuration in one click.</p>
        <div style={{ display:"grid", gap:14 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:5 }}>Blueprint Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Production Web Server" style={inp} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:5 }}>Description</label>
            <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Ubuntu 22.04, t3.medium, SSH+HTTP open" style={inp} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:5 }}>Cloud</label>
              <select value={cloud} onChange={e=>setCloud(e.target.value)} style={inp}>
                <option value="aws">AWS</option>
                <option value="azure">Azure</option>
                <option value="gcp">GCP</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:5 }}>Type</label>
              <select value={type} onChange={e=>setType(e.target.value)} style={inp}>
                <option value="vm">VM / Compute</option>
                <option value="storage">Storage</option>
                <option value="network">Network</option>
                <option value="kubernetes">Kubernetes</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:22 }}>
          <button onClick={onClose} style={{ flex:1, padding:"9px", borderRadius:9, border:`1px solid ${border}`, background:"transparent", color:muted, fontSize:13, cursor:"pointer" }}>Cancel</button>
          <button onClick={() => onSave({ name, description:desc, cloud, resource_type:type, config:{}, icon:"📋" })} disabled={!name.trim() || saving}
            style={{ flex:2, padding:"9px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#00d4aa,#00b896)", color:"#fff", fontSize:13, fontWeight:700, cursor:name.trim()&&!saving?"pointer":"not-allowed", opacity:name.trim()&&!saving?1:0.6 }}>
            {saving ? "Saving…" : "Save Blueprint"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Blueprint Card ──────────────────────────────────────────────────────────
function BlueprintCard({ bp, dark, surface, border, text, muted, onLaunch, onDelete, launching, isPreset }) {
  const cm = CLOUD_META[bp.cloud] || CLOUD_META.aws
  const [hov, setHov] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const user = JSON.parse(localStorage.getItem("user") || "{}")

  const configKeys = Object.keys(bp.config || {})
  const highlights = []
  if (bp.config?.instance?.t)    highlights.push(bp.config.instance.t)
  if (bp.config?.machineType?.name) highlights.push(bp.config.machineType.name)
  if (bp.config?.region)         highlights.push(bp.config.region)
  if (bp.config?.ami?.name)      highlights.push(bp.config.ami.name.split(" ").slice(0,2).join(" "))
  if (bp.config?.bootImage?.name) highlights.push(bp.config.bootImage.name.split(" ").slice(0,2).join(" "))
  if (bp.config?.diskGB)         highlights.push(`${bp.config.diskGB} GiB`)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setConfirmDel(false) }}
      style={{
        background: surface, border: `1px solid ${hov ? cm.border : border}`,
        borderRadius: 14, padding: "18px 20px", cursor: "default",
        transition: "all 0.18s", boxShadow: hov ? `0 8px 28px ${cm.color}18` : "none",
        display: "flex", flexDirection: "column", gap: 12, position: "relative",
      }}>
      {/* Top row */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:11, background:cm.gradient, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, boxShadow:`0 4px 12px ${cm.color}30` }}>
          {bp.icon || "📋"}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:800, color:text, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bp.name}</div>
          <div style={{ fontSize:11, color:muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bp.description || "No description"}</div>
        </div>
        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
          <span style={{ fontSize:9, padding:"3px 8px", borderRadius:8, fontWeight:800, background:cm.bg, color:cm.color, letterSpacing:"0.05em" }}>{cm.label}</span>
          <span style={{ fontSize:9, padding:"3px 8px", borderRadius:8, fontWeight:700, background: dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)", color:muted, textTransform:"capitalize" }}>{bp.resource_type}</span>
        </div>
      </div>

      {/* Config preview chips */}
      {highlights.length > 0 && (
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {highlights.slice(0,4).map(h => (
            <span key={h} style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background: dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)", color:muted, fontFamily:"monospace" }}>{h}</span>
          ))}
          {configKeys.length > 0 && <span style={{ fontSize:10, color:muted }}>+{configKeys.length} settings</span>}
        </div>
      )}

      {/* Footer */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"auto", paddingTop:4 }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:10, color:muted }}>by <span style={{ color: dark?"#94a3b8":"#475569", fontWeight:600 }}>{bp.created_by}</span></span>
          {bp.use_count > 0 && (
            <span style={{ fontSize:10, color:muted }}>🚀 {bp.use_count}× launched</span>
          )}
          {isPreset && <span style={{ fontSize:9, padding:"1px 6px", borderRadius:4, background:"rgba(0,212,170,0.12)", color:"#00d4aa", fontWeight:700 }}>PRESET</span>}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {!isPreset && !confirmDel && (bp.created_by === user?.username || user?.role === "admin") && (
            <button onClick={() => setConfirmDel(true)}
              style={{ padding:"5px 10px", borderRadius:7, border:`1px solid rgba(239,68,68,0.3)`, background:"transparent", color:"#f43f5e", fontSize:11, cursor:"pointer", fontWeight:600 }}>
              Delete
            </button>
          )}
          {confirmDel && (
            <>
              <button onClick={() => setConfirmDel(false)} style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${border}`, background:"transparent", color:muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
              <button onClick={() => onDelete(bp.id)} style={{ padding:"5px 10px", borderRadius:7, border:"none", background:"#f43f5e", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>Confirm</button>
            </>
          )}
          <button onClick={() => onLaunch(bp)} disabled={!!launching}
            style={{ padding:"5px 14px", borderRadius:7, border:"none", fontSize:12, fontWeight:700, cursor:launching?"not-allowed":"pointer",
              background: launching === bp.id ? cm.color + "50" : cm.gradient, color:"#fff", opacity: launching && launching !== bp.id ? 0.5 : 1,
              boxShadow:`0 2px 8px ${cm.color}30` }}>
            {launching === bp.id ? "Loading…" : "⚡ Launch"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function Blueprints() {
  const { dark } = useTheme()
  const navigate  = useNavigate()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"

  const [blueprints, setBlueprints] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [cloudFilter,setCloudFilter]= useState("all")
  const [search,     setSearch]     = useState("")
  const [showSave,   setShowSave]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [launching,  setLaunching]  = useState(null)
  const [notice,     setNotice]     = useState("")

  const fetchBlueprints = useCallback(async () => {
    try {
      const { data } = await listBlueprints()
      setBlueprints(data)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchBlueprints() }, [fetchBlueprints])

  const allBps = [...(blueprints.length === 0 ? PRESET_BLUEPRINTS : []), ...blueprints]

  const filtered = allBps.filter(bp => {
    if (cloudFilter !== "all" && bp.cloud !== cloudFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return bp.name.toLowerCase().includes(q)
          || (bp.description || "").toLowerCase().includes(q)
          || bp.cloud.includes(q)
          || (bp.resource_type || "").includes(q)
    }
    return true
  })

  const stats = {
    total: allBps.length,
    aws:   allBps.filter(b => b.cloud === "aws").length,
    azure: allBps.filter(b => b.cloud === "azure").length,
    gcp:   allBps.filter(b => b.cloud === "gcp").length,
  }

  const handleSave = async (data) => {
    setSaving(true)
    try {
      await createBlueprint(data)
      setNotice("Blueprint saved!")
      setShowSave(false)
      fetchBlueprints()
      setTimeout(() => setNotice(""), 3000)
    } catch (e) {
      setNotice("Error: " + (e.response?.data?.detail || e.message))
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await deleteBlueprint(id)
      setBlueprints(p => p.filter(b => b.id !== id))
      setNotice("Blueprint deleted")
      setTimeout(() => setNotice(""), 2500)
    } catch {}
  }

  const handleLaunch = async (bp) => {
    setLaunching(bp.id)
    try {
      if (!bp.id?.toString().startsWith("preset-")) {
        await launchBlueprint(bp.id)
      }
      sessionStorage.setItem("blueprint_prefill", JSON.stringify({ cloud: bp.cloud, resource_type: bp.resource_type, config: bp.config }))
      const routes = LAUNCH_ROUTES[bp.cloud] || LAUNCH_ROUTES.aws
      const route  = routes[bp.resource_type] || routes.vm
      navigate(route)
    } catch {
      setLaunching(null)
    }
  }

  const CLOUD_TABS = [
    { id:"all",   label:"All Blueprints", count: stats.total  },
    { id:"aws",   label:"AWS",            count: stats.aws    },
    { id:"azure", label:"Azure",          count: stats.azure  },
    { id:"gcp",   label:"GCP",            count: stats.gcp    },
  ]

  return (
    <div style={{ padding:"28px 32px", background:bg, minHeight:"100vh" }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:26, flexWrap:"wrap", gap:14 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:text, margin:0, letterSpacing:"-0.5px" }}>Infrastructure Blueprints</h1>
          <p style={{ fontSize:13, color:muted, marginTop:4, margin:"4px 0 0" }}>Save configurations as blueprints — relaunch in one click. No more reconfiguring the same setup.</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {/* Search */}
          <div style={{ position:"relative" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search blueprints…"
              style={{ paddingLeft:30, paddingRight:12, paddingTop:7, paddingBottom:7, borderRadius:9, border:`1px solid ${border}`, background:surface, fontSize:12, color:text, fontFamily:"inherit", outline:"none", width:200 }} />
          </div>
          <button onClick={() => setShowSave(true)}
            style={{ padding:"8px 18px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#00d4aa,#00b896)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(0,212,170,0.35)", display:"flex", alignItems:"center", gap:6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Blueprint
          </button>
        </div>
      </div>

      {/* ── Notice ──────────────────────────────────────────────────────────── */}
      {notice && (
        <div style={{ marginBottom:16, padding:"10px 16px", borderRadius:9, background: notice.startsWith("Error") ? "rgba(239,68,68,0.12)" : "rgba(0,212,170,0.12)",
          border: `1px solid ${notice.startsWith("Error") ? "rgba(239,68,68,0.3)" : "rgba(0,212,170,0.3)"}`,
          color: notice.startsWith("Error") ? "#f43f5e" : "#00d4aa", fontSize:13, fontWeight:500 }}>
          {notice}
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        {[
          { label:"Total Blueprints", value:stats.total,  color:"#00d4aa" },
          { label:"AWS",              value:stats.aws,     color:"#FF9900" },
          { label:"Azure",            value:stats.azure,   color:"#0078D4" },
          { label:"GCP",              value:stats.gcp,     color:"#4285F4" },
        ].map(s => (
          <div key={s.label} style={{ background:surface, border:`1px solid ${border}`, borderLeft:`3px solid ${s.color}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Cloud filter tabs ──────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:6, marginBottom:22, flexWrap:"wrap" }}>
        {CLOUD_TABS.map(t => {
          const cm = t.id !== "all" ? CLOUD_META[t.id] : null
          const active = cloudFilter === t.id
          return (
            <button key={t.id} onClick={() => setCloudFilter(t.id)}
              style={{ padding:"7px 16px", borderRadius:9, fontSize:12, fontWeight:600, cursor:"pointer",
                border: `1px solid ${active ? (cm?.border || "#00d4aa40") : border}`,
                background: active ? (cm?.bg || "rgba(0,212,170,0.1)") : surface,
                color: active ? (cm?.color || "#00d4aa") : muted, transition:"all 0.15s" }}>
              {t.label}
              <span style={{ marginLeft:6, fontSize:10, opacity:0.7 }}>{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Blueprint grid ─────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding:48, textAlign:"center" }}>
          <div style={{ width:28, height:28, borderRadius:"50%", border:"3px solid #00d4aa", borderTopColor:"transparent", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
          <div style={{ color:muted, fontSize:13 }}>Loading blueprints…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:64, textAlign:"center", background:surface, border:`1px solid ${border}`, borderRadius:16 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:16, fontWeight:700, color:text, marginBottom:6 }}>No blueprints yet</div>
          <div style={{ fontSize:13, color:muted, marginBottom:20 }}>Save a VM launch configuration as a blueprint to reuse it in one click.</div>
          <button onClick={() => setShowSave(true)} style={{ padding:"9px 22px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#00d4aa,#00b896)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            Create First Blueprint
          </button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:16 }}>
          {filtered.map((bp, i) => (
            <div key={bp.id} style={{ animation:"fadeIn 0.25s ease both", animationDelay: Math.min(i*40,200)+"ms" }}>
              <BlueprintCard
                bp={bp} dark={dark} surface={surface} border={border} text={text} muted={muted}
                onLaunch={handleLaunch} onDelete={handleDelete}
                launching={launching} isPreset={String(bp.id).startsWith("preset-")}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── How it works footer ─────────────────────────────────────────────── */}
      <div style={{ marginTop:40, background:surface, border:`1px solid ${border}`, borderRadius:14, padding:"20px 24px" }}>
        <div style={{ fontSize:13, fontWeight:700, color:text, marginBottom:14 }}>How Blueprints work</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:16 }}>
          {[
            { step:"1", title:"Configure your VM", desc:"Use the EC2 Launch or GCP Launch wizard to set up your instance exactly how you want it.", color:"#4285F4" },
            { step:"2", title:"Save as Blueprint", desc:'At the Review step, click "Save as Blueprint". Give it a name and description.', color:"#34A853" },
            { step:"3", title:"Relaunch in one click", desc:'Come to this page, find your blueprint, click "Launch" — the form pre-fills automatically.', color:"#FF9900" },
            { step:"4", title:"Share with your team", desc:"Public blueprints are visible to all users. Save time by reusing proven configurations.", color:"#00d4aa" },
          ].map(s => (
            <div key={s.step} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
              <div style={{ width:26, height:26, borderRadius:8, background:s.color+"20", border:`1px solid ${s.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:s.color, flexShrink:0 }}>{s.step}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:text, marginBottom:3 }}>{s.title}</div>
                <div style={{ fontSize:11, color:muted, lineHeight:1.4 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Save Modal ───────────────────────────────────────────────────────── */}
      {showSave && (
        <SaveModal dark={dark} surface={surface} border={border} text={text} muted={muted}
          onSave={handleSave} onClose={() => setShowSave(false)} saving={saving} />
      )}
    </div>
  )
}
