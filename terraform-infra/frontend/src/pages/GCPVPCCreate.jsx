import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { createRequest } from "../api/api"

const STEPS = ["Basics", "Subnets", "Firewall", "Review"]

const GCP_REGIONS = [
  { name:"us-central1",         display:"Iowa (us-central1)" },
  { name:"us-east1",            display:"South Carolina (us-east1)" },
  { name:"us-east4",            display:"N. Virginia (us-east4)" },
  { name:"us-west1",            display:"Oregon (us-west1)" },
  { name:"us-west2",            display:"Los Angeles (us-west2)" },
  { name:"europe-west1",        display:"Belgium (europe-west1)" },
  { name:"europe-west2",        display:"London (europe-west2)" },
  { name:"europe-west3",        display:"Frankfurt (europe-west3)" },
  { name:"europe-west4",        display:"Netherlands (europe-west4)" },
  { name:"europe-north1",       display:"Finland (europe-north1)" },
  { name:"asia-south1",         display:"Mumbai (asia-south1)" },
  { name:"asia-south2",         display:"Delhi (asia-south2)" },
  { name:"asia-southeast1",     display:"Singapore (asia-southeast1)" },
  { name:"asia-east1",          display:"Taiwan (asia-east1)" },
  { name:"asia-northeast1",     display:"Tokyo (asia-northeast1)" },
  { name:"australia-southeast1",display:"Sydney (australia-southeast1)" },
  { name:"me-west1",            display:"Tel Aviv (me-west1)" },
  { name:"me-central1",         display:"Doha (me-central1)" },
]

const ROUTING_MODES = [
  { id:"REGIONAL", label:"Regional",  desc:"Routes only to resources in the same region. Recommended for most workloads." },
  { id:"GLOBAL",   label:"Global",    desc:"Routes across all regions. Required for VMs in different regions to communicate via internal IPs." },
]

const MTU_OPTIONS = [
  { val:1460, label:"1460 bytes (default)", desc:"Standard Ethernet MTU. Compatible with all GCP services." },
  { val:1500, label:"1500 bytes",           desc:"Jumbo frames. Reduces CPU overhead for large data transfers." },
]

const KEYFRAMES = `
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
  @keyframes spin    { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
`

function isValidCIDR(cidr) {
  const re = /^(\d{1,3}\.){3}\d{1,3}\/(\d|[1-2]\d|3[0-2])$/
  if (!re.test(cidr)) return false
  const [ip, prefix] = cidr.split("/")
  return ip.split(".").every(o => parseInt(o) <= 255) && parseInt(prefix) <= 32
}

export default function GCPVPCCreate() {
  const { dark } = useTheme()
  const navigate  = useNavigate()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text     = dark ? "#f1f5f9" : "#0f172a"
  const muted    = dark ? "#64748b" : "#94a3b8"
  const inp = {
    width:"100%", boxSizing:"border-box", background:surface,
    border:`1px solid ${border}`, borderRadius:8,
    padding:"9px 12px", fontSize:13, color:text, fontFamily:"inherit", outline:"none",
  }

  const [step,        setStep]        = useState(0)
  const [netName,     setNetName]     = useState("")
  const [description, setDescription] = useState("")
  const [environment, setEnvironment] = useState("dev")
  const [subnetMode,  setSubnetMode]  = useState("custom") // "auto" | "custom"
  const [subnetName,  setSubnetName]  = useState("")
  const [subnetCidr,  setSubnetCidr]  = useState("10.0.0.0/24")
  const [subnetRegion,setSubnetRegion]= useState("us-central1")
  const [privateGoogleAccess, setPrivateGoogleAccess] = useState(true)
  const [routingMode, setRoutingMode] = useState("REGIONAL")
  const [mtu,         setMtu]         = useState(1460)
  const [allowInternal, setAllowInternal] = useState(true)
  const [allowSsh,    setAllowSsh]    = useState(false)
  const [allowHttp,   setAllowHttp]   = useState(false)
  const [allowHttps,  setAllowHttps]  = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState("")
  const [success,     setSuccess]     = useState(false)

  const createSubnet = subnetMode === "custom"

  const canNext = () => {
    if (step === 0) return netName.trim().length >= 2
    if (step === 1 && createSubnet) return isValidCIDR(subnetCidr) && subnetRegion
    return true
  }

  async function handleSubmit() {
    setSubmitting(true); setError("")
    try {
      const name = netName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
      await createRequest({
        resource_name: name,
        resource_type: "gcp_network",
        cloud_provider: "gcp",
        region: subnetMode === "custom" ? subnetRegion : "us-central1",
        payload: {
          network_name:             name,
          description:              description.trim(),
          environment,
          auto_create_subnetworks:  subnetMode === "auto",
          routing_mode:             routingMode,
          mtu,
          create_subnet:            createSubnet,
          subnet_name:              subnetName.trim() || `${name}-subnet`,
          subnet_cidr:              subnetCidr,
          subnet_region:            subnetRegion,
          private_google_access:    privateGoogleAccess,
          allow_internal:           allowInternal,
          allow_ssh:                allowSsh,
          allow_http:               allowHttp,
          allow_https:              allowHttps,
        },
      })
      setSuccess(true)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to submit VPC request")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:bg }}>
      <style>{KEYFRAMES}</style>
      <div style={{ textAlign:"center", padding:48, animation:"fadeUp 0.5s ease both" }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#4285F4,#34A853)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", boxShadow:"0 0 32px rgba(66,133,244,0.4)" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style={{ fontSize:22, fontWeight:700, color:text, marginBottom:8 }}>VPC request submitted!</h2>
        <p style={{ color:muted, marginBottom:28, maxWidth:380, margin:"0 auto 28px" }}>Your GCP VPC network will be provisioned after admin approval. Track progress in Approvals.</p>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <button onClick={() => navigate("/approvals")} style={{ padding:"11px 28px", borderRadius:10, background:"linear-gradient(135deg,#4285F4,#34A853)", border:"none", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", boxShadow:"0 4px 16px rgba(66,133,244,0.4)" }}>View Approvals</button>
          <button onClick={() => navigate("/gcp/network")} style={{ padding:"11px 24px", borderRadius:10, background:"transparent", border:`1px solid ${border}`, color:text, fontSize:14, cursor:"pointer" }}>VPC Networks</button>
        </div>
      </div>
    </div>
  )

  const GCP_ICON = (
    <svg width="20" height="20" viewBox="0 0 92 92" fill="none">
      <path d="M46 20a26 26 0 010 52 26 26 0 010-52z" fill="none" stroke="#4285F4" strokeWidth="7"/>
      <path d="M46 10V4M46 88v-6M10 46H4M88 46h-6" stroke="#4285F4" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="46" cy="46" r="8" fill="#4285F4"/>
    </svg>
  )

  return (
    <div style={{ background:bg, minHeight:"100vh" }}>
      <style>{KEYFRAMES}</style>

      {/* Top bar */}
      <div style={{ background:surface, borderBottom:`1px solid ${border}`, padding:"14px 32px", display:"flex", alignItems:"center", gap:14 }}>
        <button onClick={() => navigate("/gcp/network")} style={{ background:"transparent", border:"none", cursor:"pointer", color:muted, display:"flex", alignItems:"center", gap:6, fontSize:13 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          VPC Networks
        </button>
        <span style={{ color:muted }}>/</span>
        <span style={{ fontSize:13, color:muted }}>GCP</span>
        <span style={{ color:muted }}>/</span>
        <span style={{ fontSize:13, fontWeight:600, color:text }}>Create VPC Network</span>

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#4285F4,#34A853)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {GCP_ICON}
          </div>
          <span style={{ fontSize:13, fontWeight:600, color:text }}>Google Cloud</span>
        </div>
      </div>

      {/* Step progress */}
      <div style={{ background:surface, borderBottom:`1px solid ${border}`, padding:"12px 32px" }}>
        <div style={{ display:"flex", gap:0, maxWidth:560 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display:"flex", alignItems:"center", flex: i < STEPS.length - 1 ? 1 : undefined }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, cursor: i < step ? "pointer" : "default" }}
                onClick={() => { if (i < step) setStep(i) }}>
                <div style={{
                  width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, fontWeight:700,
                  background: i < step ? "#34A853" : i === step ? "#4285F4" : "transparent",
                  border: i >= step ? `2px solid ${i === step ? "#4285F4" : border}` : "none",
                  color: i <= step ? "#fff" : muted,
                }}>
                  {i < step ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> : i + 1}
                </div>
                <span style={{ fontSize:12, fontWeight:600, color: i === step ? text : muted, whiteSpace:"nowrap" }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex:1, height:1, background: i < step ? "#34A853" : border, margin:"0 10px" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:0, maxWidth:1100, margin:"0 auto", padding:"28px 24px" }}>

        {/* ── Left: Form ── */}
        <div style={{ paddingRight:28 }}>

          {/* Step 0 — Basics */}
          {step === 0 && (
            <div style={{ animation:"fadeUp 0.3s ease both" }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Network Basics</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:24 }}>A VPC network is a global resource. Subnets are regional.</p>

              <div style={{ display:"grid", gap:20 }}>
                <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:text, marginBottom:16 }}>Identity</div>
                  <div style={{ display:"grid", gap:14 }}>
                    <div>
                      <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>
                        Network Name <span style={{ color:"#f43f5e" }}>*</span>
                      </label>
                      <input
                        value={netName}
                        onChange={e => setNetName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="e.g. vpc-production, my-network"
                        style={inp}
                      />
                      <div style={{ fontSize:11, color:muted, marginTop:4 }}>Lowercase letters, numbers, and hyphens only. Must start with a letter.</div>
                    </div>
                    <div>
                      <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Description</label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Optional description for this VPC network..."
                        rows={2}
                        style={{ ...inp, resize:"vertical", lineHeight:1.5 }}
                      />
                    </div>
                    <div>
                      <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Environment</label>
                      <div style={{ display:"flex", gap:8 }}>
                        {["dev","staging","prod"].map(e => (
                          <button key={e} onClick={() => setEnvironment(e)} style={{
                            flex:1, padding:"9px 0", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
                            background: environment === e ? "rgba(66,133,244,0.1)" : "transparent",
                            border: environment === e ? "2px solid #4285F4" : `1px solid ${border}`,
                            color: environment === e ? "#4285F4" : muted,
                            textTransform:"capitalize",
                          }}>{e}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Subnets */}
          {step === 1 && (
            <div style={{ animation:"fadeUp 0.3s ease both" }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Subnet Configuration</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:24 }}>Choose how subnets are created for this VPC.</p>

              <div style={{ display:"grid", gap:16 }}>
                {/* Subnet mode */}
                <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:text, marginBottom:14 }}>Subnet Creation Mode</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {[
                      { id:"custom", label:"Custom Mode", icon:"✏️", desc:"You define subnets per region. Full control over IP ranges. Recommended for production." },
                      { id:"auto",   label:"Auto Mode",   icon:"⚡", desc:"GCP automatically creates one subnet per region with pre-defined IP ranges. Good for quick setup." },
                    ].map(m => (
                      <button key={m.id} onClick={() => setSubnetMode(m.id)} style={{
                        padding:16, borderRadius:10, cursor:"pointer", textAlign:"left",
                        background: subnetMode === m.id ? "rgba(66,133,244,0.08)" : "transparent",
                        border: subnetMode === m.id ? "2px solid #4285F4" : `1px solid ${border}`,
                        transition:"all 0.15s",
                      }}>
                        <div style={{ fontSize:20, marginBottom:8 }}>{m.icon}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:text, marginBottom:4 }}>{m.label}</div>
                        <div style={{ fontSize:11, color:muted, lineHeight:1.5 }}>{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom subnet details */}
                {createSubnet && (
                  <div style={{ background:surface, borderRadius:12, border:`1px solid #4285F4`, padding:20 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:text, marginBottom:14 }}>
                      New Subnet
                      <span style={{ fontSize:11, fontWeight:400, color:muted, marginLeft:8 }}>— one subnet will be created with this VPC</span>
                    </div>
                    <div style={{ display:"grid", gap:14 }}>
                      <div>
                        <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Subnet Name</label>
                        <input
                          value={subnetName}
                          onChange={e => setSubnetName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                          placeholder={netName ? `${netName}-subnet` : "subnet-name"}
                          style={inp}
                        />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                        <div>
                          <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>
                            IP CIDR Range <span style={{ color:"#f43f5e" }}>*</span>
                          </label>
                          <input
                            value={subnetCidr}
                            onChange={e => setSubnetCidr(e.target.value)}
                            placeholder="10.0.0.0/24"
                            style={{ ...inp, borderColor: subnetCidr && !isValidCIDR(subnetCidr) ? "#f43f5e" : border }}
                          />
                          {subnetCidr && !isValidCIDR(subnetCidr) && (
                            <div style={{ fontSize:11, color:"#f43f5e", marginTop:4 }}>Invalid CIDR format (e.g., 10.0.0.0/24)</div>
                          )}
                        </div>
                        <div>
                          <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:6 }}>Region</label>
                          <select value={subnetRegion} onChange={e => setSubnetRegion(e.target.value)} style={inp}>
                            {GCP_REGIONS.map(r => (
                              <option key={r.name} value={r.name}>{r.display}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer" }}>
                        <input type="checkbox" checked={privateGoogleAccess} onChange={e => setPrivateGoogleAccess(e.target.checked)}
                          style={{ width:15, height:15, marginTop:2, accentColor:"#4285F4" }} />
                        <div>
                          <div style={{ fontSize:13, fontWeight:500, color:text }}>Private Google Access</div>
                          <div style={{ fontSize:11, color:muted }}>Allows VMs without external IPs to reach Google APIs and services.</div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Advanced options */}
                <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:text, marginBottom:14 }}>Advanced Options</div>
                  <div style={{ display:"grid", gap:14 }}>
                    <div>
                      <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:8 }}>Dynamic Routing Mode</label>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        {ROUTING_MODES.map(m => (
                          <button key={m.id} onClick={() => setRoutingMode(m.id)} style={{
                            padding:"12px 14px", borderRadius:9, cursor:"pointer", textAlign:"left",
                            background: routingMode === m.id ? "rgba(66,133,244,0.08)" : "transparent",
                            border: routingMode === m.id ? "2px solid #4285F4" : `1px solid ${border}`,
                          }}>
                            <div style={{ fontSize:12, fontWeight:700, color:text, marginBottom:3 }}>{m.label}</div>
                            <div style={{ fontSize:11, color:muted, lineHeight:1.4 }}>{m.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ display:"block", fontSize:12, fontWeight:600, color:text, marginBottom:8 }}>Maximum Transmission Unit (MTU)</label>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        {MTU_OPTIONS.map(m => (
                          <button key={m.val} onClick={() => setMtu(m.val)} style={{
                            padding:"12px 14px", borderRadius:9, cursor:"pointer", textAlign:"left",
                            background: mtu === m.val ? "rgba(66,133,244,0.08)" : "transparent",
                            border: mtu === m.val ? "2px solid #4285F4" : `1px solid ${border}`,
                          }}>
                            <div style={{ fontSize:12, fontWeight:700, color:text, marginBottom:3 }}>{m.label}</div>
                            <div style={{ fontSize:11, color:muted, lineHeight:1.4 }}>{m.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Firewall */}
          {step === 2 && (
            <div style={{ animation:"fadeUp 0.3s ease both" }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Firewall Rules</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:24 }}>These rules apply to all VMs in this network. You can add more rules later.</p>

              <div style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, padding:20 }}>
                {[
                  { label:"Allow internal traffic",  desc:"Allow TCP, UDP, ICMP between VMs (10.0.0.0/8). Recommended.", val:allowInternal,  set:setAllowInternal,  color:"#10b981" },
                  { label:"Allow SSH (port 22)",      desc:"SSH access from any IP (0.0.0.0/0). Required for Linux remote access.",  val:allowSsh,      set:setAllowSsh,      color:"#4285F4" },
                  { label:"Allow HTTP (port 80)",     desc:"Public web traffic — unencrypted.",  val:allowHttp,     set:setAllowHttp,     color:"#f59e0b" },
                  { label:"Allow HTTPS (port 443)",   desc:"Public web traffic — encrypted.",    val:allowHttps,    set:setAllowHttps,    color:"#34A853" },
                ].map(r => (
                  <label key={r.label} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 0", borderBottom:`1px solid ${border}`, cursor:"pointer", ":last-child": { borderBottom:"none" } }}>
                    <div onClick={() => r.set(!r.val)} style={{
                      width:44, height:24, borderRadius:12, position:"relative", cursor:"pointer", transition:"background 0.2s",
                      background: r.val ? r.color : (dark ? "#1e293b" : "#e2e8f0"),
                      flexShrink:0,
                    }}>
                      <div style={{ position:"absolute", top:3, left: r.val ? 23 : 3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }} />
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:text }}>{r.label}</div>
                      <div style={{ fontSize:11, color:muted }}>{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ marginTop:14, padding:"10px 14px", borderRadius:9, background:"rgba(66,133,244,0.05)", border:"1px solid rgba(66,133,244,0.2)", fontSize:12, color:muted }}>
                <span style={{ color:"#4285F4", fontWeight:700 }}>Tip:</span> New VMs attached to this network will inherit these rules. You can modify firewall rules any time in the GCP Console under VPC → Firewall.
              </div>
            </div>
          )}

          {/* Step 3 — Review */}
          {step === 3 && (
            <div style={{ animation:"fadeUp 0.3s ease both" }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:text, marginBottom:4 }}>Review & Submit</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:24 }}>This request will be sent for admin approval before Terraform provisions the VPC.</p>

              {[
                { section:"Network", rows:[
                  { l:"Name",         v: netName || "(not set)" },
                  { l:"Description",  v: description || "—" },
                  { l:"Environment",  v: environment },
                  { l:"Routing Mode", v: routingMode },
                  { l:"MTU",          v: `${mtu} bytes` },
                ]},
                { section:"Subnets", rows:[
                  { l:"Subnet Mode",  v: subnetMode === "auto" ? "Auto (GCP-managed)" : "Custom" },
                  ...(createSubnet ? [
                    { l:"Subnet Name",   v: subnetName || `${netName}-subnet` },
                    { l:"IP CIDR",       v: subnetCidr },
                    { l:"Region",        v: subnetRegion },
                    { l:"Private Google Access", v: privateGoogleAccess ? "Enabled" : "Disabled" },
                  ] : []),
                ]},
                { section:"Firewall Rules", rows:[
                  { l:"Internal Traffic", v: allowInternal ? "✓ Allowed" : "Blocked" },
                  { l:"SSH (22)",          v: allowSsh     ? "✓ Allowed" : "Blocked" },
                  { l:"HTTP (80)",         v: allowHttp    ? "✓ Allowed" : "Blocked" },
                  { l:"HTTPS (443)",       v: allowHttps   ? "✓ Allowed" : "Blocked" },
                ]},
              ].map(section => (
                <div key={section.section} style={{ background:surface, borderRadius:12, border:`1px solid ${border}`, marginBottom:14, overflow:"hidden" }}>
                  <div style={{ padding:"10px 16px", background: dark ? "rgba(66,133,244,0.06)" : "rgba(66,133,244,0.04)", borderBottom:`1px solid ${border}`, fontSize:12, fontWeight:700, color:"#4285F4" }}>
                    {section.section}
                  </div>
                  {section.rows.map((r, i) => (
                    <div key={r.l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 16px", borderBottom: i < section.rows.length - 1 ? `1px solid ${border}` : "none" }}>
                      <span style={{ fontSize:12, color:muted }}>{r.l}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:r.v?.startsWith?.("✓") ? "#34A853" : text, fontFamily: r.l.includes("CIDR") ? "monospace" : "inherit" }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              ))}

              {error && (
                <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(244,63,94,0.1)", border:"1px solid rgba(244,63,94,0.3)", color:"#fca5a5", fontSize:13, marginBottom:14 }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:28 }}>
            <button
              onClick={() => step === 0 ? navigate("/gcp/network") : setStep(step - 1)}
              style={{ padding:"10px 24px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", background:"transparent", border:`1px solid ${border}`, color:muted }}
            >
              {step === 0 ? "Cancel" : "← Back"}
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                style={{ padding:"10px 32px", borderRadius:10, fontSize:14, fontWeight:700, cursor:canNext()?"pointer":"not-allowed", background:"linear-gradient(135deg,#4285F4,#34A853)", border:"none", color:"#fff", opacity:canNext()?1:0.5, boxShadow:"0 4px 16px rgba(66,133,244,0.35)" }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ padding:"10px 32px", borderRadius:10, fontSize:14, fontWeight:700, cursor:submitting?"not-allowed":"pointer", background:"linear-gradient(135deg,#4285F4,#34A853)", border:"none", color:"#fff", opacity:submitting?0.7:1, boxShadow:"0 4px 16px rgba(66,133,244,0.35)", display:"flex", alignItems:"center", gap:8 }}
              >
                {submitting && <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", animation:"spin 0.8s linear infinite" }} />}
                {submitting ? "Submitting..." : "Submit for Approval"}
              </button>
            )}
          </div>
        </div>

        {/* ── Right: Summary panel ── */}
        <div style={{ background:surface, borderLeft:`1px solid ${border}`, padding:24, position:"sticky", top:0, height:"100vh", overflowY:"auto", boxSizing:"border-box" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#4285F4,#34A853)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:text }}>VPC Summary</div>
          </div>

          <div style={{ fontSize:10, padding:"3px 10px", borderRadius:20, background:"rgba(66,133,244,0.1)", border:"1px solid rgba(66,133,244,0.3)", color:"#4285F4", fontWeight:600, display:"inline-block", marginBottom:16 }}>
            Google Cloud — Global Resource
          </div>

          {[
            { label:"Name",       value: netName || "—" },
            { label:"Mode",       value: subnetMode === "auto" ? "Auto" : "Custom" },
            { label:"Routing",    value: routingMode },
            { label:"MTU",        value: `${mtu} bytes` },
            { label:"Environment",value: environment },
            ...(createSubnet ? [
              { label:"Subnet CIDR", value: subnetCidr },
              { label:"Subnet Region", value: subnetRegion },
            ] : []),
          ].map(r => (
            <div key={r.label} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
              <span style={{ color:muted }}>{r.label}</span>
              <span style={{ color:text, fontWeight:500, fontFamily: r.label.includes("CIDR") ? "monospace" : "inherit" }}>{r.value}</span>
            </div>
          ))}

          <div style={{ height:1, background:border, margin:"14px 0" }} />

          {/* Firewall summary */}
          <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Firewall Rules</div>
          {[
            { label:"Internal", val:allowInternal },
            { label:"SSH",      val:allowSsh },
            { label:"HTTP",     val:allowHttp },
            { label:"HTTPS",    val:allowHttps },
          ].map(r => (
            <div key={r.label} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5 }}>
              <span style={{ color:muted }}>{r.label}</span>
              <span style={{ color: r.val ? "#34A853" : muted, fontWeight:600 }}>{r.val ? "✓ On" : "Off"}</span>
            </div>
          ))}

          <div style={{ height:1, background:border, margin:"14px 0" }} />

          <div style={{ padding:"10px 12px", borderRadius:9, background:"rgba(66,133,244,0.06)", border:"1px solid rgba(66,133,244,0.2)", fontSize:11, color:muted, lineHeight:1.6 }}>
            GCP VPCs are free. You only pay for resources (VMs, load balancers, Cloud NAT) attached to the network. Firewall rules and subnets are also free.
          </div>
        </div>
      </div>
    </div>
  )
}
