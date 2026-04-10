with open("src/pages/Storage.jsx", "r", encoding="utf-8") as f:
    content = f.read()

old = """export default function Storage() {
  const { dark } = useTheme()
  const [buckets,       setBuckets]       = useState([])
  const [stats,         setStats]         = useState(null)
  const [selectedBucket,setSel]           = useState(null)
  const [objects,       setObjects]       = useState(null)
  const [prefix,        setPrefix]        = useState("")
  const [loading,       setLoading]       = useState(true)"""

new = """export default function Storage() {
  const { dark } = useTheme()
  const [revealed,      setRevealed]      = useState(false)
  const [pin,           setPin]           = useState("")
  const [pinError,      setPinError]      = useState("")
  const [buckets,       setBuckets]       = useState([])
  const [stats,         setStats]         = useState(null)
  const [selectedBucket,setSel]           = useState(null)
  const [objects,       setObjects]       = useState(null)
  const [prefix,        setPrefix]        = useState("")
  const [loading,       setLoading]       = useState(true)"""

content = content.replace(old, new)

# Add reveal check before main return
old_return = """  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"all 0.3s ease" }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}"}</style>

      {/* Header */}"""

new_return = """  const CORRECT_PIN = "AIONOS"

  if (!revealed) {
    return (
      <div style={{ minHeight:"100vh", background:bg, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
        <div style={{ background:surface, border:"1px solid "+border, borderRadius:"16px", padding:"40px", maxWidth:"400px", width:"100%", textAlign:"center" }}>
          <div style={{ width:"64px", height:"64px", borderRadius:"16px", background:"#f43f5e15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <div style={{ fontSize:"20px", fontWeight:"700", color:text, marginBottom:"8px" }}>Storage Access</div>
          <div style={{ fontSize:"13px", color:muted, marginBottom:"28px" }}>Enter your access code to view S3 buckets</div>
          {pinError && <div style={{ background:"#f43f5e15", color:"#f43f5e", padding:"10px", borderRadius:"8px", fontSize:"13px", marginBottom:"16px" }}>{pinError}</div>}
          <input
            type="password"
            placeholder="Enter access code"
            value={pin}
            onChange={e => { setPin(e.target.value.toUpperCase()); setPinError("") }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (pin === CORRECT_PIN) { setRevealed(true); fetchBuckets() }
                else setPinError("Incorrect access code. Try again.")
              }
            }}
            style={{ width:"100%", padding:"12px 16px", border:"1px solid "+border, borderRadius:"10px", fontSize:"15px", background:surface, color:text, textAlign:"center", letterSpacing:"0.2em", marginBottom:"12px", outline:"none" }}
          />
          <button
            onClick={() => {
              if (pin === CORRECT_PIN) { setRevealed(true); fetchBuckets() }
              else setPinError("Incorrect access code. Try again.")
            }}
            style={{ width:"100%", padding:"12px", borderRadius:"10px", background:"#00d4aa", color:"#0a0f1e", border:"none", fontSize:"14px", fontWeight:"600", cursor:"pointer" }}>
            Unlock Storage
          </button>
          <div style={{ fontSize:"11px", color:muted, marginTop:"16px" }}>Hint: company name in capitals</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding:"28px", background:bg, minHeight:"100vh", transition:"all 0.3s ease" }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}"}</style>

      {/* Header */}"""

content = content.replace(old_return, new_return)

with open("src/pages/Storage.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Done")
