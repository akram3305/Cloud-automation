content = """import { useState, useEffect, useCallback } from "react"
import { createRequest, getInstances, getPriceEstimate } from "../api/api"

const ALL_REGIONS = [
  { value:"ap-south-1",      label:"Asia Pacific (Mumbai)" },
  { value:"ap-south-2",      label:"Asia Pacific (Hyderabad)" },
  { value:"ap-southeast-1",  label:"Asia Pacific (Singapore)" },
  { value:"ap-southeast-2",  label:"Asia Pacific (Sydney)" },
  { value:"ap-southeast-3",  label:"Asia Pacific (Jakarta)" },
  { value:"ap-northeast-1",  label:"Asia Pacific (Tokyo)" },
  { value:"ap-northeast-2",  label:"Asia Pacific (Seoul)" },
  { value:"ap-northeast-3",  label:"Asia Pacific (Osaka)" },
  { value:"ap-east-1",       label:"Asia Pacific (Hong Kong)" },
  { value:"us-east-1",       label:"US East (N. Virginia)" },
  { value:"us-east-2",       label:"US East (Ohio)" },
  { value:"us-west-1",       label:"US West (N. California)" },
  { value:"us-west-2",       label:"US West (Oregon)" },
  { value:"eu-west-1",       label:"Europe (Ireland)" },
  { value:"eu-west-2",       label:"Europe (London)" },
  { value:"eu-west-3",       label:"Europe (Paris)" },
  { value:"eu-central-1",    label:"Europe (Frankfurt)" },
  { value:"eu-north-1",      label:"Europe (Stockholm)" },
  { value:"eu-south-1",      label:"Europe (Milan)" },
  { value:"sa-east-1",       label:"South America (Sao Paulo)" },
  { value:"ca-central-1",    label:"Canada (Central)" },
  { value:"me-south-1",      label:"Middle East (Bahrain)" },
  { value:"me-central-1",    label:"Middle East (UAE)" },
  { value:"af-south-1",      label:"Africa (Cape Town)" },
  { value:"il-central-1",    label:"Israel (Tel Aviv)" },
]

const AMIS = {
  "ap-south-1":"ami-0f58b397bc5c1f2e8","ap-southeast-1":"ami-0b84d2c53ad5250a5",
  "ap-southeast-2":"ami-0dc96254d5535925c","ap-northeast-1":"ami-0d0b31d9e9cae44d5",
  "ap-northeast-2":"ami-0e1d09d8b7c751816","us-east-1":"ami-0c55b159cbfafe1f0",
  "us-east-2":"ami-0a0ad6b70e61be944","us-west-1":"ami-01311df3780ebd33e",
  "us-west-2":"ami-0a36eb8fadc976275","eu-west-1":"ami-08935252a36e25f85",
  "eu-west-2":"ami-01419b804382064e4","eu-west-3":"ami-04992646d54c69ef4",
  "eu-central-1":"ami-0767046d1677be5a0","eu-north-1":"ami-0b7a46b4bd694e8a6",
  "sa-east-1":"ami-0fb4cf3a99aa89f72","ca-central-1":"ami-0d4ae09ec9361d8ac",
  "me-south-1":"ami-0e7d4a4adf3ca9e5d","af-south-1":"ami-0720a3ca2735bf9af",
}

const FAMILY_COLORS = {
  "General Purpose":"#378ADD","Compute Optimized":"#16a34a",
  "Memory Optimized":"#9333ea","Storage Optimized":"#d97706",
  "GPU":"#dc2626","All":"#64748b"
}

export default function CreateVMModal({ onClose, onSuccess }) {
  const [step, setStep]             = useState("config")
  const [vmName, setVmName]         = useState("")
  const [region, setRegion]         = useState("ap-south-1")
  const [ebsSize, setEbsSize]       = useState(20)
  const [customEbs, setCustomEbs]   = useState("")
  const [useCustomEbs, setUseCustomEbs] = useState(false)
  const [vcpuMin, setVcpuMin]       = useState("")
  const [vcpuMax, setVcpuMax]       = useState("")
  const [ramMin, setRamMin]         = useState("")
  const [ramMax, setRamMax]         = useState("")
  const [family, setFamily]         = useState("All")
  const [search, setSearch]         = useState("")
  const [families, setFamilies]     = useState([])
  const [instances, setInstances]   = useState([])
  const [loading, setLoading]       = useState(false)
  const [selectedInstance, setSel]  = useState(null)
  const [prices, setPrices]         = useState(null)
  const [loadingPrices, setLPrice]  = useState(false)
  const [selectedProvider, setProv] = useState("aws")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState("")

  const fetchInstances = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (vcpuMin) params.vcpu_min = parseInt(vcpuMin)
      if (vcpuMax) params.vcpu_max = parseInt(vcpuMax)
      if (ramMin)  params.ram_min  = parseFloat(ramMin)
      if (ramMax)  params.ram_max  = parseFloat(ramMax)
      if (family && family !== "All") params.family = family
      if (search)  params.search   = search
      const { data } = await getInstances(params)
      setInstances(data.instances)
      setFamilies(data.families || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [vcpuMin, vcpuMax, ramMin, ramMax, family, search])

  useEffect(() => { fetchInstances() }, [fetchInstances])

  async function handleSelectInstance(inst) {
    setSel(inst)
    setStep("prices")
    setLPrice(true)
    try {
      const { data } = await getPriceEstimate(inst.instance_type, region)
      setPrices(data)
      const cheapId = Object.entries(data.providers).reduce((a,b) => a[1].monthly < b[1].monthly ? a : b)[0]
      setProv(cheapId)
    } catch(e) { console.error(e) }
    finally { setLPrice(false) }
  }

  const finalEbs = useCustomEbs ? parseInt(customEbs)||20 : ebsSize
  const cheapId  = prices ? Object.entries(prices.providers).reduce((a,b) => a[1].monthly < b[1].monthly ? a : b)[0] : null

  async function handleConfirm() {
    if (!vmName.trim()) { setError("VM name is required"); return }
    setSubmitting(true)
    try {
      await createRequest({
        resource_type:"vm", resource_name:vmName,
        instance_type: selectedInstance.instance_type,
        region, ami_id: AMIS[region]||AMIS["ap-south-1"],
        key_pair_name:"Aionos-terraform-automate",
        security_group_ids:[], subnet_id:"",
        tags:{ Environment:"dev", Project:"aionos", Provider:selectedProvider, EBS: finalEbs+"GB" }
      })
      onSuccess()
    } catch(e) {
      setError(e.response?.data?.detail||"Failed to submit")
      setSubmitting(false)
    }
  }

  const inp = { padding:"7px 10px", border:"1px solid #e2e8f0", borderRadius:"6px", fontSize:"13px", width:"100%", background:"#fff" }

  return (
    <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"20px" }}>
      <div style={{ background:"#fff",borderRadius:"12px",border:"0.5px solid #e2e8f0",width:"100%",maxWidth:"760px",maxHeight:"92vh",overflow:"auto" }}>

        {step === "config" && (
          <>
            <div style={{ padding:"18px 24px",borderBottom:"0.5px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div>
                <div style={{ fontSize:"16px",fontWeight:"500" }}>Configure VM</div>
                <div style={{ fontSize:"12px",color:"#64748b",marginTop:"2px" }}>Filter instances by vCPU, RAM, storage and family</div>
              </div>
              <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",fontSize:"20px",color:"#94a3b8" }}>x</button>
            </div>

            <div style={{ padding:"16px 24px",background:"#f8fafc",borderBottom:"0.5px solid #e2e8f0" }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"12px" }}>
                <div>
                  <label style={{ display:"block",fontSize:"11px",fontWeight:"500",color:"#64748b",marginBottom:"5px" }}>vCPU min</label>
                  <input type="number" placeholder="e.g. 2" value={vcpuMin} onChange={e=>setVcpuMin(e.target.value)} style={inp} min="1" />
                </div>
                <div>
                  <label style={{ display:"block",fontSize:"11px",fontWeight:"500",color:"#64748b",marginBottom:"5px" }}>vCPU max</label>
                  <input type="number" placeholder="e.g. 16" value={vcpuMax} onChange={e=>setVcpuMax(e.target.value)} style={inp} min="1" />
                </div>
                <div>
                  <label style={{ display:"block",fontSize:"11px",fontWeight:"500",color:"#64748b",marginBottom:"5px" }}>Search instance</label>
                  <input type="text" placeholder="e.g. t3, c5, m5" value={search} onChange={e=>setSearch(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ display:"block",fontSize:"11px",fontWeight:"500",color:"#64748b",marginBottom:"5px" }}>RAM min (GB)</label>
                  <input type="number" placeholder="e.g. 4" value={ramMin} onChange={e=>setRamMin(e.target.value)} style={inp} min="0.5" step="0.5" />
                </div>
                <div>
                  <label style={{ display:"block",fontSize:"11px",fontWeight:"500",color:"#64748b",marginBottom:"5px" }}>RAM max (GB)</label>
                  <input type="number" placeholder="e.g. 64" value={ramMax} onChange={e=>setRamMax(e.target.value)} style={inp} min="0.5" step="0.5" />
                </div>
                <div>
                  <label style={{ display:"block",fontSize:"11px",fontWeight:"500",color:"#64748b",marginBottom:"5px" }}>Region</label>
                  <select value={region} onChange={e=>setRegion(e.target.value)} style={inp}>
                    {ALL_REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom:"12px" }}>
                <label style={{ display:"block",fontSize:"11px",fontWeight:"500",color:"#64748b",marginBottom:"6px" }}>Instance family</label>
                <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
                  {(families.length ? families : ["All","General Purpose","Compute Optimized","Memory Optimized","Storage Optimized","GPU"]).map(f => (
                    <button key={f} onClick={() => setFamily(f)}
                      style={{ padding:"4px 12px",borderRadius:"20px",fontSize:"11px",cursor:"pointer",border:"1px solid",
                        borderColor:family===f?(FAMILY_COLORS[f]||"#378ADD"):"#e2e8f0",
                        background:family===f?(FAMILY_COLORS[f]||"#378ADD"):"#fff",
                        color:family===f?"#fff":"#475569",fontWeight:family===f?"500":"400" }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display:"block",fontSize:"11px",fontWeight:"500",color:"#64748b",marginBottom:"6px" }}>EBS storage size</label>
                <div style={{ display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap" }}>
                  {[8,20,50,100,200,500,1000].map(s => (
                    <button key={s} onClick={() => { setEbsSize(s); setUseCustomEbs(false) }}
                      style={{ padding:"4px 10px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid",
                        borderColor:!useCustomEbs&&ebsSize===s?"#378ADD":"#e2e8f0",
                        background:!useCustomEbs&&ebsSize===s?"#378ADD":"#fff",
                        color:!useCustomEbs&&ebsSize===s?"#fff":"#475569" }}>
                      {s} GB
                    </button>
                  ))}
                  <input type="number" placeholder="Custom GB" value={customEbs}
                    onChange={e => { setCustomEbs(e.target.value); setUseCustomEbs(true) }}
                    style={{ ...inp, width:"110px", borderColor:useCustomEbs?"#378ADD":"#e2e8f0" }} min="1" />
                </div>
              </div>
            </div>

            <div style={{ padding:"12px 24px" }}>
              <div style={{ fontSize:"12px",color:"#64748b",marginBottom:"10px" }}>
                {loading ? "Loading..." : `${instances.length} instances found - click to see live prices`}
              </div>
              <div style={{ maxHeight:"380px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"4px" }}>
                {instances.map(inst => (
                  <div key={inst.instance_type} onClick={() => handleSelectInstance(inst)}
                    style={{ display:"flex",alignItems:"center",padding:"10px 12px",border:"0.5px solid #e2e8f0",borderRadius:"8px",cursor:"pointer",gap:"12px" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                    onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <div style={{ fontFamily:"monospace",fontSize:"12px",fontWeight:"500",color:"#1e293b",minWidth:"130px" }}>{inst.instance_type}</div>
                    <div style={{ display:"inline-block",padding:"2px 8px",borderRadius:"10px",fontSize:"10px",background:(FAMILY_COLORS[inst.family]||"#378ADD")+"20",color:FAMILY_COLORS[inst.family]||"#378ADD",fontWeight:"500",minWidth:"120px",textAlign:"center" }}>{inst.family}</div>
                    <div style={{ display:"flex",gap:"12px",flex:1,fontSize:"11px",color:"#64748b" }}>
                      <span>{inst.vcpu} vCPU</span>
                      <span>{inst.ram} GB</span>
                      <span style={{ color:inst.storage==="EBS only"?"#94a3b8":"#0f766e" }}>{inst.storage}</span>
                      <span style={{ color:"#94a3b8",fontSize:"10px" }}>{inst.network}</span>
                    </div>
                    <div style={{ textAlign:"right",flexShrink:0 }}>
                      <div style={{ fontSize:"13px",fontWeight:"500",color:"#1e293b" }}>${inst.aws_monthly.toFixed(2)}<span style={{ fontSize:"10px",fontWeight:"400",color:"#94a3b8" }}>/mo</span></div>
                      <div style={{ fontSize:"10px",color:"#94a3b8" }}>${inst.aws_hourly.toFixed(4)}/hr</div>
                    </div>
                    <div style={{ color:"#94a3b8" }}>-</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding:"12px 24px",borderTop:"0.5px solid #e2e8f0",display:"flex",justifyContent:"flex-end" }}>
              <button onClick={onClose} style={{ padding:"8px 18px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",border:"1px solid #e2e8f0",background:"#fff" }}>Cancel</button>
            </div>
          </>
        )}

        {step === "prices" && (
          <>
            <div style={{ padding:"18px 24px",borderBottom:"0.5px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div>
                <div style={{ fontSize:"16px",fontWeight:"500" }}>Live cost estimate</div>
                <div style={{ fontSize:"12px",color:"#64748b",marginTop:"2px" }}>{loadingPrices?"Fetching live prices...":"Select provider then confirm"}</div>
              </div>
              <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",fontSize:"20px",color:"#94a3b8" }}>x</button>
            </div>

            {selectedInstance && (
              <div style={{ padding:"10px 24px",background:"#f8fafc",borderBottom:"0.5px solid #e2e8f0",display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"center" }}>
                <span style={{ fontFamily:"monospace",fontSize:"12px",fontWeight:"500",background:"#fff",border:"0.5px solid #e2e8f0",padding:"3px 10px",borderRadius:"6px" }}>{selectedInstance.instance_type}</span>
                <span style={{ fontSize:"12px",color:"#64748b" }}>{selectedInstance.vcpu} vCPU</span>
                <span style={{ fontSize:"12px",color:"#64748b" }}>{selectedInstance.ram} GB RAM</span>
                <span style={{ fontSize:"12px",color:"#64748b" }}>EBS {finalEbs} GB</span>
                <span style={{ fontSize:"12px",color:"#64748b" }}>{ALL_REGIONS.find(r=>r.value===region)?.label||region}</span>
              </div>
            )}

            <div style={{ padding:"16px 24px 8px" }}>
              {error && <div style={{ background:"#fee2e2",color:"#7f1d1d",padding:"10px 14px",borderRadius:"8px",fontSize:"13px",marginBottom:"12px" }}>{error}</div>}
              <label style={{ display:"block",fontSize:"12px",fontWeight:"500",color:"#64748b",marginBottom:"6px" }}>VM name</label>
              <input type="text" placeholder="e.g. prod-api-server" value={vmName} onChange={e=>setVmName(e.target.value)}
                style={{ width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:"8px",fontSize:"14px" }} />
            </div>

            <div style={{ padding:"12px 24px",display:"flex",flexDirection:"column",gap:"8px" }}>
              {loadingPrices ? (
                <div style={{ padding:"32px",textAlign:"center",color:"#94a3b8" }}>Fetching live prices from all providers...</div>
              ) : prices && Object.entries(prices.providers).map(([id,p]) => (
                <div key={id} onClick={() => setProv(id)}
                  style={{ border:selectedProvider===id?"2px solid #378ADD":"0.5px solid #e2e8f0",borderRadius:"10px",padding:"12px 16px",display:"flex",alignItems:"center",gap:"14px",cursor:"pointer" }}>
                  <div style={{ width:"34px",height:"34px",borderRadius:"8px",background:p.color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"500",color:p.color,flexShrink:0 }}>{p.short}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"13px",fontWeight:"500",color:"#1e293b" }}>{p.name}</div>
                    <div style={{ fontSize:"11px",color:"#64748b",marginTop:"1px" }}>{p.spec}</div>
                    <div style={{ fontSize:"10px",color:p.source==="live"?"#16a34a":"#94a3b8",marginTop:"1px" }}>{p.source==="live"?"Live price":"Estimated"}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:"17px",fontWeight:"500",color:id===cheapId?"#16a34a":"#1e293b" }}>
                      ${p.monthly.toFixed(2)}<span style={{ fontSize:"11px",fontWeight:"400",color:"#94a3b8" }}>/mo</span>
                    </div>
                    <div style={{ fontSize:"10px",color:"#94a3b8" }}>${p.hourly.toFixed(4)}/hr</div>
                    {id===cheapId && <div style={{ fontSize:"10px",background:"#dcfce7",color:"#14532d",borderRadius:"10px",padding:"1px 8px",marginTop:"3px",display:"inline-block" }}>Cheapest</div>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ margin:"0 24px 12px",background:"#f0fdf4",border:"0.5px solid #bbf7d0",borderRadius:"8px",padding:"10px 14px",fontSize:"12px",color:"#166534" }}>
              EBS {finalEbs} GB adds <strong>${(finalEbs*0.1).toFixed(2)}/mo</strong> - Total estimate: <strong>${((prices?.providers[selectedProvider]?.monthly||0)+finalEbs*0.1).toFixed(2)}/mo</strong>
            </div>

            <div style={{ padding:"14px 24px",borderTop:"0.5px solid #e2e8f0",display:"flex",gap:"10px",alignItems:"center" }}>
              <button onClick={() => setStep("config")} style={{ padding:"8px 16px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",border:"1px solid #e2e8f0",background:"#fff" }}>Back</button>
              <div style={{ flex:1 }} />
              <button onClick={handleConfirm} disabled={submitting||loadingPrices}
                style={{ padding:"9px 20px",borderRadius:"8px",fontSize:"13px",fontWeight:"500",cursor:"pointer",border:"none",background:"#16a34a",color:"#fff",opacity:submitting?0.7:1 }}>
                {submitting?"Submitting...":"Confirm & Provision"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
"""
with open("src/components/CreateVMModal.jsx", "w", newline="\n", encoding="utf-8") as f:
    f.write(content)
print("Done")
