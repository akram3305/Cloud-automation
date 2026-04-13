import { useEffect, useState, useCallback, useRef } from "react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
  ComposedChart, Line, Legend
} from "recharts"
import {
  getCostOverview, getDailyCost, getServiceCost,
  getForecast, getVMCosts, getMonthlyCost
} from "../api/api"
import { useTheme } from "../context/ThemeContext"

const COLORS = ["#00d4aa","#3b82f6","#a78bfa","#f59e0b","#f43f5e","#06b6d4","#84cc16","#fb923c"]
const STATE_COLOR = { running:"#00d4aa", stopped:"#475569", pending:"#f59e0b", stopping:"#f43f5e" }

function fmt(n, dec = 2) {
  return typeof n === "number" ? n.toFixed(dec) : "0.00"
}

function fmtMonth(ym) {
  if (!ym) return ""
  const [y, m] = ym.split("-")
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString("default", { month:"short", year:"numeric" })
}

const GLOBAL_STYLES = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  .cost-card:hover   { transform:translateY(-2px) !important; box-shadow:0 12px 32px rgba(0,0,0,0.14) !important; }
  .vm-row:hover      { opacity:0.9; }
  .tab-pill:hover    { opacity:0.85; }
  .month-row:hover   { background:var(--row-hover) !important; }
  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:#334155; border-radius:4px; }
`

/* ────────────────────────────────────────────
   Shared small components
   ──────────────────────────────────────────── */

function Spinner({ size = 20, color = "#00d4aa" }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid ${color}20`,
      borderTop: `2px solid ${color}`,
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      flexShrink: 0
    }} />
  )
}

function SkeletonBlock({ w = "100%", h = 16, radius = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "linear-gradient(90deg,#1e293b 25%,#263345 50%,#1e293b 75%)",
      backgroundSize: "200% 100%",
      animation: "spin 1.5s linear infinite"
    }} />
  )
}

function LiveDot({ color = "#00d4aa", size = 6 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, animation: "pulse 1.8s infinite", flexShrink: 0
    }} />
  )
}

function Badge({ label, color, live = false }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap: 4,
      background: color+"20", border: `1px solid ${color}40`,
      borderRadius: 6, padding: "2px 7px"
    }}>
      {live && <LiveDot color={color} size={4} />}
      <span style={{ fontSize:9, color, fontWeight:700, letterSpacing:"0.06em" }}>{label}</span>
    </div>
  )
}

/* ────────────────────────────────────────────
   Custom Tooltip
   ──────────────────────────────────────────── */

function ChartTooltip({ active, payload, label, surface, border, muted, prefix = "$" }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: surface, border: `1px solid ${border}`,
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.18)", minWidth: 120
    }}>
      <div style={{ fontSize:11, color:muted, marginBottom:4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize:14, fontWeight:700, color: p.color || "#00d4aa", display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background: p.color || "#00d4aa" }} />
          {p.name && <span style={{ fontSize:10, color:muted, fontWeight:400 }}>{p.name}:</span>}
          {prefix}{typeof p.value === "number" ? fmt(p.value, 4) : p.value}
        </div>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────
   Stacked bar custom tooltip for 6-month tab
   ──────────────────────────────────────────── */

function MonthlyTooltip({ active, payload, label, surface, border, muted }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((a,b) => a + (b.value || 0), 0)
  const top3 = [...payload].sort((a,b) => b.value - a.value).slice(0,3)
  return (
    <div style={{
      background: surface, border: `1px solid ${border}`,
      borderRadius: 10, padding: "12px 16px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.18)", minWidth: 160
    }}>
      <div style={{ fontSize:12, fontWeight:700, color:"#f1f5f9", marginBottom:6 }}>{fmtMonth(label)}</div>
      <div style={{ fontSize:14, fontWeight:700, color:"#00d4aa", marginBottom:8 }}>
        Total: ${fmt(total)}
      </div>
      {top3.map((p, i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:3 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background: p.fill || p.color }} />
            <span style={{ fontSize:11, color:muted }}>{p.name}</span>
          </div>
          <span style={{ fontSize:11, fontWeight:600, color:"#f1f5f9" }}>${fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────
   Skeleton loaders
   ──────────────────────────────────────────── */

function MonthSkeleton({ surface, border }) {
  return (
    <div style={{ animation:"fadeIn 0.3s ease" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ background:surface, border:`1px solid ${border}`, borderRadius:12, padding:18 }}>
            <SkeletonBlock h={11} w="60%" radius={4} />
            <div style={{ marginTop:10 }}><SkeletonBlock h={28} w="80%" radius={6} /></div>
          </div>
        ))}
      </div>
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:24, marginBottom:20 }}>
        <SkeletonBlock h={220} radius={8} />
      </div>
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:24 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, padding:"10px 0", borderBottom:"1px solid #1e293b" }}>
            <SkeletonBlock h={12} w="70%" />
            <SkeletonBlock h={12} w="60%" />
            <SkeletonBlock h={12} w="80%" />
            <SkeletonBlock h={12} w="50%" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   TAB 1 – OVERVIEW
   ════════════════════════════════════════════ */

function OverviewTab({ overview, daily, services, forecast, vmCosts, dark, surface, border, text, muted, subtle }) {
  const mtd = overview?.mtd_total || 0
  const fcTotal = overview?.forecast || 0
  const today = daily[daily.length - 1]?.amount || 0
  const yesterday = daily[daily.length - 2]?.amount || 0
  const trend = today - yesterday
  const runningVms = vmCosts.filter(v => v.state === "running")
  const totalRunningCost = runningVms.reduce((a,b) => a + b.cost_so_far, 0)

  const cards = [
    { label:"MTD Actual Spend",   value:`$${fmt(mtd)}`,                                color:"#00d4aa", sub: overview?.period_start ? `Since ${overview.period_start}` : "This month",   live:true,  badge:"AWS BILLING" },
    { label:"Real-Time EC2 Cost", value:`$${fmt(totalRunningCost, 4)}`,                color:"#3b82f6", sub: `${runningVms.length} instances running`,                                    live:true,  badge:"LIVE"        },
    { label:"Month Forecast",     value:`$${fmt(fcTotal)}`,                            color:"#a78bfa", sub:"Projected end-of-month",                                                     live:false, badge:"FORECAST"    },
    { label:"Today vs Yesterday", value:`${trend>=0?"+$":"-$"}${fmt(Math.abs(trend))}`,color:trend>=0?"#f43f5e":"#84cc16", sub:`Today: $${fmt(today)}`,                                  live:false, badge:"TREND"       },
  ]

  const tt = (props) => <ChartTooltip {...props} surface={surface} border={border} muted={muted} />

  return (
    <div style={{ animation:"fadeIn 0.35s ease" }}>
      {/* Metric Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        {cards.map(({ label, value, color, sub, live, badge }, i) => (
          <div key={label} className="cost-card" style={{
            background: surface, border:`1px solid ${border}`, borderLeft:`3px solid ${color}`,
            borderRadius:14, padding:20, cursor:"default",
            animation:`fadeUp 0.5s ease ${i*70}ms both`, transition:"all 0.25s ease"
          }}>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
              <Badge label={badge} color={color} live={live} />
            </div>
            <div style={{ fontSize:10, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:26, fontWeight:700, color:text, letterSpacing:"-1px", fontVariantNumeric:"tabular-nums" }}>{value}</div>
            <div style={{ fontSize:11, color:muted, marginTop:4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Daily chart + Pie */}
      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:16, marginBottom:16 }}>
        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:22, animation:"fadeUp 0.5s ease 0.28s both" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:text }}>Daily AWS Spend</div>
              <div style={{ fontSize:12, color:muted, marginTop:2 }}>Last 30 days — Cost Explorer</div>
            </div>
            <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", borderRadius:8, padding:"3px 10px", fontSize:11, color:"#00d4aa", fontWeight:600 }}>
              Total: ${fmt(daily.reduce((a,b) => a+b.amount, 0))}
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
              <YAxis tickFormatter={v=>`$${v}`} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={tt} />
              <Area type="monotone" dataKey="amount" stroke="#00d4aa" strokeWidth={2} fill="url(#dGrad)" dot={false} activeDot={{ r:4, fill:"#00d4aa", strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:22, animation:"fadeUp 0.5s ease 0.36s both" }}>
          <div style={{ fontSize:14, fontWeight:600, color:text, marginBottom:4 }}>MTD by Service</div>
          <div style={{ fontSize:12, color:muted, marginBottom:14 }}>Cost Explorer — current month</div>
          {services.length === 0 ? (
            <div style={{ padding:32, textAlign:"center", color:muted, fontSize:13 }}>No cost data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={services} dataKey="amount" nameKey="service" cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={3}>
                    {services.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v=>[`$${v}`,"Cost"]} contentStyle={{ background:surface, border:`1px solid ${border}`, borderRadius:8, fontSize:12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {services.slice(0,5).map((s,i) => (
                  <div key={s.service} style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:COLORS[i%COLORS.length], flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:11, color:muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {s.service.replace("Amazon ","").replace("AWS ","")}
                    </span>
                    <span style={{ fontSize:12, fontWeight:700, color:text }}>${s.amount}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Forecast + Service Bars */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:22, animation:"fadeUp 0.5s ease 0.44s both" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:text }}>Cost Forecast</div>
              <div style={{ fontSize:12, color:muted, marginTop:2 }}>Next 3 months projection</div>
            </div>
            <Badge label="FORECAST" color="#3b82f6" />
          </div>
          {forecast.length === 0 ? (
            <div style={{ padding:32, textAlign:"center", fontSize:13, color:muted }}>
              Forecast needs at least 1 month of billing history in AWS Cost Explorer
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
                <YAxis tickFormatter={v=>`$${v}`} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={tt} />
                <Area type="monotone" dataKey="upper"  stroke="none" fill="#3b82f610" />
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fill="url(#fGrad)" dot={{ r:4, fill:"#3b82f6", strokeWidth:0 }} />
                <Line type="monotone" dataKey="lower" stroke="#3b82f640" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:22, animation:"fadeUp 0.5s ease 0.52s both" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:text }}>Service Spend</div>
              <div style={{ fontSize:12, color:muted, marginTop:2 }}>Ranked by MTD cost</div>
            </div>
            <span style={{ fontSize:12, color:muted }}>
              Total: <span style={{ color:"#00d4aa", fontWeight:700 }}>${fmt(services.reduce((a,b)=>a+b.amount,0))}</span>
            </span>
          </div>
          {services.length === 0 ? (
            <div style={{ padding:32, textAlign:"center", color:muted, fontSize:13 }}>No service data yet</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {services.map((s,i) => {
                const max = services[0]?.amount || 1
                const pct = (s.amount / max) * 100
                return (
                  <div key={s.service} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:110, fontSize:10, color:muted, textAlign:"right", flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {s.service.replace("Amazon ","").replace("AWS ","")}
                    </div>
                    <div style={{ flex:1, height:22, background:subtle, borderRadius:6, overflow:"hidden", position:"relative" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:`linear-gradient(90deg,${COLORS[i%COLORS.length]}80,${COLORS[i%COLORS.length]})`, borderRadius:6, transition:"width 1.2s ease", display:"flex", alignItems:"center", paddingLeft:6 }}>
                        {pct > 20 && <span style={{ fontSize:10, fontWeight:600, color:"#fff" }}>${s.amount}</span>}
                      </div>
                      {pct <= 20 && <span style={{ position:"absolute", left:`${pct}%`, top:"50%", transform:"translateY(-50%)", marginLeft:6, fontSize:10, fontWeight:600, color:muted }}>${s.amount}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   TAB 2 – 6 MONTHS
   ════════════════════════════════════════════ */

function SixMonthTab({ surface, border, text, muted, subtle, dark }) {
  const [monthlyData, setMonthlyData] = useState([])
  const [loading6m, setLoading6m] = useState(true)
  const [err6m, setErr6m] = useState("")
  const [detailMonth, setDetailMonth] = useState(null)   // clicked month object
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    setLoading6m(true)
    getMonthlyCost(6)
      .then(res => {
        setMonthlyData(res.data || [])
        setErr6m("")
      })
      .catch(e => setErr6m(e.response?.data?.detail || e.message))
      .finally(() => setLoading6m(false))
  }, [])

  if (loading6m) return <MonthSkeleton surface={surface} border={border} />

  if (err6m) return (
    <div style={{ padding:48, textAlign:"center" }}>
      <div style={{ color:"#f43f5e", fontSize:14, marginBottom:6 }}>Could not load 6-month data</div>
      <div style={{ color:muted, fontSize:12 }}>{err6m}</div>
    </div>
  )

  if (!monthlyData.length) return (
    <div style={{ padding:48, textAlign:"center", color:muted, fontSize:14 }}>No historical cost data available.</div>
  )

  // Collect all unique services across all months
  const allServices = Array.from(
    new Set(monthlyData.flatMap(m => (m.services || []).map(s => s.service)))
  )

  // Build chart data: each entry has month + one key per service
  const chartData = monthlyData.map(m => {
    const row = { month: m.month, total: m.total || 0 }
    ;(m.services || []).forEach(s => { row[s.service] = s.amount })
    return row
  })

  const totals = monthlyData.map(m => m.total || 0)
  const sixMonthTotal = totals.reduce((a,b) => a+b, 0)
  const avgMonthly = totals.length ? sixMonthTotal / totals.length : 0
  const highestMonth = monthlyData.reduce((a,b) => (b.total||0) > (a.total||0) ? b : a, monthlyData[0] || {})

  return (
    <div style={{ animation:"fadeIn 0.35s ease" }}>
      {/* Summary bar */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
        {[
          { label:"6-Month Total",      value:`$${fmt(sixMonthTotal)}`,        color:"#00d4aa", icon:"📊" },
          { label:"Avg per Month",      value:`$${fmt(avgMonthly)}`,           color:"#3b82f6", icon:"📈" },
          { label:"Highest Month",      value:`${fmtMonth(highestMonth?.month||"")} — $${fmt(highestMonth?.total||0)}`, color:"#f43f5e", icon:"🔺" },
        ].map(({ label, value, color }, i) => (
          <div key={label} className="cost-card" style={{
            background: surface, border:`1px solid ${border}`, borderLeft:`3px solid ${color}`,
            borderRadius:14, padding:18, animation:`fadeUp 0.5s ease ${i*80}ms both`, transition:"all 0.25s ease"
          }}>
            <div style={{ fontSize:10, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:text, letterSpacing:"-0.5px", fontVariantNumeric:"tabular-nums" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Stacked BarChart */}
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:24, marginBottom:16, animation:"fadeUp 0.5s ease 0.24s both" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:text }}>Monthly Spend by Service</div>
            <div style={{ fontSize:12, color:muted, marginTop:2 }}>Stacked by top services — last 6 months</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ left:0, right:4 }}>
            <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v=>`$${v}`} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<MonthlyTooltipWrapper surface={surface} border={border} muted={muted} />} />
            <Legend
              wrapperStyle={{ fontSize:10, color:muted, paddingTop:12 }}
              formatter={v => v.replace("Amazon ","").replace("AWS ","")}
            />
            {allServices.slice(0,6).map((svc, i) => (
              <Bar key={svc} dataKey={svc} stackId="a" fill={COLORS[i%COLORS.length]} radius={i === allServices.slice(0,6).length-1 ? [4,4,0,0] : [0,0,0,0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly breakdown table */}
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:24, animation:"fadeUp 0.5s ease 0.38s both" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:600, color:text }}>Monthly Breakdown</div>
          <div style={{ fontSize:11, color:muted }}>Click any month to see full resource breakdown →</div>
        </div>
        {/* Header */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1.4fr 0.8fr 32px", gap:12, padding:"8px 12px", background:subtle, borderRadius:8, marginBottom:4 }}>
          {["Month","Total Spend","Top Service","vs Prev Month",""].map(h => (
            <div key={h} style={{ fontSize:10, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column" }}>
          {monthlyData.map((m, idx) => {
            const prevTotal = monthlyData[idx - 1]?.total || 0
            const topSvc = (m.services || []).sort((a,b) => b.amount - a.amount)[0]
            const pctChange = prevTotal > 0 ? ((m.total - prevTotal) / prevTotal) * 100 : null
            const isUp = pctChange !== null && pctChange >= 0
            return (
              <div
                key={m.month}
                className="month-row"
                onClick={() => setDetailMonth(m)}
                style={{
                  display:"grid", gridTemplateColumns:"1fr 1fr 1.4fr 0.8fr 32px", gap:12,
                  padding:"12px 12px", borderBottom:`1px solid ${border}`,
                  transition:"all 0.18s ease",
                  cursor:"pointer", borderRadius:6,
                  "--row-hover": dark ? "#111827" : "#f8fafc"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = dark ? "rgba(0,212,170,0.06)" : "rgba(0,212,170,0.04)"; e.currentTarget.style.paddingLeft="16px" }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.paddingLeft="12px" }}
              >
                <div style={{ fontSize:13, fontWeight:600, color:text }}>{fmtMonth(m.month)}</div>
                <div style={{ fontSize:13, fontWeight:700, color:"#00d4aa", fontVariantNumeric:"tabular-nums" }}>${fmt(m.total)}</div>
                <div style={{ display:"flex", alignItems:"center", gap:5, overflow:"hidden" }}>
                  {topSvc && (
                    <>
                      <div style={{ width:6, height:6, borderRadius:"50%", background: COLORS[0], flexShrink:0 }} />
                      <span style={{ fontSize:11, color:muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {(topSvc.service||"").replace("Amazon ","").replace("AWS ","")} — <span style={{ color:text, fontWeight:600 }}>${fmt(topSvc.amount)}</span>
                      </span>
                    </>
                  )}
                </div>
                <div style={{ fontSize:12, fontWeight:700, color: pctChange === null ? muted : isUp ? "#f43f5e" : "#84cc16" }}>
                  {pctChange === null
                    ? <span style={{ color:muted, fontWeight:400, fontSize:11 }}>—</span>
                    : <>{isUp ? "▲" : "▼"} {isUp ? "+" : ""}{fmt(pctChange, 1)}%</>
                  }
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Month Detail Modal ── */}
      {detailMonth && (
        <MonthDetailModal
          month={detailMonth}
          surface={surface} border={border} text={text} muted={muted} dark={dark}
          onClose={() => setDetailMonth(null)}
        />
      )}
    </div>
  )
}

function MonthDetailModal({ month, surface, border, text, muted, dark, onClose }) {
  const services  = [...(month.services || [])].sort((a,b) => b.amount - a.amount)
  const total     = month.total || 0
  const maxAmt    = services[0]?.amount || 1

  return (
    <div
      onClick={onClose}
      style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)",
        zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:24,
        animation:"fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: dark ? "linear-gradient(145deg,#0f172a,#0a0f1e)" : "#ffffff",
          border:`1px solid ${border}`, borderRadius:20,
          width:"100%", maxWidth:640, maxHeight:"85vh", overflow:"auto",
          boxShadow:"0 32px 80px rgba(0,0,0,0.5)",
          animation:"fadeUp 0.25s cubic-bezier(0,0,0.2,1.3) both",
        }}
      >
        {/* Header */}
        <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#00d4aa", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>
              Monthly Cost Detail
            </div>
            <div style={{ fontSize:20, fontWeight:700, color:text }}>{fmtMonth(month.month)}</div>
            <div style={{ fontSize:13, color:muted, marginTop:2 }}>
              Total: <span style={{ color:"#00d4aa", fontWeight:700 }}>${fmt(total)}</span>
              &nbsp;·&nbsp; {services.length} services billed
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:6, borderRadius:8, color:muted, fontSize:20, lineHeight:1 }}>✕</button>
        </div>

        {/* Service breakdown */}
        <div style={{ padding:"16px 24px 24px" }}>
          {services.length === 0 ? (
            <div style={{ textAlign:"center", padding:32, color:muted, fontSize:13 }}>No service data available</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {services.map((s, i) => {
                const pct    = total > 0 ? (s.amount / total) * 100 : 0
                const barPct = maxAmt > 0 ? (s.amount / maxAmt) * 100 : 0
                const color  = COLORS[i % COLORS.length]
                const svcShort = (s.service||"").replace("Amazon ","").replace("AWS ","")
                return (
                  <div key={s.service} style={{
                    background: dark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                    border:`1px solid ${border}`, borderRadius:10, padding:"12px 16px",
                    animation:`fadeUp 0.3s ease ${i*35}ms both`,
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:8, height:8, borderRadius:2, background:color, flexShrink:0 }} />
                        <span style={{ fontSize:13, fontWeight:500, color:text }}>{svcShort}</span>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:14, fontWeight:700, color:text, fontVariantNumeric:"tabular-nums" }}>${fmt(s.amount)}</div>
                        <div style={{ fontSize:10, color:muted }}>{fmt(pct,1)}% of total</div>
                      </div>
                    </div>
                    {/* Bar */}
                    <div style={{ height:4, background:dark?"rgba(255,255,255,0.06)":"#e2e8f0", borderRadius:4, overflow:"hidden" }}>
                      <div style={{
                        width:`${barPct}%`, height:"100%", borderRadius:4,
                        background:`linear-gradient(90deg,${color},${color}aa)`,
                        transition:"width 0.8s cubic-bezier(0,0,0.2,1)",
                        boxShadow:`0 0 8px ${color}60`,
                      }} />
                    </div>
                  </div>
                )
              })}

              {/* Total footer */}
              <div style={{
                background:`linear-gradient(90deg,rgba(0,212,170,0.1),rgba(14,165,233,0.05))`,
                border:`1px solid rgba(0,212,170,0.25)`, borderRadius:10, padding:"14px 16px",
                display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4,
              }}>
                <span style={{ fontSize:13, fontWeight:700, color:text }}>Total ({services.length} services)</span>
                <span style={{ fontSize:18, fontWeight:800, color:"#00d4aa", fontVariantNumeric:"tabular-nums" }}>${fmt(total)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MonthlyTooltipWrapper(props) {
  return (payload) => <MonthlyTooltip {...payload} {...props} />
}

/* ════════════════════════════════════════════
   TAB 3 – PER RESOURCE
   ════════════════════════════════════════════ */

function PerResourceTab({ vmCosts, surface, border, text, muted, subtle, dark }) {
  const runningVms = vmCosts.filter(v => v.state === "running")
  const totalRunningCost = runningVms.reduce((a,b) => a + b.cost_so_far, 0)
  const totalHourlyRate = runningVms.reduce((a,b) => a + b.cost_per_hour, 0)
  const dailyEstimate = totalHourlyRate * 24
  const monthlyEstimate = vmCosts.reduce((a,b) => a + b.estimated_monthly, 0)

  const maxHourly = Math.max(...vmCosts.map(v => v.cost_per_hour), 0.0001)

  return (
    <div style={{ animation:"fadeIn 0.35s ease" }}>
      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        {[
          { label:"Total Running Cost",   value:`$${fmt(totalRunningCost, 4)}`, color:"#f43f5e", sub:`${runningVms.length} instances active`, live:true  },
          { label:"Running Hourly Rate",  value:`$${fmt(totalHourlyRate, 4)}/h`, color:"#f59e0b", sub:"All running combined",                live:true  },
          { label:"Estimated Daily",      value:`$${fmt(dailyEstimate)}/day`,   color:"#3b82f6", sub:"At current running rate",             live:false },
          { label:"Estimated Monthly",    value:`$${fmt(monthlyEstimate)}/mo`,  color:"#a78bfa", sub:"All VMs if running 24/7",             live:false },
        ].map(({ label, value, color, sub, live }, i) => (
          <div key={label} className="cost-card" style={{
            background: surface, border:`1px solid ${border}`, borderLeft:`3px solid ${color}`,
            borderRadius:14, padding:18, animation:`fadeUp 0.5s ease ${i*70}ms both`, transition:"all 0.25s ease"
          }}>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
              <Badge label={live ? "LIVE" : "ESTIMATE"} color={color} live={live} />
            </div>
            <div style={{ fontSize:10, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:text, letterSpacing:"-0.5px", fontVariantNumeric:"tabular-nums" }}>{value}</div>
            <div style={{ fontSize:11, color:muted, marginTop:4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* VM Table */}
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden", animation:"fadeUp 0.5s ease 0.3s both" }}>
        <div style={{ padding:"18px 22px 14px", borderBottom:`1px solid ${border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:text }}>Per-VM Real-Time Cost</div>
            <div style={{ fontSize:12, color:muted, marginTop:2 }}>Live running cost × uptime — auto-refreshes every 30s</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <LiveDot color="#00d4aa" />
            <span style={{ fontSize:11, color:"#00d4aa", fontWeight:600 }}>LIVE</span>
          </div>
        </div>

        {/* Sticky header */}
        <div style={{
          position:"sticky", top:0, zIndex:2,
          display:"grid", gridTemplateColumns:"2fr 1fr 0.9fr 1fr 1.1fr 1fr 1fr 1.2fr",
          gap:8, padding:"9px 22px", background: dark ? "#0a0f1e" : "#f1f5f9",
          borderBottom:`1px solid ${border}`
        }}>
          {["VM Name","Type","State","Hours","Cost So Far","$/Hour","$/Day","Est. Monthly"].map(h => (
            <div key={h} style={{ fontSize:10, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>
          ))}
        </div>

        <div style={{ maxHeight:440, overflowY:"auto" }}>
          {vmCosts.length === 0 ? (
            <div style={{ padding:"40px 22px", textAlign:"center", color:muted, fontSize:13 }}>No VM cost data available.</div>
          ) : (
            vmCosts.map((vm, i) => {
              const barPct = (vm.cost_per_hour / maxHourly) * 100
              return (
                <div
                  key={vm.vm_id}
                  className="vm-row"
                  style={{
                    display:"grid", gridTemplateColumns:"2fr 1fr 0.9fr 1fr 1.1fr 1fr 1fr 1.2fr",
                    gap:8, padding:"11px 22px", borderBottom:`1px solid ${border}`,
                    transition:"opacity 0.2s ease", animation:`fadeUp 0.3s ease ${i*25}ms both`
                  }}
                >
                  <div style={{ fontSize:13, fontWeight:600, color:text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={vm.name}>
                    {vm.name}
                  </div>
                  <div style={{ fontSize:11, color:muted, fontFamily:"monospace" }}>{vm.instance_type}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:STATE_COLOR[vm.state]||"#475569", flexShrink:0, animation:vm.state==="running"?"pulse 2s infinite":"none" }} />
                    <span style={{ fontSize:11, color:STATE_COLOR[vm.state]||muted, fontWeight:600 }}>{vm.state}</span>
                  </div>
                  <div style={{ fontSize:12, color:vm.state==="running"?text:muted, fontVariantNumeric:"tabular-nums" }}>
                    {vm.hours_running > 0 ? `${fmt(vm.hours_running, 1)}h` : "—"}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:vm.cost_so_far>0?"#f43f5e":muted, fontVariantNumeric:"tabular-nums" }}>
                    {vm.cost_so_far > 0 ? `$${fmt(vm.cost_so_far, 4)}` : "—"}
                  </div>
                  {/* $/hr with mini sparkline bar */}
                  <div>
                    <div style={{ fontSize:12, color:muted, fontVariantNumeric:"tabular-nums", marginBottom:4 }}>
                      ${fmt(vm.cost_per_hour, 4)}
                    </div>
                    <div style={{ height:3, background: dark ? "#1e293b" : "#e2e8f0", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${barPct}%`, height:"100%", background:"linear-gradient(90deg,#3b82f6,#a78bfa)", borderRadius:2, transition:"width 0.8s ease" }} />
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:text, fontVariantNumeric:"tabular-nums" }}>
                    ${fmt(vm.cost_per_hour * 24)}
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:vm.estimated_monthly>100?"#f59e0b":text, fontVariantNumeric:"tabular-nums" }}>
                    {vm.estimated_monthly > 0 ? `$${fmt(vm.estimated_monthly)}` : "—"}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer total */}
        <div style={{
          display:"grid", gridTemplateColumns:"2fr 1fr 0.9fr 1fr 1.1fr 1fr 1fr 1.2fr",
          gap:8, padding:"11px 22px", borderTop:`1px solid ${border}`,
          background: dark ? "#0a0f1e" : "#f8fafc"
        }}>
          <div style={{ fontSize:12, fontWeight:700, color:text }}>TOTAL ({vmCosts.length} VMs)</div>
          <div /><div style={{ fontSize:11, color:muted }}>{runningVms.length} running</div><div />
          <div style={{ fontSize:13, fontWeight:700, color:"#f43f5e" }}>${fmt(totalRunningCost, 4)}</div>
          <div style={{ fontSize:12, fontWeight:700, color:"#3b82f6" }}>${fmt(totalHourlyRate, 4)}/h</div>
          <div style={{ fontSize:12, fontWeight:700, color:"#3b82f6" }}>${fmt(dailyEstimate)}</div>
          <div style={{ fontSize:12, fontWeight:700, color:"#f59e0b" }}>${fmt(monthlyEstimate)}/mo</div>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   TAB 4 – AWS RESOURCES (Cost Explorer)
   ════════════════════════════════════════════ */

function AWSResourcesTab({ surface, border, text, muted, subtle, dark }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import("../api/api").then(({ getResourceCosts }) => {
      getResourceCosts()
        .then(res => setData(res.data))
        .catch(() => setData({ total: 0, resources: [], error: "Failed to load" }))
        .finally(() => setLoading(false))
    })
  }, [])

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {[0,1,2,3,4,5,6,7].map(i => (
        <div key={i} style={{ background:surface, border:`1px solid ${border}`, borderRadius:10, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
          <SkeletonBlock w={32} h={32} radius={8} />
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
            <SkeletonBlock h={13} w="35%" />
            <SkeletonBlock h={8} w="55%" />
          </div>
          <SkeletonBlock w={80} h={22} radius={6} />
        </div>
      ))}
    </div>
  )

  const resources = data?.resources || []
  const total     = data?.total || 0
  const period    = data?.period || ""
  const maxAmt    = resources[0]?.amount || 1

  return (
    <div style={{ animation:"fadeUp 0.4s ease both" }}>
      {/* Header strip */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#00d4aa", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>AWS Cost Explorer</div>
          <div style={{ fontSize:22, fontWeight:700, color:text }}>
            ${fmt(total)} <span style={{ fontSize:13, fontWeight:400, color:muted }}>month-to-date</span>
          </div>
          {period && <div style={{ fontSize:11, color:muted, marginTop:2 }}>{period}</div>}
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", borderRadius:8, padding:"6px 14px", fontSize:11, color:"#00d4aa" }}>
            {resources.length} services billed this month
          </div>
        </div>
      </div>

      {resources.length === 0 ? (
        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, padding:"48px", textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>☁️</div>
          <div style={{ fontSize:15, fontWeight:600, color:text, marginBottom:6 }}>No billing data available</div>
          <div style={{ fontSize:12, color:muted }}>
            {data?.error || "No AWS Cost Explorer data for the current billing period."}
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {/* Column headers */}
          <div style={{ display:"grid", gridTemplateColumns:"2.5fr 1fr 1fr 1fr 0.8fr", gap:8, padding:"6px 18px", fontSize:10, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>
            <div>Service</div>
            <div style={{ textAlign:"right" }}>MTD Cost</div>
            <div style={{ textAlign:"right" }}>Share</div>
            <div style={{ textAlign:"right" }}>vs Last Month</div>
            <div></div>
          </div>

          {resources.map((r, i) => {
            const barPct = maxAmt > 0 ? Math.min((r.amount / maxAmt) * 100, 100) : 0
            const trendColor = r.trend_pct === null ? muted : r.trend_pct > 10 ? "#f43f5e" : r.trend_pct < -5 ? "#84cc16" : "#f59e0b"
            const trendLabel = r.trend_pct === null ? "N/A" : `${r.trend_pct > 0 ? "+" : ""}${r.trend_pct}%`
            const rowBg = i % 2 === 0 ? surface : subtle
            return (
              <div key={r.service} style={{ background:rowBg, border:`1px solid ${border}`, borderRadius:10, padding:"12px 18px", display:"grid", gridTemplateColumns:"2.5fr 1fr 1fr 1fr 0.8fr", gap:8, alignItems:"center", transition:"all 0.15s" }}>
                {/* Service name + icon */}
                <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background: COLORS[i % COLORS.length]+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                    {r.icon}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.short_name}</div>
                    <div style={{ height:3, background: dark ? "#1e293b" : "#e2e8f0", borderRadius:2, marginTop:4, overflow:"hidden" }}>
                      <div style={{ width:`${barPct}%`, height:"100%", background:`linear-gradient(90deg,${COLORS[i % COLORS.length]},${COLORS[(i+2) % COLORS.length]})`, borderRadius:2, transition:"width 1s ease" }} />
                    </div>
                  </div>
                </div>
                {/* MTD Cost */}
                <div style={{ textAlign:"right", fontSize:14, fontWeight:700, color:text, fontVariantNumeric:"tabular-nums" }}>
                  ${r.amount >= 1 ? fmt(r.amount) : r.amount.toFixed(4)}
                </div>
                {/* Share */}
                <div style={{ textAlign:"right" }}>
                  <span style={{ fontSize:12, fontWeight:600, color:COLORS[i % COLORS.length] }}>{r.percent}%</span>
                </div>
                {/* Trend vs last month */}
                <div style={{ textAlign:"right", fontSize:12, fontWeight:600, color:trendColor }}>
                  {trendLabel}
                </div>
                {/* Rank badge */}
                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  {i < 3 && (
                    <span style={{ background:COLORS[i]+"20", color:COLORS[i], padding:"2px 7px", borderRadius:6, fontSize:10, fontWeight:700 }}>
                      #{i+1}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Footer */}
          <div style={{ background: dark ? "#0a0f1e" : "#f8fafc", border:`1px solid ${border}`, borderRadius:10, padding:"12px 18px", display:"grid", gridTemplateColumns:"2.5fr 1fr 1fr 1fr 0.8fr", gap:8, alignItems:"center", marginTop:4 }}>
            <div style={{ fontSize:12, fontWeight:700, color:text }}>TOTAL ({resources.length} services)</div>
            <div style={{ textAlign:"right", fontSize:14, fontWeight:700, color:"#00d4aa" }}>${fmt(total)}</div>
            <div style={{ textAlign:"right", fontSize:12, color:muted }}>100%</div>
            <div /><div />
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════
   ROOT COMPONENT
   ════════════════════════════════════════════ */

const TABS = ["Overview","6 Months","Per Resource","AWS Resources"]

export default function Cost() {
  const { dark } = useTheme()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#0a0f1e" : "#f1f5f9"

  const [activeTab, setActiveTab] = useState(0)
  const [overview,  setOverview]  = useState(null)
  const [daily,     setDaily]     = useState([])
  const [services,  setServices]  = useState([])
  const [forecast,  setForecast]  = useState([])
  const [vmCosts,   setVmCosts]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [spinning,  setSpinning]  = useState(false)
  const [err,       setErr]       = useState("")
  const [lastUpdate,setLastUpdate]= useState(null)

  const vmIntervalRef = useRef(null)

  /* ---- Overview data fetch ---- */
  const fetchOverview = useCallback(async (showSpinner = false) => {
    if (showSpinner) setSpinning(true)
    try {
      const [ov, da, sv, fc] = await Promise.allSettled([
        getCostOverview(), getDailyCost(), getServiceCost(), getForecast()
      ])
      if (ov.status === "fulfilled") setOverview(ov.value.data)
      if (da.status === "fulfilled") setDaily(da.value.data.map(d => ({ ...d, date: d.date.slice(5) })))
      if (sv.status === "fulfilled") setServices(sv.value.data)
      if (fc.status === "fulfilled") setForecast(fc.value.data)
      setLastUpdate(new Date())
      setErr("")
    } catch(e) {
      setErr(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
      setSpinning(false)
    }
  }, [])

  /* ---- VM data fetch ---- */
  const fetchVMs = useCallback(async (showSpinner = false) => {
    if (showSpinner) setSpinning(true)
    try {
      const res = await getVMCosts()
      setVmCosts(res.data)
      setLastUpdate(new Date())
    } catch(e) {
      // silent on VM refresh
    } finally {
      if (showSpinner) setSpinning(false)
    }
  }, [])

  /* ---- fetchAll for current tab (refresh button) ---- */
  const fetchAll = useCallback(async () => {
    if (activeTab === 0) { fetchOverview(true); fetchVMs() }
    else if (activeTab === 1) { /* 6m tab fetches itself via useEffect */ setSpinning(true); setTimeout(() => setSpinning(false), 800) }
    else if (activeTab === 2) { fetchVMs(true) }
    else if (activeTab === 3) { /* Resources tab fetches itself on mount */ setSpinning(true); setTimeout(() => setSpinning(false), 1000) }
  }, [activeTab, fetchOverview, fetchVMs])

  /* ---- Initial load ---- */
  useEffect(() => {
    fetchOverview()
    fetchVMs()
    // auto-refresh overview every 60s
    const id = setInterval(() => { fetchOverview(); if (activeTab !== 2) fetchVMs() }, 60000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- VM auto-refresh every 30s only on Tab 3 ---- */
  useEffect(() => {
    if (activeTab === 2) {
      vmIntervalRef.current = setInterval(fetchVMs, 30000)
    }
    return () => {
      if (vmIntervalRef.current) clearInterval(vmIntervalRef.current)
    }
  }, [activeTab, fetchVMs])

  /* ---- Loading screen ---- */
  if (loading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:bg }}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ textAlign:"center" }}>
        <Spinner size={40} />
        <div style={{ fontSize:13, color:muted, marginTop:14 }}>Fetching live AWS cost data...</div>
      </div>
    </div>
  )

  // Never block the page — show it with zeros and a warning banner if CE fails
  if (!overview && !loading) {
    setOverview({ mtd_total:0, forecast:0, running_vms:0, stopped_vms:0, currency:"USD", source:"realtime_only" })
  }

  const sourceBadgeLabel = overview?.source === "hybrid"
    ? "AWS Cost Explorer + Real-time"
    : overview?.source === "realtime_only"
    ? "Real-time Estimated (no billing data)"
    : "Real-time Estimated"

  return (
    <div style={{ minHeight:"100vh", background:bg, padding:28, transition:"all 0.3s ease" }}>
      <style>{GLOBAL_STYLES}</style>

      {/* ── CE error banner (non-blocking) ── */}
      {err && (
        <div style={{ background:"#f59e0b10", border:"1px solid #f59e0b40", borderRadius:10, padding:"10px 16px", marginBottom:16, fontSize:12, color:"#f59e0b", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>AWS Cost Explorer unavailable: {err} — showing real-time estimates only.</span>
          <button onClick={() => { setErr(""); fetchOverview() }} style={{ background:"none", border:"none", color:"#f59e0b", cursor:"pointer", fontWeight:600, fontSize:12 }}>Retry</button>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, animation:"fadeUp 0.4s ease both" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <LiveDot color="#00d4aa" size={7} />
            <span style={{ fontSize:11, fontWeight:700, color:"#00d4aa", textTransform:"uppercase", letterSpacing:"0.12em" }}>
              {sourceBadgeLabel}
            </span>
          </div>
          <h1 style={{ fontSize:24, fontWeight:700, color:text, margin:0, letterSpacing:"-0.5px" }}>Cost Intelligence</h1>
          <p style={{ fontSize:13, color:muted, marginTop:4 }}>
            Real-time AWS cloud spend &middot; {overview?.running_vms || 0} running &middot; {overview?.stopped_vms || 0} stopped
          </p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button
              onClick={fetchAll}
              disabled={spinning}
              style={{
                display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
                background: surface, border:`1px solid ${border}`, borderRadius:10,
                color:text, cursor:spinning?"not-allowed":"pointer", fontSize:12, fontWeight:600,
                transition:"all 0.2s ease", opacity:spinning?0.7:1
              }}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation:spinning?"spin 0.8s linear infinite":"none", color:"#00d4aa" }}
              >
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0" />
                <path d="M21 12c0-2.4-.9-4.6-2.4-6.3" strokeDasharray="6 4" />
              </svg>
              {spinning ? "Refreshing…" : "Refresh"}
            </button>
            <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:10, padding:"8px 14px", fontSize:11, color:muted }}>
              {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "Loading..."}
            </div>
          </div>
          <div style={{ fontSize:11, color:muted }}>Auto-refreshes every 60s</div>
        </div>
      </div>

      {/* ── TAB NAV ── */}
      <div style={{
        display:"inline-flex", gap:4, background: dark ? "#0f172a" : "#e2e8f0",
        border:`1px solid ${border}`, borderRadius:12, padding:4, marginBottom:24,
        animation:"fadeUp 0.4s ease 0.08s both"
      }}>
        {TABS.map((tab, i) => {
          const active = activeTab === i
          return (
            <button
              key={tab}
              className="tab-pill"
              onClick={() => setActiveTab(i)}
              style={{
                padding:"7px 20px", borderRadius:9, border:"none", cursor:"pointer",
                fontSize:13, fontWeight:active?700:500,
                color: active ? (dark?"#0f172a":"#ffffff") : muted,
                background: active ? "#00d4aa" : "transparent",
                boxShadow: active ? "0 2px 8px #00d4aa40" : "none",
                transition:"all 0.2s ease"
              }}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      {activeTab === 0 && (
        <OverviewTab
          overview={overview} daily={daily} services={services}
          forecast={forecast} vmCosts={vmCosts}
          dark={dark} surface={surface} border={border} text={text} muted={muted} subtle={subtle}
        />
      )}
      {activeTab === 1 && (
        <SixMonthTab
          dark={dark} surface={surface} border={border} text={text} muted={muted} subtle={subtle}
        />
      )}
      {activeTab === 2 && (
        <PerResourceTab
          vmCosts={vmCosts}
          dark={dark} surface={surface} border={border} text={text} muted={muted} subtle={subtle}
        />
      )}
      {activeTab === 3 && (
        <AWSResourcesTab
          dark={dark} surface={surface} border={border} text={text} muted={muted} subtle={subtle}
        />
      )}
    </div>
  )
}
