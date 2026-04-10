import os

files = {}

# --- ThemeContext -----------------------------------------------
files["src/context/ThemeContext.jsx"] = """
import { createContext, useContext, useState, useEffect } from "react"
const ThemeContext = createContext()
export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light")
  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light")
    document.body.style.background = dark ? "#070c18" : "#f0f4f8"
  }, [dark])
  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(p => !p) }}>
      {children}
    </ThemeContext.Provider>
  )
}
export const useTheme = () => useContext(ThemeContext)
"""

# --- main.jsx ---------------------------------------------------
files["src/main.jsx"] = """
import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ThemeProvider } from "./context/ThemeContext"
import App from "./App"
ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </BrowserRouter>
)
"""

# --- App.jsx ----------------------------------------------------
files["src/App.jsx"] = """
import { Routes, Route, Navigate } from "react-router-dom"
import { useTheme } from "./context/ThemeContext"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Compute from "./pages/Compute"
import Approvals from "./pages/Approvals"
import Cost from "./pages/Cost"
import Sidebar from "./components/Sidebar"

function PrivateLayout({ children }) {
  const { dark } = useTheme()
  const token = localStorage.getItem("token")
  if (!token) return <Navigate to="/login" replace />
  return (
    <div style={{ display:"flex", minHeight:"100vh", background: dark ? "#070c18" : "#f0f4f8", transition:"background 0.3s ease" }}>
      <Sidebar />
      <main style={{ flex:1, minWidth:0, overflowY:"auto", minHeight:"100vh" }}>
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/"          element={<PrivateLayout><Dashboard /></PrivateLayout>} />
      <Route path="/compute"   element={<PrivateLayout><Compute /></PrivateLayout>} />
      <Route path="/approvals" element={<PrivateLayout><Approvals /></PrivateLayout>} />
      <Route path="/cost"      element={<PrivateLayout><Cost /></PrivateLayout>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  )
}
"""

# --- Sidebar ----------------------------------------------------
files["src/components/Sidebar.jsx"] = """
import { NavLink, useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"

const links = [
  { to:"/",          label:"Dashboard",  icon:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { to:"/compute",   label:"Compute",    icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" },
  { to:"/approvals", label:"Approvals",  icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { to:"/cost",      label:"Cost",       icon:"M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const user = JSON.parse(localStorage.getItem("user") || "{}")

  const bg      = dark ? "#0a0f1e"  : "#ffffff"
  const border  = dark ? "#1e293b"  : "#e2e8f0"
  const text    = dark ? "#94a3b8"  : "#64748b"
  const textAct = dark ? "#f1f5f9"  : "#0f172a"
  const bgAct   = dark ? "#00d4aa15": "#f0fdf4"

  return (
    <div style={{ width:"220px", minHeight:"100vh", background:bg, borderRight:`1px solid ${border}`, display:"flex", flexDirection:"column", flexShrink:0, transition:"all 0.3s ease" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');* { font-family:'DM Sans',system-ui,sans-serif }`}</style>

      {/* Logo */}
      <div style={{ padding:"24px 20px 20px", borderBottom:`1px solid ${border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"32px", height:"32px", borderRadius:"8px", background:"linear-gradient(135deg,#00d4aa,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:"14px", fontWeight:"700", color:"#fff" }}>A</span>
          </div>
          <div>
            <div style={{ fontWeight:"700", fontSize:"14px", color:textAct, letterSpacing:"-0.3px" }}>AIonOS</div>
            <div style={{ fontSize:"10px", color:text, marginTop:"1px" }}>Infrastructure</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"12px 10px" }}>
        <div style={{ fontSize:"10px", fontWeight:"600", color:text, textTransform:"uppercase", letterSpacing:"0.1em", padding:"8px 10px 4px" }}>Navigation</div>
        {links.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to==="/"} style={({ isActive }) => ({
            display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", borderRadius:"10px",
            marginBottom:"2px", fontSize:"13px", fontWeight: isActive ? "600" : "400",
            color: isActive ? "#00d4aa" : text,
            background: isActive ? bgAct : "transparent",
            textDecoration:"none", transition:"all 0.15s ease",
          })}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={icon}/>
            </svg>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding:"12px 10px 16px", borderTop:`1px solid ${border}` }}>
        {/* Theme toggle */}
        <button onClick={toggle} style={{ width:"100%", display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", borderRadius:"10px", border:"none", background: dark ? "#1e293b" : "#f1f5f9", cursor:"pointer", marginBottom:"8px", transition:"all 0.2s ease" }}>
          <div style={{ width:"32px", height:"18px", borderRadius:"20px", background: dark ? "#00d4aa" : "#cbd5e1", position:"relative", transition:"background 0.3s ease", flexShrink:0 }}>
            <div style={{ position:"absolute", top:"2px", left: dark ? "16px" : "2px", width:"14px", height:"14px", borderRadius:"50%", background:"#fff", transition:"left 0.3s ease", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }} />
          </div>
          <span style={{ fontSize:"12px", fontWeight:"500", color:text }}>{dark ? "Dark mode" : "Light mode"}</span>
        </button>

        {/* User */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px", borderRadius:"10px", background: dark ? "#0f172a" : "#f8fafc" }}>
          <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:"linear-gradient(135deg,#00d4aa,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ fontSize:"11px", fontWeight:"700", color:"#fff" }}>{(user.username||"U")[0].toUpperCase()}</span>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:"12px", fontWeight:"600", color:textAct, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.username||"user"}</div>
            <div style={{ fontSize:"10px", color:text, textTransform:"capitalize" }}>{user.role||"viewer"}</div>
          </div>
          <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login") }}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"4px", color:text, fontSize:"16px", lineHeight:1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
"""

# --- Dashboard --------------------------------------------------
files["src/pages/Dashboard.jsx"] = """
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
"""

# --- Compute ----------------------------------------------------
files["src/pages/Compute.jsx"] = """
import { useEffect, useState, useCallback } from "react"
import { listVMs, startVM, stopVM, deleteVM } from "../api/api"
import CreateVMModal from "../components/CreateVMModal"
import { useTheme } from "../context/ThemeContext"

const STATE = {
  running:  { bg:"#dcfce7", color:"#15803d", dot:"#16a34a", darkBg:"#14532d20", darkColor:"#4ade80" },
  stopped:  { bg:"#fef9c3", color:"#854d0e", dot:"#ca8a04", darkBg:"#78350f20", darkColor:"#fcd34d" },
  stopping: { bg:"#fed7aa", color:"#7c2d12", dot:"#ea580c", darkBg:"#7c2d1220", darkColor:"#fb923c" },
  pending:  { bg:"#dbeafe", color:"#1e40af", dot:"#2563eb", darkBg:"#1e3a8a20", darkColor:"#60a5fa" },
}

function Badge({ state, dark }) {
  const s = STATE[state] || STATE.pending
  return (
    <span style={{ background: dark?s.darkBg:s.bg, color: dark?s.darkColor:s.color, padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600", display:"inline-flex", alignItems:"center", gap:"5px" }}>
      <span style={{ width:"5px", height:"5px", borderRadius:"50%", background:s.dot }} />
      {state}
    </span>
  )
}

export default function Compute() {
  const { dark } = useTheme()
  const [vms,       setVms]       = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [success,   setSuccess]   = useState("")
  const [actionId,  setActionId]  = useState(null)

  const surface = dark ? "#0f172a"  : "#ffffff"
  const bg      = dark ? "#070c18"  : "#f0f4f8"
  const border  = dark ? "#1e293b"  : "#e2e8f0"
  const text    = dark ? "#f1f5f9"  : "#0f172a"
  const muted   = dark ? "#475569"  : "#64748b"
  const subtle  = dark ? "#1e293b"  : "#f8fafc"
  const th      = dark ? "#334155"  : "#64748b"

  const fetchVMs = useCallback(async () => {
    try { const { data } = await listVMs(); setVms(data) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchVMs(); const id = setInterval(fetchVMs, 10000); return () => clearInterval(id) }, [fetchVMs])

  async function handleAction(fn, id) {
    setActionId(id)
    try { await fn(id); fetchVMs() } catch(e) { alert(e.response?.data?.detail || e.message) }
    finally { setActionId(null) }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Terminate "${name}"? This is irreversible and will also destroy the EC2 instance.`)) return
    handleAction(deleteVM, id)
  }

  const running = vms.filter(v=>v.state==="running").length
  const stopped = vms.filter(v=>v.state==="stopped").length

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"all 0.3s ease" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", animation:"fadeUp 0.4s ease both" }}>
        <div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>Compute</h1>
          <div style={{ display:"flex", gap:"16px", marginTop:"6px" }}>
            <span style={{ fontSize:"13px", color:"#00d4aa" }}>{running} running</span>
            <span style={{ fontSize:"13px", color:muted }}>{stopped} stopped</span>
            <span style={{ fontSize:"13px", color:muted }}>{vms.length} total</span>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display:"flex", alignItems:"center", gap:"8px", background:"#00d4aa", color:"#0a0f1e", border:"none", padding:"10px 18px", borderRadius:"10px", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create VM
        </button>
      </div>

      {success && (
        <div style={{ background:"#00d4aa15", border:"1px solid #00d4aa30", color:"#00d4aa", padding:"12px 16px", borderRadius:"10px", marginBottom:"16px", fontSize:"13px", animation:"fadeUp 0.3s ease both" }}>
          {success}
        </div>
      )}

      {/* Table */}
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", overflow:"hidden", animation:"fadeUp 0.4s ease 0.1s both", transition:"all 0.3s ease" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"13px", fontWeight:"600", color:text }}>Virtual Machines</span>
          <button onClick={fetchVMs} style={{ background:"none", border:`1px solid ${border}`, borderRadius:"8px", padding:"6px 12px", fontSize:"12px", color:muted, cursor:"pointer" }}>Refresh</button>
        </div>

        {loading ? (
          <div style={{ padding:"48px", textAlign:"center", color:muted }}>Loading VMs...</div>
        ) : vms.length === 0 ? (
          <div style={{ padding:"64px", textAlign:"center" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>???</div>
            <div style={{ fontSize:"15px", fontWeight:"500", color:text, marginBottom:"6px" }}>No VMs yet</div>
            <div style={{ fontSize:"13px", color:muted }}>Create your first VM using the button above</div>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${border}`, background:subtle }}>
                {["Name","Instance ID","Type","Region","State","Actions"].map(h => (
                  <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:"11px", fontWeight:"600", color:th, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vms.map((vm,i) => (
                <tr key={vm.id} style={{ borderBottom:`1px solid ${border}`, transition:"background 0.15s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ fontWeight:"600", fontSize:"13px", color:text }}>{vm.name}</div>
                  </td>
                  <td style={{ padding:"14px 16px" }}>
                    <span style={{ fontFamily:"monospace", fontSize:"11px", color:muted, background:subtle, padding:"2px 8px", borderRadius:"6px" }}>{vm.instance_id||"-"}</span>
                  </td>
                  <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{vm.instance_type}</td>
                  <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{vm.region}</td>
                  <td style={{ padding:"14px 16px" }}><Badge state={vm.state} dark={dark} /></td>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", gap:"6px" }}>
                      {vm.state==="stopped" && (
                        <button onClick={()=>handleAction(startVM,vm.id)} disabled={actionId===vm.id}
                          style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #00d4aa40", background:"#00d4aa15", color:"#00d4aa" }}>
                          {actionId===vm.id?"...":"Start"}
                        </button>
                      )}
                      {vm.state==="running" && (
                        <button onClick={()=>handleAction(stopVM,vm.id)} disabled={actionId===vm.id}
                          style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #f59e0b40", background:"#f59e0b15", color:"#f59e0b" }}>
                          {actionId===vm.id?"...":"Stop"}
                        </button>
                      )}
                      <button onClick={()=>handleDelete(vm.id,vm.name)} disabled={actionId===vm.id}
                        style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>
                        {actionId===vm.id?"...":"Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <CreateVMModal onClose={()=>setShowModal(false)} onSuccess={()=>{ setShowModal(false); setSuccess("Request submitted - awaiting admin approval"); fetchVMs(); setTimeout(()=>setSuccess(""),4000) }} />}
    </div>
  )
}
"""

# --- Approvals --------------------------------------------------
files["src/pages/Approvals.jsx"] = """
import { useEffect, useState, useCallback } from "react"
import { listRequests, approveRequest, rejectRequest } from "../api/api"
import { useTheme } from "../context/ThemeContext"

const STATUS = {
  pending:      { color:"#f59e0b", bg:"#f59e0b15", label:"Pending" },
  approved:     { color:"#3b82f6", bg:"#3b82f615", label:"Approved" },
  provisioning: { color:"#a78bfa", bg:"#a78bfa15", label:"Provisioning" },
  completed:    { color:"#00d4aa", bg:"#00d4aa15", label:"Completed" },
  failed:       { color:"#f43f5e", bg:"#f43f5e15", label:"Failed" },
  rejected:     { color:"#94a3b8", bg:"#94a3b815", label:"Rejected" },
}

export default function Approvals() {
  const { dark } = useTheme()
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [actionId, setActionId] = useState(null)
  const [filter,   setFilter]   = useState("all")

  const surface = dark ? "#0f172a" : "#ffffff"
  const bg      = dark ? "#070c18" : "#f0f4f8"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"
  const th      = dark ? "#334155" : "#64748b"

  const fetchRequests = useCallback(async () => {
    try { const { data } = await listRequests(); setRequests(data) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRequests(); const id = setInterval(fetchRequests, 5000); return () => clearInterval(id) }, [fetchRequests])

  async function handleApprove(id) {
    setActionId(id)
    try { await approveRequest(id); fetchRequests() }
    catch(e) { alert(e.response?.data?.detail || e.message) }
    finally { setActionId(null) }
  }

  async function handleReject(id) {
    const reason = prompt("Rejection reason (optional):")
    if (reason === null) return
    setActionId(id)
    try { await rejectRequest(id, reason); fetchRequests() }
    catch(e) { alert(e.response?.data?.detail || e.message) }
    finally { setActionId(null) }
  }

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter)
  const pending  = requests.filter(r => r.status === "pending").length

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"all 0.3s ease" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom:"24px", animation:"fadeUp 0.4s ease both" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>Approvals</h1>
            <p style={{ fontSize:"14px", color:muted, marginTop:"4px" }}>
              {pending > 0 ? <span style={{ color:"#f59e0b" }}>{pending} request{pending>1?"s":""} awaiting approval</span> : "No pending requests"}
            </p>
          </div>
          {pending > 0 && (
            <div style={{ background:"#f59e0b15", border:"1px solid #f59e0b30", borderRadius:"10px", padding:"8px 16px", fontSize:"13px", color:"#f59e0b", fontWeight:"600" }}>
              {pending} pending
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"20px", animation:"fadeUp 0.4s ease 0.1s both" }}>
        {["all","pending","approved","completed","failed","rejected"].map(f => (
          <button key={f} onClick={()=>setFilter(f)}
            style={{ padding:"6px 14px", borderRadius:"8px", fontSize:"12px", fontWeight:"500", cursor:"pointer", border:`1px solid ${filter===f?"#00d4aa40":border}`, background:filter===f?"#00d4aa15":surface, color:filter===f?"#00d4aa":muted, textTransform:"capitalize", transition:"all 0.15s" }}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", overflow:"hidden", animation:"fadeUp 0.4s ease 0.2s both", transition:"all 0.3s ease" }}>
        {loading ? (
          <div style={{ padding:"48px", textAlign:"center", color:muted }}>Loading requests...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:"64px", textAlign:"center" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>?</div>
            <div style={{ fontSize:"15px", fontWeight:"500", color:text, marginBottom:"6px" }}>No requests found</div>
            <div style={{ fontSize:"13px", color:muted }}>Try changing the filter above</div>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${border}`, background:subtle }}>
                {["#","Requester","Resource","Status","Submitted","Actions"].map(h => (
                  <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:"11px", fontWeight:"600", color:th, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((req,i) => {
                const s = STATUS[req.status] || STATUS.pending
                return (
                  <tr key={req.id} style={{ borderBottom:`1px solid ${border}`, transition:"background 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"14px 16px", fontFamily:"monospace", fontSize:"11px", color:muted }}>#{req.id}</td>
                    <td style={{ padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:"linear-gradient(135deg,#00d4aa,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <span style={{ fontSize:"11px", fontWeight:"700", color:"#fff" }}>{(req.username||"U")[0].toUpperCase()}</span>
                        </div>
                        <span style={{ fontSize:"13px", fontWeight:"500", color:text }}>{req.username}</span>
                      </div>
                    </td>
                    <td style={{ padding:"14px 16px" }}>
                      <span style={{ fontSize:"13px", fontWeight:"500", color:text }}>{req.resource_name}</span>
                      <span style={{ fontSize:"11px", color:muted, marginLeft:"6px" }}>{req.resource_type}</span>
                    </td>
                    <td style={{ padding:"14px 16px" }}>
                      <span style={{ background:s.bg, color:s.color, padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600" }}>{s.label}</span>
                    </td>
                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>
                      {new Date(req.created_at).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                    </td>
                    <td style={{ padding:"14px 16px" }}>
                      {req.status === "pending" ? (
                        <div style={{ display:"flex", gap:"6px" }}>
                          <button onClick={()=>handleApprove(req.id)} disabled={actionId===req.id}
                            style={{ padding:"5px 14px", borderRadius:"6px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:"1px solid #00d4aa40", background:"#00d4aa15", color:"#00d4aa" }}>
                            {actionId===req.id?"...":"Approve"}
                          </button>
                          <button onClick={()=>handleReject(req.id)} disabled={actionId===req.id}
                            style={{ padding:"5px 14px", borderRadius:"6px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize:"12px", color:muted }}>-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
"""

# --- Cost (already good, just add theme) ------------------------
files["src/pages/Cost.jsx"] = """
import { useEffect, useState } from "react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { getCostOverview, getDailyCost, getServiceCost } from "../api/api"
import { useTheme } from "../context/ThemeContext"

const COLORS = ["#00d4aa","#3b82f6","#a78bfa","#f59e0b","#f43f5e","#06b6d4","#84cc16"]

function useCountUp(target, duration=1400) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now()-start)/duration,1)
      setVal((1-Math.pow(1-p,3))*target)
      if (p<1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target])
  return val
}

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
        const [ov,da,sv] = await Promise.all([getCostOverview(),getDailyCost(),getServiceCost()])
        setOverview(ov.data)
        setDaily(da.data.map(d => ({ ...d, date:d.date.slice(5) })))
        setServices(sv.data)
      } catch(e) { setErr(e.response?.data?.detail||e.message) }
      finally { setLoading(false) }
    }
    fetchAll()
    const id = setInterval(fetchAll,60000)
    return () => clearInterval(id)
  }, [])

  const totalMonthly = overview?.total_30d || 0
  const dailyAvg     = totalMonthly / 30
  const topService   = services[0]?.service?.replace("Amazon ","").replace("AWS ","") || "EC2"
  const trend        = daily.length>=2 ? daily[daily.length-1]?.amount - daily[daily.length-2]?.amount : 0

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"10px", padding:"10px 14px" }}>
        <div style={{ fontSize:"11px", color:muted, marginBottom:"3px" }}>{label}</div>
        <div style={{ fontSize:"15px", fontWeight:"600", color:"#00d4aa" }}>${payload[0]?.value?.toFixed(2)}</div>
      </div>
    )
  }

  if (loading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:bg }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:"40px", height:"40px", border:`2px solid #00d4aa20`, borderTop:"2px solid #00d4aa", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 12px" }} />
        <div style={{ fontSize:"13px", color:muted }}>Loading cost intelligence...</div>
      </div>
    </div>
  )

  if (err) return <div style={{ padding:"48px", textAlign:"center", color:"#f43f5e" }}>Error: {err}</div>

  return (
    <div style={{ minHeight:"100vh", background:bg, padding:"28px", transition:"all 0.3s ease" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px", animation:"fadeUp 0.4s ease both" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
            <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#00d4aa", boxShadow:"0 0 8px #00d4aa" }} />
            <span style={{ fontSize:"11px", fontWeight:"600", color:"#00d4aa", textTransform:"uppercase", letterSpacing:"0.12em" }}>
              {overview?.source==="live" ? "Live - AWS Cost Explorer" : "Estimated"}
            </span>
          </div>
          <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0, letterSpacing:"-0.5px" }}>Cost Intelligence</h1>
          <p style={{ fontSize:"13px", color:muted, marginTop:"4px" }}>Real-time cloud spend analysis</p>
        </div>
        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"10px", padding:"8px 14px", fontSize:"11px", color:muted, fontFamily:"monospace" }}>
          {new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
        {[
          { label:"30-Day Spend",   val:totalMonthly, prefix:"$", color:"#00d4aa", icon:"??", sub:"Total cloud cost" },
          { label:"Daily Average",  val:dailyAvg,     prefix:"$", color:"#3b82f6", icon:"??", sub:"Per day avg" },
          { label:"Top Service",    val:null,          display:topService, color:"#a78bfa", icon:"?", sub:`$${services[0]?.amount||0}/mo` },
          { label:"Daily Trend",    val:Math.abs(trend), prefix:trend>=0?"+$":"-$", color:trend>=0?"#f43f5e":"#84cc16", icon:trend>=0?"??":"??", sub:"vs yesterday" },
        ].map(({ label, val, prefix="$", display, color, icon, sub }, i) => {
          const num = useCountUp(val||0)
          return (
            <div key={label} style={{ background:surface, border:`1px solid ${border}`, borderLeft:`3px solid ${color}`, borderRadius:"14px", padding:"20px", position:"relative", overflow:"hidden", animation:`fadeUp 0.5s ease ${i*80}ms both`, transition:"all 0.3s ease" }}>
              <div style={{ position:"absolute", top:"-30px", right:"-30px", width:"90px", height:"90px", borderRadius:"50%", background:`${color}08` }} />
              <div style={{ fontSize:"24px", marginBottom:"10px" }}>{icon}</div>
              <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"5px" }}>{label}</div>
              <div style={{ fontSize:"26px", fontWeight:"700", color:text, letterSpacing:"-0.5px" }}>
                {display || (prefix + num.toFixed(2))}
              </div>
              <div style={{ fontSize:"11px", color:muted, marginTop:"3px" }}>{sub}</div>
            </div>
          )
        })}
      </div>

      {/* Charts Row */}
      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:"20px", marginBottom:"20px" }}>
        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.3s both", transition:"all 0.3s ease" }}>
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
                  <stop offset="5%"  stopColor="#00d4aa" stopOpacity={dark?0.25:0.12} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v=>`$${v}`} tick={{ fontSize:10, fill:muted }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="amount" stroke="#00d4aa" strokeWidth={2} fill="url(#cGrad)" dot={false} activeDot={{ r:4, fill:"#00d4aa", strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.4s both", transition:"all 0.3s ease" }}>
          <div style={{ fontSize:"14px", fontWeight:"600", color:text, marginBottom:"4px" }}>Service breakdown</div>
          <div style={{ fontSize:"12px", color:muted, marginBottom:"14px" }}>Cost distribution</div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={services} dataKey="amount" nameKey="service" cx="50%" cy="50%" outerRadius={65} innerRadius={38} paddingAngle={3} label={false}>
                {services.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v=>[`$${v}`,"Cost"]} contentStyle={{ background:surface, border:`1px solid ${border}`, borderRadius:"8px", fontSize:"12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
            {services.slice(0,5).map((s,i) => (
              <div key={s.service} style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:COLORS[i%COLORS.length], flexShrink:0 }} />
                <span style={{ flex:1, fontSize:"11px", color:muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.service.replace("Amazon ","").replace("AWS ","")}</span>
                <span style={{ fontSize:"11px", fontWeight:"600", color:text }}>${s.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Service Bars */}
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"14px", padding:"22px", animation:"fadeUp 0.5s ease 0.5s both", transition:"all 0.3s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
          <div>
            <div style={{ fontSize:"14px", fontWeight:"600", color:text }}>Cost by service</div>
            <div style={{ fontSize:"12px", color:muted, marginTop:"2px" }}>Ranked by spend</div>
          </div>
          <span style={{ fontSize:"12px", color:muted }}>Total: <span style={{ color:"#00d4aa", fontWeight:"600" }}>${services.reduce((a,b)=>a+b.amount,0).toFixed(2)}</span></span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {services.map((s,i) => {
            const max = services[0]?.amount||1
            const pct = (s.amount/max)*100
            return (
              <div key={s.service} style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={{ width:"130px", fontSize:"11px", color:muted, textAlign:"right", flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {s.service.replace("Amazon ","").replace("AWS ","")}
                </div>
                <div style={{ flex:1, height:"26px", background: dark?"#0a0f1e":"#f1f5f9", borderRadius:"6px", overflow:"hidden", position:"relative" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:`linear-gradient(90deg,${COLORS[i%COLORS.length]}80,${COLORS[i%COLORS.length]})`, borderRadius:"6px", transition:"width 1.2s ease", display:"flex", alignItems:"center", paddingLeft:"8px" }}>
                    {pct>15 && <span style={{ fontSize:"10px", fontWeight:"600", color:"#fff" }}>${s.amount}</span>}
                  </div>
                  {pct<=15 && <span style={{ position:"absolute", left:`${pct}%`, top:"50%", transform:"translateY(-50%)", marginLeft:"8px", fontSize:"10px", fontWeight:"600", color:muted }}>${s.amount}</span>}
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

os.makedirs("src/context", exist_ok=True)
for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True) if os.path.dirname(path) else None
    with open(path, "w", newline="\n", encoding="utf-8") as f:
        f.write(content.lstrip())
    print(f"Written: {path}")

print("All files done!")
