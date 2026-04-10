with open("src/pages/Storage.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "{b.versioning && <span style={{ fontSize:\"10px\", background:\"#3b82f615\", color:\"#3b82f6\", padding:\"1px 6px\", borderRadius:\"4px\", marginTop:\"4px\", display:\"inline-block\" }}>Versioning</span>}",
    """{b.versioning && <span style={{ fontSize:"10px", background:"#3b82f615", color:"#3b82f6", padding:"1px 6px", borderRadius:"4px", marginTop:"4px", display:"inline-block" }}>Versioning</span>}
                      {b.encryption && b.encryption !== "none" && <span style={{ fontSize:"10px", background:"#00d4aa15", color:"#00d4aa", padding:"1px 6px", borderRadius:"4px", marginTop:"4px", marginLeft:"4px", display:"inline-block" }}>{b.encryption==="AES256"?"SSE-S3":"SSE-KMS"}</span>}"""
)

with open("src/pages/Storage.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Storage badge updated")
