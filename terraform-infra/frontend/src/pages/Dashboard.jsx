import { useEffect, useState, useCallback } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { getCostOverview, getDailyCost, getServiceCost, listVMs, listRequests } from "../api/api"
import { useTheme } from "../context/ThemeContext"

const PIE_COLORS = ["#00d4aa","#3b82f6","#a78bfa","#f59e0b","#f43f5e","#06b6d4"]

export default function Dashboard() {
  const { dark } = useTheme()
  const [costData,  setCostData]  = useState(null)
  const [daily,     setDaily]     = useState([])
  const [services,  setServices]  = useState([])
  const [vms,       setVms]       = useState([])
  const [requests,  setRequests]  = useState([])
  const [loading,   setLoading]   = useState(true)

  const bg      = dark ? "#070c18"  : "#f0f4f8"
  const surface = dark ? "#0f172a"  : "#ffffff"
  const border  = dark ? "#1e293b"  : "#e2e8f0"
  const text    = dark ? "#f1f5f9"  : "#0f172a"
  const muted   = dark ? "#475569"  : "#64748b"
  const subtle  = dark ? "#1e293b"  : "#f1f5f9"

  const fetchAll = useCallback(async () => {
    try {
      const [cost, dy, sv, vmList, reqList] = await Promise.all([
        getCostOverview(), getDailyCost(), getServiceCost(), listVMs(), listRequests()
      ])
      setCostData(cost.data)
      setDaily(dy.data.slice(-14).map(d => ({ ...d, date:d.date.slice(5) })))
      setServices(sv.data.slice(0,6))
      setVms(vmList.data)
      setRequests(reqList.data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const user     = JSON.parse(localStorage.getItem("user") || "{}")
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const running  = vms.filter(v => v.state==="running").length
  const stopped  = vms.filter(v => v.state==="stopped").length
  const pending  = requests.filter(r => r.status==="pending").length
  const mtd      = costData?.total_30d || 0

  const cards = [
    { label:"Running VMs",       value:loading?"...":running,              accent:"#00d4aa", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" },
    { label:"Stopped VMs",       value:loading?"...":stopped,              accent:"#f59e0b", icon:"M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label:"MTD Spend",         value:loading?"...":"$"+mtd.toFixed(2),   accent:"#3b82f6", icon:"M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label:"Pending Approvals", value:loading?"...":pending,              accent:"#a78bfa", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  ]

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"10px", padding:"10px 14px" }}>
        <div style={{ fontSize:"11px", color:muted, marginBottom:"3px" }}>{label}</div>
        <div style={{ fontSize:"15px", fontWeight:"600", color:"#00d4aa" }}>${payload[0]?.value?.toFixed(2)}</div>
      </div>
    )
  }

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"all 0.3s ease" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom:"28px", animation:"fadeUp 0.5s ease both" }}>
        <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>{greeting}, {user.username} ??</h1>
        <p style={{ fontSize:"14px", color:muted, marginTop:"4px" }}>Here is your infrastructure overview for today</p>
      </div>

      {/* Metric Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
        {cards.map(({ label, value, accent, icon }, i) => (
          <div key={label} style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", padding:"20px", position:"relative", overflow:"hidden", animation:`fadeUp 0.5s ease ${i*80}ms both`, transition:"background 0.3s,border 0.3s" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:`linear-gradient(90deg,${accent}80,${accent})` }} />
            <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:`${accent}15`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"12px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon}/>
              </svg>
            </div>
            <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"6px" }}>{label}</div>
            <div style={{ fontSize:"28px", fontWeight:"700", color:text, letterSpacing:"-0.5px" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:"20px" }}>
        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.3s both", transition:"all 0.3s ease" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
            <div>
              <div style={{ fontSize:"14px", fontWeight:"600", color:text }}>Daily cloud spend</div>
              <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Last 14 days</div>
            </div>
            <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", borderRadius:"8px", padding:"4px 10px", fontSize:"11px", color:"#00d4aa", fontWeight:"500" }}>Live</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={daily} margin={{ left:0, right:4 }}>
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4aa" stopOpacity={dark?0.25:0.15} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v=>`$${v}`} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="amount" stroke="#00d4aa" strokeWidth={2} fill="url(#grad1)" dot={false} activeDot={{ r:4, fill:"#00d4aa", strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.4s both", transition:"all 0.3s ease" }}>
          <div style={{ fontSize:"14px", fontWeight:"600", color:text, marginBottom:"4px" }}>Cost by service</div>
          <div style={{ fontSize:"12px", color:muted, marginBottom:"14px" }}>Distribution</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={services} dataKey="amount" nameKey="service" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} label={false}>
                {services.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v=>[`$${v}`,"Cost"]} contentStyle={{ background:surface, border:`1px solid ${border}`, borderRadius:"8px", fontSize:"12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
            {services.slice(0,4).map((s,i) => (
              <div key={s.service} style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:PIE_COLORS[i%PIE_COLORS.length], flexShrink:0 }} />
                <span style={{ flex:1, fontSize:"11px", color:muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.service.replace("Amazon ","").replace("AWS ","")}</span>
                <span style={{ fontSize:"11px", fontWeight:"600", color:text }}>${s.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
