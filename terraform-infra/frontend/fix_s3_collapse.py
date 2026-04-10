with open("src/pages/Resources.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add s3Expanded state
content = content.replace(
    "  const [s3Revealed, setS3Revealed] = useState(false)",
    "  const [s3Revealed, setS3Revealed] = useState(false)\n  const [s3Expanded, setS3Expanded] = useState(false)"
)

# Replace the resources table body to collapse S3 rows
old_rows = """              {resources.map((r, i) => {
                const svc = SERVICES.find(s => s.id === r._type)
                const statusColor = STATUS_COLORS[r._status] || "#64748b"
                return (
                  <tr key={i} style={{ borderBottom:"1px solid "+border, transition:"background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        {svc && (
                          <div style={{ width:"28px", height:"28px", borderRadius:"7px", background:svc.color+"20", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={svc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d={svc.icon}/>
                            </svg>
                          </div>
                        )}
                        <span style={{ fontSize:"12px", fontWeight:"500", color:muted }}>{r._type==="ec2"?"EC2":r._type==="s3"?"S3":r._type.toUpperCase()}</span>
                      </div>
                    </td>
                    <td style={{ padding:"14px 16px", fontSize:"13px", fontWeight:"600", color:text }}>{r._type==="s3" && !s3Revealed ? r._label.slice(0,3)+"---------" : r._label}</td>
                    <td style={{ padding:"14px 16px" }}>
                      <span style={{ background:statusColor+"15", color:statusColor, padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600" }}>{r._status}</span>
                    </td>
                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{r._region}</td>
                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{r._type==="s3" && !s3Revealed ? "---------" : r._detail}</td>
                    <td style={{ padding:"14px 16px" }}>
                      {r._type === "s3" && s3Revealed && (
                        <button onClick={() => handleDeleteResource(r)}
                          style={{ padding:"4px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>
                          Delete
                        </button>
                      )}
                      {r._type === "s3" && !s3Revealed && (
                        <span style={{ fontSize:"11px", color:muted }}>locked</span>
                      )}
                    </td>
                  </tr>
                )
              })}"""

new_rows = """              {/* Non-S3 resources */}
              {resources.filter(r => r._type !== "s3").map((r, i) => {
                const svc = SERVICES.find(s => s.id === r._type)
                const statusColor = STATUS_COLORS[r._status] || "#64748b"
                return (
                  <tr key={i} style={{ borderBottom:"1px solid "+border, transition:"background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        {svc && <div style={{ width:"28px", height:"28px", borderRadius:"7px", background:svc.color+"20", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={svc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={svc.icon}/></svg>
                        </div>}
                        <span style={{ fontSize:"12px", fontWeight:"500", color:muted }}>{r._type==="ec2"?"EC2":r._type.toUpperCase()}</span>
                      </div>
                    </td>
                    <td style={{ padding:"14px 16px", fontSize:"13px", fontWeight:"600", color:text }}>{r._label}</td>
                    <td style={{ padding:"14px 16px" }}><span style={{ background:statusColor+"15", color:statusColor, padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600" }}>{r._status}</span></td>
                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{r._region}</td>
                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{r._detail}</td>
                    <td style={{ padding:"14px 16px" }} />
                  </tr>
                )
              })}

              {/* S3 collapsed row */}
              {resources.filter(r => r._type === "s3").length > 0 && (
                <>
                  <tr style={{ borderBottom:"1px solid "+border, background: s3Expanded ? (dark?"#00d4aa08":"#f0fdf4") : "transparent", cursor:"pointer" }}
                    onClick={() => {
                      if (!s3Expanded && !s3Revealed) {
                        const code = window.prompt("Enter access code to view S3 buckets:")
                        if (code && code.toUpperCase() === "AIONOS") { setS3Revealed(true); setS3Expanded(true) }
                        else if (code !== null) alert("Incorrect access code")
                      } else {
                        setS3Expanded(p => !p)
                      }
                    }}>
                    <td style={{ padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <div style={{ width:"28px", height:"28px", borderRadius:"7px", background:"#00d4aa20", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2"><path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/></svg>
                        </div>
                        <span style={{ fontSize:"12px", fontWeight:"500", color:muted }}>S3</span>
                      </div>
                    </td>
                    <td style={{ padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <span style={{ fontSize:"13px", fontWeight:"600", color:text }}>S3 Buckets</span>
                        <span style={{ background:"#00d4aa15", color:"#00d4aa", padding:"2px 8px", borderRadius:"10px", fontSize:"11px", fontWeight:"600" }}>{resources.filter(r=>r._type==="s3").length}</span>
                        {!s3Revealed && <span style={{ fontSize:"10px", background:"#f59e0b15", color:"#f59e0b", padding:"2px 8px", borderRadius:"10px", fontWeight:"600" }}>LOCKED</span>}
                      </div>
                    </td>
                    <td style={{ padding:"14px 16px" }}><span style={{ background:"#00d4aa15", color:"#00d4aa", padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600" }}>active</span></td>
                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>ap-south-1</td>
                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{s3Revealed ? resources.filter(r=>r._type==="s3").length+" buckets" : "Click to unlock"}</td>
                    <td style={{ padding:"14px 16px", textAlign:"right" }}>
                      <span style={{ fontSize:"16px", color:muted, transition:"transform 0.2s", display:"inline-block", transform: s3Expanded?"rotate(90deg)":"rotate(0deg)" }}>-</span>
                    </td>
                  </tr>

                  {/* Expanded S3 rows */}
                  {s3Expanded && s3Revealed && resources.filter(r => r._type === "s3").map((r, i) => (
                    <tr key={"s3-"+i} style={{ borderBottom:"1px solid "+border, background: dark?"#00d4aa05":"#f0fdf4" }}>
                      <td style={{ padding:"10px 16px 10px 40px" }}>
                        <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#00d4aa", marginLeft:"8px" }} />
                      </td>
                      <td style={{ padding:"10px 16px", fontSize:"12px", fontWeight:"500", color:text, fontFamily:"monospace" }}>{r._label}</td>
                      <td style={{ padding:"10px 16px" }}><span style={{ background:"#00d4aa15", color:"#00d4aa", padding:"2px 8px", borderRadius:"20px", fontSize:"10px", fontWeight:"600" }}>active</span></td>
                      <td style={{ padding:"10px 16px", fontSize:"11px", color:muted }}>{r._region}</td>
                      <td style={{ padding:"10px 16px", fontSize:"11px", color:muted }}>{r._detail}</td>
                      <td style={{ padding:"10px 16px" }}>
                        <button onClick={() => handleDeleteResource(r)}
                          style={{ padding:"3px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              )}"""

content = content.replace(old_rows, new_rows)

with open("src/pages/Resources.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Done")
