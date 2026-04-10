import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { login } from "../api/api"

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const { data } = await login(form.username, form.password)
      console.log("Login response:", data)
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("user", JSON.stringify({
        username: data.username,
        role: data.role,
      }))
      console.log("Saved user:", localStorage.getItem("user"))
      navigate("/")
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "56px", height: "56px", background: "#3b5bdb", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: "700", color: "#fff", margin: "0 auto 16px" }}>A</div>
          <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: "700" }}>AIonOS Platform</h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "4px" }}>Self-Service Infrastructure Portal</p>
        </div>

        <div style={{ background: "#fff", borderRadius: "16px", padding: "32px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1e293b", marginBottom: "24px" }}>Sign in</h2>

          {error && (
            <div style={{ background: "#fee2e2", color: "#7f1d1d", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "#64748b", marginBottom: "6px" }}>Username</label>
              <input
                type="text"
                placeholder="admin"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                required
                autoFocus
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", outline: "none" }}
              />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "#64748b", marginBottom: "6px" }}>Password</label>
              <input
                type="password"
                placeholder="--------"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", outline: "none" }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "11px", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div style={{ marginTop: "24px", background: "#f8fafc", borderRadius: "8px", padding: "12px" }}>
            <p style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase" }}>Demo credentials</p>
            {[["admin","Admin@123","Full access"],["operator","Oper@123","Create & manage VMs"],["viewer","View@123","Read only"]].map(([u,p,r]) => (
              <div key={u} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span><span style={{ fontFamily: "monospace", fontWeight: "600", color: "#1e293b" }}>{u}</span><span style={{ color: "#94a3b8" }}> / </span><span style={{ fontFamily: "monospace", color: "#475569" }}>{p}</span></span>
                <span style={{ color: "#94a3b8" }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
