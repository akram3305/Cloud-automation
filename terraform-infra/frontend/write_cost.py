content = """import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import api from "../api/api"

const COLORS = ["#378ADD","#16a34a","#9333ea","#d97706","#dc2626","#0891b2","#64748b","#db2777"]

export default function Cost() {
  const [overview, setOverview] = useState(null)
  const [daily,    setDaily]    = useState([])
  const [services, setServices] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [ov, da, sv] = await Promise.all([
          api.get("/cost/overview"),
          api.get("/cost/daily"),
          api.get("/cost/services"),
        ])
        setOverview(ov.data)
        setDaily(da.data.map(d => ({ ...d, date: d.date.slice(5) })))
        setServices(sv.data)
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  if (loading) return (
    <div style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>Loading cost data...</div>
  )

  return (
    <div style={{ padding:"24px", maxWidth:"1200px", margin:"0 auto" }}>
      <div style={{ marginBottom:"20px" }}>
        <h1 style={{ fontSize:"20px", fontWeight:"600", color:"#1e293b" }}>Cost Dashboard</h1>
        <p style={{ fontSize:"14px", color:"#64748b", marginTop:"4px" }}>
          {overview?.source === "live" ? "Live data from AWS Cost Explorer" : "Estimated costs based on running VMs"}
        </p>
      </div>

      {/* Metric cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"24px" }}>
        {[
          { label:"Total spend (30 days)", value:`$${overview?.total_30d?.toFixed(2)||"0.00"}`, color:"#378ADD" },
          { label:"Daily average",         value:`$${((overview?.total_30d||0)/30).toFixed(2)}`, color:"#16a34a" },
          { label:"Top service",           value:services[0]?.service?.replace("Amazon ","").replace("AWS ","") || "EC2", color:"#9333ea" },
        ].map(card => (
          <div key={card.label} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"20px" }}>
            <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"8px" }}>{card.label}</div>
            <div style={{ fontSize:"24px", fontWeight:"600", color:card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:"16px" }}>

        {/* Daily spend bar chart */}
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"20px" }}>
          <div style={{ fontSize:"14px", fontWeight:"500", color:"#1e293b", marginBottom:"16px" }}>Daily spend - last 14 days</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={daily}>
              <XAxis dataKey="date" tick={{ fontSize:11, fill:"#94a3b8" }} />
              <YAxis tick={{ fontSize:11, fill:"#94a3b8" }} tickFormatter={v=>`$${v}`} />
              <Tooltip formatter={v=>[`$${v}`, "Cost"]} />
              <Bar dataKey="amount" fill="#378ADD" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Service breakdown pie */}
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"20px" }}>
          <div style={{ fontSize:"14px", fontWeight:"500", color:"#1e293b", marginBottom:"16px" }}>Cost by service</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={services} dataKey="amount" nameKey="service" cx="50%" cy="50%" outerRadius={70} label={false}>
                {services.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v=>[`$${v}`, "Cost"]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop:"12px", display:"flex", flexDirection:"column", gap:"6px" }}>
            {services.slice(0,5).map((s,i) => (
              <div key={s.service} style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"12px" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:COLORS[i%COLORS.length], flexShrink:0 }} />
                <span style={{ flex:1, color:"#64748b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.service.replace("Amazon ","").replace("AWS ","")}</span>
                <span style={{ fontWeight:"500", color:"#1e293b" }}>${s.amount}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
"""
with open("src/pages/Cost.jsx", "w", newline="\n", encoding="utf-8") as f:
    f.write(content)
print("Done")
