import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { listGCPNetworks, listGCPSubnetworks } from "../api/api"
import GCPProjectSelector from "../components/GCPProjectSelector"

export default function GCPNetwork() {
  const { dark } = useTheme()
  const navigate = useNavigate()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text     = dark ? "#f1f5f9" : "#0f172a"
  const muted    = dark ? "#64748b" : "#64748b"

  const [selProject,       setSelProject]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("gcp_selected_project") || "null") } catch { return null }
  })
  const [networks,         setNetworks]       = useState([])
  const [selectedNetwork,  setSelected]       = useState(null)
  const [subnets,          setSubnets]        = useState([])
  const [loading,          setLoading]        = useState(false)
  const [loadingSubs,      setLoadingSubs]    = useState(false)
  const [error,            setError]          = useState("")

  const loadNetworks = useCallback(() => {
    setLoading(true)
    setError("")
    setSelected(null)
    setSubnets([])
    listGCPNetworks(selProject?.id || null)
      .then(r => {
        const list = r.data?.networks || []
        setNetworks(list)
        if (list[0]) setSelected(list[0])
      })
      .catch(e => setError(e.response?.data?.detail || "Failed to load VPC networks"))
      .finally(() => setLoading(false))
  }, [selProject])

  useEffect(() => { loadNetworks() }, [loadNetworks])

  useEffect(() => {
    if (!selectedNetwork) return
    setLoadingSubs(true)
    listGCPSubnetworks({ network: selectedNetwork.name, ...(selProject?.id ? { project: selProject.id } : {}) })
      .then(r => setSubnets(r.data?.subnetworks || []))
      .catch(() => setSubnets([]))
      .finally(() => setLoadingSubs(false))
  }, [selectedNetwork, selProject])

  const thStyle = {
    padding: "9px 14px", fontSize: 11, fontWeight: 600, color: muted,
    textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left",
    borderBottom: `1px solid ${border}`,
    background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
  }
  const tdStyle = {
    padding: "11px 14px", fontSize: 13, color: text,
    borderBottom: `1px solid ${border}`,
  }

  const modeColor = (mode) => {
    if (!mode) return muted
    if (mode.toLowerCase().includes("auto")) return "#10b981"
    return "#4285f4"
  }

  const guessUseCase = (name = "") => {
    const n = name.toLowerCase()
    if (n.includes("default"))                         return "Default network"
    if (n.includes("prod"))                            return "Production workloads"
    if (n.includes("staging") || n.includes("stage")) return "Staging environment"
    if (n.includes("dev"))                             return "Development"
    if (n.includes("gke") || n.includes("k8s"))       return "GKE cluster"
    if (n.includes("db") || n.includes("data"))       return "Database tier"
    if (n.includes("mgmt") || n.includes("manage"))   return "Management"
    if (n.includes("priv") || n.includes("internal")) return "Private / internal"
    return "General purpose"
  }

  return (
    <div style={{ background: bg, minHeight: "100vh" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin   { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#4285f4,#34a853)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(66,133,244,0.35)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>GCP VPC Networks</h1>
            <p style={{ fontSize: 12, color: muted, margin: "2px 0 0" }}>
              {selProject ? `Project: ${selProject.name}` : "All accessible GCP projects"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <GCPProjectSelector
            value={selProject}
            onChange={p => { setSelProject(p); setNetworks([]); setSubnets([]) }}
            showLabel={false}
            compact={true}
          />
          <button
            onClick={() => navigate("/gcp/network/create")}
          style={{
            padding: "9px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700,
            fontSize: 13, background: "linear-gradient(135deg,#4285f4,#34a853)", color: "#fff",
            boxShadow: "0 4px 14px rgba(66,133,244,0.4)", transition: "opacity 0.15s",
            display: "flex", alignItems: "center", gap: 7,
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v16m8-8H4"/>
          </svg>
          Create VPC Network
          </button>
        </div>
      </div>

      {error && (
        <div style={{ margin: "12px 28px 0", padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ display: "grid", gridTemplateColumns: "310px 1fr", gap: 20, padding: "20px 28px" }}>

        {/* ── LEFT: Network list ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            VPC Networks {networks.length > 0 && `(${networks.length})`}
          </div>

          {loading ? (
            <div style={{ padding: "32px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(66,133,244,0.2)", borderTopColor: "#4285f4", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : networks.length === 0 ? (
            <div style={{ padding: 20, borderRadius: 12, background: surface, border: `1px solid ${border}`, color: muted, fontSize: 13, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🌐</div>
              No VPC networks found.<br />Configure GCP credentials in .env
            </div>
          ) : networks.map(net => {
            const isSelected = selectedNetwork?.name === net.name
            return (
              <div key={net.id || net.name} onClick={() => setSelected(net)}
                style={{
                  padding: "14px 16px", marginBottom: 8, borderRadius: 12, cursor: "pointer",
                  background: isSelected ? "rgba(66,133,244,0.08)" : surface,
                  border: `1.5px solid ${isSelected ? "#4285f4" : border}`,
                  transition: "all 0.15s", animation: "fadeUp 0.3s ease both",
                  boxShadow: isSelected ? "0 0 0 3px rgba(66,133,244,0.1)" : "none",
                }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? "#4285f4" : text }}>{net.name}</span>
                  {isSelected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4285f4" }} />}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                  {net.auto_create_subnetworks !== undefined && (
                    <span style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 5, fontWeight: 600,
                      background: net.auto_create_subnetworks ? "rgba(16,185,129,0.12)" : "rgba(66,133,244,0.12)",
                      color: net.auto_create_subnetworks ? "#10b981" : "#4285f4",
                      border: `1px solid ${net.auto_create_subnetworks ? "rgba(16,185,129,0.3)" : "rgba(66,133,244,0.3)"}`,
                    }}>
                      {net.auto_create_subnetworks ? "Auto Subnets" : "Custom Subnets"}
                    </span>
                  )}
                  {net.routing_config?.routing_mode && (
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, fontWeight: 600, background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                      {net.routing_config.routing_mode}
                    </span>
                  )}
                </div>

                {net.description && (
                  <div style={{ fontSize: 11, color: muted, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {net.description}
                  </div>
                )}

                {net.subnetworks?.length > 0 && (
                  <div style={{ fontSize: 10, color: muted, marginTop: 4 }}>
                    {net.subnetworks.length} subnet{net.subnetworks.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )
          })}

          {/* Create button at bottom of list */}
          <button
            onClick={() => navigate("/gcp/network/create")}
            style={{
              width: "100%", padding: "11px 0", marginTop: 4, borderRadius: 10, border: `1.5px dashed ${border}`,
              background: "transparent", color: muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#4285f4"; e.currentTarget.style.color = "#4285f4" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = muted }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v16m8-8H4"/>
            </svg>
            New VPC Network
          </button>
        </div>

        {/* ── RIGHT: Subnets ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Subnets {selectedNetwork ? `— ${selectedNetwork.name}` : ""}
          </div>

          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Subnet Name", "Region", "IP Range", "Purpose"].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingSubs ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 36, textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: muted, fontSize: 13 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", border: "3px solid rgba(66,133,244,0.2)", borderTopColor: "#4285f4", animation: "spin 0.8s linear infinite" }} />
                        Loading subnets…
                      </div>
                    </td>
                  </tr>
                ) : !selectedNetwork ? (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: muted, padding: 36 }}>
                    Select a VPC network to view its subnets
                  </td></tr>
                ) : subnets.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: muted, padding: 36 }}>
                    No subnets found in {selectedNetwork.name}
                  </td></tr>
                ) : subnets.map((s, i) => {
                  const isLast = i === subnets.length - 1
                  const regionShort = (s.region || "").split("/").pop()
                  return (
                    <tr key={s.name}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      style={{ transition: "background 0.1s" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                        {s.name}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: muted, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                        {regionShort || s.region || "—"}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "#4285f4", borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                        {s.ip_cidr_range || "—"}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, color: muted, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                        {guessUseCase(s.name)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Info panel */}
          {selectedNetwork && (
            <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(66,133,244,0.06)", border: "1px solid rgba(66,133,244,0.2)", fontSize: 12, color: muted }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                <span>
                  <span style={{ color: "#4285f4", fontWeight: 700 }}>VPC mode: </span>
                  {selectedNetwork.auto_create_subnetworks
                    ? "Auto-mode — Google automatically creates one subnet per region."
                    : "Custom-mode — subnets are manually defined. Recommended for production."
                  }
                  {" "}When launching a GCP Compute Engine instance, select one of the subnets above as the network interface.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
