import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"

const SERVICES = [
  {
    key: "vms",
    label: "Virtual Machines",
    desc: "Deploy and manage Windows and Linux virtual machines",
    category: "Compute",
    color: "#0078D4",
    icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
    active: true,
    manageUrl: "/azure/compute",
    createUrl: "/azure/compute/create",
    createLabel: "Launch VM",
  },
  {
    key: "storage",
    label: "Blob Storage",
    desc: "Massively scalable object storage for unstructured data",
    category: "Storage",
    color: "#50e6ff",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
    active: true,
    manageUrl: "/azure/storage",
    createUrl: null,
    createLabel: null,
  },
  {
    key: "network",
    label: "VNet & Subnets",
    desc: "Isolated, private cloud network with custom IP ranges",
    category: "Networking",
    color: "#7fba00",
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    active: true,
    manageUrl: "/azure/network",
    createUrl: null,
    createLabel: null,
  },
  {
    key: "cost",
    label: "Cost Explorer",
    desc: "Monitor, analyze and optimize your Azure spending",
    category: "Cost & Ops",
    color: "#ff8c00",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    active: true,
    manageUrl: "/azure/cost",
    createUrl: null,
    createLabel: null,
  },
  {
    key: "aks",
    label: "AKS Clusters",
    desc: "Managed Kubernetes service for containerized apps",
    category: "Containers",
    color: "#a78bfa",
    icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
    active: false,
  },
  {
    key: "appservice",
    label: "App Services",
    desc: "Build and host web apps, REST APIs and mobile backends",
    category: "Web",
    color: "#0ea5e9",
    icon: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
    active: false,
  },
  {
    key: "functions",
    label: "Azure Functions",
    desc: "Execute event-driven serverless code at scale",
    category: "Serverless",
    color: "#f59e0b",
    icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    active: false,
  },
  {
    key: "sql",
    label: "SQL Database",
    desc: "Fully managed relational database with intelligent features",
    category: "Database",
    color: "#ef4444",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7",
    active: false,
  },
  {
    key: "cosmos",
    label: "Cosmos DB",
    desc: "Fast NoSQL database with multi-region distribution",
    category: "Database",
    color: "#ec4899",
    icon: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
    active: false,
  },
  {
    key: "keyvault",
    label: "Key Vault",
    desc: "Safeguard cryptographic keys and secrets",
    category: "Security",
    color: "#8b5cf6",
    icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
    active: false,
  },
  {
    key: "monitor",
    label: "Azure Monitor",
    desc: "Full-stack observability for apps and infrastructure",
    category: "Monitoring",
    color: "#06b6d4",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    active: false,
  },
  {
    key: "aad",
    label: "Active Directory",
    desc: "Identity and access management for Azure resources",
    category: "Security",
    color: "#0078D4",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    active: false,
  },
]

const CATEGORIES = ["All", "Compute", "Storage", "Networking", "Containers", "Database", "Security", "Serverless", "Web", "Monitoring", "Cost & Ops"]

export default function AzureServices() {
  const { dark } = useTheme()
  const navigate = useNavigate()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#64748b" : "#64748b"

  const [search, setSearch]   = useState("")
  const [cat,    setCat]      = useState("All")
  const [filter, setFilter]   = useState("all") // "all" | "active" | "soon"

  const filtered = SERVICES.filter(s => {
    const matchSearch = !search || s.label.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase())
    const matchCat    = cat === "All" || s.category === cat
    const matchFilter = filter === "all" || (filter === "active" && s.active) || (filter === "soon" && !s.active)
    return matchSearch && matchCat && matchFilter
  })

  const activeCount = SERVICES.filter(s => s.active).length

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: 0 }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        .svc-card:hover { transform:translateY(-3px) !important; }
      `}</style>

      {/* Top accent */}
      <div style={{ position:"fixed", top:0, left:0, right:0, height:4, background:"linear-gradient(135deg,#0078D4,#50e6ff)", zIndex:1000 }} />

      {/* Header */}
      <div style={{ background:surface, borderBottom:`1px solid ${border}`, padding:"20px 32px", animation:"fadeUp 0.4s ease both" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <button onClick={() => navigate("/azure")} style={{ background:"transparent", border:"none", cursor:"pointer", color:muted, display:"flex", alignItems:"center", gap:6, fontSize:13, padding:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>
              Azure Dashboard
            </button>
            <div style={{ width:1, height:20, background:border }} />
            <div style={{ width:40, height:40, borderRadius:10, background:"linear-gradient(135deg,#0078D4,#50e6ff)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(0,120,212,0.35)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
            </div>
            <div>
              <h1 style={{ fontSize:20, fontWeight:700, color:text, margin:0 }}>Azure Services</h1>
              <p style={{ fontSize:12, color:muted, margin:"2px 0 0" }}>{activeCount} services available · {SERVICES.length - activeCount} coming soon</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search services..."
              style={{ padding:"8px 12px", borderRadius:8, border:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.04)":"#fff", color:text, fontSize:13, outline:"none", width:200 }}
            />
            <div style={{ display:"flex", background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", border:`1px solid ${border}`, borderRadius:8, padding:2, gap:2 }}>
              {[{id:"all",label:"All"},{id:"active",label:"Active"},{id:"soon",label:"Soon"}].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding:"5px 12px", borderRadius:6, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:filter===f.id?"#0078D4":"transparent", color:filter===f.id?"#fff":muted, transition:"all 0.15s" }}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Category pills */}
        <div style={{ display:"flex", gap:6, marginTop:14, flexWrap:"wrap" }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${cat===c?"#0078D4":border}`, background:cat===c?"rgba(0,120,212,0.12)":"transparent", color:cat===c?"#0078D4":muted, fontSize:11, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding:"24px 32px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:muted, fontSize:14 }}>No services match your search.</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
            {filtered.map((svc, i) => (
              <div
                key={svc.key}
                className="svc-card"
                style={{
                  background: svc.active
                    ? (dark ? `linear-gradient(135deg,${svc.color}0a,${svc.color}05)` : `linear-gradient(135deg,${svc.color}08,${svc.color}04)`)
                    : surface,
                  border: `1px solid ${svc.active ? svc.color+"33" : border}`,
                  borderRadius: 14, padding: "22px 20px",
                  opacity: svc.active ? 1 : 0.6,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  animation: `fadeUp 0.4s ease ${i * 40}ms both`,
                  position: "relative", overflow: "hidden",
                }}
                onMouseEnter={e => { if(svc.active) e.currentTarget.style.boxShadow = `0 8px 24px ${svc.color}22` }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none" }}
              >
                {!svc.active && (
                  <div style={{ position:"absolute", top:12, right:12, fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:10, background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)", color:muted, letterSpacing:"0.06em" }}>SOON</div>
                )}

                {/* Icon + category */}
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
                  <div style={{ width:44, height:44, borderRadius:11, background:`${svc.color}20`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={svc.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={svc.icon}/></svg>
                  </div>
                  <span style={{ fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:6, background:`${svc.color}18`, color:svc.color, border:`1px solid ${svc.color}30`, textTransform:"uppercase", letterSpacing:"0.06em" }}>{svc.category}</span>
                </div>

                <div style={{ fontSize:15, fontWeight:700, color:text, marginBottom:6 }}>{svc.label}</div>
                <div style={{ fontSize:12, color:muted, lineHeight:1.6, marginBottom:svc.active?16:0 }}>{svc.desc}</div>

                {svc.active && (
                  <div style={{ display:"flex", gap:8 }}>
                    <button
                      onClick={() => navigate(svc.manageUrl)}
                      style={{ flex:1, padding:"8px 0", borderRadius:8, border:`1px solid ${svc.color}40`, background:"transparent", color:svc.color, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${svc.color}15` }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
                    >
                      Manage
                    </button>
                    {svc.createUrl && (
                      <button
                        onClick={() => navigate(svc.createUrl)}
                        style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", background:`linear-gradient(135deg,#0078D4,#50e6ff)`, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 2px 8px rgba(0,120,212,0.3)", transition:"all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = "0.9" }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = "1" }}
                      >
                        {svc.createLabel || "Create"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
