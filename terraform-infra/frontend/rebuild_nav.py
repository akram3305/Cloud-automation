# Rewrite App.jsx cleanly
app = """import { Routes, Route, Navigate } from "react-router-dom"
import { useTheme } from "./context/ThemeContext"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Compute from "./pages/Compute"
import Approvals from "./pages/Approvals"
import Cost from "./pages/Cost"
import Resources from "./pages/Resources"
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
      <Route path="/login"     element={<Login />} />
      <Route path="/"          element={<PrivateLayout><Dashboard /></PrivateLayout>} />
      <Route path="/compute"   element={<PrivateLayout><Compute /></PrivateLayout>} />
      <Route path="/approvals" element={<PrivateLayout><Approvals /></PrivateLayout>} />
      <Route path="/cost"      element={<PrivateLayout><Cost /></PrivateLayout>} />
      <Route path="/resources" element={<PrivateLayout><Resources /></PrivateLayout>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  )
}
"""

with open("src/App.jsx", "w", newline="\n", encoding="utf-8") as f:
    f.write(app)
print("App.jsx done")

# Rewrite Sidebar with correct links
sidebar = """import { NavLink, useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"

const links = [
  { to:"/",          label:"Dashboard", icon:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { to:"/resources", label:"Resources", icon:"M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { to:"/compute",   label:"Compute",   icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" },
  { to:"/approvals", label:"Approvals", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { to:"/cost",      label:"Cost",      icon:"M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const user = JSON.parse(localStorage.getItem("user") || "{}")

  const bg     = dark ? "#0a0f1e" : "#ffffff"
  const border = dark ? "#1e293b" : "#e2e8f0"
  const text   = dark ? "#94a3b8" : "#64748b"
  const textAct= dark ? "#f1f5f9" : "#0f172a"
  const bgAct  = dark ? "#00d4aa15": "#f0fdf4"

  return (
    <div style={{ width:"220px", minHeight:"100vh", background:bg, borderRight:"1px solid "+border, display:"flex", flexDirection:"column", flexShrink:0, transition:"all 0.3s ease" }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');*{font-family:'DM Sans',system-ui,sans-serif}"}</style>
      <div style={{ padding:"24px 20px 20px", borderBottom:"1px solid "+border }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"32px", height:"32px", borderRadius:"8px", background:"linear-gradient(135deg,#00d4aa,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:"14px", fontWeight:"700", color:"#fff" }}>A</span>
          </div>
          <div>
            <div style={{ fontWeight:"700", fontSize:"14px", color:textAct }}>AIonOS</div>
            <div style={{ fontSize:"10px", color:text, marginTop:"1px" }}>Infrastructure</div>
          </div>
        </div>
      </div>
      <nav style={{ flex:1, padding:"12px 10px" }}>
        <div style={{ fontSize:"10px", fontWeight:"600", color:text, textTransform:"uppercase", letterSpacing:"0.1em", padding:"8px 10px 4px" }}>Navigation</div>
        {links.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to==="/"} style={({ isActive }) => ({
            display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", borderRadius:"10px",
            marginBottom:"2px", fontSize:"13px", fontWeight: isActive?"600":"400",
            color: isActive?"#00d4aa":text, background: isActive?bgAct:"transparent",
            textDecoration:"none", transition:"all 0.15s ease",
          })}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={icon}/>
            </svg>
            {label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding:"12px 10px 16px", borderTop:"1px solid "+border }}>
        <button onClick={toggle} style={{ width:"100%", display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", borderRadius:"10px", border:"none", background: dark?"#1e293b":"#f1f5f9", cursor:"pointer", marginBottom:"8px", transition:"all 0.2s ease" }}>
          <div style={{ width:"32px", height:"18px", borderRadius:"20px", background: dark?"#00d4aa":"#cbd5e1", position:"relative", transition:"background 0.3s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:"2px", left: dark?"16px":"2px", width:"14px", height:"14px", borderRadius:"50%", background:"#fff", transition:"left 0.3s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }} />
          </div>
          <span style={{ fontSize:"12px", fontWeight:"500", color:text }}>{dark?"Dark mode":"Light mode"}</span>
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px", borderRadius:"10px", background: dark?"#0f172a":"#f8fafc" }}>
          <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:"linear-gradient(135deg,#00d4aa,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ fontSize:"11px", fontWeight:"700", color:"#fff" }}>{(user.username||"U")[0].toUpperCase()}</span>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:"12px", fontWeight:"600", color:textAct, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.username||"user"}</div>
            <div style={{ fontSize:"10px", color:text, textTransform:"capitalize" }}>{user.role||"viewer"}</div>
          </div>
          <button onClick={()=>{ localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login") }}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"4px", color:text, fontSize:"16px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
"""

with open("src/components/Sidebar.jsx", "w", newline="\n", encoding="utf-8") as f:
    f.write(sidebar)
print("Sidebar.jsx done")
