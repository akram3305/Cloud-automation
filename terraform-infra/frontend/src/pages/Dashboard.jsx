import { useEffect, useState, useCallback, useRef } from "react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts"
import {
  getCostOverview, getDailyCost, getServiceCost,
  listVMs, listRequests
} from "../api/api"
import { useTheme } from "../context/ThemeContext"
import { useNavigate } from "react-router-dom"
import PinnedResources from "../components/PinnedResources"

const PIE_COLORS = ["#00d4aa", "#3b82f6", "#a78bfa", "#f59e0b", "#f43f5e", "#06b6d4"]

const STATUS_COLORS = {
  pending:      "#f59e0b",
  completed:    "#00d4aa",
  failed:       "#f43f5e",
  provisioning: "#a78bfa",
  approved:     "#00d4aa",
  rejected:     "#f43f5e",
}

function timeAgo(dateStr) {
  if (!dateStr) return ""
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function resourceIcon(type) {
  const t = (type || "").toUpperCase()
  if (t.includes("EC2"))    return "⬛"
  if (t.includes("S3"))     return "🪣"
  if (t.includes("EKS"))    return "☸"
  if (t.includes("VPC"))    return "🔷"
  if (t.includes("RDS"))    return "🗄"
  if (t.includes("LAMBDA")) return "λ"
  return "☁"
}

const KEYFRAMES = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
@keyframes spin {
  from { transform: rotate(0deg);   }
  to   { transform: rotate(360deg); }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 #00d4aa22; }
  50%       { box-shadow: 0 0 0 8px #00d4aa00; }
}
`

function Skeleton({ w = "100%", h = "18px", r = "8px", dark }) {
  const base  = dark ? "#1e293b" : "#e2e8f0"
  const shine = dark ? "#263347" : "#f1f5f9"
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: `linear-gradient(90deg, ${base} 25%, ${shine} 50%, ${base} 75%)`,
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
    }} />
  )
}

export default function Dashboard() {
  const { dark } = useTheme()
  const navigate  = useNavigate()

  const [costData,    setCostData]    = useState(null)
  const [daily,       setDaily]       = useState([])
  const [services,    setServices]    = useState([])
  const [vms,         setVms]         = useState([])
  const [requests,    setRequests]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const intervalRef = useRef(null)
  const [chartType, setChartType] = useState("area") // "area" | "bar"

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"

  const fetchAll = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const results = await Promise.allSettled([
        getCostOverview(),
        getDailyCost(),
        getServiceCost(),
        listVMs(),
        listRequests(),
      ])
      const [costRes, dailyRes, svcRes, vmRes, reqRes] = results

      if (costRes.status  === "fulfilled") setCostData(costRes.value?.data ?? costRes.value)
      if (dailyRes.status === "fulfilled") {
        const raw = dailyRes.value?.data ?? dailyRes.value ?? []
        setDaily(raw.slice(-14).map(d => ({ ...d, date: d.date?.slice(5) ?? d.date })))
      }
      if (svcRes.status === "fulfilled") setServices((svcRes.value?.data ?? svcRes.value ?? []).slice(0, 6))
      if (vmRes.status  === "fulfilled") setVms(vmRes.value?.data ?? vmRes.value ?? [])
      if (reqRes.status === "fulfilled") setRequests(reqRes.value?.data ?? reqRes.value ?? [])
      setLastUpdated(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(() => fetchAll(), 10000)
    return () => clearInterval(intervalRef.current)
  }, [fetchAll])

  const user     = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}") } catch { return {} } })()
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const running = vms.filter(v => v.state === "running").length
  const pending = requests.filter(r => r.status === "pending").length
  const mtd     = (() => {
    if (!costData) return 0
    return costData.mtd_total ?? costData.total_30d ?? 0
  })()
  const forecast = costData?.forecast ?? 0

  const metricCards = [
    {
      label:"Running Resources",
      value:running,
      sub:`${vms.filter(v => v.state === "stopped").length} stopped`,
      accent:"#00d4aa",
      icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
    },
    {
      label:"MTD Spend",
      value:`$${Number(mtd).toFixed(2)}`,
      sub:costData?.currency ?? "USD",
      accent:"#3b82f6",
      icon:"M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      label:"Monthly Forecast",
      value:`$${Number(forecast).toFixed(2)}`,
      sub:"Projected end-of-month",
      accent:"#a78bfa",
      icon:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    },
    {
      label:"Pending Approvals",
      value:pending,
      sub:`${requests.length} total requests`,
      accent:"#f59e0b",
      icon:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  ]

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"10px", padding:"10px 14px" }}>
        <div style={{ fontSize:"11px", color:muted, marginBottom:"3px" }}>{label}</div>
        <div style={{ fontSize:"15px", fontWeight:"600", color:"#00d4aa" }}>
          ${Number(payload[0]?.value ?? 0).toFixed(2)}
        </div>
      </div>
    )
  }

  // Quick Launch cards — AWS only
  const QUICK_LAUNCH = [
    { label:"Launch EC2 Instance", desc:"On-demand virtual server",  path:"/compute/create", color:"#FF9900", logo:"EC2",  logoBg:"#FF9900" },
    { label:"Browse S3 Buckets",   desc:"Object storage",            path:"/storage",         color:"#7FBA00", logo:"S3",   logoBg:"#7FBA00" },
    { label:"VPC Networks",        desc:"Virtual private cloud",     path:"/network",         color:"#a78bfa", logo:"VPC",  logoBg:"#a78bfa" },
    { label:"All AWS Services",    desc:"Full service catalog",      path:"/services",        color:"#00d4aa", logo:"AWS",  logoBg: dark?"#1e293b":"#e2e8f0" },
  ]

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"background 0.3s, color 0.3s" }}>
      <style>{KEYFRAMES}</style>

      {/* gradient banner */}
      <div style={{ position:"fixed", top:0, left:0, right:0, height:"4px", background:"linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)", zIndex:1000 }} />

      {/* subtle top-area gradient wash */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"280px", background:"linear-gradient(135deg, #00d4aa08 0%, #3b82f608 100%)", pointerEvents:"none", zIndex:0 }} />

      <div style={{ position:"relative", zIndex:1 }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px", animation:"fadeUp 0.5s ease both" }}>
          <div>
            <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>
              {greeting},{" "}
              <span style={{ background:"linear-gradient(90deg,#00d4aa,#3b82f6)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                {user.username || "User"}
              </span>
            </h1>
            <p style={{ fontSize:"14px", color:muted, marginTop:"5px", marginBottom:0 }}>Your infrastructure at a glance</p>
          </div>

          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"8px" }}>
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              style={{
                display:"flex", alignItems:"center", gap:"7px",
                background:surface, border:`1px solid ${border}`,
                borderRadius:"10px", padding:"9px 16px",
                color:text, fontSize:"13px", fontWeight:"500",
                cursor:refreshing?"not-allowed":"pointer",
                opacity:refreshing?0.75:1, transition:"all 0.2s ease",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={refreshing?"#00d4aa":muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation:refreshing?"spin 0.8s linear infinite":"none" }}>
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {lastUpdated && (
              <span style={{ fontSize:"11px", color:muted }}>Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        {/* ── Metric Cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
          {metricCards.map(({ label, value, sub, accent, icon }, i) => (
            <div key={label}
              style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", padding:"20px", position:"relative", overflow:"hidden", animation:`fadeUp 0.5s ease ${i*80}ms both`, transition:"transform 0.18s ease, box-shadow 0.18s ease", cursor:"default" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${accent}22` }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)";   e.currentTarget.style.boxShadow = "none" }}
            >
              <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:`linear-gradient(90deg,${accent}60,${accent})` }} />
              <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:`${accent}18`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"14px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
              </div>
              <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"6px" }}>{label}</div>
              {loading
                ? <Skeleton w="60%" h="32px" r="6px" dark={dark} />
                : <div style={{ fontSize:"30px", fontWeight:"700", color:text, letterSpacing:"-0.5px", lineHeight:1.1 }}>{value}</div>
              }
              {sub && !loading && <div style={{ fontSize:"11px", color:muted, marginTop:"6px" }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* ── Pinned Resources ── */}
        <PinnedResources dark={dark} />

        {/* ── Quick Launch ── */}
        <div style={{ marginBottom:"24px", animation:"fadeUp 0.5s ease 0.24s both" }}>
          <div style={{ fontSize:"13px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"12px" }}>Quick Launch</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px" }}>
            {QUICK_LAUNCH.map(card => (
              <button
                key={card.path}
                onClick={() => navigate(card.path)}
                style={{
                  background:surface, border:`1px solid ${border}`,
                  borderRadius:"12px", padding:"16px",
                  cursor:"pointer", textAlign:"left",
                  transition:"all 0.18s ease",
                  display:"flex", alignItems:"center", gap:12,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-2px)"
                  e.currentTarget.style.boxShadow = `0 6px 20px ${card.color}22`
                  e.currentTarget.style.borderColor = card.color + "60"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "none"
                  e.currentTarget.style.borderColor = border
                }}
              >
                <div style={{ width:36, height:36, borderRadius:9, background:card.logoBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff", flexShrink:0, letterSpacing:"-0.5px" }}>
                  {card.logo}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:text, marginBottom:2 }}>{card.label}</div>
                  <div style={{ fontSize:11, color:muted }}>{card.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── AWS Resources ── */}
        <div style={{ marginBottom:"24px", animation:"fadeUp 0.5s ease 0.32s both" }}>
          <div style={{ fontSize:"13px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"12px", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:18, height:18, borderRadius:5, background:"#FF9900", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"#fff" }}>AWS</div>
            AWS Resources
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px" }}>
            {[
              { label:"EC2 Instances",  value:loading?"—":running,         sub:`${vms.filter(v=>v.state==="stopped").length} stopped`,  path:"/compute",   color:"#FF9900", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
              { label:"S3 Buckets",     value:loading?"—":"Open",          sub:"Click to manage",                                       path:"/storage",   color:"#7FBA00", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
              { label:"VPC Networks",   value:loading?"—":"Open",          sub:"Click to manage",                                       path:"/network",   color:"#a78bfa", icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { label:"Cost Explorer",  value:loading?"—":`$${Number(mtd).toFixed(0)}`, sub:"Month-to-date (USD)",                     path:"/cost",      color:"#3b82f6", icon:"M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
            ].map(({ label, value, sub, path, color, icon }) => (
              <div key={label}
                onClick={() => navigate(path)}
                style={{ background:surface, border:`1px solid ${border}`, borderRadius:"12px", padding:"16px 18px", cursor:"pointer", transition:"all 0.18s ease", position:"relative", overflow:"hidden" }}
                onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=`0 6px 20px ${color}22`; e.currentTarget.style.borderColor=color+"50" }}
                onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.borderColor=border }}
              >
                <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px", background:`linear-gradient(90deg,${color}60,${color})` }} />
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ fontSize:"11px", fontWeight:600, color:muted, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
                  <div style={{ width:28, height:28, borderRadius:8, background:`${color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
                  </div>
                </div>
                <div style={{ fontSize:"26px", fontWeight:"700", color:text, lineHeight:1, marginBottom:4 }}>{value}</div>
                <div style={{ fontSize:"11px", color:muted }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Charts Row ── */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:"20px", marginBottom:"24px" }}>
          {/* Area Chart */}
          <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.4s both", transition:"all 0.3s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"18px" }}>
              <div>
                <div style={{ fontSize:"15px", fontWeight:"600", color:text }}>Daily Cloud Spend</div>
                <div style={{ fontSize:"12px", color:muted, marginTop:"3px" }}>Last 14 days from AWS Cost Explorer</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ display:"flex", background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)", border:`1px solid ${border}`, borderRadius:8, padding:2, gap:2 }}>
                  {[{id:"area",label:"Area"},{id:"bar",label:"Bar"}].map(t => (
                    <button key={t.id} onClick={() => setChartType(t.id)} style={{ padding:"4px 10px", borderRadius:6, border:"none", cursor:"pointer", fontSize:11, fontWeight:600, background: chartType===t.id ? "#00d4aa" : "transparent", color: chartType===t.id ? "#0a0f1e" : muted, transition:"all 0.15s" }}>{t.label}</button>
                  ))}
                </div>
                <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", borderRadius:"8px", padding:"4px 10px", fontSize:"11px", color:"#00d4aa", fontWeight:"600", display:"flex", alignItems:"center", gap:"5px" }}>
                  <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#00d4aa", display:"inline-block" }} />
                  Live
                </div>
              </div>
            </div>
            {loading ? (
              <Skeleton h="160px" r="10px" dark={dark} />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                {chartType === "bar" ? (
                  <BarChart data={daily} margin={{ left:0, right:4, top:4 }}>
                    <XAxis dataKey="date" tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} width={48}/>
                    <Tooltip content={<CustomTooltip />}/>
                    <Bar dataKey="amount" fill="#00d4aa" radius={[4,4,0,0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={daily} margin={{ left:0, right:4, top:4 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00d4aa" stopOpacity={dark?0.28:0.18}/>
                        <stop offset="95%" stopColor="#00d4aa" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} width={48}/>
                    <Tooltip content={<CustomTooltip />}/>
                    <Area type="monotone" dataKey="amount" stroke="#00d4aa" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} activeDot={{ r:5, fill:"#00d4aa", strokeWidth:0 }}/>
                  </AreaChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie / Donut */}
          <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.48s both", transition:"all 0.3s ease" }}>
            <div style={{ fontSize:"15px", fontWeight:"600", color:text, marginBottom:"3px" }}>Cost by Service</div>
            <div style={{ fontSize:"12px", color:muted, marginBottom:"10px" }}>MTD distribution</div>
            {loading ? (
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                <Skeleton h="140px" r="50%" w="140px" dark={dark} />
                <Skeleton h="14px" dark={dark}/>
                <Skeleton h="14px" w="80%" dark={dark}/>
                <Skeleton h="14px" w="65%" dark={dark}/>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={services} dataKey="amount" nameKey="service" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={3} label={false}>
                      {services.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v => [`$${Number(v).toFixed(2)}`, "Cost"]} contentStyle={{ background:surface, border:`1px solid ${border}`, borderRadius:"8px", fontSize:"12px", color:text }}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:"flex", flexDirection:"column", gap:"6px", marginTop:"6px" }}>
                  {services.slice(0, 5).map((s, i) => (
                    <div key={s.service} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:PIE_COLORS[i % PIE_COLORS.length], flexShrink:0 }}/>
                      <span style={{ flex:1, fontSize:"12px", color:muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {s.service.replace("Amazon ", "").replace("AWS ", "")}
                      </span>
                      <span style={{ fontSize:"12px", fontWeight:"600", color:text }}>${Number(s.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.56s both" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
            <div>
              <div style={{ fontSize:"15px", fontWeight:"600", color:text }}>Recent Activity</div>
              <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Latest infrastructure requests</div>
            </div>
            <a href="/requests" style={{ fontSize:"13px", color:"#3b82f6", textDecoration:"none", fontWeight:"500" }}>View all →</a>
          </div>

          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              {Array.from({ length:5 }).map((_, i) => (
                <div key={i} style={{ display:"flex", gap:"12px", alignItems:"center" }}>
                  <Skeleton w="40px" h="40px" r="10px" dark={dark}/>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"6px" }}>
                    <Skeleton w="50%" h="13px" dark={dark}/>
                    <Skeleton w="30%" h="11px" dark={dark}/>
                  </div>
                  <Skeleton w="70px" h="22px" r="6px" dark={dark}/>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
              {requests.slice(0, 8).map((req, i) => {
                const statusColor = STATUS_COLORS[req.status] ?? muted
                return (
                  <div key={req.id ?? i}
                    style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 12px", borderRadius:"10px", borderLeft:`3px solid ${statusColor}`, marginLeft:"-1px", transition:"background 0.15s ease", animation:`fadeUp 0.4s ease ${i*50}ms both` }}
                    onMouseEnter={e => { e.currentTarget.style.background = dark?"#1e293b50":"#f8fafc" }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
                  >
                    <div style={{ width:"36px", height:"36px", borderRadius:"9px", background:`${statusColor}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", flexShrink:0 }}>
                      {resourceIcon(req.resource_type)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:"13px", fontWeight:"600", color:text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {req.resource_name || req.resource_type || "Resource"}
                      </div>
                      <div style={{ fontSize:"11px", color:muted, marginTop:"2px" }}>{req.resource_type}</div>
                    </div>
                    <span style={{ background:`${statusColor}18`, color:statusColor, border:`1px solid ${statusColor}40`, borderRadius:"6px", padding:"3px 9px", fontSize:"11px", fontWeight:"600", textTransform:"capitalize", flexShrink:0 }}>
                      {req.status}
                    </span>
                    <div style={{ fontSize:"11px", color:muted, flexShrink:0, minWidth:"56px", textAlign:"right" }}>
                      {timeAgo(req.created_at)}
                    </div>
                  </div>
                )
              })}
              {requests.length === 0 && (
                <div style={{ textAlign:"center", padding:"32px", color:muted, fontSize:"13px" }}>No recent activity</div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
