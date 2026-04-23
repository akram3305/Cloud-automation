import { useState } from "react"
import { createPortal } from "react-dom"

const SCRIPTS = [
  {
    id: "nginx",
    label: "NGINX Web Server",
    desc: "Install and start NGINX, serve a simple hello page",
    icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    color: "#34A853",
    script: `#!/bin/bash
apt-get update -y
apt-get install -y nginx
systemctl start nginx
systemctl enable nginx
echo "<h1>Hello from $(hostname)</h1>" > /var/www/html/index.html`,
  },
  {
    id: "gaming",
    label: "Gaming Website (NGINX)",
    desc: "NGINX + a styled gaming landing page with dark theme",
    icon: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z",
    color: "#a78bfa",
    script: `#!/bin/bash
apt-get update -y
apt-get install -y nginx
systemctl start nginx
systemctl enable nginx
rm -rf /var/www/html/*
cat > /var/www/html/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AIonOS Gaming</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0a0f1e; color:#e2e8f0; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { text-align:center; padding:60px 40px; border:1px solid rgba(255,255,255,0.08); border-radius:20px; background:rgba(255,255,255,0.03); max-width:480px; }
    h1 { font-size:2.5rem; font-weight:900; background:linear-gradient(135deg,#a78bfa,#00d4aa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:12px; }
    p { color:#64748b; font-size:1rem; line-height:1.6; }
    .badge { display:inline-block; margin-top:20px; padding:6px 18px; border-radius:999px; background:rgba(167,139,250,0.12); border:1px solid rgba(167,139,250,0.3); color:#a78bfa; font-size:13px; font-weight:600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Gaming Platform</h1>
    <p>Your AIonOS gaming server is live and ready to play.</p>
    <span class="badge">Powered by AIonOS</span>
  </div>
</body>
</html>
HTMLEOF`,
  },
  {
    id: "docker",
    label: "Docker Engine",
    desc: "Install Docker CE and Docker Compose on Debian/Ubuntu",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    color: "#3b82f6",
    script: `#!/bin/bash
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl start docker
systemctl enable docker
usermod -aG docker gcpuser`,
  },
  {
    id: "nodejs",
    label: "Node.js 20 LTS",
    desc: "Install Node.js 20 LTS via NodeSource, npm, and PM2",
    icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    color: "#f59e0b",
    script: `#!/bin/bash
apt-get update -y
apt-get install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2
node --version
npm --version`,
  },
  {
    id: "python",
    label: "Python 3 + Flask",
    desc: "Install Python 3, pip, virtualenv, and Flask",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    color: "#f59e0b",
    script: `#!/bin/bash
apt-get update -y
apt-get install -y python3 python3-pip python3-venv
python3 -m venv /opt/venv
/opt/venv/bin/pip install --upgrade pip
/opt/venv/bin/pip install flask gunicorn
echo "Python and Flask ready. Virtualenv at /opt/venv"`,
  },
  {
    id: "lamp",
    label: "LAMP Stack",
    desc: "Apache 2, MySQL, PHP 8 on Debian/Ubuntu",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
    color: "#ef4444",
    script: `#!/bin/bash
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y apache2 mysql-server php libapache2-mod-php php-mysql
systemctl start apache2
systemctl enable apache2
systemctl start mysql
systemctl enable mysql
echo "<?php phpinfo(); ?>" > /var/www/html/info.php`,
  },
  {
    id: "monitoring",
    label: "Monitoring Agent",
    desc: "Install htop, ncdu, netstat and set up basic system monitoring",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    color: "#00d4aa",
    script: `#!/bin/bash
apt-get update -y
apt-get install -y htop ncdu net-tools iotop sysstat curl wget unzip
systemctl enable sysstat
# Log system info on boot
hostnamectl > /root/system-info.txt
echo "Startup time: $(date)" >> /root/system-info.txt
free -h >> /root/system-info.txt
df -h >> /root/system-info.txt`,
  },
  {
    id: "blank",
    label: "Blank (custom)",
    desc: "Start with an empty script and write your own",
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    color: "#64748b",
    script: "#!/bin/bash\n",
  },
]

function Icon({ d, size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function StartupScriptPicker({ onSelect, dark }) {
  const [open, setOpen] = useState(false)

  const bg     = dark ? "#0f172a" : "#ffffff"
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
  const txt    = dark ? "#e2e8f0" : "#1e293b"
  const muted  = dark ? "#64748b" : "#94a3b8"
  const card   = dark ? "rgba(255,255,255,0.03)" : "#f8fafc"
  const hover  = dark ? "rgba(255,255,255,0.06)" : "#f1f5f9"

  function pick(script) {
    onSelect(script)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: "5px 12px", borderRadius: 7,
          border: "1px solid rgba(167,139,250,0.4)",
          background: "rgba(167,139,250,0.08)", color: "#a78bfa",
          fontSize: 11, fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5,
          fontFamily: "system-ui,sans-serif",
        }}>
        <Icon d="M4 6h16M4 10h16M4 14h8" size={12} color="#a78bfa" />
        Script Templates
      </button>

      {open && createPortal(
        <div
          onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}>
          <div style={{
            width: "100%", maxWidth: 680, maxHeight: "88vh",
            background: bg, border: `1px solid ${border}`, borderRadius: 18,
            boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            fontFamily: "system-ui,sans-serif",
          }}>
            {/* Header */}
            <div style={{
              padding: "18px 22px", borderBottom: `1px solid ${border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: dark ? "rgba(167,139,250,0.05)" : "rgba(167,139,250,0.03)",
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: txt }}>Startup Script Templates</div>
                <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                  Select a template — it will populate the script editor. You can edit it after.
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                style={{ background: "transparent", border: "none", color: muted, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "2px 8px" }}>
                ×
              </button>
            </div>

            {/* Grid */}
            <div style={{ overflowY: "auto", padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {SCRIPTS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => pick(s.script)}
                    style={{
                      background: card, border: `1px solid ${border}`, borderRadius: 12,
                      padding: "14px 16px", cursor: "pointer", textAlign: "left",
                      display: "flex", gap: 12, alignItems: "flex-start",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = hover}
                    onMouseLeave={e => e.currentTarget.style.background = card}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                      background: `${s.color}18`, border: `1px solid ${s.color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon d={s.icon} size={15} color={s.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 3 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: muted, lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
