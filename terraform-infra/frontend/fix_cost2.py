with open("src/pages/Cost.jsx", "r", encoding="utf-8") as f:
    content = f.read()

old = """        {[
          { label:"30-Day Spend",   val:totalMonthly, prefix:"$", color:"#00d4aa", icon:"", sub:"Total cloud cost" },
          { label:"Daily Average",  val:dailyAvg,     prefix:"$", color:"#3b82f6", icon:"", sub:"Per day avg" },
          { label:"Top Service",    val:null,          display:topService, color:"#a78bfa", icon:"", sub:`$${services[0]?.amount||0}/mo` },
          { label:"Daily Trend",    val:Math.abs(trend), prefix:trend>=0?"+$":"-$", color:trend>=0?"#f43f5e":"#84cc16", icon:trend>=0?"":"", sub:"vs yesterday" },
        ].map(({ label, val, prefix="$", display, color, icon, sub }, i) => {
          const num = useCountUp(val||0)
          return (
            <div key={label} style={{ background:surface, border:`1px solid ${border}`, borderLeft:`3px solid ${color}`, borderRadius:"14px", padding:"20px", position:"relative", overflow:"hidden", animation:`fadeUp 0.5s ease ${i*80}ms both`, transition:"all 0.3s ease" }}>
              <div style={{ position:"absolute", top:"-30px", right:"-30px", width:"90px", height:"90px", borderRadius:"50%", background:`${color}08` }} />
              <div style={{ fontSize:"24px", marginBottom:"10px" }}>{icon}</div>
              <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"5px" }}>{label}</div>
              <div style={{ fontSize:"26px", fontWeight:"700", color:text, letterSpacing:"-0.5px" }}>
                {display || (prefix + num.toFixed(2))}
              </div>
              <div style={{ fontSize:"11px", color:muted, marginTop:"3px" }}>{sub}</div>
            </div>
          )
        })}"""

new = """        {[
          { label:"30-Day Spend",  value:"$"+totalMonthly.toFixed(2), color:"#00d4aa", icon:"Money",  sub:"Total cloud cost" },
          { label:"Daily Average", value:"$"+dailyAvg.toFixed(2),     color:"#3b82f6", icon:"Chart",  sub:"Per day avg" },
          { label:"Top Service",   value:topService,                   color:"#a78bfa", icon:"Flash",  sub:"$"+(services[0]?.amount||0)+"/mo" },
          { label:"Daily Trend",   value:(trend>=0?"+$":"-$")+Math.abs(trend).toFixed(4), color:trend>=0?"#f43f5e":"#84cc16", icon:"Trend", sub:"vs yesterday" },
        ].map(({ label, value, color, icon, sub }, i) => (
          <div key={label} style={{ background:surface, border:`1px solid ${border}`, borderLeft:`3px solid ${color}`, borderRadius:"14px", padding:"20px", position:"relative", overflow:"hidden", animation:`fadeUp 0.5s ease ${i*80}ms both`, transition:"all 0.3s ease" }}>
            <div style={{ position:"absolute", top:"-30px", right:"-30px", width:"90px", height:"90px", borderRadius:"50%", background:`${color}08` }} />
            <div style={{ fontSize:"11px", fontWeight:"600", color:muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"5px" }}>{label}</div>
            <div style={{ fontSize:"26px", fontWeight:"700", color:text, letterSpacing:"-0.5px" }}>{value}</div>
            <div style={{ fontSize:"11px", color:muted, marginTop:"3px" }}>{sub}</div>
          </div>
        ))}"""

content = content.replace(old, new)

# Also remove the useCountUp hook since we no longer need it
content = content.replace("""function useCountUp(target, duration=1400) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now()-start)/duration,1)
      setVal((1-Math.pow(1-p,3))*target)
      if (p<1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target])
  return val
}

""", "")

with open("src/pages/Cost.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Fixed")
