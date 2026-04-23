import { useEffect, useState, useCallback, useRef } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import {
  listVMs, getCostOverview, listAzureVMs, azureHealth,
  listGCPInstances, gcpHealth, getGCPCost, listRequests, getAzureCostByRG
} from "../api/api"
import { useTheme } from "../context/ThemeContext"
import { useNavigate } from "react-router-dom"

const CLOUD_COLORS  = { aws: "#f59e0b", azure: "#0078D4", gcp: "#4285f4" }
const CLOUD_ACCENTS = { aws: "#00d4aa", azure: "#50e6ff", gcp: "#34A853" }
const STATUS_COLORS = {
  completed:    "#00d4aa",
  failed:       "#f43f5e",
  provisioning: "#a78bfa",
  pending:      "#f59e0b",
  approved:     "#3b82f6",
  rejected:     "#f43f5e",
}

const KEYFRAMES = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes shimmer {
  0%   { background-position: -700px 0; }
  100% { background-position:  700px 0; }
}
@keyframes spin {
  from { transform: rotate(0deg);   }
  to   { transform: rotate(360deg); }
}
@keyframes glowPulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1;   }
}
`

function timeAgo(dateStr) {
  if (!dateStr) return ""
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function detectCloud(resourceType) {
  const t = (resourceType || "").toLowerCase()
  if (t.startsWith("gcp_") || t.includes("gcp"))   return "gcp"
  if (t.startsWith("azure_") || t.includes("azure")) return "azure"
  return "aws"
}

function Skeleton({ w = "100%", h = "18px", r = "8px", dark }) {
  const base  = dark ? "#1e293b" : "#e2e8f0"
  const shine = dark ? "#263347" : "#f1f5f9"
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: `linear-gradient(90deg, ${base} 25%, ${shine} 50%, ${base} 75%)`,
      backgroundSize: "700px 100%",
      animation: "shimmer 1.4s infinite linear",
    }} />
  )
}

function CloudBadge({ cloud, small }) {
  const labels = { aws: "AWS", azure: "AZ", gcp: "GCP" }
  const bgs    = {
    aws:   "#f59e0b",
    azure: "linear-gradient(135deg,#0078D4,#50e6ff)",
    gcp:   "linear-gradient(135deg,#4285f4,#34A853)",
  }
  const size = small ? 20 : 26
  return (
    <div style={{
      width: size, height: size, borderRadius: small ? 4 : 6,
      background: bgs[cloud], display: "inline-flex",
      alignItems: "center", justifyContent: "center",
      fontSize: small ? 8 : 10, fontWeight: 800, color: "#fff",
      letterSpacing: "-0.3px", flexShrink: 0,
    }}>
      {labels[cloud] || cloud.toUpperCase()}
    </div>
  )
}

function StatusBadge({ status, surface, border }) {
  const color = STATUS_COLORS[status] ?? "#64748b"
  return (
    <span style={{
      background: `${color}18`, color, border: `1px solid ${color}40`,
      borderRadius: "6px", padding: "2px 8px",
      fontSize: "10px", fontWeight: 700, textTransform: "capitalize", letterSpacing: "0.04em",
    }}>
      {status}
    </span>
  )
}

export default function MultiCloudDashboard() {
  const { dark }   = useTheme()
  const navigate   = useNavigate()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#111827" : "#f8fafc"

  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const [awsVMs,      setAwsVMs]      = useState([])
  const [awsCost,     setAwsCost]     = useState(null)
  const [azureVMs,    setAzureVMs]    = useState([])
  const [azureCostRG, setAzureCostRG] = useState([])
  const [azureUp,     setAzureUp]     = useState(null)
  const [gcpInstances,setGcpInstances]= useState([])
  const [gcpCost,     setGcpCost]     = useState(null)
  const [gcpUp,       setGcpUp]       = useState(null)
  const [requests,    setRequests]    = useState([])

  const intervalRef = useRef(null)

  const fetchAll = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const [
        awsVMsRes, awsCostRes,
        azureVMsRes, azureHealthRes, azureCostRes,
        gcpRes, gcpHealthRes, gcpCostRes,
        reqRes,
      ] = await Promise.allSettled([
        listVMs(),
        getCostOverview(),
        listAzureVMs(),
        azureHealth(),
        getAzureCostByRG(),
        listGCPInstances(),
        gcpHealth(),
        getGCPCost(),
        listRequests(),
      ])

      const toArr = (v) => Array.isArray(v) ? v : (Array.isArray(v?.vms) ? v.vms : Array.isArray(v?.instances) ? v.instances : [])

      if (awsVMsRes.status      === "fulfilled") setAwsVMs(toArr(awsVMsRes.value?.data))
      if (awsCostRes.status     === "fulfilled") setAwsCost(awsCostRes.value?.data ?? null)
      if (azureVMsRes.status    === "fulfilled") setAzureVMs(toArr(azureVMsRes.value?.data))
      setAzureUp(azureHealthRes.status === "fulfilled")
      if (azureCostRes.status   === "fulfilled") {
        const raw = azureCostRes.value?.data
        setAzureCostRG(Array.isArray(raw) ? raw : (raw?.resource_groups ?? []))
      }
      if (gcpRes.status         === "fulfilled") setGcpInstances(toArr(gcpRes.value?.data))
      setGcpUp(gcpHealthRes.status === "fulfilled")
      if (gcpCostRes.status     === "fulfilled") setGcpCost(gcpCostRes.value?.data ?? null)
      if (reqRes.status         === "fulfilled") {
        const data = reqRes.value?.data
        setRequests(Array.isArray(data) ? data : [])
      }

      setLastUpdated(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(() => fetchAll(), 30000)
    return () => clearInterval(intervalRef.current)
  }, [fetchAll])

  const awsRunning   = (awsVMs   || []).filter(v => v.state === "running").length
  const azureRunning = (azureVMs || []).filter(v => ["running","VM running"].includes(v.state)).length
  const gcpRunning   = (gcpInstances || []).filter(i => i.status === "RUNNING").length
  const totalRunning = awsRunning + azureRunning + gcpRunning

  const awsMtd    = awsCost?.mtd_total   ?? awsCost?.total_30d ?? null
  const azureMtd  = azureCostRG.length > 0
    ? azureCostRG.reduce((s, rg) => s + (parseFloat(rg.cost ?? rg.total_cost ?? 0)), 0)
    : null
  const gcpMtd    = gcpCost?.total_cost  ?? gcpCost?.mtd_total ?? null

  const pendingReqs = requests.filter(r => r.status === "pending")

  const costChartData = [
    { name: "AWS",   cost: awsMtd   ?? 0, color: CLOUD_COLORS.aws   },
    { name: "Azure", cost: azureMtd ?? 0, color: CLOUD_COLORS.azure  },
    { name: "GCP",   cost: gcpMtd   ?? 0, color: CLOUD_COLORS.gcp   },
  ]

  const gcpProjects = [...new Set((gcpInstances || []).map(i => i.project).filter(Boolean))].length

  function fmtCost(val) {
    if (val === null || val === undefined) return "–"
    return `$${Number(val).toFixed(2)}`
  }

  const CustomBarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: surface, border: `1px solid ${border}`,
        borderRadius: "10px", padding: "10px 14px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}>
        <div style={{ fontSize: "11px", color: muted, marginBottom: "3px" }}>{label}</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: text }}>
          ${Number(payload[0]?.value ?? 0).toFixed(2)}
        </div>
        <div style={{ fontSize: "10px", color: muted, marginTop: "2px" }}>MTD spend</div>
      </div>
    )
  }

  const CLOUD_CARDS = [
    {
      key:      "aws",
      name:     "Amazon Web Services",
      subtitle: "Connected — ap-south-1",
      color:    CLOUD_COLORS.aws,
      accent:   CLOUD_ACCENTS.aws,
      logoBg:   "#f59e0b",
      logoText: "AWS",
      connected: true,
      path:     "/compute",
      metrics: [
        { label: "VMs Running", value: loading ? null : awsRunning },
        { label: "Services",    value: loading ? null : "EC2/S3/EKS" },
        { label: "MTD Spend",   value: loading ? null : fmtCost(awsMtd) },
      ],
      actions: [
        { label: "Compute",  path: "/compute" },
        { label: "Storage",  path: "/storage" },
        { label: "EKS",      path: "/eks" },
        { label: "Cost",     path: "/cost" },
      ],
    },
    {
      key:      "azure",
      name:     "Microsoft Azure",
      subtitle: "Hub-and-Spoke — 3 subscriptions",
      color:    CLOUD_COLORS.azure,
      accent:   CLOUD_ACCENTS.azure,
      logoBg:   "linear-gradient(135deg,#0078D4,#50e6ff)",
      logoText: "AZ",
      connected: azureUp !== false,
      path:     "/azure",
      metrics: [
        { label: "VMs Running",      value: loading ? null : (azureUp === false ? "–" : azureRunning) },
        { label: "Resource Groups",  value: loading ? null : (azureCostRG.length > 0 ? azureCostRG.length : "–") },
        { label: "MTD Spend",        value: loading ? null : fmtCost(azureMtd) },
      ],
      actions: [
        { label: "Compute",  path: "/azure/compute" },
        { label: "Storage",  path: "/azure/storage" },
        { label: "Network",  path: "/azure/network" },
        { label: "Cost",     path: "/azure/cost" },
      ],
    },
    {
      key:      "gcp",
      name:     "Google Cloud Platform",
      subtitle: "Compute Engine ready",
      color:    CLOUD_COLORS.gcp,
      accent:   CLOUD_ACCENTS.gcp,
      logoBg:   "linear-gradient(135deg,#4285f4,#34A853)",
      logoText: "GCP",
      connected: gcpUp !== false,
      path:     "/gcp",
      metrics: [
        { label: "Instances", value: loading ? null : (gcpUp === false ? "–" : gcpRunning) },
        { label: "Projects",  value: loading ? null : (gcpProjects > 0 ? gcpProjects : "–") },
        { label: "MTD Spend", value: loading ? null : fmtCost(gcpMtd) },
      ],
      actions: [
        { label: "Compute",  path: "/gcp/compute" },
        { label: "Storage",  path: "/gcp/storage" },
        { label: "Network",  path: "/gcp/network" },
        { label: "Cost",     path: "/gcp/cost" },
      ],
    },
  ]

  return (
    <div style={{ padding: "28px", background: bg, minHeight: "100vh", transition: "background 0.3s, color 0.3s" }}>
      <style>{KEYFRAMES}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #f59e0b 0%, #0078D4 50%, #4285f4 100%)", zIndex: 1000 }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "300px", background: dark ? "linear-gradient(135deg, #f59e0b06 0%, #0078D406 50%, #4285f406 100%)" : "linear-gradient(135deg, #f59e0b04 0%, #0078D404 50%, #4285f404 100%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── Page Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", animation: "fadeUp 0.5s ease both" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "linear-gradient(135deg, #f59e0b, #0078D4, #4285f4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                ☁
              </div>
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "800", color: text, margin: 0, letterSpacing: "-0.5px" }}>
                  Cloud Command Center
                </h1>
                <p style={{ fontSize: "13px", color: muted, margin: 0, marginTop: "2px" }}>
                  Unified visibility across AWS, Azure &amp; Google Cloud
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                background: surface, border: `1px solid ${border}`,
                borderRadius: "10px", padding: "9px 16px",
                color: text, fontSize: "13px", fontWeight: "500",
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.75 : 1, transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.borderColor = "#00d4aa60"; e.currentTarget.style.boxShadow = "0 0 0 1px #00d4aa20" } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.boxShadow = "none" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={refreshing ? "#00d4aa" : muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>
                <path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {lastUpdated && (
              <span style={{ fontSize: "11px", color: muted }}>Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        {/* ── Top Metric Strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px", animation: "fadeUp 0.5s ease 80ms both" }}>

          {/* Total Running Resources */}
          <div
            style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px", padding: "18px 20px", position: "relative", overflow: "hidden", cursor: "default", transition: "transform 0.18s ease, box-shadow 0.18s ease" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px #00d4aa18" }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #00d4aa60, #00d4aa)" }} />
            <div style={{ fontSize: "11px", fontWeight: "600", color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Total Running Resources</div>
            {loading
              ? <Skeleton w="50%" h="30px" r="6px" dark={dark} />
              : <div style={{ fontSize: "28px", fontWeight: "800", color: text, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{totalRunning}</div>
            }
            {!loading && (
              <div style={{ fontSize: "11px", color: muted, marginTop: "6px" }}>
                AWS {awsRunning} · AZ {azureRunning} · GCP {gcpRunning}
              </div>
            )}
          </div>

          {/* AWS MTD Cost */}
          <div
            style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px", padding: "18px 20px", position: "relative", overflow: "hidden", cursor: "pointer", transition: "transform 0.18s ease, box-shadow 0.18s ease" }}
            onClick={() => navigate("/cost")}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${CLOUD_COLORS.aws}22` }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, ${CLOUD_COLORS.aws}60, ${CLOUD_COLORS.aws})` }} />
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <CloudBadge cloud="aws" small />
              <span style={{ fontSize: "11px", fontWeight: "600", color: muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>AWS MTD Cost</span>
            </div>
            {loading
              ? <Skeleton w="55%" h="30px" r="6px" dark={dark} />
              : <div style={{ fontSize: "28px", fontWeight: "800", color: text, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{fmtCost(awsMtd)}</div>
            }
            {!loading && <div style={{ fontSize: "11px", color: muted, marginTop: "6px" }}>Month-to-date · USD</div>}
          </div>

          {/* Azure / GCP Cost */}
          <div
            style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px", padding: "18px 20px", position: "relative", overflow: "hidden", cursor: "pointer", transition: "transform 0.18s ease, box-shadow 0.18s ease" }}
            onClick={() => navigate("/azure/cost")}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${CLOUD_COLORS.azure}22` }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, ${CLOUD_COLORS.azure}60, ${CLOUD_COLORS.azure})` }} />
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <CloudBadge cloud="azure" small />
              <span style={{ fontSize: "11px", fontWeight: "600", color: muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Azure MTD Cost</span>
            </div>
            {loading
              ? <Skeleton w="55%" h="30px" r="6px" dark={dark} />
              : <div style={{ fontSize: "28px", fontWeight: "800", color: text, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{fmtCost(azureMtd)}</div>
            }
            {!loading && <div style={{ fontSize: "11px", color: muted, marginTop: "6px" }}>{azureUp === false ? "API unavailable" : "Month-to-date · USD"}</div>}
          </div>

          {/* Pending Approvals */}
          <div
            style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px", padding: "18px 20px", position: "relative", overflow: "hidden", cursor: "pointer", transition: "transform 0.18s ease, box-shadow 0.18s ease" }}
            onClick={() => navigate("/approvals")}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${STATUS_COLORS.pending}22` }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, ${STATUS_COLORS.pending}60, ${STATUS_COLORS.pending})` }} />
            <div style={{ fontSize: "11px", fontWeight: "600", color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Pending Approvals</div>
            {loading
              ? <Skeleton w="40%" h="30px" r="6px" dark={dark} />
              : (
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: pendingReqs.length > 0 ? STATUS_COLORS.pending : text, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{pendingReqs.length}</div>
                  {pendingReqs.length > 0 && (
                    <div style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "5px", background: `${STATUS_COLORS.pending}18`, color: STATUS_COLORS.pending, fontWeight: 700, animation: "glowPulse 2s ease-in-out infinite" }}>ACTION</div>
                  )}
                </div>
              )
            }
            {!loading && <div style={{ fontSize: "11px", color: muted, marginTop: "6px" }}>{requests.length} total requests</div>}
          </div>
        </div>

        {/* ── Three Cloud Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "24px", animation: "fadeUp 0.5s ease 160ms both" }}>
          {CLOUD_CARDS.map((card, ci) => (
            <div
              key={card.key}
              onClick={() => navigate(card.path)}
              style={{
                background: surface,
                border: `1px solid ${card.color}40`,
                borderRadius: "16px",
                padding: "22px",
                cursor: "pointer",
                boxShadow: `0 0 0 1px ${card.color}12, 0 4px 24px ${card.color}0a`,
                transition: "transform 0.18s ease, box-shadow 0.18s ease",
                animation: `fadeUp 0.5s ease ${160 + ci * 80}ms both`,
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-3px)"
                e.currentTarget.style.boxShadow = `0 0 0 1px ${card.color}30, 0 12px 40px ${card.color}20`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = `0 0 0 1px ${card.color}12, 0 4px 24px ${card.color}0a`
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, ${card.color}80, ${card.color})` }} />
              <div style={{ position: "absolute", bottom: 0, right: 0, width: "120px", height: "120px", borderRadius: "50%", background: `radial-gradient(circle, ${card.color}08 0%, transparent 70%)`, pointerEvents: "none" }} />

              {/* Card Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "12px",
                    background: card.logoBg, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: "13px", fontWeight: "800", color: "#fff", letterSpacing: "-0.3px",
                    boxShadow: `0 4px 12px ${card.color}40`,
                  }}>
                    {card.logoText}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: text }}>{card.name}</div>
                    <div style={{ fontSize: "11px", color: muted, marginTop: "2px" }}>{card.subtitle}</div>
                  </div>
                </div>
                <span style={{
                  background: card.connected ? `${card.accent}18` : "#f43f5e18",
                  color: card.connected ? card.accent : "#f43f5e",
                  border: `1px solid ${card.connected ? card.accent : "#f43f5e"}40`,
                  borderRadius: "6px", padding: "3px 9px",
                  fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
                }}>
                  {card.connected ? "CONNECTED" : "LIMITED"}
                </span>
              </div>

              {/* Metrics Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "18px" }}>
                {card.metrics.map(m => (
                  <div key={m.label} style={{ background: dark ? "#ffffff06" : "#00000004", borderRadius: "10px", padding: "10px 12px" }}>
                    <div style={{ fontSize: "10px", color: muted, marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</div>
                    {loading
                      ? <Skeleton w="60%" h="20px" r="4px" dark={dark} />
                      : <div style={{ fontSize: "16px", fontWeight: "700", color: card.accent }}>{m.value ?? "–"}</div>
                    }
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                onClick={e => e.stopPropagation()}>
                {card.actions.map(a => (
                  <button
                    key={a.path}
                    onClick={() => navigate(a.path)}
                    style={{
                      flex: "1 1 auto",
                      background: `${card.color}12`,
                      border: `1px solid ${card.color}30`,
                      borderRadius: "8px", padding: "6px 10px",
                      fontSize: "11px", fontWeight: "600",
                      color: card.color, cursor: "pointer",
                      transition: "background 0.15s ease, border-color 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${card.color}22`; e.currentTarget.style.borderColor = `${card.color}55` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${card.color}12`; e.currentTarget.style.borderColor = `${card.color}30` }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Two-Column Row: Pending Actions + Cost Chart ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px", animation: "fadeUp 0.5s ease 400ms both" }}>

          {/* Pending Actions Panel */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px", padding: "22px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: text }}>Pending Actions</div>
                <div style={{ fontSize: "12px", color: muted, marginTop: "2px" }}>Requests awaiting your review</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {!loading && pendingReqs.length > 0 && (
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "6px",
                    background: `${STATUS_COLORS.pending}18`, color: STATUS_COLORS.pending,
                    border: `1px solid ${STATUS_COLORS.pending}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: 800,
                  }}>
                    {pendingReqs.length}
                  </div>
                )}
                <button
                  onClick={() => navigate("/approvals")}
                  style={{
                    background: "none", border: `1px solid ${border}`, borderRadius: "8px",
                    padding: "5px 12px", fontSize: "12px", fontWeight: 600,
                    color: text, cursor: "pointer", transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f680"; e.currentTarget.style.color = "#3b82f6" }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = text }}
                >
                  View All →
                </button>
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", minHeight: "200px" }}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <Skeleton w="32px" h="32px" r="8px" dark={dark} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
                      <Skeleton w="60%" h="12px" dark={dark} />
                      <Skeleton w="40%" h="10px" dark={dark} />
                    </div>
                    <Skeleton w="64px" h="24px" r="6px" dark={dark} />
                  </div>
                ))
              ) : pendingReqs.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: muted, fontSize: "13px" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>✓</div>
                  No pending requests
                </div>
              ) : (
                pendingReqs.slice(0, 6).map((req, i) => {
                  const cloud = detectCloud(req.resource_type)
                  return (
                    <div
                      key={req.id ?? i}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 12px", borderRadius: "10px",
                        background: dark ? "#ffffff04" : "#00000003",
                        border: `1px solid ${border}`,
                        transition: "background 0.15s ease",
                        animation: `fadeUp 0.4s ease ${i * 60}ms both`,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? "#ffffff08" : "#00000006"}
                      onMouseLeave={e => e.currentTarget.style.background = dark ? "#ffffff04" : "#00000003"}
                    >
                      <CloudBadge cloud={cloud} small />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {req.resource_name || req.resource_type || "Resource"}
                        </div>
                        <div style={{ fontSize: "11px", color: muted, marginTop: "2px" }}>
                          {req.requested_by || req.user || "Unknown"} · {timeAgo(req.created_at)}
                        </div>
                      </div>
                      <button
                        onClick={() => navigate("/approvals")}
                        style={{
                          background: "#3b82f618", border: "1px solid #3b82f640",
                          borderRadius: "7px", padding: "4px 10px",
                          fontSize: "11px", fontWeight: 700, color: "#3b82f6",
                          cursor: "pointer", flexShrink: 0, transition: "all 0.15s ease",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#3b82f628" }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#3b82f618" }}
                      >
                        Review
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Cost by Cloud Chart */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px", padding: "22px", display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700", color: text }}>Cost by Cloud</div>
              <div style={{ fontSize: "12px", color: muted, marginTop: "2px" }}>Month-to-date spend comparison</div>
            </div>

            {loading ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px", justifyContent: "center" }}>
                <Skeleton h="36px" r="6px" dark={dark} />
                <Skeleton h="36px" w="70%" r="6px" dark={dark} />
                <Skeleton h="36px" w="40%" r="6px" dark={dark} />
              </div>
            ) : (
              <>
                <div style={{ flex: 1, minHeight: "160px" }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={costChartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                      <XAxis type="number" tickFormatter={v => `$${v}`} tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: text, fontWeight: 600 }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<CustomBarTooltip />} cursor={{ fill: dark ? "#ffffff06" : "#00000004" }} />
                      <Bar dataKey="cost" radius={[0, 6, 6, 0]} maxBarSize={32}>
                        {costChartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  {costChartData.map(d => (
                    <div key={d.name} style={{ flex: 1, background: dark ? "#ffffff05" : "#00000003", borderRadius: "10px", padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginBottom: "4px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: d.color }} />
                        <span style={{ fontSize: "11px", color: muted, fontWeight: 600 }}>{d.name}</span>
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: d.color }}>
                        {d.cost > 0 ? `$${d.cost.toFixed(2)}` : "–"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Recent Deployments ── */}
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px", padding: "22px", animation: "fadeUp 0.5s ease 560ms both" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: text }}>Recent Deployments</div>
              <div style={{ fontSize: "12px", color: muted, marginTop: "2px" }}>Latest infrastructure activity across all clouds</div>
            </div>
            <button
              onClick={() => navigate("/requests")}
              style={{
                background: "none", border: `1px solid ${border}`, borderRadius: "8px",
                padding: "5px 12px", fontSize: "12px", fontWeight: 600,
                color: text, cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#00d4aa60"; e.currentTarget.style.color = "#00d4aa" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = text }}
            >
              View All →
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <Skeleton w="28px" h="28px" r="6px" dark={dark} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
                    <Skeleton w="45%" h="12px" dark={dark} />
                    <Skeleton w="28%" h="10px" dark={dark} />
                  </div>
                  <Skeleton w="72px" h="22px" r="6px" dark={dark} />
                  <Skeleton w="52px" h="10px" r="4px" dark={dark} />
                </div>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px", color: muted, fontSize: "13px" }}>
              No recent deployments
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {requests.slice(0, 10).map((req, i) => {
                const cloud = detectCloud(req.resource_type)
                const statusColor = STATUS_COLORS[req.status] ?? muted
                return (
                  <div
                    key={req.id ?? i}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 12px", borderRadius: "10px",
                      borderLeft: `3px solid ${statusColor}`,
                      transition: "background 0.15s ease",
                      animation: `fadeUp 0.4s ease ${i * 40}ms both`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = dark ? "#1e293b40" : "#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <CloudBadge cloud={cloud} small />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {req.resource_name || req.resource_type || "Resource"}
                      </div>
                      <div style={{ fontSize: "11px", color: muted, marginTop: "2px", display: "flex", alignItems: "center", gap: "5px" }}>
                        <span>{req.resource_type}</span>
                        {req.requested_by && <><span>·</span><span>{req.requested_by}</span></>}
                      </div>
                    </div>

                    <StatusBadge status={req.status} />

                    <div style={{ fontSize: "11px", color: muted, flexShrink: 0, minWidth: "52px", textAlign: "right" }}>
                      {timeAgo(req.created_at)}
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
