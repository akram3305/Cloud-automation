import { useState } from "react"
import { setSchedule } from "../api/api"
import { useTheme } from "../context/ThemeContext"

const PRESETS = [
  { label:"Office Hours",   start:"09:00", stop:"18:00", icon:"💼" },
  { label:"Half Day AM",    start:"09:00", stop:"13:00", icon:"🌅" },
  { label:"Half Day PM",    start:"13:00", stop:"18:00", icon:"🌇" },
  { label:"Extended",       start:"08:00", stop:"20:00", icon:"⏰" },
  { label:"Night Shift",    start:"20:00", stop:"06:00", icon:"🌙" },
  { label:"Dev Hours",      start:"10:00", stop:"22:00", icon:"💻" },
  { label:"24hr (no stop)", start:"00:00", stop:"",      icon:"♾️" },
  { label:"Clear All",      start:"",      stop:"",      icon:"🗑️" },
]

const HOURS = ["12","01","02","03","04","05","06","07","08","09","10","11"]
const MINS  = ["00","05","10","15","20","25","30","35","40","45","50","55"]
const DAYS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

function to12h(time24) {
  if (!time24) return { h:"09", m:"00", ampm:"AM" }
  const [hStr, mStr] = time24.split(":")
  const h = parseInt(hStr)
  return {
    h: String(h === 0 ? 12 : h > 12 ? h - 12 : h).padStart(2,"0"),
    m: mStr || "00",
    ampm: h < 12 ? "AM" : "PM"
  }
}

function to24h(h, m, ampm) {
  let hour = parseInt(h)
  if (ampm === "AM" && hour === 12) hour = 0
  else if (ampm === "PM" && hour !== 12) hour += 12
  return String(hour).padStart(2,"0") + ":" + m
}

function fmt12(t) {
  if (!t) return "Not set"
  const { h, m, ampm } = to12h(t)
  return parseInt(h) + ":" + m + " " + ampm
}

export default function ScheduleModal({ vm, onClose, onSaved }) {
  const { dark } = useTheme()
  const [autoStart, setAutoStart] = useState(vm.auto_start || "")
  const [autoStop,  setAutoStop]  = useState(vm.auto_stop  || "")
  const [saving, setSaving]       = useState(false)
  const [saved,  setSaved]        = useState(false)
  const [error,  setError]        = useState("")
  const [tab,    setTab]          = useState("presets")
  const [activeDays, setActiveDays] = useState(["Mon","Tue","Wed","Thu","Fri"])

  const startP = to12h(autoStart)
  const stopP  = to12h(autoStop)
  const [startH, setStartH] = useState(startP.h)
  const [startM, setStartM] = useState(startP.m)
  const [startAP, setStartAP] = useState(startP.ampm)
  const [stopH,  setStopH]  = useState(stopP.h)
  const [stopM,  setStopM]  = useState(stopP.m)
  const [stopAP, setStopAP] = useState(stopP.ampm)

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#475569" : "#64748b"
  const subtle  = dark ? "#1e293b" : "#f8fafc"

  function updateStart(h, m, ap) {
    setStartH(h); setStartM(m); setStartAP(ap)
    setAutoStart(to24h(h, m, ap))
  }
  function updateStop(h, m, ap) {
    setStopH(h); setStopM(m); setStopAP(ap)
    setAutoStop(to24h(h, m, ap))
  }

  function applyPreset(p) {
    setAutoStart(p.start)
    setAutoStop(p.stop)
    if (p.start) { const x=to12h(p.start); setStartH(x.h); setStartM(x.m); setStartAP(x.ampm) }
    if (p.stop)  { const x=to12h(p.stop);  setStopH(x.h);  setStopM(x.m);  setStopAP(x.ampm) }
  }

  function toggleDay(d) {
    setActiveDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d])
  }

  async function handleSave() {
    setSaving(true); setError("")
    try { await setSchedule(vm.id, autoStart, autoStop); setSaved(true); setTimeout(()=>{ onSaved() }, 1500) }
    catch(e) { setError(e.response?.data?.detail || e.message) }
    finally { setSaving(false) }
  }

  const btnSel = (active, color) => ({
    padding:"7px 11px", borderRadius:"8px", fontSize:"13px", fontWeight:"600",
    cursor:"pointer", border:"1px solid "+(active?color+"60":border),
    background: active ? color+"20" : surface, color: active ? color : muted,
    transition:"all 0.15s", minWidth:"42px", textAlign:"center"
  })

  const tabStyle = (active) => ({
    padding:"8px 16px", borderRadius:"8px", fontSize:"13px", fontWeight:"500",
    cursor:"pointer", border:"none",
    background: active ? "#00d4aa20" : "transparent",
    color: active ? "#00d4aa" : muted, transition:"all 0.15s"
  })

  const estimatedSaving = () => {
    if (!autoStart || !autoStop) return null
    const [sh,sm] = autoStart.split(":").map(Number)
    const [eh,em] = autoStop.split(":").map(Number)
    let runMins = (eh*60+em) - (sh*60+sm)
    if (runMins < 0) runMins += 1440
    const offMins = 1440 - runMins
    const savePct = Math.round((offMins / 1440) * 100)
    return savePct
  }
  const saving_pct = estimatedSaving()

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:"16px" }}>
      <div style={{ background:surface, borderRadius:"18px", border:"1px solid "+border, width:"100%", maxWidth:"580px", maxHeight:"92vh", overflow:"auto" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid "+border }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:"17px", fontWeight:"700", color:text }}>Schedule Auto Start / Stop</div>
              <div style={{ fontSize:"12px", color:muted, marginTop:"3px", display:"flex", gap:"10px", alignItems:"center" }}>
                <span style={{ color:"#00d4aa", fontFamily:"monospace" }}>{vm.name}</span>
                <span style={{ background:vm.state==="running"?"#00d4aa20":"#f59e0b20", color:vm.state==="running"?"#00d4aa":"#f59e0b", padding:"1px 8px", borderRadius:"10px", fontSize:"11px" }}>{vm.state}</span>
                <span style={{ color:muted }}>{vm.instance_type}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"22px", color:muted, lineHeight:1 }}>x</button>
          </div>

          {/* Current schedule summary */}
          {(vm.auto_start || vm.auto_stop) && (
            <div style={{ marginTop:"12px", background:dark?"#00d4aa08":"#f0fdf4", border:"1px solid #00d4aa30", borderRadius:"8px", padding:"8px 14px", fontSize:"12px", display:"flex", gap:"16px" }}>
              <span style={{ color:muted }}>Current:</span>
              {vm.auto_start && <span><span style={{ color:"#00d4aa" }}>Start</span> {fmt12(vm.auto_start)}</span>}
              {vm.auto_stop  && <span><span style={{ color:"#f43f5e" }}>Stop</span> {fmt12(vm.auto_stop)}</span>}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ padding:"12px 24px 0", display:"flex", gap:"4px", borderBottom:"1px solid "+border }}>
          {[["presets","Quick Presets"],["picker","Time Picker"],["days","Active Days"],["info","Cost Savings"]].map(([id,label]) => (
            <button key={id} onClick={()=>setTab(id)} style={tabStyle(tab===id)}>{label}</button>
          ))}
        </div>

        <div style={{ padding:"20px 24px" }}>
          {error && <div style={{ background:"#f43f5e15", color:"#f43f5e", padding:"10px", borderRadius:"8px", fontSize:"13px", marginBottom:"14px" }}>{error}</div>}

          {/* PRESETS TAB */}
          {tab==="presets" && (
            <div>
              <div style={{ fontSize:"13px", color:muted, marginBottom:"14px" }}>Select a preset to quickly configure your schedule</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                {PRESETS.map(p => (
                  <div key={p.label} onClick={() => applyPreset(p)}
                    style={{ padding:"12px 16px", borderRadius:"10px", cursor:"pointer", border:"1px solid "+(autoStart===p.start&&autoStop===p.stop?"#00d4aa40":border), background:autoStart===p.start&&autoStop===p.stop?"#00d4aa10":subtle, transition:"all 0.2s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="#00d4aa40";e.currentTarget.style.background="#00d4aa08"}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=autoStart===p.start&&autoStop===p.stop?"#00d4aa40":border;e.currentTarget.style.background=autoStart===p.start&&autoStop===p.stop?"#00d4aa10":subtle}}>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                      <span style={{ fontSize:"16px" }}>{p.icon}</span>
                      <span style={{ fontSize:"13px", fontWeight:"600", color:text }}>{p.label}</span>
                    </div>
                    <div style={{ fontSize:"11px", color:muted }}>
                      {p.start ? fmt12(p.start) : "No start"} {p.start||p.stop?" → ":""} {p.stop ? fmt12(p.stop) : p.start?"No stop":""}
                      {!p.start && !p.stop && <span style={{ color:"#f43f5e" }}>Remove all schedules</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TIME PICKER TAB */}
          {tab==="picker" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
              {/* Start */}
              <div style={{ background:subtle, borderRadius:"12px", padding:"16px", border:"1px solid "+border }}>
                <div style={{ fontSize:"13px", fontWeight:"600", color:"#00d4aa", marginBottom:"12px", display:"flex", alignItems:"center", gap:"6px" }}>
                  <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#00d4aa" }} />
                  Auto Start
                  {autoStart && <span style={{ marginLeft:"auto", background:"#00d4aa20", color:"#00d4aa", padding:"2px 8px", borderRadius:"8px", fontSize:"11px" }}>{fmt12(autoStart)}</span>}
                </div>
                <div style={{ marginBottom:"10px" }}>
                  <div style={{ fontSize:"10px", color:muted, marginBottom:"5px", textTransform:"uppercase" }}>Hour</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
                    {HOURS.map(h => <button key={h} onClick={()=>updateStart(h,startM,startAP)} style={btnSel(startH===h,"#00d4aa")}>{parseInt(h)}</button>)}
                  </div>
                </div>
                <div style={{ marginBottom:"10px" }}>
                  <div style={{ fontSize:"10px", color:muted, marginBottom:"5px", textTransform:"uppercase" }}>Minute</div>
                  <div style={{ display:"flex", gap:"4px" }}>
                    {MINS.map(m => <button key={m} onClick={()=>updateStart(startH,m,startAP)} style={btnSel(startM===m,"#00d4aa")}>{m}</button>)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:"10px", color:muted, marginBottom:"5px", textTransform:"uppercase" }}>AM / PM</div>
                  <div style={{ display:"flex", gap:"6px" }}>
                    {["AM","PM"].map(ap => <button key={ap} onClick={()=>updateStart(startH,startM,ap)} style={{...btnSel(startAP===ap,"#00d4aa"),flex:1,fontSize:"14px",fontWeight:"700",padding:"8px"}}>{ap}</button>)}
                  </div>
                </div>
                <div style={{marginTop:"10px"}}>
                  <div style={{fontSize:"10px",color:muted,marginBottom:"5px",textTransform:"uppercase"}}>Custom Time</div>
                  <input type="time" value={autoStart} onChange={e=>{const v=e.target.value;setAutoStart(v);if(v){const x=to12h(v);setStartH(x.h);setStartM(x.m);setStartAP(x.ampm)}}}
                    style={{width:"100%",padding:"8px 12px",border:"1px solid #00d4aa40",borderRadius:"8px",fontSize:"14px",fontWeight:"600",background:"#00d4aa10",color:"#00d4aa",cursor:"pointer"}} />
                </div>
                {autoStart && <button onClick={()=>{setAutoStart("");setStartH("09");setStartM("00");setStartAP("AM")}} style={{marginTop:"8px",width:"100%",padding:"5px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #f43f5e30",background:"#f43f5e10",color:"#f43f5e"}}>Clear Start</button>}
              </div>

              {/* Stop */}
              <div style={{ background:subtle, borderRadius:"12px", padding:"16px", border:"1px solid "+border }}>
                <div style={{ fontSize:"13px", fontWeight:"600", color:"#f43f5e", marginBottom:"12px", display:"flex", alignItems:"center", gap:"6px" }}>
                  <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#f43f5e" }} />
                  Auto Stop
                  {autoStop && <span style={{ marginLeft:"auto", background:"#f43f5e20", color:"#f43f5e", padding:"2px 8px", borderRadius:"8px", fontSize:"11px" }}>{fmt12(autoStop)}</span>}
                </div>
                <div style={{ marginBottom:"10px" }}>
                  <div style={{ fontSize:"10px", color:muted, marginBottom:"5px", textTransform:"uppercase" }}>Hour</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
                    {HOURS.map(h => <button key={h} onClick={()=>updateStop(h,stopM,stopAP)} style={btnSel(stopH===h,"#f43f5e")}>{parseInt(h)}</button>)}
                  </div>
                </div>
                <div style={{ marginBottom:"10px" }}>
                  <div style={{ fontSize:"10px", color:muted, marginBottom:"5px", textTransform:"uppercase" }}>Minute</div>
                  <div style={{ display:"flex", gap:"4px" }}>
                    {MINS.map(m => <button key={m} onClick={()=>updateStop(stopH,m,stopAP)} style={btnSel(stopM===m,"#f43f5e")}>{m}</button>)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:"10px", color:muted, marginBottom:"5px", textTransform:"uppercase" }}>AM / PM</div>
                  <div style={{ display:"flex", gap:"6px" }}>
                    {["AM","PM"].map(ap => <button key={ap} onClick={()=>updateStop(stopH,stopM,ap)} style={{...btnSel(stopAP===ap,"#f43f5e"),flex:1,fontSize:"14px",fontWeight:"700",padding:"8px"}}>{ap}</button>)}
                  </div>
                </div>
                <div style={{marginTop:"10px"}}>
                  <div style={{fontSize:"10px",color:muted,marginBottom:"5px",textTransform:"uppercase"}}>Custom Time</div>
                  <input type="time" value={autoStop} onChange={e=>{const v=e.target.value;setAutoStop(v);if(v){const x=to12h(v);setStopH(x.h);setStopM(x.m);setStopAP(x.ampm)}}}
                    style={{width:"100%",padding:"8px 12px",border:"1px solid #f43f5e40",borderRadius:"8px",fontSize:"14px",fontWeight:"600",background:"#f43f5e10",color:"#f43f5e",cursor:"pointer"}} />
                </div>
                {autoStop && <button onClick={()=>{setAutoStop("");setStopH("06");setStopM("00");setStopAP("PM")}} style={{marginTop:"8px",width:"100%",padding:"5px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #f43f5e30",background:"#f43f5e10",color:"#f43f5e"}}>Clear Stop</button>}
              </div>
            </div>
          )}

          {/* DAYS TAB */}
          {tab==="days" && (
            <div>
              <div style={{ fontSize:"13px", color:muted, marginBottom:"14px" }}>Choose which days this schedule is active</div>
              <div style={{ display:"flex", gap:"8px", marginBottom:"16px" }}>
                {DAYS.map(d => (
                  <button key={d} onClick={()=>toggleDay(d)} style={{ flex:1, padding:"12px 4px", borderRadius:"10px", fontSize:"12px", fontWeight:"600", cursor:"pointer", border:"1px solid "+(activeDays.includes(d)?"#00d4aa40":border), background:activeDays.includes(d)?"#00d4aa20":subtle, color:activeDays.includes(d)?"#00d4aa":muted, transition:"all 0.15s" }}>
                    {d}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", gap:"8px", marginBottom:"16px" }}>
                <button onClick={()=>setActiveDays(["Mon","Tue","Wed","Thu","Fri"])} style={{ padding:"6px 14px", borderRadius:"8px", fontSize:"12px", cursor:"pointer", border:"1px solid "+border, background:subtle, color:muted }}>Weekdays</button>
                <button onClick={()=>setActiveDays(["Sat","Sun"])} style={{ padding:"6px 14px", borderRadius:"8px", fontSize:"12px", cursor:"pointer", border:"1px solid "+border, background:subtle, color:muted }}>Weekend</button>
                <button onClick={()=>setActiveDays([...DAYS])} style={{ padding:"6px 14px", borderRadius:"8px", fontSize:"12px", cursor:"pointer", border:"1px solid "+border, background:subtle, color:muted }}>Every Day</button>
              </div>
              <div style={{ background:subtle, borderRadius:"10px", padding:"12px 16px", fontSize:"12px", color:muted }}>
                <div style={{ fontWeight:"600", color:text, marginBottom:"4px" }}>Active on</div>
                <div>{activeDays.length > 0 ? activeDays.join(", ") : "No days selected"}</div>
                <div style={{ marginTop:"6px", fontSize:"11px", color:"#f59e0b" }}>Note: Day-based scheduling coming soon. Currently runs daily.</div>
              </div>
            </div>
          )}

          {/* COST SAVINGS TAB */}
          {tab==="info" && (
            <div>
              <div style={{ fontSize:"13px", color:muted, marginBottom:"16px" }}>Estimated cost savings based on your schedule</div>
              {saving_pct ? (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px", marginBottom:"16px" }}>
                    {[
                      { label:"Runtime/day",  value: autoStart&&autoStop ? (() => { const [sh,sm]=autoStart.split(":").map(Number); const [eh,em]=autoStop.split(":").map(Number); let m=(eh*60+em)-(sh*60+sm); if(m<0)m+=1440; return Math.round(m/60*10)/10+"h" })() : "--", color:"#3b82f6" },
                      { label:"Off time/day", value: saving_pct ? (24 - parseFloat((() => { const [sh,sm]=autoStart.split(":").map(Number); const [eh,em]=autoStop.split(":").map(Number); let m=(eh*60+em)-(sh*60+sm); if(m<0)m+=1440; return Math.round(m/60*10)/10 })())) + "h" : "--", color:"#00d4aa" },
                      { label:"Cost saving",  value: saving_pct+"%", color:"#f59e0b" },
                    ].map(s => (
                      <div key={s.label} style={{ background:subtle, borderRadius:"10px", padding:"14px", textAlign:"center", border:"1px solid "+border }}>
                        <div style={{ fontSize:"22px", fontWeight:"700", color:s.color }}>{s.value}</div>
                        <div style={{ fontSize:"11px", color:muted, marginTop:"4px" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:subtle, borderRadius:"10px", padding:"14px", border:"1px solid "+border, fontSize:"12px" }}>
                    <div style={{ fontWeight:"600", color:text, marginBottom:"8px" }}>Schedule Summary</div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                      <span style={{ color:muted }}>Auto Start</span>
                      <span style={{ color:"#00d4aa", fontWeight:"600" }}>{autoStart ? fmt12(autoStart) : "Not set"}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                      <span style={{ color:muted }}>Auto Stop</span>
                      <span style={{ color:"#f43f5e", fontWeight:"600" }}>{autoStop ? fmt12(autoStop) : "Not set"}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                      <span style={{ color:muted }}>Active Days</span>
                      <span style={{ color:text, fontWeight:"600" }}>{activeDays.join(", ")}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:muted }}>Instance</span>
                      <span style={{ color:text, fontWeight:"600" }}>{vm.instance_type} ({vm.region})</span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding:"40px", textAlign:"center", color:muted }}>
                  <div style={{ fontSize:"32px", marginBottom:"10px" }}>📊</div>
                  <div>Set a start and stop time to see cost savings estimate</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toast */}
        {saved && (
          <div style={{margin:'0 24px 0',background:'#00d4aa15',border:'1px solid #00d4aa40',borderRadius:'10px',padding:'12px 16px',display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'20px',height:'20px',borderRadius:'50%',background:'#00d4aa',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='3'><polyline points='20 6 9 17 4 12'/></svg>
            </div>
            <div>
              <div style={{fontSize:'13px',fontWeight:'600',color:'#00d4aa'}}>Schedule Saved!</div>
              <div style={{fontSize:'11px',color:'#475569',marginTop:'1px'}}>
                {autoStart && 'Start: '+fmt12(autoStart)}
                {autoStart && autoStop && '  |  '}
                {autoStop && 'Stop: '+fmt12(autoStop)}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding:"16px 24px", borderTop:"1px solid "+border, background:subtle, borderRadius:"0 0 18px 18px" }}>
          {/* Preview bar */}
          {(autoStart || autoStop) && (
            <div style={{ background:surface, borderRadius:"10px", padding:"10px 14px", marginBottom:"12px", display:"flex", gap:"20px", alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontSize:"12px", color:muted }}>Preview:</span>
              {autoStart && <span style={{ fontSize:"13px" }}><span style={{ color:"#00d4aa", fontWeight:"600" }}>Start</span> {fmt12(autoStart)}</span>}
              {autoStop  && <span style={{ fontSize:"13px" }}><span style={{ color:"#f43f5e", fontWeight:"600" }}>Stop</span> {fmt12(autoStop)}</span>}
              {saving_pct && <span style={{ marginLeft:"auto", background:"#f59e0b20", color:"#f59e0b", padding:"2px 10px", borderRadius:"10px", fontSize:"12px", fontWeight:"600" }}>Save ~{saving_pct}% cost</span>}
            </div>
          )}
          <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end" }}>
            {(autoStart || autoStop) && (
              <button onClick={async()=>{setAutoStart("");setAutoStop("");setSaving(true);try{await setSchedule(vm.id,"","");setSaved(true);setTimeout(()=>onSaved(),1500)}catch(e){setError(e.message)}finally{setSaving(false)}}} style={{ padding:"9px 16px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>
                Clear Schedule
              </button>
            )}
            <button onClick={onClose} style={{ padding:"9px 16px", borderRadius:"8px", fontSize:"13px", cursor:"pointer", border:"1px solid "+border, background:"transparent", color:text }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding:"9px 20px", borderRadius:"8px", fontSize:"13px", fontWeight:"600", cursor:"pointer", border:"none", background:"#00d4aa", color:"#0a0f1e", opacity:saving?0.7:1 }}>
              {saving ? "Saving..." : "Save Schedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
