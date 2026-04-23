import { useState, useEffect, useCallback } from "react"
import { useTheme } from "../context/ThemeContext"
import {
  listAzureStorageAccounts, createAzureStorageAccount,
  listAzureContainers,      createAzureContainer,
  listAzureFileShares,      createAzureFileShare,
  listAzureQueues,          createAzureQueue,
  listAzureTables,          createAzureTable,
} from "../api/api"

// ── Constants ─────────────────────────────────────────────────────────────────

const SUBS = [
  { id: "nonprod", label: "Non-Production" },
  { id: "prod",    label: "Production"     },
]

const TABS = [
  { id: "blob",  icon: "🗂",  label: "Blob Containers", desc: "Store unstructured data — files, images, logs, backups" },
  { id: "files", icon: "📁",  label: "File Shares",     desc: "SMB/NFS network file shares mountable by VMs" },
  { id: "queue", icon: "📬",  label: "Queues",          desc: "Message queue for decoupling application components" },
  { id: "table", icon: "🗄",  label: "Tables",          desc: "Structured NoSQL key-value store" },
]

const SKU_OPTIONS = [
  { value: "Standard_LRS", label: "Standard LRS",  desc: "Locally redundant — cheapest" },
  { value: "Standard_GRS", label: "Standard GRS",  desc: "Geo-redundant — cross-region" },
  { value: "Standard_ZRS", label: "Standard ZRS",  desc: "Zone-redundant — same region" },
  { value: "Premium_LRS",  label: "Premium LRS",   desc: "High performance SSDs" },
]

const KIND_OPTIONS = [
  { value: "StorageV2",   label: "StorageV2 (general purpose v2)" },
  { value: "BlobStorage", label: "BlobStorage (blob only)" },
  { value: "FileStorage", label: "FileStorage (Premium files)" },
]

// ── Small Components ──────────────────────────────────────────────────────────

function Badge({ label, color }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
      letterSpacing: "0.06em", color,
      background: color + "18", border: `1px solid ${color}40`,
    }}>{label}</span>
  )
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "#64748b" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12 }}>{sub}</div>
    </div>
  )
}

function Spinner({ size = 24, color = "#0078D4" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `3px solid ${color}30`, borderTopColor: color,
      animation: "spin 0.8s linear infinite", flexShrink: 0,
    }} />
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AzureStorage() {
  const { dark } = useTheme()

  const bg      = dark ? "#070c18" : "#f0f4f8"
  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "#1e293b" : "#e2e8f0"
  const text    = dark ? "#f1f5f9" : "#0f172a"
  const muted   = dark ? "#64748b" : "#64748b"
  const panel   = dark ? "rgba(255,255,255,0.03)" : "#f8fafc"

  // ── State ────────────────────────────────────────────────────────────────

  const [sub,             setSub]             = useState("nonprod")
  const [accounts,        setAccounts]        = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [activeTab,       setActiveTab]       = useState("blob")
  const [tabData,         setTabData]         = useState({ blob: [], files: [], queue: [], table: [] })
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingTab,      setLoadingTab]      = useState(false)
  const [error,           setError]           = useState("")
  const [tabError,        setTabError]        = useState("")

  // Create Account form
  const [showCreateAcct,  setShowCreateAcct]  = useState(false)
  const [newAcct,         setNewAcct]         = useState({ name: "", resource_group: "", location: "eastus", sku: "Standard_LRS", kind: "StorageV2" })
  const [creatingAcct,    setCreatingAcct]    = useState(false)

  // Create item (container / share / queue / table)
  const [showCreateItem,  setShowCreateItem]  = useState(false)
  const [newItem,         setNewItem]         = useState({ name: "", public_access: "None", quota_gb: 100 })
  const [creatingItem,    setCreatingItem]    = useState(false)

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchAccounts = useCallback(() => {
    setLoadingAccounts(true)
    setError("")
    setSelectedAccount(null)
    setTabData({ blob: [], files: [], queue: [], table: [] })
    listAzureStorageAccounts(sub)
      .then(r => {
        const list = r.data || []
        setAccounts(list)
        if (list[0]) setSelectedAccount(list[0])
      })
      .catch(e => setError(e.response?.data?.detail || "Failed to load storage accounts"))
      .finally(() => setLoadingAccounts(false))
  }, [sub])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const fetchTabData = useCallback(() => {
    if (!selectedAccount) return
    const rg  = selectedAccount.resource_group
    const acc = selectedAccount.name
    setLoadingTab(true)
    setTabError("")
    const fetchers = {
      blob:  () => listAzureContainers(acc, rg, sub),
      files: () => listAzureFileShares(acc, rg, sub),
      queue: () => listAzureQueues(acc, rg, sub),
      table: () => listAzureTables(acc, rg, sub),
    }
    fetchers[activeTab]()
      .then(r => setTabData(prev => ({ ...prev, [activeTab]: r.data || [] })))
      .catch(e => setTabError(e.response?.data?.detail || `Failed to load ${activeTab} data`))
      .finally(() => setLoadingTab(false))
  }, [selectedAccount, activeTab, sub])

  useEffect(() => { fetchTabData() }, [fetchTabData])

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleCreateAccount() {
    setCreatingAcct(true)
    setError("")
    try {
      await createAzureStorageAccount({ ...newAcct, subscription: sub })
      setShowCreateAcct(false)
      setNewAcct({ name: "", resource_group: "", location: "eastus", sku: "Standard_LRS", kind: "StorageV2" })
      fetchAccounts()
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to create storage account")
    } finally {
      setCreatingAcct(false)
    }
  }

  async function handleCreateItem() {
    if (!selectedAccount) return
    const rg  = selectedAccount.resource_group
    const acc = selectedAccount.name
    setCreatingItem(true)
    setTabError("")
    try {
      const base = { name: newItem.name, resource_group: rg, subscription: sub }
      if (activeTab === "blob")  await createAzureContainer(acc, { ...base, public_access: newItem.public_access })
      if (activeTab === "files") await createAzureFileShare(acc, { ...base, quota_gb: newItem.quota_gb })
      if (activeTab === "queue") await createAzureQueue(acc, base)
      if (activeTab === "table") await createAzureTable(acc, base)
      setShowCreateItem(false)
      setNewItem({ name: "", public_access: "None", quota_gb: 100 })
      fetchTabData()
    } catch (e) {
      setTabError(e.response?.data?.detail || `Failed to create ${activeTab}`)
    } finally {
      setCreatingItem(false)
    }
  }

  // ── Style helpers ─────────────────────────────────────────────────────────

  const inp = {
    width: "100%", boxSizing: "border-box",
    background: surface, border: `1px solid ${border}`,
    borderRadius: 8, padding: "9px 12px",
    fontSize: 13, color: text, outline: "none", fontFamily: "inherit",
  }
  const btn = (col) => ({
    padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: "pointer", border: "none", color: "#fff",
    background: col, transition: "opacity 0.15s",
  })

  const currentTabItems = tabData[activeTab] || []
  const currentTab = TABS.find(t => t.id === activeTab)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: bg, minHeight: "100vh" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Azure Storage icon */}
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#0078D4,#50e6ff)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,120,212,0.35)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>Azure Storage</h1>
            <p style={{ fontSize: 12, color: muted, margin: "2px 0 0" }}>Storage Accounts → Blob · Files · Queue · Table</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Subscription toggle */}
          <div style={{ display: "flex", background: panel, border: `1px solid ${border}`, borderRadius: 8, padding: 3, gap: 3 }}>
            {SUBS.map(s => (
              <button key={s.id} onClick={() => setSub(s.id)} style={{
                padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                background: sub === s.id ? (s.id === "prod" ? "#f59e0b" : "#0078D4") : "transparent",
                color: sub === s.id ? "#fff" : muted, transition: "all 0.15s",
              }}>{s.label}</button>
            ))}
          </div>
          <button onClick={fetchAccounts} style={{ ...btn("#334155"), background: panel, border: `1px solid ${border}`, color: text }}>↻ Refresh</button>
          <button onClick={() => setShowCreateAcct(true)} style={{ ...btn("linear-gradient(135deg,#0078D4,#50e6ff)"), boxShadow: "0 4px 12px rgba(0,120,212,0.35)", padding: "8px 18px" }}>
            + New Storage Account
          </button>
        </div>
      </div>

      {/* ── Global error ── */}
      {error && (
        <div style={{ margin: "16px 28px 0", padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Body: two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 0, height: "calc(100vh - 73px)", overflow: "hidden" }}>

        {/* ── LEFT: Storage Account list ── */}
        <div style={{ background: panel, borderRight: `1px solid ${border}`, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Storage Accounts {accounts.length > 0 && `(${accounts.length})`}
          </div>

          {loadingAccounts ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
              <Spinner />
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState icon="🗄" title="No storage accounts" sub={`None found in ${sub === "prod" ? "Production" : "Non-Production"}`} />
          ) : accounts.map(acct => {
            const isSelected = selectedAccount?.name === acct.name
            return (
              <div
                key={acct.name}
                onClick={() => setSelectedAccount(acct)}
                style={{
                  padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                  background: isSelected ? "rgba(0,120,212,0.1)" : surface,
                  border: isSelected ? "1.5px solid #0078D4" : `1px solid ${border}`,
                  transition: "all 0.15s", animation: "fadeUp 0.3s ease both",
                  boxShadow: isSelected ? "0 0 0 3px rgba(0,120,212,0.1)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "#0078D4" : text, wordBreak: "break-all" }}>
                    {acct.name}
                  </span>
                  {isSelected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#0078D4", flexShrink: 0, marginTop: 4 }} />}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                  <Badge label={acct.sku || "—"} color="#0078D4" />
                  <Badge label={acct.kind || "—"} color="#50e6ff" />
                  <Badge label={acct.location || "—"} color="#64748b" />
                </div>
                <div style={{ fontSize: 10, color: muted, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {acct.resource_group}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── RIGHT: Selected account detail ── */}
        <div style={{ overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 0 }}>
          {!selectedAccount ? (
            <EmptyState icon="👈" title="Select a storage account" sub="Click an account on the left to manage its data services" />
          ) : (
            <>
              {/* Account header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>{selectedAccount.name}</h2>
                  <Badge label={sub === "prod" ? "PRODUCTION" : "NON-PROD"} color={sub === "prod" ? "#f59e0b" : "#10b981"} />
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {[
                    { l: "Resource Group", v: selectedAccount.resource_group },
                    { l: "Location",       v: selectedAccount.location },
                    { l: "SKU",            v: selectedAccount.sku },
                    { l: "Kind",           v: selectedAccount.kind },
                  ].map(r => (
                    <div key={r.l}>
                      <div style={{ fontSize: 10, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.l}</div>
                      <div style={{ fontSize: 13, color: text, fontWeight: 500 }}>{r.v || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Endpoint chips */}
              {selectedAccount.blob_endpoint && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                  {[
                    { l: "Blob",  v: selectedAccount.blob_endpoint,  c: "#0078D4" },
                    { l: "File",  v: selectedAccount.file_endpoint,  c: "#10b981" },
                    { l: "Queue", v: selectedAccount.queue_endpoint, c: "#f59e0b" },
                    { l: "Table", v: selectedAccount.table_endpoint, c: "#a78bfa" },
                  ].filter(e => e.v).map(e => (
                    <div key={e.l} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, fontFamily: "monospace", background: e.c + "14", border: `1px solid ${e.c}33`, color: e.c }}>
                      <strong>{e.l}:</strong> {e.v.replace("https://", "").replace("/", "")}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Tabs ── */}
              <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${border}`, paddingBottom: 0 }}>
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setShowCreateItem(false); setTabError("") }}
                    style={{
                      padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                      background: "transparent", borderBottom: activeTab === tab.id ? "2px solid #0078D4" : "2px solid transparent",
                      color: activeTab === tab.id ? "#0078D4" : muted,
                      display: "flex", alignItems: "center", gap: 6, marginBottom: -1, transition: "all 0.15s",
                    }}>
                    <span>{tab.icon}</span> {tab.label}
                    {tabData[tab.id].length > 0 && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: activeTab === tab.id ? "rgba(0,120,212,0.15)" : border, color: activeTab === tab.id ? "#0078D4" : muted }}>
                        {tabData[tab.id].length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab description */}
              <div style={{ fontSize: 12, color: muted, marginBottom: 16, padding: "8px 12px", borderRadius: 8, background: panel, borderLeft: "3px solid #0078D4" }}>
                {currentTab?.desc}
              </div>

              {/* Tab error */}
              {tabError && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>
                  {tabError}
                </div>
              )}

              {/* ── Create item form ── */}
              {showCreateItem && (
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: 20, marginBottom: 16, animation: "fadeUp 0.2s ease both" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 16 }}>
                    Create {currentTab?.label.replace("s", "")}
                  </div>
                  <div style={{ display: "grid", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: text, marginBottom: 6 }}>
                        Name <span style={{ color: "#f43f5e" }}>*</span>
                      </label>
                      <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                        placeholder={
                          activeTab === "blob"  ? "my-container" :
                          activeTab === "files" ? "myfileshare" :
                          activeTab === "queue" ? "myqueue" : "mytable"
                        }
                        style={inp} />
                      <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                        {activeTab === "blob" || activeTab === "queue"
                          ? "Lowercase letters, digits, and hyphens only. 3–63 characters."
                          : activeTab === "files"
                          ? "Lowercase letters, digits, and hyphens. 3–63 characters."
                          : "Letters and digits only. 3–63 characters, must start with a letter."}
                      </div>
                    </div>

                    {/* Blob-specific: public access */}
                    {activeTab === "blob" && (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: text, marginBottom: 8 }}>Public access level</label>
                        {[
                          { v: "None",      l: "Private",             desc: "No anonymous access — recommended" },
                          { v: "Blob",      l: "Blob",                desc: "Anonymous read for blobs only" },
                          { v: "Container", l: "Container",           desc: "Anonymous read for container and blobs" },
                        ].map(opt => (
                          <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, marginBottom: 4, cursor: "pointer", background: newItem.public_access === opt.v ? "rgba(0,120,212,0.08)" : "transparent", border: `1px solid ${newItem.public_access === opt.v ? "rgba(0,120,212,0.4)" : border}` }}>
                            <input type="radio" checked={newItem.public_access === opt.v} onChange={() => setNewItem(p => ({ ...p, public_access: opt.v }))} style={{ accentColor: "#0078D4" }} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: text }}>{opt.l}</div>
                              <div style={{ fontSize: 10, color: muted }}>{opt.desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* File share-specific: quota */}
                    {activeTab === "files" && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: text }}>Quota (GiB)</label>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0078D4" }}>{newItem.quota_gb} GiB</span>
                        </div>
                        <input type="range" min={1} max={102400} step={1} value={newItem.quota_gb} onChange={e => setNewItem(p => ({ ...p, quota_gb: +e.target.value }))} style={{ width: "100%", accentColor: "#0078D4" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: muted, marginTop: 4 }}>
                          <span>1 GiB</span><span>1 TiB</span><span>100 TiB</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <button onClick={handleCreateItem} disabled={!newItem.name.trim() || creatingItem}
                      style={{ ...btn("linear-gradient(135deg,#0078D4,#50e6ff)"), boxShadow: "0 4px 12px rgba(0,120,212,0.3)", opacity: creatingItem ? 0.7 : 1, cursor: creatingItem ? "not-allowed" : "pointer" }}>
                      {creatingItem ? "Creating..." : `Create ${currentTab?.label.replace("s", "")}`}
                    </button>
                    <button onClick={() => { setShowCreateItem(false); setNewItem({ name: "", public_access: "None", quota_gb: 100 }); setTabError("") }}
                      style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "transparent", border: `1px solid ${border}`, color: text }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Tab content: item table ── */}
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
                {/* Table header bar */}
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: text }}>
                    {currentTab?.icon} {currentTab?.label}
                    {!loadingTab && ` (${currentTabItems.length})`}
                  </span>
                  {!showCreateItem && (
                    <button onClick={() => { setShowCreateItem(true); setTabError("") }}
                      style={{ ...btn("#0078D4"), padding: "6px 14px", fontSize: 11 }}>
                      + Create
                    </button>
                  )}
                </div>

                {loadingTab ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: 40, color: muted, fontSize: 13 }}>
                    <Spinner />Loading {currentTab?.label.toLowerCase()}…
                  </div>
                ) : currentTabItems.length === 0 ? (
                  <EmptyState
                    icon={currentTab?.icon}
                    title={`No ${currentTab?.label.toLowerCase()} yet`}
                    sub={`Click "+ Create" to add your first ${currentTab?.label.replace("s", "").toLowerCase()}`}
                  />
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                        {activeTab === "blob"  && ["Name", "Public Access", "Lease State", "Last Modified", ""].map(h => <Th key={h} border={border} muted={muted}>{h}</Th>)}
                        {activeTab === "files" && ["Name", "Quota (GiB)", "Last Modified", ""].map(h => <Th key={h} border={border} muted={muted}>{h}</Th>)}
                        {activeTab === "queue" && ["Name", ""].map(h => <Th key={h} border={border} muted={muted}>{h}</Th>)}
                        {activeTab === "table" && ["Name", ""].map(h => <Th key={h} border={border} muted={muted}>{h}</Th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {currentTabItems.map((item, idx) => {
                        const name = item.name
                        const tdS = { padding: "11px 14px", fontSize: 13, color: text, borderBottom: idx < currentTabItems.length - 1 ? `1px solid ${border}` : "none" }
                        return (
                          <tr key={name}
                            onMouseEnter={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            style={{ transition: "background 0.1s" }}>
                            <td style={{ ...tdS, fontWeight: 600, fontFamily: activeTab !== "table" ? "monospace" : "inherit", fontSize: 12 }}>{name}</td>

                            {activeTab === "blob" && <>
                              <td style={tdS}>
                                <Badge label={item.public_access || "None"} color={item.public_access === "None" ? "#10b981" : "#f59e0b"} />
                              </td>
                              <td style={{ ...tdS, color: muted, fontSize: 11 }}>{item.lease_state || "—"}</td>
                              <td style={{ ...tdS, color: muted, fontSize: 11 }}>{item.last_modified ? item.last_modified.split("T")[0] : "—"}</td>
                            </>}

                            {activeTab === "files" && <>
                              <td style={tdS}>{item.quota_gb ? `${item.quota_gb} GiB` : "—"}</td>
                              <td style={{ ...tdS, color: muted, fontSize: 11 }}>{item.last_modified ? item.last_modified.split("T")[0] : "—"}</td>
                            </>}

                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Create Storage Account Modal ── */}
      {showCreateAcct && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 32, width: 520, maxHeight: "90vh", overflowY: "auto", animation: "fadeUp 0.25s ease both", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: text }}>Create Storage Account</div>
                <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>Azure Storage — {sub === "prod" ? "Production" : "Non-Production"}</div>
              </div>
              <button onClick={() => setShowCreateAcct(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: muted, fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>
            )}

            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: text, marginBottom: 6 }}>Account Name <span style={{ color: "#f43f5e" }}>*</span></label>
                <input value={newAcct.name} onChange={e => setNewAcct(p => ({ ...p, name: e.target.value }))}
                  placeholder="mystorageaccount" style={inp} />
                <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>3–24 characters. Lowercase letters and digits only. Globally unique.</div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: text, marginBottom: 6 }}>Resource Group <span style={{ color: "#f43f5e" }}>*</span></label>
                <input value={newAcct.resource_group} onChange={e => setNewAcct(p => ({ ...p, resource_group: e.target.value }))}
                  placeholder="rg-storage-dev-eastus" style={inp} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: text, marginBottom: 6 }}>Region <span style={{ color: "#f43f5e" }}>*</span></label>
                <input value={newAcct.location} onChange={e => setNewAcct(p => ({ ...p, location: e.target.value }))}
                  placeholder="eastus" style={inp} />
                <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>e.g. eastus, westeurope, centralindia</div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: text, marginBottom: 8 }}>Performance / Redundancy</label>
                {SKU_OPTIONS.map(s => (
                  <label key={s.value} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, marginBottom: 4, cursor: "pointer", background: newAcct.sku === s.value ? "rgba(0,120,212,0.08)" : "transparent", border: `1px solid ${newAcct.sku === s.value ? "rgba(0,120,212,0.4)" : border}` }}>
                    <input type="radio" checked={newAcct.sku === s.value} onChange={() => setNewAcct(p => ({ ...p, sku: s.value }))} style={{ accentColor: "#0078D4" }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: text }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: muted }}>{s.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: text, marginBottom: 6 }}>Kind</label>
                <select value={newAcct.kind} onChange={e => setNewAcct(p => ({ ...p, kind: e.target.value }))} style={{ ...inp }}>
                  {KIND_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              <button
                onClick={handleCreateAccount}
                disabled={!newAcct.name || !newAcct.resource_group || !newAcct.location || creatingAcct}
                style={{ flex: 1, ...btn("linear-gradient(135deg,#0078D4,#50e6ff)"), padding: "11px 0", boxShadow: "0 4px 16px rgba(0,120,212,0.35)", fontSize: 13, opacity: creatingAcct ? 0.7 : 1, cursor: creatingAcct ? "not-allowed" : "pointer" }}>
                {creatingAcct ? "Creating..." : "Create Storage Account"}
              </button>
              <button onClick={() => { setShowCreateAcct(false); setError("") }}
                style={{ padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", border: `1px solid ${border}`, color: text }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Local sub-component for table headers ─────────────────────────────────────
function Th({ children, border, muted }) {
  return (
    <th style={{ padding: "9px 14px", fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left", borderBottom: `1px solid ${border}` }}>
      {children}
    </th>
  )
}
