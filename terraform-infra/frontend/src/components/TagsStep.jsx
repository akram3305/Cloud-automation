import { useTheme } from "../context/ThemeContext"

const ENVIRONMENTS = ["Production","Staging","Development","Testing","QA","UAT","Sandbox"]

export default function TagsStep({ tags, setTags, error }) {
  const { dark } = useTheme()
  const surface = dark?"#0f172a":"#ffffff"
  const border  = dark?"#1e293b":"#e2e8f0"
  const text    = dark?"#f1f5f9":"#0f172a"
  const muted   = dark?"#475569":"#64748b"
  const subtle  = dark?"#1e293b":"#f8fafc"
  const inp     = {padding:"9px 12px",border:"1px solid "+border,borderRadius:"8px",fontSize:"13px",width:"100%",background:surface,color:text,outline:"none"}

  function addCustomTag() {
    setTags(p=>({...p, _custom:[...(p._custom||[]),{key:"",value:""}]}))
  }
  function updateCustom(i,field,val) {
    setTags(p=>({...p,_custom:p._custom.map((t,j)=>j===i?{...t,[field]:val}:t)}))
  }
  function removeCustom(i) {
    setTags(p=>({...p,_custom:p._custom.filter((_,j)=>j!==i)}))
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
      <div style={{background:"#3b82f610",border:"1px solid #3b82f630",borderRadius:"10px",padding:"12px 14px",fontSize:"12px",color:"#3b82f6"}}>
        These tags will be applied to all AWS resources created. All 3 fields are required.
      </div>

      {/* Project Name */}
      <div>
        <label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",fontWeight:"600",color:muted,marginBottom:"6px"}}>
          <span style={{background:"#f43f5e",color:"#fff",borderRadius:"4px",padding:"1px 5px",fontSize:"10px"}}>*</span>
          Project Name
        </label>
        <input style={inp} placeholder="e.g. AIonOS-Platform, IntelliStream, AmadeusProd"
          value={tags.project||""} onChange={e=>setTags(p=>({...p,project:e.target.value}))} />
        <div style={{fontSize:"11px",color:muted,marginTop:"3px"}}>Tag key: <code style={{color:"#00d4aa"}}>Project</code></div>
      </div>

      {/* Project Owner */}
      <div>
        <label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",fontWeight:"600",color:muted,marginBottom:"6px"}}>
          <span style={{background:"#f43f5e",color:"#fff",borderRadius:"4px",padding:"1px 5px",fontSize:"10px"}}>*</span>
          Project Owner
        </label>
        <input style={inp} placeholder="e.g. Akram Khan, DevOps Team, TIM Operations"
          value={tags.owner||""} onChange={e=>setTags(p=>({...p,owner:e.target.value}))} />
        <div style={{fontSize:"11px",color:muted,marginTop:"3px"}}>Tag key: <code style={{color:"#00d4aa"}}>Owner</code></div>
      </div>

      {/* Environment */}
      <div>
        <label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",fontWeight:"600",color:muted,marginBottom:"6px"}}>
          <span style={{background:"#f43f5e",color:"#fff",borderRadius:"4px",padding:"1px 5px",fontSize:"10px"}}>*</span>
          Environment
        </label>
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
          {ENVIRONMENTS.map(env=>(
            <button key={env} onClick={()=>setTags(p=>({...p,environment:env}))}
              style={{padding:"7px 14px",borderRadius:"8px",fontSize:"12px",fontWeight:"500",cursor:"pointer",
                border:"1px solid "+(tags.environment===env?"#a78bfa60":border),
                background:tags.environment===env?"#a78bfa20":subtle,
                color:tags.environment===env?"#a78bfa":muted,transition:"all 0.15s"}}>
              {env}
            </button>
          ))}
        </div>
        <div style={{fontSize:"11px",color:muted,marginTop:"5px"}}>Tag key: <code style={{color:"#00d4aa"}}>Environment</code></div>
      </div>

      {/* Custom tags */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
          <label style={{fontSize:"12px",fontWeight:"600",color:muted}}>Additional Tags (optional)</label>
          <button onClick={addCustomTag} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #3b82f640",background:"#3b82f615",color:"#3b82f6"}}>+ Add Tag</button>
        </div>
        {(tags._custom||[]).map((t,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:"8px",marginBottom:"6px",alignItems:"center"}}>
            <input style={{...inp,padding:"7px 10px"}} placeholder="Key" value={t.key} onChange={e=>updateCustom(i,"key",e.target.value)} />
            <input style={{...inp,padding:"7px 10px"}} placeholder="Value" value={t.value} onChange={e=>updateCustom(i,"value",e.target.value)} />
            <button onClick={()=>removeCustom(i)} style={{padding:"5px 8px",borderRadius:"6px",fontSize:"12px",cursor:"pointer",border:"1px solid #f43f5e40",background:"#f43f5e15",color:"#f43f5e"}}>x</button>
          </div>
        ))}
      </div>

      {/* Preview */}
      {(tags.project||tags.owner||tags.environment) && (
        <div style={{background:subtle,borderRadius:"10px",padding:"12px 14px",border:"1px solid "+border}}>
          <div style={{fontSize:"11px",fontWeight:"600",color:muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Tag Preview</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
            {tags.project&&<span style={{background:"#00d4aa15",color:"#00d4aa",padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"500"}}>Project: {tags.project}</span>}
            {tags.owner&&<span style={{background:"#3b82f615",color:"#3b82f6",padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"500"}}>Owner: {tags.owner}</span>}
            {tags.environment&&<span style={{background:"#a78bfa15",color:"#a78bfa",padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"500"}}>Environment: {tags.environment}</span>}
            {(tags._custom||[]).filter(t=>t.key).map((t,i)=>(
              <span key={i} style={{background:"#f59e0b15",color:"#f59e0b",padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"500"}}>{t.key}: {t.value}</span>
            ))}
            <span style={{background:"#64748b15",color:"#64748b",padding:"3px 10px",borderRadius:"6px",fontSize:"11px"}}>CreatedBy: AIonOS-Platform</span>
          </div>
        </div>
      )}

      {error&&<div style={{background:"#f43f5e15",color:"#f43f5e",padding:"10px",borderRadius:"8px",fontSize:"13px"}}>{error}</div>}
    </div>
  )
}
