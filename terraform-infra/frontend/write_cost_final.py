content = """import { useEffect, useState } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { getCostOverview, getDailyCost, getServiceCost } from "../api/api"
import { useTheme } from "../context/ThemeContext"

const COLORS = ["#00d4aa","#3b82f6","#a78bfa","#f59e0b","#f43f5e","#06b6d4","#84cc16"]

export default function Cost() {
  const { dark } = useTheme()
  const [overview, setOverview] = useState(null)
  const [daily,    setDaily]    = useState([])
  const [services, setServices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState("")

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"

  useEffect(() => {
    async function fetchAll() {
      try {
        const [ov, da, sv] = await Promise.all([getCostOverview(), getDailyCost(), getServiceCost()])
        setOverview(ov.data)
        setDaily(da.data.map(d => ({ ...d, date: d.date.slice(5) })))
        setServices(sv.data)
      } catch(e) { setErr(e.response?.data?.detail || e.message) }
      finally { setLoading(false) }
    }
    fetchAll()
    const id = setInterval(fetchAll, 60000)
    return () => clearInterval(id)
  }, [])

  if (loading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:bg }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:"40px", height:"40px", border:"2px solid #00d4aa20", borderTop:"2px solid #00d4aa", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 12px" }} />
        <div style={{ fontSize:"13px", color:muted }}>Loading cost data...</div>
      </div>
    </div>
  )

  if (err) return <div style={{ padding:"48px", textAlign:"center", color:"#f43f5e" }}>Error: {err}</div>

  const totalMonthly = overview?.total_30d || 0
  const dailyAvg     = totalMonthly / 30
  const topService   = services[0]?.service?.replace("Amazon ","").replace("AWS ","") || "EC2"
  const trend        = daily.length >= 2 ? daily[daily.length-1]?.amount - daily[daily.length-2]?.amount : 0

  const cards = [
    { label:"30-Day Spend",  value:"$"+totalMonthly.toFixed(2), color:"#00d4aa", sub:"Total cloud cost" },
    { label:"Daily Average", value:"$"+dailyAvg.toFixed(2),     color:"#3b82f6", sub:"Per day avg" },
    { label:"Top Service",   value:topService,                   color:"#a78bfa", sub:"$"+(services[0]?.amount||0)+"/mo" },
    { label:"Daily Trend",   value:(trend>=0?"+$":"-$")+Math.abs(trend).toFixed(3), color:trend>=0?"#f43f5e":"#84cc16", sub:"vs yesterday" },
  ]

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background:surface, border:"1px solid "+border, borderRadius:"10px", padding:"10px 14px" }}>
        <div style={{ fontSize:"11px", color:muted, marginBottom:"3px" }}>{label}</div>
        <div style={{ fontSize:"15px", fontWeight:"600", color:"#00d4aa" }}>${payload[0]?.value?.toFixed(2)}</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:"100vh", background:bg, padding:"28px", transition:"all 0.3s ease" }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}"}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px", animation:"fadeUp 0.4s ease both" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
            <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#00d4aa", boxShadow:"0 0 8px #00d4aa" }} />
            <span style={{ fontSize:"11px", fontWeight:"600", color:"#00d4aa", textTransform:"uppercase", letterSpacing:"0.12em" }}>
              {overview?.source === "live" ? "Live - AWS Cost Explorer" : "Estimated"}
            </span>
          </div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>Cost Intelligence</h1>
          <p style={{ fontSize:"13px", color:muted, marginTop:"4px" }}>Real-time cloud spend analysis</p>
        </div>
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"10px", padding:"8px 14px", fontSize:"11px", color:muted }}>
          {new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
        {cards.map(({ label, value, color, sub }, i) => (
          <div key={label} style={{ background:surface, border:"1px solid "+border, borderLeft:"3px solid "+color, borderRadius:"14px", padding:"20px", animation:"fadeUp 0.5s ease "+(i*80)+"ms both", transition:"all 0.3s ease" }}>
            <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"8px" }}>{label}</div>
            <div style={{ fontSize:"26px", fontWeight:"700", color:text, letterSpacing:"-0.5px" }}>{value}</div>
            <div style={{ fontSize:"11px", color:muted, marginTop:"4px" }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:"20px", marginBottom:"20px" }}>
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.3s both", transition:"all 0.3s ease" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
            <div>
              <div style={{ fontSize:"14px", fontWeight:"600", color:text }}>Spend over time</div>
              <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Last 14 days</div>
            </div>
            <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", borderRadius:"8px", padding:"3px 10px", fontSize:"11px", color:"#00d4aa", fontWeight:"500" }}>Daily</div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={daily} margin={{ left:0, right:4 }}>
              <defs>
                <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4aa" stopOpacity={dark ? 0.25 : 0.12} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => "$"+v} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="amount" stroke="#00d4aa" strokeWidth={2} fill="url(#cGrad)" dot={false} activeDot={{ r:4, fill:"#00d4aa", strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.4s both", transition:"all 0.3s ease" }}>
          <div style={{ fontSize:"14px", fontWeight:"600", color:text, marginBottom:"4px" }}>Service breakdown</div>
          <div style={{ fontSize:"12px", color:muted, marginBottom:"14px" }}>Cost distribution</div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={services} dataKey="amount" nameKey="service" cx="50%" cy="50%" outerRadius={65} innerRadius={38} paddingAngle={3} label={false}>
                {services.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => ["$"+v, "Cost"]} contentStyle={{ background:surface, border:"1px solid "+border, borderRadius:"8px", fontSize:"12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
            {services.slice(0,5).map((s,i) => (
              <div key={s.service} style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:COLORS[i % COLORS.length], flexShrink:0 }} />
                <span style={{ flex:1, fontSize:"11px", color:muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.service.replace("Amazon ","").replace("AWS ","")}</span>
                <span style={{ fontSize:"11px", fontWeight:"600", color:text }}>${s.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.5s both", transition:"all 0.3s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
          <div>
            <div style={{ fontSize:"14px", fontWeight:"600", color:text }}>Cost by service</div>
            <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Ranked by spend</div>
          </div>
          <span style={{ fontSize:"12px", color:muted }}>
            Total: <span style={{ color:"#00d4aa", fontWeight:"600" }}>${services.reduce((a,b) => a+b.amount, 0).toFixed(2)}</span>
          </span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {services.map((s,i) => {
            const max = services[0]?.amount || 1
            const pct = (s.amount / max) * 100
            return (
              <div key={s.service} style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={{ width:"130px", fontSize:"11px", color:muted, textAlign:"right", flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {s.service.replace("Amazon ","").replace("AWS ","")}
                </div>
                <div style={{ flex:1, height:"26px", background: dark ? "#0a0f1e" : "#f1f5f9", borderRadius:"6px", overflow:"hidden", position:"relative" }}>
                  <div style={{ width:pct+"%", height:"100%", background:"linear-gradient(90deg,"+COLORS[i%COLORS.length]+"80,"+COLORS[i%COLORS.length]+")", borderRadius:"6px", transition:"width 1.2s ease", display:"flex", alignItems:"center", paddingLeft:"8px" }}>
                    {pct > 15 && <span style={{ fontSize:"10px", fontWeight:"600", color:"#fff" }}>${s.amount}</span>}
                  </div>
                  {pct <= 15 && <span style={{ position:"absolute", left:pct+"%", top:"50%", transform:"translateY(-50%)", marginLeft:"8px", fontSize:"10px", fontWeight:"600", color:muted }}>${s.amount}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
"""

with open("src/pages/Cost.jsx", "w", newline="\n", encoding="utf-8") as f:
    f.write(content)
print("Done")
