import { useState } from "react"
import { startVM, stopVM, deleteVM } from "../api/api"
import { useTheme } from "../context/ThemeContext"
import ScheduleModal from "./ScheduleModal"
export default function VMTable({ vms, onRefresh }) {
  const { dark } = useTheme()
  const [loading, setLoading] = useState(null)
  const [schedVM, setSchedVM] = useState(null)
  const surface=dark?"#0f172a":"#ffffff",border=dark?"#1e293b":"#e2e8f0"
  const text=dark?"#f1f5f9":"#0f172a",muted=dark?"#475569":"#64748b",subtle=dark?"#1e293b":"#f8fafc"
  const SC={running:"#00d4aa",stopped:"#f59e0b",stopping:"#f97316",pending:"#3b82f6"}
  async function handleStart(id){setLoading(id+"-start");try{await startVM(id);onRefresh()}catch(e){alert(e.response?.data?.detail||e.message)}finally{setLoading(null)}}
  async function handleStop(id){setLoading(id+"-stop");try{await stopVM(id);onRefresh()}catch(e){alert(e.response?.data?.detail||e.message)}finally{setLoading(null)}}
  async function handleDelete(id,name){if(!window.confirm("Delete VM "+name+"?"))return;setLoading(id+"-delete");try{await deleteVM(id);onRefresh()}catch(e){alert(e.response?.data?.detail||e.message)}finally{setLoading(null)}}
  if(!vms||vms.length===0)return <div style={{padding:"48px",textAlign:"center",color:muted}}>No VMs found</div>
  return (
    <>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{background:subtle,borderBottom:"1px solid "+border}}>
            {["Name","Instance ID","Type","Region","State","Actions"].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:"11px",fontWeight:"600",color:muted,textTransform:"uppercase"}}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {vms.map(vm=>{
            const sc=SC[vm.state]||"#64748b"
            return (
              <tr key={vm.id} style={{borderBottom:"1px solid "+border}}
                onMouseEnter={e=>e.currentTarget.style.background=dark?"#ffffff05":"#f8fafc"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"14px 16px",fontSize:"13px",fontWeight:"600",color:text}}>{vm.name}</td>
                <td style={{padding:"14px 16px"}}><span style={{fontFamily:"monospace",fontSize:"11px",background:dark?"#1e293b":"#f1f5f9",color:muted,padding:"3px 8px",borderRadius:"4px"}}>{vm.instance_id}</span></td>
                <td style={{padding:"14px 16px",fontSize:"12px",color:muted}}>{vm.instance_type}</td>
                <td style={{padding:"14px 16px",fontSize:"12px",color:muted}}>{vm.region}</td>
                <td style={{padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                    <div style={{width:"7px",height:"7px",borderRadius:"50%",background:sc}}/>
                    <span style={{fontSize:"12px",fontWeight:"500",color:sc}}>{vm.state}</span>
                  </div>
                  {(vm.auto_start||vm.auto_stop)&&<div style={{fontSize:"10px",color:"#3b82f6",marginTop:"2px"}}>{vm.auto_start&&"Start:"+vm.auto_start}{vm.auto_start&&vm.auto_stop&&" | "}{vm.auto_stop&&"Stop:"+vm.auto_stop}</div>}
                </td>
                <td style={{padding:"14px 16px"}}>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    {vm.state==="stopped"&&<button onClick={()=>handleStart(vm.id)} disabled={loading===vm.id+"-start"} style={{padding:"5px 12px",borderRadius:"6px",fontSize:"12px",cursor:"pointer",border:"1px solid #00d4aa40",background:"#00d4aa15",color:"#00d4aa"}}>{loading===vm.id+"-start"?"...":"Start"}</button>}
                    {vm.state==="running"&&<button onClick={()=>handleStop(vm.id)} disabled={loading===vm.id+"-stop"} style={{padding:"5px 12px",borderRadius:"6px",fontSize:"12px",cursor:"pointer",border:"1px solid #f59e0b40",background:"#f59e0b15",color:"#f59e0b"}}>{loading===vm.id+"-stop"?"...":"Stop"}</button>}
                    <button onClick={()=>setSchedVM(vm)} style={{padding:"5px 12px",borderRadius:"6px",fontSize:"12px",cursor:"pointer",border:"1px solid #3b82f640",background:"#3b82f615",color:"#3b82f6"}}>{(vm.auto_start||vm.auto_stop)?"Scheduled":"Schedule"}</button>
                    <button onClick={()=>handleDelete(vm.id,vm.name)} disabled={loading===vm.id+"-delete"} style={{padding:"5px 12px",borderRadius:"6px",fontSize:"12px",cursor:"pointer",border:"1px solid #f43f5e40",background:"#f43f5e15",color:"#f43f5e"}}>{loading===vm.id+"-delete"?"...":"Delete"}</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {schedVM&&<ScheduleModal vm={schedVM} onClose={()=>setSchedVM(null)} onSaved={()=>{setSchedVM(null);onRefresh()}} />}
    </>
  )
}