import { useState, useEffect } from "react"
import api from "../api/api"

const STATUS_COLOR = {
  Running:   "#00d4aa",
  Pending:   "#f59e0b",
  Failed:    "#f43f5e",
  Succeeded: "#3b82f6",
  Unknown:   "#64748b",
  Evicted:   "#f43f5e",
}

export default function K8sPodManager({ cloud, clusterName, region, location, dark, onClose }) {
  const [namespaces, setNamespaces] = useState([])
  const [selectedNs, setSelectedNs] = useState("default")
  const [pods,       setPods]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [nsLoading,  setNsLoading]  = useState(false)
  const [error,      setError]      = useState("")
  const [logPod,     setLogPod]     = useState(null)
  const [logs,       setLogs]       = useState("")
  const [logLoading, setLogLoading] = useState(false)
  const [tailLines,  setTailLines]  = useState(200)

  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"

  const prefix = cloud === "eks" ? `/k8s/eks/${encodeURIComponent(clusterName)}` : `/k8s/gke/${encodeURIComponent(clusterName)}`
  const qs     = cloud === "eks" ? `region=${region}` : `location=${location}`

  useEffect(() => {
    setNsLoading(true)
    setError("")
    api.get(`${prefix}/namespaces?${qs}`)
      .then(r => {
        const ns = r.data || []
        setNamespaces(ns)
        if      (ns.includes("default"))    setSelectedNs("default")
        else if (ns.includes("kube-system")) setSelectedNs("kube-system")
        else if (ns.length > 0)             setSelectedNs(ns[0])
      })
      .catch(e => setError(e.response?.data?.detail || e.message))
      .finally(() => setNsLoading(false))
  }, [clusterName])

  useEffect(() => {
    if (!selectedNs) return
    fetchPods(selectedNs)
  }, [selectedNs])

  function fetchPods(ns) {
    setLoading(true)
    setError("")
    api.get(`${prefix}/pods?${qs}&namespace=${ns}`)
      .then(r => setPods(r.data || []))
      .catch(e => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false))
  }

  async function fetchLogs(ns, pod) {
    setLogPod({ namespace: ns, name: pod })
    setLogs("")
    setLogLoading(true)
    try {
      const r = await api.get(`${prefix}/pods/${ns}/${pod}/logs?${qs}&tail=${tailLines}`)
      setLogs(r.data.logs || "")
    } catch (e) {
      setLogs(`Error: ${e.response?.data?.detail || e.message}`)
    } finally {
      setLogLoading(false)
    }
  }

  const counts = {
    Running:   pods.filter(p => p.status === "Running").length,
    Pending:   pods.filter(p => p.status === "Pending").length,
    Failed:    pods.filter(p => p.status === "Failed").length,
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:1500, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:"16px", width:"100%", maxWidth:"980px", maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ width:"36px", height:"36px", borderRadius:"9px", background: cloud==="eks" ? "#00d4aa20" : "#4285F420", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px" }}>
              ☸
            </div>
            <div>
              <div style={{ fontSize:"15px", fontWeight:"700", color:text }}>{clusterName}</div>
              <div style={{ fontSize:"11px", color:muted }}>
                <span style={{ background: cloud==="eks"?"#00d4aa20":"#4285F420", color: cloud==="eks"?"#00d4aa":"#4285F4", padding:"1px 7px", borderRadius:"4px", fontWeight:"700", fontSize:"10px", marginRight:"6px" }}>
                  {cloud.toUpperCase()}
                </span>
                {region || location} · Pod Manager
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <button onClick={() => fetchPods(selectedNs)}
              style={{ padding:"6px 12px", borderRadius:"7px", border:`1px solid ${border}`, background:"transparent", color:muted, cursor:"pointer", fontSize:"12px" }}>
              ↻ Refresh
            </button>
            <button onClick={onClose}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:"20px", color:muted, lineHeight:1 }}>✕</button>
          </div>
        </div>

        {/* Namespace bar */}
        <div style={{ padding:"10px 20px", borderBottom:`1px solid ${border}`, display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <label style={{ fontSize:"12px", color:muted }}>Namespace:</label>
            {nsLoading ? (
              <span style={{ fontSize:"12px", color:muted }}>Loading...</span>
            ) : (
              <select value={selectedNs} onChange={e => setSelectedNs(e.target.value)}
                style={{ padding:"5px 10px", border:`1px solid ${border}`, borderRadius:"6px", background:surface, color:text, fontSize:"12px", cursor:"pointer" }}>
                <option value="all">— all namespaces —</option>
                {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
              </select>
            )}
          </div>
          <div style={{ display:"flex", gap:"8px", marginLeft:"auto", flexWrap:"wrap" }}>
            {[["Running", counts.Running, "#00d4aa"], ["Pending", counts.Pending, "#f59e0b"], ["Failed", counts.Failed, "#f43f5e"]].map(([label, count, color]) => (
              <span key={label} style={{ fontSize:"11px", fontWeight:"600", color, background:`${color}18`, padding:"3px 10px", borderRadius:"12px" }}>
                {label}: {count}
              </span>
            ))}
            <span style={{ fontSize:"11px", color:muted, padding:"3px 0" }}>Total: {pods.length}</span>
          </div>
        </div>

        {/* Table area */}
        <div style={{ flex:1, overflow:"auto" }}>
          {error && (
            <div style={{ margin:"16px 20px", padding:"10px 14px", background:"#f43f5e15", border:"1px solid #f43f5e30", borderRadius:"8px", color:"#f43f5e", fontSize:"12px" }}>
              ✗ {error}
            </div>
          )}

          {loading ? (
            <div style={{ padding:"56px", textAlign:"center", color:muted }}>
              <div style={{ fontSize:"28px", marginBottom:"10px" }}>⏳</div>
              <div style={{ fontSize:"13px" }}>Fetching pods from cluster...</div>
            </div>
          ) : pods.length === 0 && !error ? (
            <div style={{ padding:"56px", textAlign:"center" }}>
              <div style={{ fontSize:"36px", marginBottom:"12px" }}>📦</div>
              <div style={{ fontSize:"14px", fontWeight:"600", color:text, marginBottom:"6px" }}>No pods found</div>
              <div style={{ fontSize:"12px", color:muted }}>Namespace: <strong>{selectedNs}</strong></div>
            </div>
          ) : pods.length > 0 ? (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", position:"sticky", top:0, zIndex:1 }}>
                  {["Pod Name", "Namespace", "Status", "Ready", "Restarts", "Node", "Age", ""].map(h => (
                    <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:"10px", fontWeight:"700", color:muted, textTransform:"uppercase", letterSpacing:"0.06em", background:subtle, borderBottom:`1px solid ${border}`, whiteSpace:"nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pods.map((pod, i) => {
                  const dotColor = STATUS_COLOR[pod.status] || "#64748b"
                  const age = pod.start_time ? _relativeAge(pod.start_time) : "—"
                  return (
                    <tr key={i} style={{ borderBottom:`1px solid ${border}`, background: i % 2 === 0 ? surface : subtle, transition:"background 0.1s" }}>
                      <td style={{ padding:"9px 14px", fontSize:"12px", fontFamily:"'Courier New', monospace", color:text, maxWidth:"200px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={pod.name}>
                        {pod.name}
                      </td>
                      <td style={{ padding:"9px 14px", fontSize:"11px", color:muted }}>
                        {pod.namespace}
                      </td>
                      <td style={{ padding:"9px 14px" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:"5px", fontSize:"12px", fontWeight:"600", color:dotColor }}>
                          <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:dotColor, flexShrink:0 }} />
                          {pod.status}
                        </span>
                      </td>
                      <td style={{ padding:"9px 14px", fontSize:"12px", color:text }}>{pod.ready}</td>
                      <td style={{ padding:"9px 14px", fontSize:"12px", fontWeight: pod.restarts > 5 ? "700" : "400", color: pod.restarts > 5 ? "#f43f5e" : pod.restarts > 0 ? "#f59e0b" : muted }}>
                        {pod.restarts}
                      </td>
                      <td style={{ padding:"9px 14px", fontSize:"11px", color:muted, maxWidth:"120px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={pod.node}>
                        {pod.node || "—"}
                      </td>
                      <td style={{ padding:"9px 14px", fontSize:"11px", color:muted, whiteSpace:"nowrap" }}>
                        {age}
                      </td>
                      <td style={{ padding:"7px 14px" }}>
                        <button onClick={() => fetchLogs(pod.namespace, pod.name)}
                          style={{ padding:"4px 10px", borderRadius:"5px", border:`1px solid #3b82f640`, background:"#3b82f610", color:"#3b82f6", cursor:"pointer", fontSize:"11px", fontWeight:"600", whiteSpace:"nowrap" }}>
                          Logs
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      {/* Log viewer overlay */}
      {logPod && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1600, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
          <div style={{ background: dark ? "#020817" : "#1e1e2e", border:`1px solid ${border}`, borderRadius:"14px", width:"100%", maxWidth:"860px", maxHeight:"88vh", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"13px 18px", borderBottom:`1px solid rgba(255,255,255,0.08)`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <div>
                <div style={{ fontSize:"13px", fontWeight:"600", color:"#e2e8f0", fontFamily:"monospace" }}>{logPod.name}</div>
                <div style={{ fontSize:"11px", color:"#64748b" }}>namespace: {logPod.namespace}</div>
              </div>
              <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                <select value={tailLines} onChange={e => { setTailLines(+e.target.value); fetchLogs(logPod.namespace, logPod.name) }}
                  style={{ padding:"4px 8px", border:`1px solid rgba(255,255,255,0.12)`, borderRadius:"5px", background:"rgba(255,255,255,0.05)", color:"#94a3b8", fontSize:"11px", cursor:"pointer" }}>
                  {[50, 100, 200, 500, 1000].map(n => <option key={n} value={n}>{n} lines</option>)}
                </select>
                <button onClick={() => fetchLogs(logPod.namespace, logPod.name)}
                  style={{ padding:"4px 10px", borderRadius:"5px", border:`1px solid rgba(255,255,255,0.1)`, background:"rgba(255,255,255,0.05)", color:"#94a3b8", cursor:"pointer", fontSize:"11px" }}>
                  ↻
                </button>
                <button onClick={() => setLogPod(null)}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:"18px", color:"#64748b" }}>✕</button>
              </div>
            </div>
            <div style={{ flex:1, overflow:"auto", padding:"14px 18px" }}>
              {logLoading ? (
                <div style={{ color:"#64748b", textAlign:"center", padding:"28px", fontSize:"13px" }}>Loading logs...</div>
              ) : (
                <pre style={{ margin:0, fontSize:"12px", fontFamily:"'Courier New', monospace", color:"#e2e8f0", whiteSpace:"pre-wrap", wordBreak:"break-word", lineHeight:"1.7" }}>
                  {logs || "(no log output)"}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function _relativeAge(isoTime) {
  if (!isoTime) return "—"
  const diff = (Date.now() - new Date(isoTime).getTime()) / 1000
  if (diff < 60)    return `${Math.floor(diff)}s`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}
