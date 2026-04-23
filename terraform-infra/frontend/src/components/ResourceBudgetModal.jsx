import { useState, useEffect } from "react"
import { getVMBudgetByRes, createVMBudget, updateVMBudget, deleteVMBudget } from "../api/api"

const THRESHOLD_COLOR = { 50: "#3b82f6", 70: "#f59e0b", 90: "#f97316", 100: "#ef4444" }

export default function ResourceBudgetModal({ resource, onClose }) {
  // resource = { vm_id, vm_name, cloud, region, instance_type }
  const [existing,  setExisting]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [error,     setError]     = useState("")
  const [success,   setSuccess]   = useState("")

  const [form, setForm] = useState({
    monthly_budget: 100,
    alert_50: true, alert_70: true, alert_90: true,
    action_100: "notify",
    notify_emails: "",
  })

  useEffect(() => {
    getVMBudgetByRes(resource.vm_id)
      .then(r => {
        setExisting(r.data)
        setForm({
          monthly_budget: r.data.monthly_budget,
          alert_50: r.data.alert_50,
          alert_70: r.data.alert_70,
          alert_90: r.data.alert_90,
          action_100: r.data.action_100,
          notify_emails: r.data.notify_emails || "",
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [resource.vm_id])

  async function handleSave() {
    if (!form.monthly_budget || form.monthly_budget <= 0) {
      setError("Please enter a valid monthly budget amount")
      return
    }
    setSaving(true); setError("")
    try {
      const payload = {
        vm_id:          resource.vm_id,
        vm_name:        resource.vm_name,
        cloud:          resource.cloud,
        region:         resource.region || "",
        instance_type:  resource.instance_type || "",
        monthly_budget: parseFloat(form.monthly_budget),
        alert_50:       form.alert_50,
        alert_70:       form.alert_70,
        alert_90:       form.alert_90,
        action_100:     form.action_100,
        notify_emails:  form.notify_emails,
      }
      if (existing) await updateVMBudget(existing.id, payload)
      else          await createVMBudget(payload)
      setSuccess(existing ? "Budget updated!" : "Budget set!")
      setTimeout(() => onClose(true), 1200)
    } catch (e) {
      setError(e.response?.data?.detail || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    setDeleting(true)
    try {
      await deleteVMBudget(existing.id)
      onClose(true)
    } catch (e) {
      setError(e.response?.data?.detail || "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  const CLOUD_COLOR = { aws: "#FF9900", gcp: "#4285F4", azure: "#0078D4" }
  const cc = CLOUD_COLOR[resource.cloud] || "#00d4aa"

  const pct = existing
    ? Math.min(((existing.monthly_budget > 0 ? 1 : 0) * 0), 100)
    : 0

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:3000, padding:16 }}>
      <div style={{ background:"#0f1629", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, width:"100%", maxWidth:460, boxShadow:"0 24px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <span style={{ fontSize:16 }}>💰</span>
              <span style={{ fontSize:16, fontWeight:700, color:"#e2e8f0" }}>Resource Budget</span>
              <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background: cc+"20", color:cc, border:`1px solid ${cc}40`, textTransform:"uppercase" }}>
                {resource.cloud}
              </span>
            </div>
            <div style={{ fontSize:12, color:"#64748b" }}>
              <span style={{ color:"#94a3b8", fontWeight:600 }}>{resource.vm_name}</span>
              {resource.region && <span> · {resource.region}</span>}
              {resource.instance_type && <span> · {resource.instance_type}</span>}
            </div>
          </div>
          <button onClick={() => onClose(false)} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"5px 8px", color:"#94a3b8", cursor:"pointer", fontSize:14 }}>✕</button>
        </div>

        <div style={{ padding:"20px 24px 24px" }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:"24px", color:"#64748b", fontSize:13 }}>Loading...</div>
          ) : (
            <>
              {existing && (
                <div style={{ background:"rgba(0,212,170,0.08)", border:"1px solid rgba(0,212,170,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:18, fontSize:12, color:"#00d4aa" }}>
                  Budget already set — editing existing budget
                </div>
              )}

              {/* Monthly limit */}
              <div style={{ marginBottom:18 }}>
                <label style={{ fontSize:11, fontWeight:600, color:"#64748b", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                  Monthly Budget (USD $)
                </label>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#00d4aa", fontWeight:700, fontSize:15 }}>$</span>
                  <input
                    type="number" min={1} step={10}
                    value={form.monthly_budget}
                    onChange={e => setForm(f => ({ ...f, monthly_budget: e.target.value }))}
                    style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"10px 12px 10px 28px", fontSize:15, fontWeight:700, color:"#e2e8f0", outline:"none" }}
                  />
                </div>
              </div>

              {/* Alert thresholds */}
              <div style={{ marginBottom:18 }}>
                <label style={{ fontSize:11, fontWeight:600, color:"#64748b", display:"block", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                  Email Alerts at
                </label>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { key:"alert_50", pct:50 },
                    { key:"alert_70", pct:70 },
                    { key:"alert_90", pct:90 },
                  ].map(({ key, pct }) => (
                    <button key={key} onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                      style={{
                        flex:1, padding:"8px 4px", borderRadius:9, cursor:"pointer", fontSize:12, fontWeight:700,
                        border:`1px solid ${form[key] ? THRESHOLD_COLOR[pct]+"60" : "rgba(255,255,255,0.08)"}`,
                        background: form[key] ? THRESHOLD_COLOR[pct]+"15" : "rgba(255,255,255,0.03)",
                        color: form[key] ? THRESHOLD_COLOR[pct] : "#475569",
                        transition:"all 0.15s",
                      }}>
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Action at 100% */}
              <div style={{ marginBottom:18 }}>
                <label style={{ fontSize:11, fontWeight:600, color:"#64748b", display:"block", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                  At 100% Budget
                </label>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { val:"notify", label:"Alert Only",   color:"#f59e0b" },
                    { val:"stop",   label:"Auto-Stop VM", color:"#ef4444" },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setForm(f => ({ ...f, action_100: opt.val }))}
                      style={{
                        flex:1, padding:"9px 8px", borderRadius:9, cursor:"pointer", fontSize:12, fontWeight:600,
                        border:`1px solid ${form.action_100===opt.val ? opt.color+"60" : "rgba(255,255,255,0.08)"}`,
                        background: form.action_100===opt.val ? opt.color+"15" : "rgba(255,255,255,0.03)",
                        color: form.action_100===opt.val ? opt.color : "#475569",
                        transition:"all 0.15s",
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.action_100 === "stop" && (
                  <div style={{ marginTop:8, fontSize:11, color:"#ef4444", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:7, padding:"7px 10px" }}>
                    VM will be automatically stopped when monthly spend reaches 100% of budget
                  </div>
                )}
              </div>

              {/* Extra emails */}
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11, fontWeight:600, color:"#64748b", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                  Extra Alert Emails <span style={{ color:"#475569", textTransform:"none", fontWeight:400 }}>(comma separated, optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="manager@company.com, finance@company.com"
                  value={form.notify_emails}
                  onChange={e => setForm(f => ({ ...f, notify_emails: e.target.value }))}
                  style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, padding:"9px 12px", fontSize:12, color:"#e2e8f0", outline:"none" }}
                />
              </div>

              {error   && <div style={{ fontSize:12, color:"#ef4444", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, padding:"9px 12px", marginBottom:14 }}>{error}</div>}
              {success && <div style={{ fontSize:12, color:"#00d4aa", background:"rgba(0,212,170,0.1)", border:"1px solid rgba(0,212,170,0.2)", borderRadius:8, padding:"9px 12px", marginBottom:14 }}>{success}</div>}

              {/* Buttons */}
              <div style={{ display:"flex", gap:8 }}>
                {existing && (
                  <button onClick={handleDelete} disabled={deleting}
                    style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:9, padding:"9px 16px", fontSize:12, color:"#ef4444", cursor:deleting?"default":"pointer", opacity:deleting?0.6:1 }}>
                    {deleting ? "Removing..." : "Remove Budget"}
                  </button>
                )}
                <div style={{ flex:1 }} />
                <button onClick={() => onClose(false)} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, padding:"9px 18px", fontSize:12, color:"#64748b", cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ background:"linear-gradient(135deg,#00d4aa,#0ea5e9)", border:"none", borderRadius:9, padding:"9px 22px", fontSize:13, fontWeight:700, color:"#fff", cursor:saving?"default":"pointer", opacity:saving?0.7:1 }}>
                  {saving ? "Saving..." : existing ? "Update Budget" : "Set Budget"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
