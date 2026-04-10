with open("src/pages/Resources.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the S3 collapsed row to add Create button
old = """                    <td style={{ padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <span style={{ fontSize:"13px", fontWeight:"600", color:text }}>S3 Buckets</span>
                        <span style={{ background:"#00d4aa15", color:"#00d4aa", padding:"2px 8px", borderRadius:"10px", fontSize:"11px", fontWeight:"600" }}>{resources.filter(r=>r._type==="s3").length}</span>
                        {!s3Revealed && <span style={{ fontSize:"10px", background:"#f59e0b15", color:"#f59e0b", padding:"2px 8px", borderRadius:"10px", fontWeight:"600" }}>LOCKED</span>}
                      </div>
                    </td>"""

new = """                    <td style={{ padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                        <span style={{ fontSize:"13px", fontWeight:"600", color:text }}>S3 Buckets</span>
                        <span style={{ background:"#00d4aa15", color:"#00d4aa", padding:"2px 8px", borderRadius:"10px", fontSize:"11px", fontWeight:"600" }}>{resources.filter(r=>r._type==="s3").length}</span>
                        {!s3Revealed && <span style={{ fontSize:"10px", background:"#f59e0b15", color:"#f59e0b", padding:"2px 8px", borderRadius:"10px", fontWeight:"600" }}>LOCKED</span>}
                        {s3Revealed && s3Expanded && (
                          <button onClick={e => { e.stopPropagation(); setS3Modal(true) }}
                            style={{ padding:"3px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e" }}>
                            + Create Bucket
                          </button>
                        )}
                      </div>
                    </td>"""

content = content.replace(old, new)

with open("src/pages/Resources.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Done")
