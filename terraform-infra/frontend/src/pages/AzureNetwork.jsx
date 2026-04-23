import { useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import { listAzureVNets, listAzureSubnets } from "../api/api"

// In Azure Hub-and-Spoke, VNets always live in the Connectivity subscription (hub).
// The "spoke subscription" context tells users which workload environment they're planning for.
const SPOKE_SUBS = [
  { id: "nonprod",      label: "Non-Production", color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)"  },
  { id: "prod",         label: "Production",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)"  },
  { id: "connectivity", label: "Connectivity",   color: "#0078D4", bg: "rgba(0,120,212,0.1)",   border: "rgba(0,120,212,0.3)"   },
]

export default function AzureNetwork() {
  const { dark } = useTheme()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text     = dark ? "#f1f5f9" : "#0f172a"
  const muted    = dark ? "#64748b" : "#64748b"
  const panel    = dark ? "rgba(255,255,255,0.03)" : "#f8fafc"

  const [spokeSub,     setSpokeSub]    = useState("nonprod")
  const [vnets,        setVnets]       = useState([])
  const [selectedVnet, setSelected]   = useState(null)
  const [subnets,      setSubnets]    = useState([])
  const [loading,      setLoading]    = useState(false)
  const [loadingSubs,  setLoadingSubs] = useState(false)
  const [error,        setError]      = useState("")

  useEffect(() => {
    setLoading(true)
    setError("")
    // VNets are always in the Connectivity (hub) subscription regardless of spoke
    listAzureVNets("connectivity")
      .then(r => {
        const list = r.data || []
        setVnets(list)
        if (list[0]) setSelected(list[0])
      })
      .catch(e => setError(e.response?.data?.detail || "Failed to load VNets"))
      .finally(() => setLoading(false))
  }, []) // No dependency on spokeSub — VNets are always from connectivity

  useEffect(() => {
    if (!selectedVnet) return
    setLoadingSubs(true)
    listAzureSubnets(selectedVnet.resource_group, selectedVnet.name, "connectivity")
      .then(r => setSubnets(r.data || []))
      .catch(() => setSubnets([]))
      .finally(() => setLoadingSubs(false))
  }, [selectedVnet])

  const activeSub = SPOKE_SUBS.find(s => s.id === spokeSub)

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

  return (
    <div style={{ background: bg, minHeight: "100vh" }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }`}</style>

      {/* ── Top bar ── */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#0078D4,#7fba00)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,120,212,0.35)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>Azure Virtual Networks</h1>
            <p style={{ fontSize: 12, color: muted, margin: "2px 0 0" }}>
              Hub VNets from <span style={{ color: "#0078D4", fontWeight: 600 }}>Connectivity</span> subscription — shared across all spokes
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Spoke subscription context selector */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 10, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Spoke Subscription Context</span>
            <div style={{ display: "flex", background: panel, border: `1px solid ${border}`, borderRadius: 8, padding: 3, gap: 3 }}>
              {SPOKE_SUBS.map(s => (
                <button key={s.id} onClick={() => setSpokeSub(s.id)} style={{
                  padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                  background: spokeSub === s.id ? s.color : "transparent",
                  color: spokeSub === s.id ? "#fff" : muted,
                  transition: "all 0.15s",
                }}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Context info banner ── */}
      <div style={{ margin: "16px 28px 0", padding: "10px 16px", borderRadius: 10, background: `${activeSub.color}0d`, border: `1px solid ${activeSub.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeSub.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <span style={{ fontSize: 12, color: text }}>
          Working context: <strong style={{ color: activeSub.color }}>{activeSub.label}</strong> spoke subscription.
          VNets and subnets are always hosted in the <strong style={{ color: "#0078D4" }}>Connectivity</strong> hub subscription and shared by all spokes.
          VMs in <strong style={{ color: activeSub.color }}>{activeSub.label}</strong> attach NICs to subnets from this hub.
        </span>
      </div>

      {error && (
        <div style={{ margin: "12px 28px 0", padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, padding: "20px 28px" }}>

        {/* ── LEFT: VNet list ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Virtual Networks {vnets.length > 0 && `(${vnets.length})`}
          </div>

          {loading ? (
            <div style={{ padding: "32px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(0,120,212,0.2)", borderTopColor: "#0078D4", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : vnets.length === 0 ? (
            <div style={{ padding: 20, borderRadius: 12, background: surface, border: `1px solid ${border}`, color: muted, fontSize: 13, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🌐</div>
              No VNets found. Configure Connectivity subscription credentials in .env
            </div>
          ) : vnets.map(v => (
            <div key={v.id || v.name} onClick={() => setSelected(v)}
              style={{
                padding: "14px 16px", marginBottom: 8, borderRadius: 12, cursor: "pointer",
                background: selectedVnet?.name === v.name ? "rgba(0,120,212,0.1)" : surface,
                border: `1.5px solid ${selectedVnet?.name === v.name ? "#0078D4" : border}`,
                transition: "all 0.15s", animation: "fadeUp 0.3s ease both",
                boxShadow: selectedVnet?.name === v.name ? "0 0 0 3px rgba(0,120,212,0.1)" : "none",
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: selectedVnet?.name === v.name ? "#0078D4" : text }}>{v.name}</span>
                {selectedVnet?.name === v.name && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#0078D4" }} />}
              </div>
              <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>{v.location}</div>
              {v.address_space?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {v.address_space.map(cidr => (
                    <span key={cidr} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, fontFamily: "monospace", background: "rgba(0,120,212,0.1)", color: "#0078D4", border: "1px solid rgba(0,120,212,0.2)" }}>
                      {cidr}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 10, color: muted, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                RG: {v.resource_group || "—"}
              </div>
            </div>
          ))}
        </div>

        {/* ── RIGHT: Subnets ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Subnets {selectedVnet ? `— ${selectedVnet.name}` : ""}
          </div>

          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Subnet Name", "Address Prefix", "Use Case"].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingSubs ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 36, textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: muted, fontSize: 13 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", border: "3px solid rgba(0,120,212,0.2)", borderTopColor: "#0078D4", animation: "spin 0.8s linear infinite" }} />
                        Loading subnets…
                      </div>
                    </td>
                  </tr>
                ) : !selectedVnet ? (
                  <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: muted, padding: 36 }}>
                    Select a VNet to view its subnets
                  </td></tr>
                ) : subnets.length === 0 ? (
                  <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: muted, padding: 36 }}>
                    No subnets found in {selectedVnet.name}
                  </td></tr>
                ) : subnets.map((s, i) => {
                  const isLast = i === subnets.length - 1
                  // Guess use case from subnet name
                  const n = (s.name || "").toLowerCase()
                  const useCase =
                    n.includes("gateway")  ? "VPN / ExpressRoute Gateway" :
                    n.includes("bastion")  ? "Azure Bastion (SSH/RDP)" :
                    n.includes("firewall") ? "Azure Firewall" :
                    n.includes("web")      ? "Web / App tier" :
                    n.includes("db") || n.includes("data") ? "Database tier" :
                    n.includes("mgmt") || n.includes("manage") ? "Management" :
                    n.includes("aks") || n.includes("k8s")  ? "AKS Cluster" :
                    "General purpose"
                  return (
                    <tr key={s.id || s.name}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      style={{ transition: "background 0.1s" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                        {s.name}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "#7fba00", borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                        {s.address_prefix}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, color: muted, borderBottom: isLast ? "none" : `1px solid ${border}` }}>
                        {useCase}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Spoke context reminder */}
          {selectedVnet && subnets.length > 0 && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: `${activeSub.color}0d`, border: `1px solid ${activeSub.border}`, fontSize: 12, color: muted }}>
              <span style={{ color: activeSub.color, fontWeight: 700 }}>Tip:</span> When creating a VM in the{" "}
              <strong style={{ color: activeSub.color }}>{activeSub.label}</strong> subscription, use the subnet IDs above as the NIC attachment point.
              The full subnet resource ID is in the format:{" "}
              <code style={{ fontSize: 10, background: "rgba(0,0,0,0.2)", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>
                /subscriptions/.../resourceGroups/{selectedVnet.resource_group}/providers/Microsoft.Network/virtualNetworks/{selectedVnet.name}/subnets/&lt;name&gt;
              </code>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
