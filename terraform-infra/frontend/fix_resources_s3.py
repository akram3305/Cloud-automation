with open("src/pages/Resources.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add s3Revealed state
content = content.replace(
    "  const [success,   setSuccess]  = useState(\"\")",
    "  const [success,   setSuccess]  = useState(\"\")\n  const [s3Revealed, setS3Revealed] = useState(false)\n  const [s3Pin, setS3Pin] = useState(\"\")\n  const [s3PinErr, setS3PinErr] = useState(\"\")"
)

# Replace the resources table rows to hide S3 delete and mask S3 names
old_rows = """                      <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{r._detail}</td>
                    <td style={{ padding:"14px 16px" }}>
                      {(r._type === "s3") && (
                        <button onClick={() => handleDeleteResource(r)}
                          style={{ padding:"4px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>
                          Delete
                        </button>
                      )}
                    </td>"""

new_rows = """                      <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{r._type==="s3" && !s3Revealed ? "--------" : r._detail}</td>
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
                    </td>"""

content = content.replace(old_rows, new_rows)

# Mask S3 bucket names when not revealed
old_name = "                    <td style={{ padding:\"14px 16px\", fontSize:\"13px\", fontWeight:\"600\", color:text }}>{r._label}</td>"
new_name = "                    <td style={{ padding:\"14px 16px\", fontSize:\"13px\", fontWeight:\"600\", color:text }}>{r._type===\"s3\" && !s3Revealed ? r._label.slice(0,3)+\"--------\" : r._label}</td>"
content = content.replace(old_name, new_name)

# Add lock/unlock button in the Your Resources header
old_header = """        <div style={{ padding:"16px 20px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:"15px", fontWeight:"600", color:text }}>Your Resources</div>
          <div style={{ fontSize:"12px", color:muted }}>{resources.length} total</div>
        </div>"""

new_header = """        <div style={{ padding:"16px 20px", borderBottom:"1px solid "+border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:"15px", fontWeight:"600", color:text }}>Your Resources</div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ fontSize:"12px", color:muted }}>{resources.length} total</span>
            {!s3Revealed ? (
              <button onClick={() => {
                const code = window.prompt("Enter access code to reveal S3 buckets:")
                if (code && code.toUpperCase() === "AIONOS") { setS3Revealed(true) }
                else if (code !== null) { alert("Incorrect access code") }
              }} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"5px 12px", borderRadius:"8px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:"1px solid #f59e0b40", background:"#f59e0b15", color:"#f59e0b" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                S3 Locked
              </button>
            ) : (
              <button onClick={() => setS3Revealed(false)} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"5px 12px", borderRadius:"8px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:"1px solid #00d4aa40", background:"#00d4aa15", color:"#00d4aa" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4M7 11V7a5 5 0 0110 0"/></svg>
                S3 Unlocked
              </button>
            )}
          </div>
        </div>"""

content = content.replace(old_header, new_header)

with open("src/pages/Resources.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Done")
