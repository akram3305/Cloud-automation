with open("src/pages/Resources.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add encryption to s3Form state
content = content.replace(
    'const [s3Form, setS3Form] = useState({ name:"", region:"ap-south-1", versioning:false, public:false })',
    'const [s3Form, setS3Form] = useState({ name:"", region:"ap-south-1", versioning:false, public:false, encryption:"AES256" })'
)

# Add encryption field to the S3 modal form after the region field
old_s3_checks = """              <div style={{ display:"flex", gap:"20px" }}>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"13px", color:text }}>
                  <input type="checkbox" checked={s3Form.versioning} onChange={e => setS3Form(p=>({...p, versioning:e.target.checked}))} />
                  Enable versioning
                </label>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"13px", color:text }}>
                  <input type="checkbox" checked={s3Form.public} onChange={e => setS3Form(p=>({...p, public:e.target.checked}))} />
                  Public access
                </label>
              </div>"""

new_s3_checks = """              <div>
                <label style={{ display:"block", fontSize:"12px", fontWeight:"500", color:muted, marginBottom:"5px" }}>Server-side encryption</label>
                <div style={{ display:"flex", gap:"8px" }}>
                  {[
                    { value:"AES256",  label:"SSE-S3",    desc:"AES-256 managed by AWS" },
                    { value:"aws:kms", label:"SSE-KMS",   desc:"AWS Key Management Service" },
                    { value:"none",    label:"None",      desc:"No encryption" },
                  ].map(opt => (
                    <div key={opt.value} onClick={() => setS3Form(p=>({...p, encryption:opt.value}))}
                      style={{ flex:1, padding:"10px", borderRadius:"8px", cursor:"pointer", border:"1px solid "+(s3Form.encryption===opt.value?"#00d4aa40":border), background:s3Form.encryption===opt.value?"#00d4aa10":surface, transition:"all 0.15s" }}>
                      <div style={{ fontSize:"12px", fontWeight:"600", color:s3Form.encryption===opt.value?"#00d4aa":text }}>{opt.label}</div>
                      <div style={{ fontSize:"10px", color:muted, marginTop:"2px" }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:"20px" }}>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"13px", color:text }}>
                  <input type="checkbox" checked={s3Form.versioning} onChange={e => setS3Form(p=>({...p, versioning:e.target.checked}))} />
                  Enable versioning
                </label>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"13px", color:text }}>
                  <input type="checkbox" checked={s3Form.public} onChange={e => setS3Form(p=>({...p, public:e.target.checked}))} />
                  Public access
                </label>
              </div>"""

content = content.replace(old_s3_checks, new_s3_checks)

# Update cost estimate note to include encryption info
content = content.replace(
    'Storage: $0.023/GB-month - GET: $0.0004/10K - PUT: $0.005/1K',
    'Storage: $0.023/GB-month - GET: $0.0004/10K - PUT: $0.005/1K | KMS: +$0.03/10K requests'
)

with open("src/pages/Resources.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Frontend updated")
