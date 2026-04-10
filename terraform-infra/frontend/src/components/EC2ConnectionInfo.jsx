import { useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import api from "../api/api"

const AMI_USERS = {
  "amazon-linux": "ec2-user",
  "ubuntu":       "ubuntu",
  "windows":      "Administrator",
  "rhel":         "ec2-user",
  "centos":       "centos",
  "debian":       "admin",
  "deep-learning":"ec2-user",
}

function detectOS(amiId, amiName) {
  const n = (amiName || "").toLowerCase()
  if(n.includes("windows"))      return "windows"
  if(n.includes("ubuntu"))       return "ubuntu"
  if(n.includes("rhel"))         return "rhel"
  if(n.includes("centos"))       return "centos"
  if(n.includes("debian"))       return "debian"
  if(n.includes("deep-learning"))return "deep-learning"
  return "amazon-linux"
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} style={{ padding:"4px 10px", borderRadius:"6px", fontSize:"11px", cursor:"pointer", border:"1px solid #00d4aa40", background:copied?"#00d4aa20":"transparent", color:"#00d4aa", marginLeft:"8px", transition:"all 0.2s" }}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  )
}

export default function EC2ConnectionInfo({ vm, onClose }) {
  const { dark } = useTheme()
  const [tab, setTab]         = useState("ssh")
  const [polling, setPolling] = useState(!vm.public_ip)
  const [currentVM, setVM]    = useState(vm)
  const [attempts, setAttempts]= useState(0)

  const os = detectOS(currentVM.ami_id, "")
  const sshUser = AMI_USERS[os] || "ec2-user"
  const isWindows = os === "windows"
  const ip = currentVM.public_ip || currentVM.private_ip || "pending..."
  const keyFile = (currentVM.key_name || "keypair") + ".pem"

  const surface = dark?"#0f172a":"#ffffff"
  const border  = dark?"#1e293b":"#e2e8f0"
  const text    = dark?"#f1f5f9":"#0f172a"
  const muted   = dark?"#475569":"#64748b"
  const subtle  = dark?"#1e293b":"#f8fafc"
  const codeBg  = dark?"#0a0f1e":"#f0fdf4"

  useEffect(() => {
    if (!polling) return
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get("/vms")
        const updated = data.find(v => v.id === vm.id)
        if(updated) {
          setVM(updated)
          setAttempts(a => a + 1)
          if(updated.public_ip || updated.state === "running") setPolling(false)
        }
        if(attempts > 20) setPolling(false)
      } catch(e) { console.error(e) }
    }, 5000)
    return () => clearInterval(interval)
  }, [polling, attempts])

  const sshCmd     = `ssh -i "${keyFile}" ${sshUser}@${ip}`
  const scpCmd     = `scp -i "${keyFile}" file.txt ${sshUser}@${ip}:/home/${sshUser}/`
  const chmodCmd   = `chmod 400 "${keyFile}"`
  const rdpInfo    = `Computer: ${ip}\nUsername: Administrator\nPassword: (Get from AWS console — right-click instance → Get Windows Password)`
  const vscodeCmd  = `# VS Code Remote SSH config\nHost ${currentVM.name || "my-ec2"}\n  HostName ${ip}\n  User ${sshUser}\n  IdentityFile ~/.ssh/${keyFile}`
  const portFwd    = `ssh -i "${keyFile}" -L 8080:localhost:8080 ${sshUser}@${ip}`
  const sshConfig  = `Host ${currentVM.name || "my-ec2"}\n  HostName ${ip}\n  User ${sshUser}\n  IdentityFile ~/.ssh/${keyFile}\n  StrictHostKeyChecking no`

  const tabBtn = (id) => ({
    padding:"7px 14px", borderRadius:"8px", fontSize:"12px", fontWeight:"500",
    cursor:"pointer", border:"none",
    background: tab===id?"#00d4aa20":"transparent",
    color: tab===id?"#00d4aa":muted
  })

  function CodeBlock({ code, label }) {
    return (
      <div style={{ marginBottom:"12px" }}>
        {label && <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"5px" }}>{label}</div>}
        <div style={{ background:codeBg, border:"1px solid "+(dark?"#00d4aa20":"#00d4aa30"), borderRadius:"8px", padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <pre style={{ margin:0, fontSize:"12px", color:"#00d4aa", fontFamily:"monospace", whiteSpace:"pre-wrap", flex:1, lineHeight:"1.6" }}>{code}</pre>
          <CopyButton text={code} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:3000, padding:"16px" }}>
      <div style={{ background:surface, borderRadius:"18px", border:"1px solid "+border, width:"100%", maxWidth:"680px", maxHeight:"92vh", overflow:"auto" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid "+border }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"4px" }}>
                <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:"#00d4aa20", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:"17px", fontWeight:"700", color:text }}>{currentVM.name}</div>
                  <div style={{ fontSize:"12px", color:muted }}>{currentVM.instance_type} — {currentVM.region}</div>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"22px", color:muted }}>x</button>
          </div>

          {/* Status bar */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px", marginTop:"14px" }}>
            {[
              { label:"Instance ID",  value:currentVM.instance_id || "--",    color:"#3b82f6" },
              { label:"State",        value:currentVM.state || "pending",      color:currentVM.state==="running"?"#00d4aa":"#f59e0b" },
              { label:"Public IP",    value:ip,                                color:currentVM.public_ip?"#00d4aa":"#f59e0b" },
              { label:"OS / User",    value:`${os} / ${sshUser}`,             color:"#a78bfa" },
            ].map(s=>(
              <div key={s.label} style={{ background:subtle, borderRadius:"8px", padding:"10px 12px", border:"1px solid "+border }}>
                <div style={{ fontSize:"10px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"3px" }}>{s.label}</div>
                <div style={{ fontSize:"12px", fontWeight:"600", color:s.color, fontFamily:"monospace", wordBreak:"break-all" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {polling && (
            <div style={{ background:"#f59e0b10", border:"1px solid #f59e0b30", borderRadius:"8px", padding:"10px 14px", marginTop:"12px", fontSize:"12px", color:"#f59e0b", display:"flex", alignItems:"center", gap:"8px" }}>
              <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#f59e0b", animation:"pulse 1.5s infinite" }} />
              Instance is starting up — checking for public IP every 5 seconds... ({attempts * 5}s elapsed)
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ padding:"0 24px", borderBottom:"1px solid "+border, display:"flex", gap:"4px" }}>
          {(isWindows
            ? [["ssh","RDP Connection"],["web","Web Browser"],["info","Instance Info"]]
            : [["ssh","SSH Connection"],["vscode","VS Code Remote"],["scp","File Transfer"],["tunnel","Port Forwarding"],["info","Instance Info"]]
          ).map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={tabBtn(id)}>{label}</button>
          ))}
        </div>

        <div style={{ padding:"20px 24px" }}>

          {/* SSH Tab */}
          {tab==="ssh" && !isWindows && (
            <div>
              <div style={{ background:"#3b82f610", border:"1px solid #3b82f630", borderRadius:"8px", padding:"12px 14px", marginBottom:"16px", fontSize:"12px" }}>
                <div style={{ fontWeight:"600", color:"#3b82f6", marginBottom:"4px" }}>Prerequisites</div>
                <div style={{ color:muted }}>1. Download your key pair file: <code style={{ color:"#00d4aa" }}>{keyFile}</code> (from IAM → Key Pairs section)</div>
                <div style={{ color:muted }}>2. Move it to your SSH folder and set permissions</div>
                <div style={{ color:muted }}>3. Instance must be in <strong style={{ color:"#00d4aa" }}>running</strong> state</div>
              </div>
              <CodeBlock code={chmodCmd} label="Step 1 — Fix key permissions (run once)" />
              <CodeBlock code={sshCmd} label="Step 2 — Connect via SSH" />
              <div style={{ background:subtle, borderRadius:"8px", padding:"14px", border:"1px solid "+border }}>
                <div style={{ fontSize:"12px", fontWeight:"600", color:text, marginBottom:"8px" }}>Default credentials by OS</div>
                {[
                  ["Amazon Linux 2023", "ec2-user", "No password — key pair only"],
                  ["Ubuntu 20/22",      "ubuntu",   "No password — key pair only"],
                  ["RHEL",             "ec2-user", "No password — key pair only"],
                  ["Debian",           "admin",    "No password — key pair only"],
                ].map(([os,user,note])=>(
                  <div key={os} style={{ display:"flex", gap:"16px", padding:"4px 0", fontSize:"11px", borderBottom:"1px solid "+border }}>
                    <span style={{ color:muted, width:"140px" }}>{os}</span>
                    <span style={{ color:"#00d4aa", fontFamily:"monospace", fontWeight:"600" }}>{user}</span>
                    <span style={{ color:muted }}>{note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RDP Tab for Windows */}
          {tab==="ssh" && isWindows && (
            <div>
              <div style={{ background:"#3b82f610", border:"1px solid #3b82f630", borderRadius:"8px", padding:"12px 14px", marginBottom:"16px", fontSize:"12px" }}>
                <div style={{ fontWeight:"600", color:"#3b82f6", marginBottom:"4px" }}>Windows RDP Connection</div>
                <div style={{ color:muted }}>1. Open Remote Desktop Connection (mstsc.exe)</div>
                <div style={{ color:muted }}>2. Use the IP and credentials below</div>
                <div style={{ color:muted }}>3. Get password: AWS Console → EC2 → Right-click instance → Get Windows Password</div>
              </div>
              <CodeBlock code={`Computer: ${ip}\nPort: 3389`} label="RDP Address" />
              <CodeBlock code={`Username: Administrator\nPassword: (Decrypt using your .pem key in AWS Console)`} label="Credentials" />
              <div style={{ background:subtle, borderRadius:"8px", padding:"14px", border:"1px solid "+border, fontSize:"12px", color:muted }}>
                <div style={{ fontWeight:"600", color:text, marginBottom:"6px" }}>Quick Connect</div>
                <div>Open Start → type <code style={{ color:"#00d4aa" }}>mstsc</code> → Enter computer: <code style={{ color:"#00d4aa" }}>{ip}</code></div>
              </div>
            </div>
          )}

          {/* VS Code Remote */}
          {tab==="vscode" && (
            <div>
              <div style={{ background:"#a78bfa10", border:"1px solid #a78bfa30", borderRadius:"8px", padding:"12px 14px", marginBottom:"16px", fontSize:"12px" }}>
                <div style={{ fontWeight:"600", color:"#a78bfa", marginBottom:"4px" }}>VS Code Remote SSH Setup</div>
                <div style={{ color:muted }}>Install the <strong>Remote - SSH</strong> extension in VS Code, then use this config</div>
              </div>
              <CodeBlock code={sshConfig} label="Add to ~/.ssh/config" />
              <div style={{ background:subtle, borderRadius:"8px", padding:"14px", border:"1px solid "+border, fontSize:"12px" }}>
                <div style={{ fontWeight:"600", color:text, marginBottom:"8px" }}>Steps in VS Code</div>
                <div style={{ color:muted, lineHeight:"1.8" }}>
                  1. Press <code style={{ color:"#00d4aa" }}>Ctrl+Shift+P</code> → "Remote-SSH: Connect to Host"<br/>
                  2. Select <code style={{ color:"#00d4aa" }}>{currentVM.name || "my-ec2"}</code><br/>
                  3. VS Code will open a new window connected to your EC2<br/>
                  4. Open terminal in VS Code — you are now inside the instance
                </div>
              </div>
            </div>
          )}

          {/* SCP File Transfer */}
          {tab==="scp" && (
            <div>
              <CodeBlock code={`# Upload file to EC2\n${scpCmd}`} label="Upload file" />
              <CodeBlock code={`# Download file from EC2\nscp -i "${keyFile}" ${sshUser}@${ip}:/path/to/file.txt ./local-copy.txt`} label="Download file" />
              <CodeBlock code={`# Upload entire folder\nscp -i "${keyFile}" -r ./my-folder/ ${sshUser}@${ip}:/home/${sshUser}/`} label="Upload folder" />
              <div style={{ background:subtle, borderRadius:"8px", padding:"14px", border:"1px solid "+border, fontSize:"12px", color:muted }}>
                <div style={{ fontWeight:"600", color:text, marginBottom:"6px" }}>Alternative: SFTP with FileZilla</div>
                <div>Host: <code style={{ color:"#00d4aa" }}>{ip}</code> | Port: 22 | Protocol: SFTP | Logon: Key file | Key: {keyFile}</div>
              </div>
            </div>
          )}

          {/* Port Forwarding */}
          {tab==="tunnel" && (
            <div>
              <CodeBlock code={portFwd} label="Forward port 8080 (web apps)" />
              <CodeBlock code={`ssh -i "${keyFile}" -L 5432:localhost:5432 ${sshUser}@${ip}`} label="Forward port 5432 (PostgreSQL)" />
              <CodeBlock code={`ssh -i "${keyFile}" -L 3306:localhost:3306 ${sshUser}@${ip}`} label="Forward port 3306 (MySQL)" />
              <div style={{ background:subtle, borderRadius:"8px", padding:"14px", border:"1px solid "+border, fontSize:"12px", color:muted }}>
                <div style={{ fontWeight:"600", color:text, marginBottom:"6px" }}>How to use</div>
                <div style={{ lineHeight:"1.8" }}>
                  1. Run the tunnel command in your terminal<br/>
                  2. Open browser → <code style={{ color:"#00d4aa" }}>http://localhost:8080</code><br/>
                  3. Traffic is forwarded securely through SSH to your EC2<br/>
                  4. Press <code style={{ color:"#00d4aa" }}>Ctrl+C</code> to stop the tunnel
                </div>
              </div>
            </div>
          )}

          {/* Info Tab */}
          {tab==="info" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                {[
                  ["Instance ID",    currentVM.instance_id || "--"],
                  ["Instance Type",  currentVM.instance_type || "--"],
                  ["Region",         currentVM.region || "--"],
                  ["State",          currentVM.state || "--"],
                  ["Public IP",      currentVM.public_ip || "Not assigned"],
                  ["Private IP",     currentVM.private_ip || "--"],
                  ["AMI ID",         currentVM.ami_id || "--"],
                  ["Key Pair",       currentVM.key_name || "None"],
                  ["Created",        currentVM.created_at ? new Date(currentVM.created_at).toLocaleString("en-IN") : "--"],
                  ["Owner",          currentVM.owner_username || "--"],
                  ["OS User",        sshUser],
                  ["SSH Port",       isWindows ? "3389 (RDP)" : "22"],
                ].map(([k,v])=>(
                  <div key={k} style={{ background:subtle, borderRadius:"8px", padding:"10px 12px" }}>
                    <div style={{ fontSize:"10px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"3px" }}>{k}</div>
                    <div style={{ fontSize:"12px", fontWeight:"600", color:text, wordBreak:"break-all" }}>{v}</div>
                  </div>
                ))}
              </div>

              {currentVM.auto_start || currentVM.auto_stop ? (
                <div style={{ background:"#3b82f610", border:"1px solid #3b82f630", borderRadius:"8px", padding:"12px 14px", marginTop:"12px", fontSize:"12px" }}>
                  <div style={{ fontWeight:"600", color:"#3b82f6", marginBottom:"4px" }}>Auto Schedule</div>
                  {currentVM.auto_start && <div style={{ color:muted }}>Start: <strong style={{ color:"#00d4aa" }}>{currentVM.auto_start}</strong> daily</div>}
                  {currentVM.auto_stop  && <div style={{ color:muted }}>Stop:  <strong style={{ color:"#f43f5e" }}>{currentVM.auto_stop}</strong> daily</div>}
                </div>
              ) : null}
            </div>
          )}

          {/* Web browser */}
          {tab==="web" && (
            <div>
              <div style={{ background:subtle, borderRadius:"8px", padding:"14px", border:"1px solid "+border, marginBottom:"12px" }}>
                <div style={{ fontSize:"12px", fontWeight:"600", color:text, marginBottom:"8px" }}>Common URLs</div>
                {[
                  ["HTTP", `http://${ip}`],
                  ["HTTPS", `https://${ip}`],
                  ["Custom Port", `http://${ip}:8080`],
                ].map(([label, url])=>(
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid "+border }}>
                    <span style={{ fontSize:"12px", color:muted }}>{label}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <code style={{ fontSize:"12px", color:"#00d4aa" }}>{url}</code>
                      <CopyButton text={url} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:"12px", color:muted }}>Make sure your Security Group allows inbound traffic on the required ports.</div>
            </div>
          )}
        </div>

        <div style={{ padding:"16px 24px", borderTop:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:"11px", color:muted }}>
            {currentVM.public_ip ? `Ready to connect at ${ip}` : "Waiting for IP address..."}
          </div>
          <button onClick={onClose} style={{ padding:"9px 22px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e" }}>Close</button>
        </div>
        <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}"}</style>
      </div>
    </div>
  )
}
