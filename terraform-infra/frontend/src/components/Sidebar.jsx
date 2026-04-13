import { useState, useRef } from "react"
import { NavLink, useNavigate, useLocation } from "react-router-dom"
import NotificationBell from "./NotificationBell"
import { useTheme } from "../context/ThemeContext"

const AWS_ROUTES = ["/", "/compute", "/storage", "/network", "/eks", "/kubernetes", "/iam", "/resources", "/activity", "/approvals", "/cost", "/tfstate"]

const AWS_SECTIONS = [
  {
    label: "General",
    color: "#00d4aa",
    links: [
      { to: "/",          label: "Dashboard",  icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { to: "/activity",  label: "Activity",   icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
      { to: "/resources", label: "Resources",  icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
    ],
  },
  {
    label: "Infrastructure",
    color: "#3b82f6",
    links: [
      { to: "/compute",    label: "EC2 Compute", icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" },
      { to: "/storage",    label: "S3 Storage",  icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
      { to: "/network",    label: "VPC Network", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { to: "/eks",        label: "EKS Clusters",icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
      { to: "/kubernetes", label: "Kubernetes",  icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
    ],
  },
  {
    label: "Security",
    color: "#f59e0b",
    links: [
      { to: "/iam", label: "IAM & Keys", icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" },
    ],
  },
  {
    label: "Operations",
    color: "#a78bfa",
    links: [
      { to: "/approvals", label: "Approvals", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
      { to: "/cost",      label: "Cost",       icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { to: "/tfstate",   label: "TF State",  icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
    ],
  },
]

function RippleButton({ onClick, style, children, className }) {
  const ref = useRef(null)
  function handleClick(e) {
    const btn = ref.current
    if (!btn) { onClick?.(e); return }
    const rect = btn.getBoundingClientRect()
    const ripple = document.createElement("span")
    const size = Math.max(rect.width, rect.height)
    ripple.style.cssText = `
      position:absolute;width:${size}px;height:${size}px;
      left:${e.clientX - rect.left - size/2}px;
      top:${e.clientY - rect.top - size/2}px;
      border-radius:50%;background:rgba(255,255,255,0.18);
      transform:scale(0);animation:ripple-kf 0.5s ease-out forwards;
      pointer-events:none;
    `
    btn.appendChild(ripple)
    setTimeout(() => ripple.remove(), 500)
    onClick?.(e)
  }
  return (
    <div ref={ref} onClick={handleClick} style={{ position:"relative", overflow:"hidden", ...style }} className={className}>
      {children}
    </div>
  )
}

export default function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { dark, toggle } = useTheme()
  const user = JSON.parse(localStorage.getItem("user") || "{}")

  const isAwsRoute = AWS_ROUTES.some(r => r === "/" ? location.pathname === "/" : location.pathname.startsWith(r))
  const [openCloud, setOpenCloud] = useState(isAwsRoute ? "aws" : "aws")

  // ── Color palette ──────────────────────────────────────────────
  const sidebarBg   = dark
    ? "linear-gradient(180deg,#080e1f 0%,#0b1225 40%,#080e1f 100%)"
    : "linear-gradient(180deg,#f8faff 0%,#eef2ff 100%)"
  const borderColor = dark ? "rgba(255,255,255,0.06)" : "rgba(99,102,241,0.12)"
  const textPrimary = dark ? "#e2e8f0" : "#1e293b"
  const textMuted   = dark ? "#64748b" : "#94a3b8"
  const surfaceHov  = dark ? "rgba(255,255,255,0.05)" : "rgba(99,102,241,0.06)"
  const glassCard   = dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.7)"

  return (
    <div style={{
      width: 248,
      minHeight: "100vh",
      background: sidebarBg,
      borderRight: `1px solid ${borderColor}`,
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      position: "relative",
      transition: "all 0.3s ease",
    }}>
      <style>{`
        @keyframes ripple-kf { to { transform:scale(4); opacity:0; } }
        @keyframes sb-slide-in { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes sb-glow-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        @keyframes sb-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }

        .sb-link {
          display:flex; align-items:center; gap:9px;
          padding:8px 12px; border-radius:10px; margin-bottom:2px;
          font-size:13px; text-decoration:none;
          transition:all 0.18s cubic-bezier(0.4,0,0.2,1);
          cursor:pointer; user-select:none;
          position:relative; overflow:hidden;
        }
        .sb-link:hover { transform:translateX(2px); }
        .sb-link-active {
          background: linear-gradient(90deg,rgba(0,212,170,0.18),rgba(0,212,170,0.04)) !important;
          border-left:3px solid #00d4aa !important;
          color:#00d4aa !important;
          font-weight:600 !important;
          box-shadow: inset 0 0 20px rgba(0,212,170,0.06);
        }
        .sb-link-active .sb-icon-wrap { background:rgba(0,212,170,0.2) !important; }
        .sb-link-active .sb-icon-wrap svg { stroke:#00d4aa !important; }

        .sb-cloud-btn {
          display:flex; align-items:center; gap:10px;
          padding:10px 14px; border-radius:12px; cursor:pointer;
          transition:all 0.22s cubic-bezier(0.4,0,0.2,1);
          user-select:none; position:relative; overflow:hidden;
        }
        .sb-cloud-btn:hover { transform:translateY(-1px); }

        .sb-section-label {
          font-size:9.5px; font-weight:700; letter-spacing:0.12em;
          text-transform:uppercase; padding:10px 14px 4px;
          display:flex; align-items:center; gap:6px;
        }

        .sb-bottom-btn:hover { opacity:0.85; }

        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(148,163,184,0.2); border-radius:4px; }
      `}</style>

      {/* ── Decorative ambient glow ── */}
      {dark && (
        <div style={{
          position:"absolute", top:-60, left:-40, width:200, height:200,
          background:"radial-gradient(circle,rgba(0,212,170,0.06) 0%,transparent 70%)",
          pointerEvents:"none",
        }} />
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        padding:"18px 16px 14px",
        borderBottom:`1px solid ${borderColor}`,
        position:"relative",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Logo mark */}
          <div style={{
            width:34, height:34, borderRadius:10, flexShrink:0,
            background:"linear-gradient(135deg,#00d4aa 0%,#0ea5e9 100%)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 0 16px rgba(0,212,170,0.35), 0 2px 8px rgba(0,0,0,0.3)",
            animation: "sb-float 4s ease-in-out infinite",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontWeight:800, fontSize:15, letterSpacing:"-0.3px",
              background:"linear-gradient(90deg,#00d4aa,#0ea5e9)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              backgroundClip:"text",
            }}>AIonOS</div>
            <div style={{ fontSize:10, color:textMuted, marginTop:0, letterSpacing:"0.04em" }}>Cloud Platform</div>
          </div>
          <NotificationBell />
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav style={{ flex:1, padding:"10px 8px", overflowY:"auto" }}>

        {/* ════ AWS Cloud ════ */}
        <RippleButton
          className="sb-cloud-btn"
          onClick={() => setOpenCloud(p => p === "aws" ? null : "aws")}
          style={{
            marginBottom: openCloud === "aws" ? 0 : 4,
            background: openCloud === "aws"
              ? (dark ? "linear-gradient(90deg,rgba(255,153,0,0.14),rgba(255,153,0,0.04))" : "linear-gradient(90deg,rgba(255,153,0,0.1),rgba(255,153,0,0.02))")
              : glassCard,
            border: `1px solid ${openCloud === "aws" ? "rgba(255,153,0,0.3)" : borderColor}`,
            boxShadow: openCloud === "aws" ? "0 0 20px rgba(255,153,0,0.08)" : "none",
          }}
        >
          {/* AWS logo */}
          <div style={{
            width:28, height:28, borderRadius:7, flexShrink:0,
            background:"linear-gradient(135deg,#FF9900,#FFB347)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(255,153,0,0.4)",
            fontSize:10, fontWeight:800, color:"#fff", fontFamily:"Arial,sans-serif",
          }}>aws</div>
          <span style={{ flex:1, fontSize:13, fontWeight:600, color:textPrimary }}>Amazon Web Services</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition:"transform 0.3s ease", transform:openCloud==="aws"?"rotate(90deg)":"rotate(0deg)", flexShrink:0 }}>
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </RippleButton>

        {/* AWS sections accordion */}
        <div style={{
          overflow:"hidden",
          maxHeight: openCloud === "aws" ? "800px" : "0px",
          opacity: openCloud === "aws" ? 1 : 0,
          transition:"max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
          marginBottom: openCloud === "aws" ? 6 : 0,
        }}>
          <div style={{
            margin:"4px 0 0 0",
            padding:"6px 4px 8px",
            background: dark ? "rgba(255,255,255,0.02)" : "rgba(255,153,0,0.03)",
            borderRadius:10,
            border:`1px solid ${borderColor}`,
          }}>
            {AWS_SECTIONS.map(section => (
              <div key={section.label}>
                <div className="sb-section-label" style={{ color:section.color+"99" }}>
                  <div style={{ width:3, height:10, borderRadius:2, background:`linear-gradient(180deg,${section.color},${section.color}44)`, flexShrink:0 }} />
                  {section.label}
                </div>
                {section.links.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    style={({ isActive }) => ({
                      display:"flex", alignItems:"center", gap:9,
                      padding:"7px 12px", borderRadius:9, marginBottom:1,
                      fontSize:13, fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#00d4aa" : textMuted,
                      background: isActive
                        ? "linear-gradient(90deg,rgba(0,212,170,0.16),rgba(0,212,170,0.04))"
                        : "transparent",
                      borderLeft: isActive ? "2.5px solid #00d4aa" : "2.5px solid transparent",
                      textDecoration:"none",
                      transition:"all 0.16s cubic-bezier(0.4,0,0.2,1)",
                      boxShadow: isActive ? "inset 0 0 20px rgba(0,212,170,0.04)" : "none",
                    })}
                    className={({ isActive }) => isActive ? "sb-link sb-link-active" : "sb-link"}
                    onMouseEnter={e => {
                      if (!e.currentTarget.classList.contains("sb-link-active")) {
                        e.currentTarget.style.background = surfaceHov
                        e.currentTarget.style.color = textPrimary
                      }
                    }}
                    onMouseLeave={e => {
                      if (!e.currentTarget.classList.contains("sb-link-active")) {
                        e.currentTarget.style.background = "transparent"
                        e.currentTarget.style.color = textMuted
                      }
                    }}
                  >
                    <div className="sb-icon-wrap" style={{
                      width:22, height:22, borderRadius:6, flexShrink:0,
                      background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      transition:"all 0.16s ease",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={icon} />
                      </svg>
                    </div>
                    {label}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height:1, margin:"8px 4px", background:`linear-gradient(90deg,transparent,${borderColor},transparent)` }} />

        {/* ════ Azure ════ */}
        <RippleButton
          className="sb-cloud-btn"
          onClick={() => setOpenCloud(p => p === "azure" ? null : "azure")}
          style={{
            marginBottom:4,
            background: openCloud === "azure"
              ? "rgba(0,120,212,0.1)"
              : glassCard,
            border: `1px solid ${openCloud === "azure" ? "rgba(0,120,212,0.3)" : borderColor}`,
          }}
        >
          <div style={{
            width:28, height:28, borderRadius:7, flexShrink:0,
            background:"linear-gradient(135deg,#0078D4,#50e6ff)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(0,120,212,0.3)",
          }}>
            <span style={{ fontSize:11, fontWeight:800, color:"#fff" }}>Az</span>
          </div>
          <span style={{ flex:1, fontSize:13, fontWeight:600, color:textPrimary }}>Microsoft Azure</span>
          <span style={{
            fontSize:9, fontWeight:700, color:"#0078D4",
            background:"rgba(0,120,212,0.15)", border:"1px solid rgba(0,120,212,0.3)",
            borderRadius:4, padding:"2px 6px", flexShrink:0, letterSpacing:"0.04em",
          }}>SOON</span>
        </RippleButton>

        <div style={{
          overflow:"hidden",
          maxHeight: openCloud === "azure" ? "120px" : "0px",
          opacity: openCloud === "azure" ? 1 : 0,
          transition:"max-height 0.3s ease, opacity 0.25s ease",
          marginBottom: openCloud === "azure" ? 4 : 0,
        }}>
          <div style={{ padding:"12px 14px 8px", background:glassCard, borderRadius:10, border:`1px solid ${borderColor}` }}>
            <div style={{ fontSize:12, color:textMuted }}>Azure integration is coming soon.</div>
            <div style={{ marginTop:6, display:"flex", gap:4, flexWrap:"wrap" }}>
              {["VMs","Blob Storage","AKS","Azure AD"].map(f => (
                <span key={f} style={{ fontSize:10, color:"#0078D4", background:"rgba(0,120,212,0.1)", border:"1px solid rgba(0,120,212,0.2)", borderRadius:5, padding:"2px 7px" }}>{f}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ════ GCP ════ */}
        <RippleButton
          className="sb-cloud-btn"
          onClick={() => setOpenCloud(p => p === "gcp" ? null : "gcp")}
          style={{
            background: openCloud === "gcp"
              ? "rgba(66,133,244,0.1)"
              : glassCard,
            border: `1px solid ${openCloud === "gcp" ? "rgba(66,133,244,0.3)" : borderColor}`,
          }}
        >
          <div style={{
            width:28, height:28, borderRadius:7, flexShrink:0,
            background:"linear-gradient(135deg,#4285F4,#34A853,#FBBC04,#EA4335)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(66,133,244,0.3)",
          }}>
            <span style={{ fontSize:9, fontWeight:800, color:"#fff" }}>GCP</span>
          </div>
          <span style={{ flex:1, fontSize:13, fontWeight:600, color:textPrimary }}>Google Cloud</span>
          <span style={{
            fontSize:9, fontWeight:700, color:"#4285F4",
            background:"rgba(66,133,244,0.12)", border:"1px solid rgba(66,133,244,0.3)",
            borderRadius:4, padding:"2px 6px", flexShrink:0, letterSpacing:"0.04em",
          }}>SOON</span>
        </RippleButton>

        <div style={{
          overflow:"hidden",
          maxHeight: openCloud === "gcp" ? "120px" : "0px",
          opacity: openCloud === "gcp" ? 1 : 0,
          transition:"max-height 0.3s ease, opacity 0.25s ease",
          marginTop: openCloud === "gcp" ? 4 : 0,
        }}>
          <div style={{ padding:"12px 14px 8px", background:glassCard, borderRadius:10, border:`1px solid ${borderColor}` }}>
            <div style={{ fontSize:12, color:textMuted }}>Google Cloud integration is coming soon.</div>
            <div style={{ marginTop:6, display:"flex", gap:4, flexWrap:"wrap" }}>
              {["Compute","GCS","GKE","BigQuery"].map(f => (
                <span key={f} style={{ fontSize:10, color:"#4285F4", background:"rgba(66,133,244,0.1)", border:"1px solid rgba(66,133,244,0.2)", borderRadius:5, padding:"2px 7px" }}>{f}</span>
              ))}
            </div>
          </div>
        </div>

      </nav>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div style={{ padding:"10px 8px 14px", borderTop:`1px solid ${borderColor}` }}>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="sb-bottom-btn"
          style={{
            width:"100%", display:"flex", alignItems:"center", gap:10,
            padding:"9px 14px", borderRadius:10, border:`1px solid ${borderColor}`,
            background: glassCard, cursor:"pointer", marginBottom:8,
            transition:"all 0.2s ease",
          }}
        >
          <div style={{
            width:34, height:19, borderRadius:20,
            background: dark ? "linear-gradient(90deg,#00d4aa,#0ea5e9)" : "linear-gradient(90deg,#94a3b8,#cbd5e1)",
            position:"relative", transition:"all 0.3s", flexShrink:0,
            boxShadow: dark ? "0 0 10px rgba(0,212,170,0.3)" : "none",
          }}>
            <div style={{
              position:"absolute", top:2.5, left: dark ? 17 : 2.5,
              width:14, height:14, borderRadius:"50%", background:"#fff",
              transition:"left 0.3s cubic-bezier(0.34,1.56,0.64,1)",
              boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
            }} />
          </div>
          <span style={{ fontSize:12, fontWeight:500, color:textMuted }}>
            {dark ? "Dark mode" : "Light mode"}
          </span>
          <span style={{ marginLeft:"auto", fontSize:10, color:dark?"#00d4aa60":"#94a3b8", fontFamily:"monospace" }}>
            {dark ? "●" : "○"}
          </span>
        </button>

        {/* User profile card */}
        <div style={{
          display:"flex", alignItems:"center", gap:9,
          padding:"10px 14px", borderRadius:12,
          background: dark
            ? "linear-gradient(90deg,rgba(0,212,170,0.08),rgba(14,165,233,0.05))"
            : "linear-gradient(90deg,rgba(0,212,170,0.08),rgba(14,165,233,0.04))",
          border:`1px solid ${dark ? "rgba(0,212,170,0.15)" : "rgba(0,212,170,0.2)"}`,
        }}>
          {/* Avatar */}
          <div style={{
            width:30, height:30, borderRadius:9, flexShrink:0,
            background:"linear-gradient(135deg,#00d4aa,#0ea5e9)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 0 12px rgba(0,212,170,0.3)",
            fontSize:12, fontWeight:700, color:"#fff",
          }}>
            {(user.username || "U")[0].toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:textPrimary, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {user.username || "user"}
            </div>
            <div style={{ fontSize:10, color:"#00d4aa", textTransform:"capitalize", marginTop:1 }}>
              {user.role || "viewer"} · Online
            </div>
          </div>
          <button
            onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login") }}
            title="Logout"
            style={{
              background:"rgba(244,63,94,0.1)", border:"1px solid rgba(244,63,94,0.2)",
              cursor:"pointer", padding:"5px", borderRadius:7, color:"#f43f5e",
              display:"flex", alignItems:"center", transition:"all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(244,63,94,0.2)"; e.currentTarget.style.boxShadow="0 0 8px rgba(244,63,94,0.2)" }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(244,63,94,0.1)"; e.currentTarget.style.boxShadow="none" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Version tag */}
        <div style={{ textAlign:"center", marginTop:8, fontSize:9, color:textMuted, letterSpacing:"0.06em" }}>
          AIonOS Platform v1.0 · <span style={{ color:"#00d4aa60" }}>Cloud</span>
        </div>
      </div>
    </div>
  )
}
