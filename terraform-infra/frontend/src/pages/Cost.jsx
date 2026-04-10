import { useEffect, useState, useCallback } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, ComposedChart, Line } from "recharts"
import { getCostOverview, getDailyCost, getServiceCost, getForecast, getVMCosts } from "../api/api"
import { useTheme } from "../context/ThemeContext"

const COLORS = ["#00d4aa","#3b82f6","#a78bfa","#f59e0b","#f43f5e","#06b6d4","#84cc16","#fb923c"]
const STATE_COLOR = { running:"#00d4aa", stopped:"#475569", pending:"#f59e0b", stopping:"#f43f5e" }

export default function Cost() {
  const { dark } = useTheme()
  const [overview,   setOverview]   = useState(null)
  const [daily,      setDaily]      = useState([])
  const [services,   setServices]   = useState([])
  const [forecast,   setForecast]   = useState([])
  const [vmCosts,    setVmCosts]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [err,        setErr]        = useState("")
  const [lastUpdate, setLastUpdate] = useState(null)

  const bg       = dark ? "#070c18" : "#f0f4f8"
  const surface  = dark ? "#0f172a" : "#ffffff"
  const border   = dark ? "#1e293b" : "#e2e8f0"
  const text     = dark ? "#f1f5f9" : "#0f172a"
  const muted    = dark ? "#475569" : "#64748b"
  const subtle   = dark ? "#0a0f1e" : "#f1f5f9"
  const cardHover= dark ? "#111827" : "#f8fafc"

  const fetchAll = useCallback(async () => {
    try {
      const [ov, da, sv, fc, vm] = await Promise.all([
        getCostOverview(),
        getDailyCost(),
        getServiceCost(),
        getForecast(),
        getVMCosts(),
      ])
      setOverview(ov.data)
      setDaily(da.data.map(d => ({ ...d, date: d.date.slice(5) })))
      setServices(sv.data)
      setForecast(fc.data)
      setVmCosts(vm.data)
      setLastUpdate(new Date())
    } catch(e) {
      setErr(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 60000)
    return () => clearInterval(id)
  }, [fetchAll])

  if (loading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:bg }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:"40px", height:"40px", border:"2px solid #00d4aa20", borderTop:"2px solid #00d4aa", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 12px" }} />
        <div style={{ fontSize:"13px", color:muted }}>Fetching live AWS cost data...</div>
      </div>
    </div>
  )

  if (err) return (
    <div style={{ padding:"48px", textAlign:"center" }}>
      <div style={{ color:"#f43f5e", fontSize:"14px", marginBottom:"8px" }}>Error loading cost data</div>
      <div style={{ color:muted, fontSize:"12px" }}>{err}</div>
      <button onClick={fetchAll} style={{ marginTop:"16px", padding:"8px 16px", background:"#00d4aa20", border:"1px solid #00d4aa40", borderRadius:"8px", color:"#00d4aa", cursor:"pointer", fontSize:"13px" }}>Retry</button>
    </div>
  )

  const mtd      = overview?.mtd_total      || 0
  const fcTotal  = overview?.forecast       || 0
  const dailyAvg = daily.length ? daily.reduce((a,b) => a + b.amount, 0) / daily.length : 0
  const today    = daily[daily.length-1]?.amount || 0
  const yesterday= daily[daily.length-2]?.amount || 0
  const trend    = today - yesterday

  const runningVms       = vmCosts.filter(v => v.state === "running")
  const totalRunningCost = runningVms.reduce((a,b) => a + b.cost_so_far, 0)

  const cards = [
    { label:"MTD Actual Spend",    value:"$"+mtd.toFixed(2),                color:"#00d4aa", sub: overview?.period_start ? "Since "+overview.period_start : "This month",    live:true,  badge:"AWS BILLING" },
    { label:"Real-Time EC2 Cost",  value:"$"+totalRunningCost.toFixed(4),   color:"#3b82f6", sub: runningVms.length+" instances running now",                                 live:true,  badge:"LIVE"        },
    { label:"Month Forecast",      value:"$"+fcTotal.toFixed(2),            color:"#a78bfa", sub:"Projected end-of-month",                                                   live:false, badge:"FORECAST"    },
    { label:"Today vs Yesterday",  value:(trend>=0?"+$":"-$")+Math.abs(trend).toFixed(2), color:trend>=0?"#f43f5e":"#84cc16", sub:"Today: $"+today.toFixed(2),              live:false, badge:"TREND"       },
  ]

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background:surface, border:"1px solid "+border, borderRadius:"10px", padding:"10px 14px", boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize:"11px", color:muted, marginBottom:"3px" }}>{label}</div>
        {payload.map((p,i) => (
          <div key={i} style={{ fontSize:"14px", fontWeight:"600", color:p.color||"#00d4aa" }}>
            ${typeof p.value === "number" ? p.value.toFixed(4) : p.value}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ minHeight:"100vh", background:bg, padding:"28px", transition:"all 0.3s ease" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .vm-row:hover     { background:${cardHover} !important; }
        .cost-card:hover  { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.12) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px", animation:"fadeUp 0.4s ease both" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
            <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#00d4aa", boxShadow:"0 0 8px #00d4aa", animation:"pulse 2s infinite" }} />
            <span style={{ fontSize:"11px", fontWeight:"600", color:"#00d4aa", textTransform:"uppercase", letterSpacing:"0.12em" }}>
              {overview?.source === "hybrid" ? "Live - AWS Cost Explorer + Real-time" : "Real-time Estimated"}
            </span>
          </div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>Cost Intelligence</h1>
          <p style={{ fontSize:"13px", color:muted, marginTop:"4px" }}>
            Real-time AWS cloud spend &middot; {overview?.running_vms || 0} running &middot; {overview?.stopped_vms || 0} stopped
          </p>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ background:surface, border:"1px solid "+border, borderRadius:"10px", padding:"8px 14px", fontSize:"11px", color:muted }}>
            {lastUpdate ? "Updated "+lastUpdate.toLocaleTimeString() : "Loading..."}
          </div>
          <div style={{ fontSize:"11px", color:muted, marginTop:"6px" }}>Auto-refreshes every 60s</div>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
        {cards.map(({ label, value, color, sub, live, badge }, i) => (
          <div key={label} className="cost-card" style={{ background:surface, border:"1px solid "+border, borderLeft:"3px solid "+color, borderRadius:"14px", padding:"20px", animation:"fadeUp 0.5s ease "+(i*80)+"ms both", transition:"all 0.3s ease" }}>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"10px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"4px", background:color+"20", border:"1px solid "+color+"40", borderRadius:"6px", padding:"2px 7px" }}>
                {live && <div style={{ width:"4px", height:"4px", borderRadius:"50%", background:color, animation:"pulse 1.5s infinite" }} />}
                <span style={{ fontSize:"9px", color:color, fontWeight:"700", letterSpacing:"0.06em" }}>{badge}</span>
              </div>
            </div>
            <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"6px" }}>{label}</div>
            <div style={{ fontSize:"26px", fontWeight:"700", color:text, letterSpacing:"-1px", fontVariantNumeric:"tabular-nums" }}>{value}</div>
            <div style={{ fontSize:"11px", color:muted, marginTop:"4px" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:"20px", marginBottom:"20px" }}>
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.3s both" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
            <div>
              <div style={{ fontSize:"14px", fontWeight:"600", color:text }}>Daily AWS Spend</div>
              <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Last 30 days - from AWS Cost Explorer</div>
            </div>
            <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", borderRadius:"8px", padding:"3px 10px", fontSize:"11px", color:"#00d4aa", fontWeight:"600" }}>
              Total: ${daily.reduce((a,b) => a+b.amount, 0).toFixed(2)}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={daily} margin={{ left:0, right:4 }}>
              <defs>
                <linearGradient id="dGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4aa" stopOpacity={dark?0.3:0.15} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tickFormatter={v=>"$"+v} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="amount" stroke="#00d4aa" strokeWidth={2} fill="url(#dGrad)" dot={false} activeDot={{ r:4, fill:"#00d4aa", strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.4s both" }}>
          <div style={{ fontSize:"14px", fontWeight:"600", color:text, marginBottom:"4px" }}>MTD by Service</div>
          <div style={{ fontSize:"12px", color:muted, marginBottom:"14px" }}>Cost Explorer - current month</div>
          {services.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center", color:muted, fontSize:"13px" }}>No cost data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={services} dataKey="amount" nameKey="service" cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={3}>
                    {services.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v=>["$"+v,"Cost"]} contentStyle={{ background:surface, border:"1px solid "+border, borderRadius:"8px", fontSize:"12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                {services.slice(0,5).map((s,i) => (
                  <div key={s.service} style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                    <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:COLORS[i%COLORS.length], flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:"11px", color:muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {s.service.replace("Amazon ","").replace("AWS ","")}
                    </span>
                    <span style={{ fontSize:"12px", fontWeight:"700", color:text }}>${s.amount}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Forecast + Service Bars */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", marginBottom:"20px" }}>
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.5s both" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
            <div>
              <div style={{ fontSize:"14px", fontWeight:"600", color:text }}>Cost Forecast</div>
              <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Next 3 months projection</div>
            </div>
            <div style={{ background:"#3b82f615", border:"1px solid #3b82f630", borderRadius:"8px", padding:"3px 10px", fontSize:"11px", color:"#3b82f6", fontWeight:"600" }}>FORECAST</div>
          </div>
          {forecast.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center" }}>
              <div style={{ fontSize:"13px", color:muted }}>Forecast needs at least 1 month of billing history in AWS Cost Explorer</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={forecast} margin={{ left:0, right:4 }}>
                <defs>
                  <linearGradient id="fGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={dark?0.3:0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v=>"$"+v} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="upper"  stroke="none" fill="#3b82f610" />
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fill="url(#fGrad)" dot={{ r:4, fill:"#3b82f6", strokeWidth:0 }} />
                <Line type="monotone" dataKey="lower"  stroke="#3b82f640" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.6s both" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
            <div>
              <div style={{ fontSize:"14px", fontWeight:"600", color:text }}>Service Spend</div>
              <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Ranked by MTD cost</div>
            </div>
            <span style={{ fontSize:"12px", color:muted }}>
              Total: <span style={{ color:"#00d4aa", fontWeight:"700" }}>${services.reduce((a,b)=>a+b.amount,0).toFixed(2)}</span>
            </span>
          </div>
          {services.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center", color:muted, fontSize:"13px" }}>No service data yet</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {services.map((s,i) => {
                const max = services[0]?.amount || 1
                const pct = (s.amount/max)*100
                return (
                  <div key={s.service} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <div style={{ width:"110px", fontSize:"10px", color:muted, textAlign:"right", flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {s.service.replace("Amazon ","").replace("AWS ","")}
                    </div>
                    <div style={{ flex:1, height:"22px", background:subtle, borderRadius:"6px", overflow:"hidden", position:"relative" }}>
                      <div style={{ width:pct+"%", height:"100%", background:"linear-gradient(90deg,"+COLORS[i%COLORS.length]+"80,"+COLORS[i%COLORS.length]+")", borderRadius:"6px", transition:"width 1.2s ease", display:"flex", alignItems:"center", paddingLeft:"6px" }}>
                        {pct>20 && <span style={{ fontSize:"10px", fontWeight:"600", color:"#fff" }}>${s.amount}</span>}
                      </div>
                      {pct<=20 && <span style={{ position:"absolute", left:pct+"%", top:"50%", transform:"translateY(-50%)", marginLeft:"6px", fontSize:"10px", fontWeight:"600", color:muted }}>${s.amount}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Per-VM Real-Time Cost Table */}
      <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.7s both" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <div>
            <div style={{ fontSize:"14px", fontWeight:"600", color:text }}>Per-VM Real-Time Cost</div>
            <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Live running cost based on instance type x uptime - updates every 60s</div>
          </div>
          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
              <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#00d4aa", animation:"pulse 1.5s infinite" }} />
              <span style={{ fontSize:"11px", color:"#00d4aa", fontWeight:"600" }}>LIVE</span>
            </div>
            <div style={{ background:"#f43f5e15", border:"1px solid #f43f5e30", borderRadius:"8px", padding:"3px 10px", fontSize:"11px", color:"#f43f5e", fontWeight:"600" }}>
              Running Cost: ${totalRunningCost.toFixed(4)}/session
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr", gap:"8px", padding:"8px 12px", background:subtle, borderRadius:"8px", marginBottom:"8px" }}>
          {["VM Name","Type","State","Hours Running","Cost So Far","$/Hour","Est. Monthly"].map(h => (
            <div key={h} style={{ fontSize:"10px", fontWeight:"700", color:muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
          {vmCosts.map((vm, i) => (
            <div key={vm.vm_id} className="vm-row" style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr", gap:"8px", padding:"10px 12px", borderRadius:"8px", transition:"background 0.2s ease", animation:"fadeUp 0.3s ease "+(i*30)+"ms both", background:"transparent" }}>
              <div style={{ fontSize:"13px", fontWeight:"600", color:text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={vm.name}>{vm.name}</div>
              <div style={{ fontSize:"11px", color:muted, fontFamily:"monospace" }}>{vm.instance_type}</div>
              <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:STATE_COLOR[vm.state]||"#475569", flexShrink:0, animation:vm.state==="running"?"pulse 2s infinite":"none" }} />
                <span style={{ fontSize:"11px", color:STATE_COLOR[vm.state]||muted, fontWeight:"600" }}>{vm.state}</span>
              </div>
              <div style={{ fontSize:"12px", color:vm.state==="running"?text:muted, fontVariantNumeric:"tabular-nums" }}>
                {vm.hours_running>0 ? vm.hours_running.toFixed(1)+"h" : "-"}
              </div>
              <div style={{ fontSize:"13px", fontWeight:"700", color:vm.cost_so_far>0?"#f43f5e":muted, fontVariantNumeric:"tabular-nums" }}>
                {vm.cost_so_far>0 ? "$"+vm.cost_so_far.toFixed(4) : "-"}
              </div>
              <div style={{ fontSize:"12px", color:muted, fontVariantNumeric:"tabular-nums" }}>${vm.cost_per_hour.toFixed(4)}</div>
              <div style={{ fontSize:"12px", fontWeight:"600", color:vm.estimated_monthly>100?"#f59e0b":text, fontVariantNumeric:"tabular-nums" }}>
                {vm.estimated_monthly>0 ? "$"+vm.estimated_monthly.toFixed(2) : "-"}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr", gap:"8px", padding:"10px 12px", marginTop:"8px", borderTop:"1px solid "+border }}>
          <div style={{ fontSize:"12px", fontWeight:"700", color:text }}>TOTAL ({vmCosts.length} VMs)</div>
          <div /><div style={{ fontSize:"11px", color:muted }}>{runningVms.length} running</div><div />
          <div style={{ fontSize:"13px", fontWeight:"700", color:"#f43f5e" }}>${totalRunningCost.toFixed(4)}</div>
          <div />
          <div style={{ fontSize:"12px", fontWeight:"700", color:"#f59e0b" }}>
            ${vmCosts.reduce((a,b)=>a+b.estimated_monthly,0).toFixed(2)}/mo
          </div>
        </div>
      </div>

    </div>
  )
}
