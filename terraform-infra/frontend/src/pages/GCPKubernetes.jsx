import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { listGKEClusters } from "../api/api"
import K8sPodManager from "../components/K8sPodManager"

function SvgIcon({ d, size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const STATUS_COLORS = {
  pending:   { bg:"rgba(245,158,11,0.15)",  color:"#f59e0b", dot:"#f59e0b"  },
  approved:  { bg:"rgba(66,133,244,0.15)",  color:"#4285F4", dot:"#4285F4"  },
  running:   { bg:"rgba(34,197,94,0.15)",   color:"#22c55e", dot:"#22c55e"  },
  completed: { bg:"rgba(52,168,83,0.15)",   color:"#34A853", dot:"#34A853"  },
  failed:    { bg:"rgba(239,68,68,0.15)",   color:"#ef4444", dot:"#ef4444"  },
  rejected:  { bg:"rgba(100,116,139,0.15)", color:"#94a3b8", dot:"#94a3b8"  },
}

const CHANNEL_COLORS = {
  RAPID:  "#EA4335",
  REGULAR:"#4285F4",
  STABLE: "#34A853",
  NONE:   "#94a3b8",
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px",
      borderRadius:20, background:s.bg, color:s.color, fontSize:10, fontWeight:700,
      whiteSpace:"nowrap", textTransform:"capitalize",
    }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:s.dot, flexShrink:0,
        boxShadow: status === "running" ? `0 0 4px ${s.dot}` : "none" }} />
      {status}
    </span>
  )
}

function ChannelBadge({ channel }) {
  const c = CHANNEL_COLORS[channel] || CHANNEL_COLORS.NONE
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px",
      borderRadius:6, background:`${c}18`, color:c, fontSize:10, fontWeight:700, border:`1px solid ${c}30` }}>
      {channel || "NONE"}
    </span>
  )
}

// ── How-to Guide Modal ────────────────────────────────────────────────────────
const GUIDE_STEPS = [
  {
    num: 1,
    title: "Basics",
    color: "#4285F4",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    fields: [
      { name:"Cluster Name",     desc:"Lowercase letters, numbers, hyphens only. Min 3 chars. e.g. my-cluster" },
      { name:"Region",           desc:"GCP region where the cluster will be created. e.g. us-central1, asia-south1" },
      { name:"Release Channel",  desc:"REGULAR = recommended. RAPID = latest features. STABLE = slowest but most reliable." },
      { name:"Cluster Type",     desc:"Regional = 3 control-plane replicas across zones (HA). Zonal = single zone, cheaper." },
      { name:"Environment",      desc:"dev / staging / prod — used for labeling and workspace isolation in Terraform state." },
    ],
  },
  {
    num: 2,
    title: "Node Pool",
    color: "#34A853",
    icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
    fields: [
      { name:"Machine Type",     desc:"Choose based on workload. e2-standard-4 is a good general-purpose default." },
      { name:"Initial Nodes",    desc:"Nodes at cluster start. Must be between Min and Max." },
      { name:"Min / Max Nodes",  desc:"Auto-scaler boundaries. Min = never go below. Max = never exceed." },
      { name:"Disk Type",        desc:"SSD (pd-ssd) = high IOPS. Balanced = cost vs performance. Standard = cheapest." },
      { name:"Disk Size",        desc:"Per-node boot disk in GB. Minimum 10 GB. Recommended: 100 GB." },
      { name:"Node Image",       desc:"Container-Optimized OS is hardened and recommended. Ubuntu if you need custom packages." },
      { name:"Spot VMs",         desc:"~70% cheaper but nodes can be preempted. Only for fault-tolerant workloads." },
    ],
  },
  {
    num: 3,
    title: "Networking & Features",
    color: "#FBBC04",
    icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    fields: [
      { name:"Network / Subnetwork", desc:"Leave 'default' unless you have a custom VPC. Select matching subnetwork if using custom network." },
      { name:"Private Cluster",      desc:"Nodes get only internal IPs — no direct internet. Recommended for production workloads." },
      { name:"Master CIDR",          desc:"Only shown when Private Cluster is ON. Must be a /28 block unused in your VPC. e.g. 172.16.0.32/28" },
      { name:"HTTP Load Balancing",  desc:"Enables GCP Cloud Load Balancer for Kubernetes LoadBalancer services." },
      { name:"HPA",                  desc:"Horizontal Pod Autoscaling — scales pod count based on CPU/memory metrics." },
      { name:"Network Policy",       desc:"Enables Calico for pod-to-pod network isolation using NetworkPolicy objects." },
      { name:"Workload Identity",    desc:"Allows pods to call GCP APIs (Cloud Storage, BigQuery etc.) without service account keys." },
      { name:"Cloud Logging",        desc:"Streams pod logs to Google Cloud Logging (Stackdriver)." },
      { name:"Cloud Monitoring",     desc:"Sends node and pod metrics to Google Cloud Monitoring." },
    ],
  },
  {
    num: 4,
    title: "Review & Submit",
    color: "#EA4335",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    fields: [
      { name:"Review all settings",  desc:"Check cluster name, region, machine type, node counts, and networking before submitting." },
      { name:"Submit for Approval",  desc:"Request is saved as 'pending'. Nothing is provisioned yet." },
      { name:"Admin approves",       desc:"An admin reviews the request in the Approvals page and approves it." },
      { name:"Terraform runs",       desc:"Backend generates workspace → terraform init → plan → apply on GCP." },
      { name:"Cluster is live",      desc:"Status changes to 'completed'. Cluster appears in GCP Console." },
    ],
  },
]

const PREREQ_ITEMS = [
  { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"GCP Service Account key JSON", desc:"Download from GCP IAM → Service Accounts" },
  { icon:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z", label:"GCP_PROJECT_ID in .env", desc:"Set GCP_PROJECT_ID=your-project-id" },
  { icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label:"GCP_CREDENTIALS_FILE or GCP_CREDENTIALS_JSON in .env", desc:"Path to key file or inline JSON string" },
  { icon:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", label:"Service account IAM roles", desc:"roles/container.admin · roles/compute.networkViewer · roles/iam.serviceAccountUser" },
]

function HowToModal({ dark, onClose }) {
  const [activeStep, setActiveStep] = useState(0)
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const txt     = dark ? "#e2e8f0" : "#1e293b"
  const muted   = dark ? "#64748b" : "#94a3b8"
  const subtle  = dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:1100,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:820, maxHeight:"92vh", display:"flex", flexDirection:"column",
        background:surface, border:`1px solid ${border}`, borderRadius:18,
        boxShadow:"0 32px 80px rgba(0,0,0,0.5)", overflow:"hidden" }}>

        {/* Modal header */}
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background: dark ? "rgba(66,133,244,0.06)" : "rgba(66,133,244,0.04)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10,
              background:"linear-gradient(135deg,#4285F4,#34A853)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:8, fontWeight:800, color:"#fff" }}>GKE</span>
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:txt }}>How to Create a GKE Cluster</div>
              <div style={{ fontSize:12, color:muted }}>Step-by-step guide — 4 steps, takes about 2 minutes</div>
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"transparent", border:"none", color:muted, fontSize:22, cursor:"pointer", lineHeight:1 }}>×</button>
        </div>

        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* Left nav */}
          <div style={{ width:200, flexShrink:0, borderRight:`1px solid ${border}`,
            padding:"16px 12px", display:"flex", flexDirection:"column", gap:4, overflowY:"auto" }}>

            {/* Prerequisites */}
            <button onClick={() => setActiveStep(-1)}
              style={{ textAlign:"left", padding:"9px 12px", borderRadius:8, cursor:"pointer",
                background: activeStep === -1 ? "rgba(251,188,4,0.12)" : "transparent",
                border: activeStep === -1 ? "1px solid rgba(251,188,4,0.3)" : "1px solid transparent",
                color: activeStep === -1 ? "#FBBC04" : muted, fontSize:12, fontWeight:600 }}>
              Prerequisites
            </button>

            <div style={{ fontSize:10, color:muted, textTransform:"uppercase",
              letterSpacing:"0.08em", padding:"10px 12px 4px", fontWeight:700 }}>Steps</div>

            {GUIDE_STEPS.map((s, i) => (
              <button key={i} onClick={() => setActiveStep(i)}
                style={{ textAlign:"left", padding:"9px 12px", borderRadius:8, cursor:"pointer",
                  background: activeStep === i ? `${s.color}14` : "transparent",
                  border: activeStep === i ? `1px solid ${s.color}40` : "1px solid transparent",
                  color: activeStep === i ? s.color : muted, fontSize:12, fontWeight:600,
                  display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:20, height:20, borderRadius:"50%", flexShrink:0,
                  background: activeStep === i ? s.color : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
                  color: activeStep === i ? "#fff" : muted,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:9, fontWeight:800 }}>{s.num}</span>
                {s.title}
              </button>
            ))}

            {/* After Submit */}
            <div style={{ fontSize:10, color:muted, textTransform:"uppercase",
              letterSpacing:"0.08em", padding:"10px 12px 4px", fontWeight:700 }}>After Submit</div>
            <button onClick={() => setActiveStep(99)}
              style={{ textAlign:"left", padding:"9px 12px", borderRadius:8, cursor:"pointer",
                background: activeStep === 99 ? "rgba(52,168,83,0.12)" : "transparent",
                border: activeStep === 99 ? "1px solid rgba(52,168,83,0.3)" : "1px solid transparent",
                color: activeStep === 99 ? "#34A853" : muted, fontSize:12, fontWeight:600 }}>
              Approval & Deploy
            </button>
            <button onClick={() => setActiveStep(100)}
              style={{ textAlign:"left", padding:"9px 12px", borderRadius:8, cursor:"pointer",
                background: activeStep === 100 ? "rgba(66,133,244,0.12)" : "transparent",
                border: activeStep === 100 ? "1px solid rgba(66,133,244,0.3)" : "1px solid transparent",
                color: activeStep === 100 ? "#4285F4" : muted, fontSize:12, fontWeight:600 }}>
              Connect to Cluster
            </button>
          </div>

          {/* Right content */}
          <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

            {/* Prerequisites */}
            {activeStep === -1 && (
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:txt, marginBottom:6 }}>Prerequisites</div>
                <div style={{ fontSize:12, color:muted, marginBottom:20 }}>
                  Before creating a GKE cluster, make sure these are configured in your <code style={{ background:subtle, padding:"1px 5px", borderRadius:4, fontSize:11 }}>.env</code> file and backend.
                </div>
                <div style={{ display:"grid", gap:10 }}>
                  {PREREQ_ITEMS.map((item, i) => (
                    <div key={i} style={{ display:"flex", gap:14, padding:"14px 16px", borderRadius:12,
                      border:`1px solid ${border}`, background:subtle, alignItems:"flex-start" }}>
                      <div style={{ width:32, height:32, borderRadius:8, flexShrink:0,
                        background:"rgba(251,188,4,0.12)", border:"1px solid rgba(251,188,4,0.25)",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <SvgIcon d={item.icon} size={15} color="#FBBC04" />
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:3 }}>{item.label}</div>
                        <div style={{ fontSize:11, color:muted, lineHeight:1.6 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:16, padding:"12px 16px", borderRadius:10,
                  background:"rgba(66,133,244,0.07)", border:"1px solid rgba(66,133,244,0.2)",
                  fontSize:12, color:muted, lineHeight:1.7 }}>
                  <strong style={{ color:"#4285F4" }}>Service account minimum roles:</strong><br/>
                  <code style={{ fontSize:11 }}>roles/container.admin</code> · <code style={{ fontSize:11 }}>roles/compute.networkViewer</code> · <code style={{ fontSize:11 }}>roles/iam.serviceAccountUser</code>
                </div>
              </div>
            )}

            {/* Steps 1–4 */}
            {activeStep >= 0 && activeStep <= 3 && (() => {
              const s = GUIDE_STEPS[activeStep]
              return (
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                    <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
                      background:`${s.color}18`, border:`1px solid ${s.color}40`,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <SvgIcon d={s.icon} size={18} color={s.color} />
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:txt }}>Step {s.num} — {s.title}</div>
                      <div style={{ fontSize:12, color:muted }}>Fill in these fields in the wizard</div>
                    </div>
                  </div>
                  <div style={{ display:"grid", gap:8 }}>
                    {s.fields.map((f, i) => (
                      <div key={i} style={{ display:"flex", gap:14, padding:"13px 16px", borderRadius:11,
                        border:`1px solid ${border}`, background:subtle, alignItems:"flex-start" }}>
                        <div style={{ width:24, height:24, borderRadius:6, flexShrink:0,
                          background:`${s.color}18`, border:`1px solid ${s.color}30`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:10, fontWeight:800, color:s.color }}>
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:2 }}>{f.name}</div>
                          <div style={{ fontSize:12, color:muted, lineHeight:1.6 }}>{f.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:20, display:"flex", gap:8 }}>
                    {activeStep > 0 && (
                      <button onClick={() => setActiveStep(activeStep - 1)}
                        style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${border}`,
                          background:"transparent", color:muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        ← Previous
                      </button>
                    )}
                    {activeStep < 3 && (
                      <button onClick={() => setActiveStep(activeStep + 1)}
                        style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${s.color}50`,
                          background:`${s.color}12`, color:s.color, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        Next Step →
                      </button>
                    )}
                    {activeStep === 3 && (
                      <button onClick={() => setActiveStep(99)}
                        style={{ padding:"8px 18px", borderRadius:8, border:"1px solid rgba(52,168,83,0.4)",
                          background:"rgba(52,168,83,0.12)", color:"#34A853", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        After Submit →
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Approval & Deploy */}
            {activeStep === 99 && (
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:txt, marginBottom:6 }}>Approval & Deploy</div>
                <div style={{ fontSize:12, color:muted, marginBottom:20 }}>
                  After you submit, the cluster goes through an approval and Terraform provisioning pipeline.
                </div>
                <div style={{ display:"grid", gap:0 }}>
                  {[
                    { step:"1", color:"#f59e0b", title:"Request saved as Pending",    desc:"Nothing is provisioned yet. The request is stored in the database waiting for an admin." },
                    { step:"2", color:"#4285F4", title:"Admin approves",              desc:"Log in as admin → go to Approvals page → find the cluster request → click Approve." },
                    { step:"3", color:"#a78bfa", title:"Terraform workspace generated",desc:"Backend auto-generates terraform.tfvars from your settings and copies the gke.tf template." },
                    { step:"4", color:"#34A853", title:"Terraform apply runs",         desc:"terraform init → terraform plan → terraform apply executes against your GCP project." },
                    { step:"5", color:"#22c55e", title:"Cluster is live",             desc:"Status updates to 'completed'. The GKE cluster appears in your GCP Console." },
                  ].map((item, i, arr) => (
                    <div key={i} style={{ display:"flex", gap:0 }}>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:40, flexShrink:0 }}>
                        <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0,
                          background:`${item.color}18`, border:`2px solid ${item.color}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:12, fontWeight:800, color:item.color }}>
                          {item.step}
                        </div>
                        {i < arr.length - 1 && (
                          <div style={{ width:2, flex:1, background:border, margin:"4px 0", minHeight:20 }} />
                        )}
                      </div>
                      <div style={{ paddingLeft:14, paddingBottom: i < arr.length - 1 ? 20 : 0, paddingTop:4 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:3 }}>{item.title}</div>
                        <div style={{ fontSize:12, color:muted, lineHeight:1.6 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connect to Cluster */}
            {activeStep === 100 && (
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:txt, marginBottom:6 }}>Connect to Your Cluster</div>
                <div style={{ fontSize:12, color:muted, marginBottom:20 }}>
                  Once the cluster status is <strong>completed</strong>, run these commands to connect with kubectl.
                </div>
                <div style={{ display:"grid", gap:12 }}>
                  {[
                    { label:"1. Activate service account", code:"gcloud auth activate-service-account \\\n  --key-file=/path/to/service-account-key.json" },
                    { label:"2. Get cluster credentials", code:"gcloud container clusters get-credentials CLUSTER_NAME \\\n  --region REGION \\\n  --project YOUR_PROJECT_ID" },
                    { label:"3. Verify nodes are ready", code:"kubectl get nodes" },
                    { label:"4. Check all system pods", code:"kubectl get pods --all-namespaces" },
                  ].map((item, i) => (
                    <div key={i} style={{ borderRadius:10, border:`1px solid ${border}`, overflow:"hidden" }}>
                      <div style={{ padding:"8px 14px", background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)",
                        fontSize:11, fontWeight:700, color:muted, borderBottom:`1px solid ${border}` }}>
                        {item.label}
                      </div>
                      <pre style={{ margin:0, padding:"12px 14px", fontSize:12, color:"#34A853",
                        background:dark?"rgba(52,168,83,0.05)":"rgba(52,168,83,0.04)", overflowX:"auto",
                        fontFamily:"'Courier New', monospace", lineHeight:1.6 }}>
                        {item.code}
                      </pre>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:16, padding:"12px 16px", borderRadius:10,
                  background:"rgba(66,133,244,0.07)", border:"1px solid rgba(66,133,244,0.2)",
                  fontSize:12, color:muted, lineHeight:1.7 }}>
                  <strong style={{ color:"#4285F4" }}>Private cluster?</strong> You need to be inside the VPC or use
                  GCP Cloud Shell — private clusters have no public API endpoint.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Cluster Detail Modal ──────────────────────────────────────────────────────
function ClusterDetailModal({ cluster, dark, onClose }) {
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const txt     = dark ? "#e2e8f0" : "#1e293b"
  const muted   = dark ? "#64748b" : "#94a3b8"
  const cfg     = cluster.config || {}

  const rows = [
    ["Cluster Name",      cfg.resource_name  || cluster.resource_name || "—"],
    ["Region",            cfg.region         || "—"],
    ["Environment",       cfg.environment    || "—"],
    ["Release Channel",   cfg.release_channel || "—"],
    ["Cluster Type",      cfg.regional_cluster ? "Regional" : "Zonal"],
    ["Machine Type",      cfg.machine_type   || "—"],
    ["Disk",              cfg.disk_size_gb   ? `${cfg.disk_size_gb} GB ${cfg.disk_type || ""}`.trim() : "—"],
    ["Node Image",        cfg.image_type     || "—"],
    ["Initial Nodes",     cfg.initial_node_count ?? "—"],
    ["Min / Max Nodes",   cfg.min_node_count != null ? `${cfg.min_node_count} / ${cfg.max_node_count}` : "—"],
    ["Spot VMs",          cfg.spot ? "Yes" : "No"],
    ["Network",           cfg.network        || "default"],
    ["Subnetwork",        cfg.subnetwork     || "default"],
    ["Private Cluster",   cfg.private_cluster ? "Yes" : "No"],
    ["Network Policy",    cfg.enable_network_policy ? "Calico" : "None"],
    ["Workload Identity", cfg.enable_workload_identity ? "Enabled" : "Disabled"],
    ["HTTP Load Balancing",cfg.enable_http_load_balancing ? "Enabled" : "Disabled"],
    ["HPA",               cfg.enable_horizontal_pod_autoscaling ? "Enabled" : "Disabled"],
    ["Cloud Logging",     cfg.enable_logging ? "Enabled" : "Disabled"],
    ["Cloud Monitoring",  cfg.enable_monitoring ? "Enabled" : "Disabled"],
  ]

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.68)", zIndex:1000,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:660, maxHeight:"88vh", overflowY:"auto",
        background:surface, border:`1px solid ${border}`, borderRadius:16, padding:24,
        boxShadow:"0 24px 64px rgba(0,0,0,0.45)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:txt }}>
              {cfg.resource_name || cluster.resource_name || "GKE Cluster"}
            </div>
            <div style={{ fontSize:12, color:muted, marginTop:3 }}>
              Request #{cluster.id} · Submitted {new Date(cluster.created_at).toLocaleString()}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:muted, fontSize:22, cursor:"pointer" }}>×</button>
        </div>

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
          <StatusBadge status={cluster.status} />
          <ChannelBadge channel={cfg.release_channel} />
          {cfg.spot && (
            <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px",
              borderRadius:6, background:"rgba(251,188,4,0.15)", color:"#FBBC04",
              fontSize:10, fontWeight:700, border:"1px solid rgba(251,188,4,0.25)" }}>Spot VMs</span>
          )}
          {cfg.private_cluster && (
            <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px",
              borderRadius:6, background:"rgba(66,133,244,0.12)", color:"#4285F4",
              fontSize:10, fontWeight:700, border:"1px solid rgba(66,133,244,0.25)" }}>Private</span>
          )}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ padding:"10px 12px", border:`1px solid ${border}`,
              borderRadius:10, background:dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize:10, color:muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:12, color:txt, fontWeight:600, wordBreak:"break-all" }}>{String(value)}</div>
            </div>
          ))}
        </div>

        {cluster.status === "pending" && (
          <div style={{ marginTop:16, padding:12, borderRadius:10,
            background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.22)",
            fontSize:12, color:"#f59e0b" }}>
            Awaiting admin approval. Visit the Approvals page to review.
          </div>
        )}
        {cluster.status === "failed" && cluster.error_message && (
          <div style={{ marginTop:16, padding:12, borderRadius:10,
            background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)",
            fontSize:12, color:"#ef4444" }}>
            {cluster.error_message}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GCPKubernetes() {
  const { dark } = useTheme()
  const navigate = useNavigate()

  const [clusters,     setClusters]     = useState([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState("")
  const [search,       setSearch]       = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [detail,       setDetail]       = useState(null)
  const [podCluster,   setPodCluster]   = useState(null)  // {name, location}
  const [showGuide,    setShowGuide]    = useState(false)
  const [lastRefresh,  setLastRefresh]  = useState(null)

  const bg     = dark ? "#070c18"                : "#f0f4f8"
  const card   = dark ? "rgba(255,255,255,0.03)" : "#ffffff"
  const border = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const txt    = dark ? "#e2e8f0"                : "#1e293b"
  const muted  = dark ? "#64748b"                : "#94a3b8"
  const input  = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"
  const GCP    = { blue:"#4285F4", green:"#34A853", yellow:"#FBBC04", red:"#EA4335" }

  const load = () => {
    setLoading(true); setError("")
    listGKEClusters()
      .then(r => { setClusters(r.data || []); setLastRefresh(new Date()) })
      .catch(e => setError(e.response?.data?.detail || "Failed to load GKE clusters"))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const STATUS_TABS = ["all", "pending", "approved", "running", "completed", "failed"]

  const filtered = useMemo(() => clusters.filter(c => {
    const cfg = c.config || {}
    const q   = search.toLowerCase()
    const matchText = !q ||
      (cfg.resource_name || c.resource_name || "").toLowerCase().includes(q) ||
      (cfg.region || "").toLowerCase().includes(q) ||
      (cfg.machine_type || "").toLowerCase().includes(q) ||
      (cfg.environment || "").toLowerCase().includes(q)
    return matchText && (statusFilter === "all" || c.status === statusFilter)
  }), [clusters, search, statusFilter])

  const counts = useMemo(() => {
    const m = {}
    STATUS_TABS.forEach(s => { m[s] = s === "all" ? clusters.length : clusters.filter(c => c.status === s).length })
    return m
  }, [clusters])

  const summaryCards = [
    { label:"Total Clusters",   value:loading?"—":clusters.length,    accent:GCP.blue,  icon:"M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7", sub:"cluster requests" },
    { label:"Running",           value:loading?"—":counts.running||0,  accent:"#22c55e", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",              sub:"provisioned clusters" },
    { label:"Pending Approval",  value:loading?"—":counts.pending||0,  accent:"#f59e0b", icon:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",               sub:"awaiting review" },
    { label:"Failed",            value:loading?"—":counts.failed||0,   accent:GCP.red,   icon:"M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z", sub:"need attention" },
  ]

  return (
    <div style={{ minHeight:"100vh", background:bg, color:txt, fontFamily:"system-ui,sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        .gkerow:hover { background: ${dark?"rgba(255,255,255,0.025)":"rgba(0,0,0,0.025)"} !important; }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ padding:"24px 28px 0", display:"flex", alignItems:"center",
        justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:42, height:42, borderRadius:12,
            background:"linear-gradient(135deg,#4285F4,#34A853)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 14px rgba(66,133,244,0.35)" }}>
            <span style={{ fontSize:9, fontWeight:800, color:"#fff", letterSpacing:"-0.5px" }}>GKE</span>
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:21, fontWeight:800, letterSpacing:"-0.3px" }}>Kubernetes Engine</h1>
            <p style={{ margin:"2px 0 0", fontSize:12, color:muted }}>
              Managed GKE cluster requests
              {lastRefresh && <span style={{ marginLeft:8, color:dark?"#334155":"#cbd5e1" }}>· Updated {lastRefresh.toLocaleTimeString()}</span>}
            </p>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={load} disabled={loading}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9,
              background:card, border:`1px solid ${border}`, color:txt, fontSize:12,
              cursor:"pointer", opacity:loading?0.6:1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation:loading?"spin 0.8s linear infinite":"none" }}>
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button onClick={() => setShowGuide(true)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9,
              background:card, border:`1px solid rgba(66,133,244,0.35)`, color:GCP.blue,
              fontSize:12, fontWeight:700, cursor:"pointer" }}>
            <SvgIcon d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13} color={GCP.blue} />
            How to Create
          </button>
          <button onClick={() => navigate("/approvals")}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9,
              background:card, border:`1px solid ${border}`, color:muted, fontSize:12,
              fontWeight:600, cursor:"pointer" }}>
            <SvgIcon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={13} color={muted} />
            Approvals
          </button>
          <button onClick={() => navigate("/gcp/kubernetes/create")}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9,
              background:"linear-gradient(135deg,#4285F4,#34A853)", border:"none",
              color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer",
              boxShadow:"0 4px 12px rgba(66,133,244,0.35)" }}>
            <SvgIcon d="M12 4v16m8-8H4" size={13} color="#fff" />
            Create GKE Cluster
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{ margin:"16px 28px 0", padding:"14px 18px", borderRadius:12,
          background:"rgba(66,133,244,0.07)", border:"1px solid rgba(66,133,244,0.25)" }}>
          <div style={{ fontSize:13, fontWeight:600, color:GCP.blue, marginBottom:3 }}>Notice</div>
          <div style={{ fontSize:12, color:muted }}>{error}</div>
        </div>
      )}

      {/* ── Summary cards ────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, padding:"20px 28px 0" }}>
        {summaryCards.map(c => (
          <div key={c.label} style={{ background:card, border:`1px solid ${border}`,
            borderRadius:14, padding:"16px 18px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:12, right:14, opacity:0.12 }}>
              <SvgIcon d={c.icon} size={28} color={c.accent} />
            </div>
            <div style={{ fontSize:10, color:muted, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8, fontWeight:600 }}>{c.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:c.accent }}>{c.value}</div>
            <div style={{ fontSize:11, color:muted, marginTop:4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Getting-started banner (only when no clusters yet) ───────────── */}
      {!loading && clusters.length === 0 && (
        <div style={{ margin:"16px 28px 0", padding:"20px 24px", borderRadius:14,
          background: dark ? "rgba(66,133,244,0.05)" : "rgba(66,133,244,0.04)",
          border:`1px solid rgba(66,133,244,0.2)` }}>
          <div style={{ fontSize:14, fontWeight:800, color:GCP.blue, marginBottom:14 }}>
            Getting Started with GKE
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:0, position:"relative" }}>
            {[
              { num:"1", color:"#4285F4", title:"Fill the wizard",    desc:"Click Create GKE Cluster and complete the 4-step form" },
              { num:"2", color:"#FBBC04", title:"Submit request",     desc:"Request is saved as pending — nothing is provisioned yet" },
              { num:"3", color:"#f59e0b", title:"Admin approves",     desc:"Admin reviews and approves from the Approvals page" },
              { num:"4", color:"#a78bfa", title:"Terraform runs",     desc:"Backend generates Terraform and applies it on GCP" },
              { num:"5", color:"#34A853", title:"Cluster is live",    desc:"Connect with kubectl and deploy your workloads" },
            ].map((item, i, arr) => (
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", position:"relative" }}>
                {i < arr.length - 1 && (
                  <div style={{ position:"absolute", top:16, left:"calc(50% + 16px)",
                    right:"calc(-50% + 16px)", height:2,
                    background:`linear-gradient(90deg,${item.color}60,${arr[i+1].color}60)` }} />
                )}
                <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, zIndex:1,
                  background:`${item.color}18`, border:`2px solid ${item.color}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight:800, color:item.color }}>
                  {item.num}
                </div>
                <div style={{ marginTop:10, textAlign:"center", padding:"0 6px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:txt, marginBottom:4 }}>{item.title}</div>
                  <div style={{ fontSize:11, color:muted, lineHeight:1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:20, display:"flex", gap:10, justifyContent:"center" }}>
            <button onClick={() => setShowGuide(true)}
              style={{ padding:"8px 20px", borderRadius:9, border:`1px solid rgba(66,133,244,0.4)`,
                background:"rgba(66,133,244,0.1)", color:GCP.blue, fontSize:12,
                fontWeight:700, cursor:"pointer" }}>
              View Detailed Guide
            </button>
            <button onClick={() => navigate("/gcp/kubernetes/create")}
              style={{ padding:"8px 20px", borderRadius:9,
                background:"linear-gradient(135deg,#4285F4,#34A853)", border:"none",
                color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer",
                boxShadow:"0 4px 12px rgba(66,133,244,0.35)" }}>
              Create First Cluster →
            </button>
          </div>
        </div>
      )}

      {/* ── Main table panel ──────────────────────────────────────────────── */}
      <div style={{ margin:"16px 28px 28px", background:card, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden" }}>

        {/* Toolbar */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${border}`,
          display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:"1 1 220px", minWidth:180 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, region, machine type…"
              style={{ width:"100%", padding:"7px 10px 7px 30px", borderRadius:8, background:input,
                border:`1px solid ${border}`, color:txt, fontSize:12, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {STATUS_TABS.map(s => {
              const sc = STATUS_COLORS[s] || { color:txt }
              const isActive = statusFilter === s
              return (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ padding:"5px 11px", fontSize:11, fontWeight:600, borderRadius:7, cursor:"pointer",
                    background: isActive ? `${sc.color}20` : "transparent",
                    border: isActive ? `1px solid ${sc.color}50` : `1px solid ${border}`,
                    color: isActive ? (s==="all"?txt:sc.color) : muted,
                    transition:"all 0.15s", textTransform:"capitalize" }}>
                  {s} {counts[s] > 0 ? `(${counts[s]})` : ""}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize:11, color:muted, flexShrink:0 }}>
            {filtered.length} / {clusters.length} cluster{clusters.length!==1?"s":""}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding:48, textAlign:"center", color:muted }}>
            <div style={{ width:28, height:28, border:`2px solid ${GCP.blue}`, borderTopColor:"transparent",
              borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 14px" }} />
            <div style={{ fontSize:13 }}>Loading GKE clusters…</div>
          </div>
        ) : filtered.length === 0 && clusters.length > 0 ? (
          <div style={{ padding:48, textAlign:"center" }}>
            <div style={{ fontSize:14, fontWeight:600, color:txt, marginBottom:6 }}>No clusters match your filter</div>
            <div style={{ fontSize:12, color:muted }}>Try adjusting your search or status filter.</div>
          </div>
        ) : clusters.length > 0 ? (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }}>
                  {["Cluster Name","Status","Region","Machine Type","Nodes","Release Channel","Type","Environment","Requested",""].map(h => (
                    <th key={h} style={{ padding:"9px 16px", fontSize:10, fontWeight:700, color:muted,
                      textAlign:"left", borderBottom:`1px solid ${border}`,
                      textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((cluster, idx) => {
                  const cfg = cluster.config || {}
                  const name = cfg.resource_name || cluster.resource_name || `gke-${cluster.id}`
                  const nodeRange = cfg.min_node_count != null
                    ? `${cfg.initial_node_count || cfg.min_node_count} (${cfg.min_node_count}–${cfg.max_node_count})`
                    : (cfg.initial_node_count ?? "—")
                  const createdAt = cluster.created_at
                    ? new Date(cluster.created_at).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" })
                    : "—"
                  return (
                    <tr key={cluster.id || idx} className="gkerow"
                      style={{ borderBottom:`1px solid ${border}`, transition:"background 0.1s", cursor:"pointer" }}
                      onClick={() => setDetail(cluster)}>
                      <td style={{ padding:"12px 16px" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:txt }}>{name}</div>
                        <div style={{ fontSize:10, color:muted, marginTop:2 }}>req #{cluster.id}</div>
                      </td>
                      <td style={{ padding:"12px 16px" }}><StatusBadge status={cluster.status} /></td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:muted, whiteSpace:"nowrap" }}>{cfg.region||"—"}</td>
                      <td style={{ padding:"12px 16px" }}>
                        <code style={{ fontSize:11, color:txt, background:input, padding:"2px 6px", borderRadius:4, whiteSpace:"nowrap" }}>
                          {cfg.machine_type||"—"}
                        </code>
                      </td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:muted, whiteSpace:"nowrap" }}>{nodeRange}</td>
                      <td style={{ padding:"12px 16px" }}><ChannelBadge channel={cfg.release_channel} /></td>
                      <td style={{ padding:"12px 16px" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px",
                          borderRadius:6, fontSize:10, fontWeight:700,
                          background: cfg.regional_cluster ? "rgba(66,133,244,0.10)" : "rgba(52,168,83,0.10)",
                          color: cfg.regional_cluster ? "#4285F4" : "#34A853",
                          border: cfg.regional_cluster ? "1px solid rgba(66,133,244,0.22)" : "1px solid rgba(52,168,83,0.22)" }}>
                          {cfg.regional_cluster ? "Regional" : "Zonal"}
                        </span>
                      </td>
                      <td style={{ padding:"12px 16px" }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:6,
                          background: cfg.environment==="prod" ? "rgba(239,68,68,0.10)" : cfg.environment==="staging" ? "rgba(245,158,11,0.10)" : "rgba(100,116,139,0.10)",
                          color: cfg.environment==="prod" ? "#ef4444" : cfg.environment==="staging" ? "#f59e0b" : muted }}>
                          {cfg.environment||"dev"}
                        </span>
                      </td>
                      <td style={{ padding:"12px 16px", fontSize:11, color:muted, whiteSpace:"nowrap" }}>{createdAt}</td>
                      <td style={{ padding:"12px 16px" }}>
                        <div style={{ display:"flex", gap:"6px" }}>
                          {cluster.status === "completed" && cfg.region && (
                            <button onClick={e => { e.stopPropagation(); setPodCluster({ name: cfg.resource_name || cluster.resource_name, location: cfg.region }) }}
                              style={{ padding:"5px 10px", borderRadius:7, fontSize:11, fontWeight:600, cursor:"pointer",
                                background:"#4285F410", border:`1px solid #4285F440`, color:"#4285F4", whiteSpace:"nowrap" }}>
                              ☸ Pods
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); setDetail(cluster) }}
                            style={{ padding:"6px 12px", borderRadius:8, fontSize:11, fontWeight:600, cursor:"pointer",
                              background:input, border:`1px solid ${border}`, color:txt }}>
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && filtered.length > 0 && (
          <div style={{ padding:"10px 20px", borderTop:`1px solid ${border}`,
            display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:11, color:muted }}>
              Showing {filtered.length} cluster request{filtered.length!==1?"s":""}
            </div>
            <div style={{ display:"flex", gap:16, fontSize:11, color:muted }}>
              {counts.running > 0 && <span style={{ color:"#22c55e", fontWeight:700 }}>{counts.running} running</span>}
              {counts.pending > 0 && <span style={{ color:"#f59e0b", fontWeight:700 }}>{counts.pending} pending</span>}
              {counts.failed  > 0 && <span style={{ color:"#ef4444", fontWeight:700 }}>{counts.failed} failed</span>}
            </div>
          </div>
        )}
      </div>

      {detail    && <ClusterDetailModal cluster={detail} dark={dark} onClose={() => setDetail(null)} />}
      {showGuide && <HowToModal dark={dark} onClose={() => setShowGuide(false)} />}
      {podCluster && (
        <K8sPodManager
          cloud="gke"
          clusterName={podCluster.name}
          location={podCluster.location}
          dark={dark}
          onClose={() => setPodCluster(null)}
        />
      )}
    </div>
  )
}
