with open("src/pages/Resources.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add deleteBucket import
content = content.replace(
    'import { createRequest, listRequests, listVMs, listBuckets } from "../api/api"',
    'import { createRequest, listRequests, listVMs, listBuckets, deleteBucket } from "../api/api"'
)

# Add handleDeleteBucket function after fetchResources
content = content.replace(
    '  async function handleS3Create() {',
    '''  async function handleDeleteResource(r) {
    if (r._type === "s3") {
      if (!window.confirm("Delete bucket " + r._label + "? This will permanently delete all objects inside.")) return
      try {
        await deleteBucket(r._label, true)
        setSuccess("Bucket " + r._label + " deleted")
        fetchResources()
        setTimeout(() => setSuccess(""), 3000)
      } catch(e) { alert(e.response?.data?.detail || e.message) }
    }
  }

  async function handleS3Create() {'''
)

# Add delete button to resources table
content = content.replace(
    '                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{r._detail}</td>',
    '''                    <td style={{ padding:"14px 16px", fontSize:"12px", color:muted }}>{r._detail}</td>
                    <td style={{ padding:"14px 16px" }}>
                      {(r._type === "s3") && (
                        <button onClick={() => handleDeleteResource(r)}
                          style={{ padding:"4px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"500", cursor:"pointer", border:"1px solid #f43f5e40", background:"#f43f5e15", color:"#f43f5e" }}>
                          Delete
                        </button>
                      )}
                    </td>'''
)

# Add Actions header to table
content = content.replace(
    '{["Type","Name","Status","Region","Details"].map(h => (',
    '{["Type","Name","Status","Region","Details","Actions"].map(h => ('
)

with open("src/pages/Resources.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Done")
