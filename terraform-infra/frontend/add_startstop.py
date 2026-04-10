with open("src/pages/Resources.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add startVM/stopVM imports
content = content.replace(
    "import { createRequest, listRequests, listVMs, listBuckets, deleteBucket } from \"../api/api\"",
    "import { createRequest, listRequests, listVMs, listBuckets, deleteBucket, startVM, stopVM } from \"../api/api\""
)

# Add actionId state
content = content.replace(
    "  const [s3Error, setS3Error]    = useState(\"\")",
    "  const [s3Error, setS3Error]    = useState(\"\")\n  const [actionId, setActionId]  = useState(null)"
)

# Add handler functions
content = content.replace(
    "  function handleServiceClick(svc) {",
    """  async function handleStartVM(vm) {
    setActionId(vm.id+"-start")
    try { await startVM(vm.id); fetchAll() } catch(e) { alert(e.response?.data?.detail||e.message) }
    finally { setActionId(null) }
  }

  async function handleStopVM(vm) {
    setActionId(vm.id+"-stop")
    try { await stopVM(vm.id); fetchAll() } catch(e) { alert(e.response?.data?.detail||e.message) }
    finally { setActionId(null) }
  }

  function handleServiceClick(svc) {"""
)

# Add start/stop buttons to EC2 rows
old_action_td = "                    <td style={{ padding:\"14px 16px\" }} />"
new_action_td = """                    <td style={{ padding:"14px 16px" }}>
                      {r._type === "ec2" && (
                        <div style={{ display:"flex", gap:"6px" }}>
                          {r._status === "stopped" && (
                            <button onClick={() => handleStartVM(r)} disabled={actionId===r.id+"-start"}
                              style={{ padding:"4px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #00d4aa40", background:"#00d4aa15", color:"#00d4aa" }}>
                              {actionId===r.id+"-start"?"...":"Start"}
                            </button>
                          )}
                          {r._status === "running" && (
                            <button onClick={() => handleStopVM(r)} disabled={actionId===r.id+"-stop"}
                              style={{ padding:"4px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #f59e0b40", background:"#f59e0b15", color:"#f59e0b" }}>
                              {actionId===r.id+"-stop"?"...":"Stop"}
                            </button>
                          )}
                        </div>
                      )}
                    </td>"""

content = content.replace(old_action_td, new_action_td, 1)

with open("src/pages/Resources.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Done")
