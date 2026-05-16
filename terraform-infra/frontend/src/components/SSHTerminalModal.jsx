import { useEffect, useRef, useState } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { getGCPInstanceSSHKey } from "../api/api"

// ── Cloud defaults ────────────────────────────────────────────────────────────
const CLOUD_DEFAULTS = {
  aws:   { color: "#FF9900", bg: "rgba(255,153,0,0.1)",   label: "AWS EC2",  user: "ec2-user"   },
  gcp:   { color: "#4285F4", bg: "rgba(66,133,244,0.1)", label: "GCP VM",   user: "gcpuser"    },
  azure: { color: "#0078D4", bg: "rgba(0,120,212,0.1)",  label: "Azure VM", user: "azureuser"  },
}

// ── Terminal colour theme ─────────────────────────────────────────────────────
const TERM_THEME = {
  background:  "#0a0f1e",
  foreground:  "#e2e8f0",
  cursor:      "#00d4aa",
  cursorAccent:"#0a0f1e",
  selectionBackground: "rgba(0,212,170,0.3)",
  black:       "#0a0f1e", brightBlack:  "#475569",
  red:         "#f87171", brightRed:    "#ef4444",
  green:       "#4ade80", brightGreen:  "#22c55e",
  yellow:      "#fbbf24", brightYellow: "#f59e0b",
  blue:        "#60a5fa", brightBlue:   "#3b82f6",
  magenta:     "#c084fc", brightMagenta:"#a855f7",
  cyan:        "#22d3ee", brightCyan:   "#06b6d4",
  white:       "#e2e8f0", brightWhite:  "#f8fafc",
}

export default function SSHTerminalModal({ vmName, host: initialHost, cloud = "aws", dark, onClose }) {
  const cd = CLOUD_DEFAULTS[cloud] || CLOUD_DEFAULTS.aws

  // ── form state ────────────────────────────────────────────────────────────
  const [host,     setHost]     = useState(initialHost || "")
  const [port,     setPort]     = useState(22)
  const [username, setUsername] = useState(cd.user)
  const [authType, setAuthType] = useState("password")
  const [password, setPassword] = useState("")
  const [keyData,  setKeyData]  = useState("")
  const [showPass, setShowPass] = useState(false)

  // ── connection state ──────────────────────────────────────────────────────
  // idle | fetching-key | connecting | connected | disconnected | error
  const [status,  setStatus]  = useState("idle")
  const [errMsg,  setErrMsg]  = useState("")

  // ── refs ──────────────────────────────────────────────────────────────────
  const termDivRef  = useRef(null)   // <div> where xterm mounts
  const termRef     = useRef(null)   // Terminal instance
  const fitRef      = useRef(null)   // FitAddon instance
  const wsRef       = useRef(null)   // WebSocket
  const roRef       = useRef(null)   // ResizeObserver
  const queueRef    = useRef([])     // data received before terminal init
  const statusRef   = useRef("idle") // always-current status for WS callbacks

  // ── cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      roRef.current?.disconnect()
      wsRef.current?.close()
      termRef.current?.dispose()
    }
  }, [])

  // ── init xterm after "connected" status set ───────────────────────────────
  useEffect(() => {
    if (status !== "connected") return
    if (termRef.current) return        // already initialised
    if (!termDivRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Cascadia Code","JetBrains Mono","Fira Code",monospace',
      theme: TERM_THEME,
      scrollback: 5000,
      allowProposedApi: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(termDivRef.current)
    setTimeout(() => fit.fit(), 50)

    termRef.current = term
    fitRef.current  = fit

    // resize observer — refit when container dimensions change
    const ro = new ResizeObserver(() => { try { fit.fit() } catch {} })
    ro.observe(termDivRef.current)
    roRef.current = ro

    // keyboard → WS
    term.onData(data => {
      wsRef.current?.readyState === WebSocket.OPEN &&
        wsRef.current.send(JSON.stringify({ type: "data", data }))
    })

    // terminal resize → WS
    term.onResize(({ cols, rows }) => {
      wsRef.current?.readyState === WebSocket.OPEN &&
        wsRef.current.send(JSON.stringify({ type: "resize", cols, rows }))
    })

    // flush queued data that arrived before the terminal was ready
    queueRef.current.forEach(d => term.write(d))
    queueRef.current = []
  }, [status])

  // ── optional: auto-fetch stored GCP key ──────────────────────────────────
  async function fetchStoredKey() {
    setStatus("fetching-key")
    setErrMsg("")
    try {
      const r = await getGCPInstanceSSHKey(vmName)
      const k = r.data
      setKeyData(k.private_key || "")
      setUsername(k.username || "gcpuser")
      setAuthType("key")
      setStatus("idle")
    } catch {
      setStatus("idle")
      setErrMsg("No stored key found — enter credentials manually.")
    }
  }

  // ── connect ───────────────────────────────────────────────────────────────
  function connect() {
    if (!host.trim()) { setErrMsg("Host / IP is required"); return }
    statusRef.current = "connecting"
    setStatus("connecting")
    setErrMsg("")

    const token   = localStorage.getItem("token") || ""
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:"
    // In dev, Vite's WebSocket proxy is unreliable for upgrade requests —
    // connect directly to the backend port instead.
    const wsHost  = import.meta.env.DEV ? "127.0.0.1:8000" : window.location.host
    const ws = new WebSocket(`${wsProto}//${wsHost}/ws/ssh?token=${encodeURIComponent(token)}`)
    wsRef.current  = ws

    ws.onopen = () => {
      const cols = termRef.current?.cols || 200
      const rows = termRef.current?.rows || 50
      ws.send(JSON.stringify({
        type:      "init",
        host:      host.trim(),
        port:      Number(port),
        username:  username.trim(),
        auth_type: authType,
        password:  authType === "password" ? password : "",
        key_data:  authType === "key"      ? keyData  : "",
        cols, rows,
      }))
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === "connected") {
          statusRef.current = "connected"
          setStatus("connected")
        } else if (msg.type === "data") {
          if (termRef.current) {
            termRef.current.write(msg.data)
          } else {
            queueRef.current.push(msg.data)
          }
        } else if (msg.type === "disconnected") {
          setStatus("disconnected")
          termRef.current?.write("\r\n\x1b[33m[SSH session ended]\x1b[0m\r\n")
        } else if (msg.type === "error") {
          setStatus("error")
          setErrMsg(msg.message || "Unknown error")
        }
      } catch {}
    }

    ws.onerror = () => {
      setStatus("error")
      setErrMsg(`WebSocket connection failed (${wsHost}). Check the backend is running on port 8000.`)
    }

    ws.onclose = () => {
      if (statusRef.current === "connected" || termRef.current) {
        termRef.current?.write("\r\n\x1b[33m[Connection closed]\x1b[0m\r\n")
        statusRef.current = "disconnected"
        setStatus("disconnected")
      } else if (statusRef.current === "connecting") {
        statusRef.current = "error"
        setStatus("error")
        setErrMsg("Connection closed before SSH handshake.")
      }
    }
  }

  function disconnect() {
    wsRef.current?.close()
    setStatus("disconnected")
  }

  function reconnect() {
    roRef.current?.disconnect()
    termRef.current?.dispose()
    termRef.current = null
    fitRef.current  = null
    queueRef.current = []
    setStatus("idle")
    setErrMsg("")
  }

  // ── styles ────────────────────────────────────────────────────────────────
  const surf   = dark ? "#0f172a" : "#ffffff"
  const border = dark ? "#1e293b" : "#e2e8f0"
  const txt    = dark ? "#f1f5f9" : "#0f172a"
  const muted  = dark ? "#64748b" : "#94a3b8"
  const inp    = {
    width: "100%", boxSizing: "border-box",
    padding: "9px 12px", borderRadius: 8, fontSize: 13,
    background: dark ? "#1e293b" : "#f8faff",
    border: `1px solid ${border}`, color: txt,
    fontFamily: "inherit", outline: "none",
  }

  const connected   = status === "connected"
  const connecting  = status === "connecting" || status === "fetching-key"
  const isError     = status === "error"
  const disconnected = status === "disconnected"

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1200,
      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: surf, borderRadius: 16, width: "min(1020px, 96vw)",
        maxHeight: "95vh", display: "flex", flexDirection: "column",
        border: `1px solid ${border}`, boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", borderBottom: `1px solid ${border}`,
          background: dark ? "#070c18" : "#f8fafc", flexShrink: 0,
        }}>
          {/* Terminal icon */}
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: "linear-gradient(135deg,#0a0f1e,#1e293b)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#00d4aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: txt, lineHeight: 1.2 }}>
              SSH Terminal
              {vmName && <span style={{ color: muted, fontWeight: 500, marginLeft: 6 }}>— {vmName}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                background: cd.bg, color: cd.color, border: `1px solid ${cd.color}40`,
              }}>{cd.label}</span>
              {connected && (
                <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 4px #22c55e" }} />
                  Connected · {host}:{port}
                </span>
              )}
              {connecting && (
                <span style={{ fontSize: 10, color: "#60a5fa", fontWeight: 600 }}>Connecting…</span>
              )}
              {disconnected && (
                <span style={{ fontSize: 10, color: muted, fontWeight: 600 }}>Disconnected</span>
              )}
            </div>
          </div>

          {connected && (
            <button onClick={disconnect} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)",
              color: "#ef4444", cursor: "pointer",
            }}>Disconnect</button>
          )}
          {disconnected && (
            <button onClick={reconnect} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.35)",
              color: "#00d4aa", cursor: "pointer",
            }}>New Session</button>
          )}
          <button onClick={onClose} style={{
            padding: "6px 10px", borderRadius: 8, background: "transparent",
            border: `1px solid ${border}`, color: muted, cursor: "pointer", fontSize: 16, lineHeight: 1,
          }}>✕</button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>

          {/* Connection form — shown when not connected */}
          {!connected && !disconnected && (
            <div style={{ padding: "20px 22px", overflowY: "auto" }}>

              {/* Error / info banner */}
              {(isError || errMsg) && (
                <div style={{
                  marginBottom: 14, padding: "10px 14px", borderRadius: 9,
                  background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.3)",
                  color: "#fca5a5", fontSize: 13,
                }}>
                  {errMsg}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: muted, fontWeight: 600, display: "block", marginBottom: 5 }}>Host / IP Address</label>
                  <input value={host} onChange={e => setHost(e.target.value)} placeholder="e.g. 34.123.45.67"
                    style={inp} disabled={connecting} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: muted, fontWeight: 600, display: "block", marginBottom: 5 }}>Port</label>
                  <input value={port} onChange={e => setPort(e.target.value)} type="number" min="1" max="65535"
                    style={{ ...inp, width: 80 }} disabled={connecting} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: muted, fontWeight: 600, display: "block", marginBottom: 5 }}>Username</label>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ec2-user / gcpuser / ubuntu"
                  style={inp} disabled={connecting} />
              </div>

              {/* Auth type toggle */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: muted, fontWeight: 600, display: "block", marginBottom: 7 }}>Authentication</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {["password", "key"].map(t => (
                    <button key={t} onClick={() => setAuthType(t)} style={{
                      padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: authType === t ? "rgba(0,212,170,0.15)" : "transparent",
                      border: `1px solid ${authType === t ? "rgba(0,212,170,0.5)" : border}`,
                      color: authType === t ? "#00d4aa" : muted,
                      transition: "all 0.15s",
                    }}>
                      {t === "password" ? "🔑 Password" : "📄 Private Key"}
                    </button>
                  ))}
                </div>
              </div>

              {authType === "password" ? (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: muted, fontWeight: 600, display: "block", marginBottom: 5 }}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input value={password} onChange={e => setPassword(e.target.value)}
                      type={showPass ? "text" : "password"} placeholder="SSH password"
                      style={{ ...inp, paddingRight: 44 }} disabled={connecting}
                      onKeyDown={e => e.key === "Enter" && !connecting && connect()} />
                    <button onClick={() => setShowPass(s => !s)} style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 13,
                    }}>{showPass ? "Hide" : "Show"}</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Private Key (PEM)</label>
                    {cloud === "gcp" && (
                      <button onClick={fetchStoredKey} disabled={connecting} style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
                        background: "rgba(66,133,244,0.1)", border: "1px solid rgba(66,133,244,0.35)",
                        color: "#4285F4", fontWeight: 600,
                      }}>Auto-fill stored key</button>
                    )}
                  </div>
                  <textarea value={keyData} onChange={e => setKeyData(e.target.value)} rows={7}
                    placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
                    disabled={connecting}
                    style={{
                      ...inp, resize: "vertical", fontFamily: '"Cascadia Code","Fira Code",monospace',
                      fontSize: 11, lineHeight: 1.5,
                    }} />
                </div>
              )}

              {/* Security note */}
              <div style={{
                padding: "8px 12px", borderRadius: 8, marginBottom: 18,
                background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${border}`, fontSize: 11, color: muted,
              }}>
                Credentials are transmitted over your local network only and are never stored. The SSH connection is established server-side via paramiko.
              </div>

              <button onClick={connect} disabled={connecting || !host.trim()} style={{
                width: "100%", padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: connecting || !host.trim() ? "not-allowed" : "pointer",
                background: connecting || !host.trim()
                  ? "rgba(0,212,170,0.3)"
                  : "linear-gradient(135deg,#00d4aa,#00b896)",
                border: "none", color: "#fff",
                boxShadow: connecting ? "none" : "0 4px 14px rgba(0,212,170,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {connecting ? (
                  <>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
                    Connecting…
                  </>
                ) : "Connect"}
              </button>
            </div>
          )}

          {/* Reconnect prompt after disconnect */}
          {disconnected && (
            <div style={{ padding: "20px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: muted, marginBottom: 14 }}>Session ended.</div>
              <button onClick={reconnect} style={{
                padding: "9px 22px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                background: "rgba(0,212,170,0.12)", border: "1px solid rgba(0,212,170,0.4)",
                color: "#00d4aa", cursor: "pointer",
              }}>Start New Session</button>
            </div>
          )}

          {/* xterm terminal container */}
          <div
            ref={termDivRef}
            style={{
              flex: 1,
              minHeight: 0,
              display: connected || disconnected ? "block" : "none",
              background: "#0a0f1e",
              padding: 6,
              // minimum so xterm can measure itself
              height: connected ? "calc(100vh - 240px)" : 200,
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .xterm { height: 100% !important; }
        .xterm-viewport { overflow-y: auto !important; }
      `}</style>
    </div>
  )
}
