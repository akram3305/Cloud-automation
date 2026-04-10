with open("src/components/CreateVMModal.jsx", "r", encoding="utf-8") as f:
    content = f.read()

old = """                <div style={{ flex:1 }}>
                    <div style={{ fontSize:"13px",fontWeight:"500",color:"#1e293b" }}>{p.name}</div>
                    <div style={{ fontSize:"11px",color:"#64748b",marginTop:"1px" }}>{p.spec}</div>
                    <div style={{ fontSize:"10px",color:p.source==="live"?"#16a34a":"#94a3b8",marginTop:"1px" }}>{p.source==="live"?"Live price":"Estimated"}</div>
                  </div>"""

new = """                <div style={{ flex:1 }}>
                    <div style={{ fontSize:"13px",fontWeight:"500",color:"#1e293b" }}>{p.name}</div>
                    <div style={{ fontSize:"11px",color:"#374151",marginTop:"2px",fontFamily:"monospace" }}>{p.details || p.spec}</div>
                    <div style={{ display:"flex",gap:"8px",marginTop:"4px",flexWrap:"wrap" }}>
                      <span style={{ fontSize:"10px",background:"#f1f5f9",color:"#475569",padding:"1px 6px",borderRadius:"4px" }}>{p.vcpu} vCPU</span>
                      <span style={{ fontSize:"10px",background:"#f1f5f9",color:"#475569",padding:"1px 6px",borderRadius:"4px" }}>{p.ram} GB RAM</span>
                      <span style={{ fontSize:"10px",color:p.source==="live"?"#16a34a":"#94a3b8",fontWeight:"500" }}>{p.source==="live"?"Live":"Est."}</span>
                    </div>
                  </div>"""

content = content.replace(old, new)
with open("src/components/CreateVMModal.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Done step 4")
