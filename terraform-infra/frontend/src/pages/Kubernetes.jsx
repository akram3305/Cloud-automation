import { useState } from "react"
import { useTheme } from "../context/ThemeContext"

const PROVIDERS = [
  { id:"aws",     label:"AWS EKS",        color:"#f59e0b", icon:"☁️" },
  { id:"azure",   label:"Azure AKS",      color:"#3b82f6", icon:"🔷" },
  { id:"gcp",     label:"GCP GKE",        color:"#00d4aa", icon:"🟢" },
  { id:"linode",  label:"Linode LKE",     color:"#a78bfa", icon:"🟣" },
]

const COMING_SOON = ["azure","gcp","linode"]

export default function Kubernetes() {
  const { dark } = useTheme()
  const [activeProvider, setActiveProvider] = useState("aws")

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text     = dark ? "#f1f5f9" : "#0f172a"
  const muted    = dark ? "#475569" : "#64748b"

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh" }}>
      {/* Header */}
      <div style={{ marginBottom:"24px" }}>
        <h1 style={{ fontSize:"24px", fontWeight:"700", color:text, margin:0 }}>Kubernetes</h1>
        <p style={{ fontSize:"13px", color:muted, marginTop:"4px" }}>
          Manage Kubernetes clusters across cloud providers
        </p>
      </div>

      {/* Provider tabs */}
      <div style={{ display:"flex", gap:"10px", marginBottom:"24px" }}>
        {PROVIDERS.map(p => (
          <button key={p.id} onClick={() => setActiveProvider(p.id)}
            style={{
              padding:"10px 20px", borderRadius:"10px", fontSize:"13px", fontWeight:"600",
              cursor:"pointer", border:"1px solid "+(activeProvider===p.id ? p.color+"60" : border),
              background: activeProvider===p.id ? p.color+"15" : surface,
              color: activeProvider===p.id ? p.color : muted,
              display:"flex", alignItems:"center", gap:"8px",
            }}>
            <span>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* AWS EKS tab */}
      {activeProvider === "aws" && (
        <div>
          <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"48px", textAlign:"center" }}>
            <div style={{ fontSize:"48px", marginBottom:"16px" }}>⚙️</div>
            <div style={{ fontSize:"18px", fontWeight:"700", color:text, marginBottom:"8px" }}>
              AWS EKS Management
            </div>
            <div style={{ fontSize:"13px", color:muted, marginBottom:"24px", maxWidth:"400px", margin:"0 auto 24px" }}>
              EKS cluster provisioning is available via the EKS page using the Terraform approval workflow.
            </div>
            <a href="/eks" style={{
              display:"inline-block", padding:"10px 24px", borderRadius:"10px",
              background:"#f59e0b", color:"#fff", fontSize:"13px", fontWeight:"600",
              textDecoration:"none",
            }}>
              Go to EKS →
            </a>
          </div>
        </div>
      )}

      {/* Coming soon tabs */}
      {COMING_SOON.includes(activeProvider) && (
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"14px", padding:"48px", textAlign:"center" }}>
          <div style={{ fontSize:"48px", marginBottom:"16px" }}>🚧</div>
          <div style={{ fontSize:"18px", fontWeight:"700", color:text, marginBottom:"8px" }}>
            {PROVIDERS.find(p=>p.id===activeProvider)?.label} — Coming Soon
          </div>
          <div style={{ fontSize:"13px", color:muted, maxWidth:"400px", margin:"0 auto" }}>
            Support for {PROVIDERS.find(p=>p.id===activeProvider)?.label} is under development.
            AWS EKS is currently available.
          </div>
        </div>
      )}
    </div>
  )
}