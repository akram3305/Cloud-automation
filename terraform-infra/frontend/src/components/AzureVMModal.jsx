import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Server, Network, HardDrive, Tag, CheckCircle, AlertCircle, Loader } from "lucide-react";
import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:8000" });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem("token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ── Static data ────────────────────────────────────────────────────────────

const SUBSCRIPTIONS = [
  { value: "nonprod", label: "Non-Production" },
  { value: "prod",    label: "Production" },
];

const OS_IMAGES = {
  Linux: [
    { label: "Ubuntu 22.04 LTS",        publisher: "Canonical",         offer: "0001-com-ubuntu-server-jammy", sku: "22_04-lts-gen2" },
    { label: "Ubuntu 20.04 LTS",        publisher: "Canonical",         offer: "0001-com-ubuntu-server-focal", sku: "20_04-lts-gen2" },
    { label: "RHEL 9",                  publisher: "RedHat",            offer: "RHEL",                         sku: "9-lvm-gen2" },
    { label: "RHEL 8",                  publisher: "RedHat",            offer: "RHEL",                         sku: "8-lvm-gen2" },
    { label: "CentOS 8",                publisher: "OpenLogic",         offer: "CentOS",                       sku: "8_5-gen2" },
    { label: "Debian 12",               publisher: "Debian",            offer: "debian-12",                    sku: "12-gen2" },
    { label: "SUSE SLES 15",            publisher: "SUSE",              offer: "sles-15-sp5",                  sku: "gen2" },
    { label: "Oracle Linux 8",          publisher: "Oracle",            offer: "Oracle-Linux",                 sku: "ol88-lvm-gen2" },
  ],
  Windows: [
    { label: "Windows Server 2022",     publisher: "MicrosoftWindowsServer", offer: "WindowsServer", sku: "2022-datacenter-azure-edition" },
    { label: "Windows Server 2019",     publisher: "MicrosoftWindowsServer", offer: "WindowsServer", sku: "2019-datacenter-gensecond" },
    { label: "Windows Server 2016",     publisher: "MicrosoftWindowsServer", offer: "WindowsServer", sku: "2016-datacenter-gensecond" },
    { label: "Windows 11 Enterprise",   publisher: "MicrosoftWindowsDesktop", offer: "Windows-11",  sku: "win11-23h2-ent" },
    { label: "Windows 10 Enterprise",   publisher: "MicrosoftWindowsDesktop", offer: "Windows-10",  sku: "win10-22h2-ent-g2" },
  ],
};

const VM_SIZES = {
  "General Purpose": [
    { value: "Standard_B1s",   label: "B1s — 1 vCPU, 1 GB RAM" },
    { value: "Standard_B2s",   label: "B2s — 2 vCPU, 4 GB RAM" },
    { value: "Standard_B4ms",  label: "B4ms — 4 vCPU, 16 GB RAM" },
    { value: "Standard_D2s_v5",label: "D2s v5 — 2 vCPU, 8 GB RAM" },
    { value: "Standard_D4s_v5",label: "D4s v5 — 4 vCPU, 16 GB RAM" },
    { value: "Standard_D8s_v5",label: "D8s v5 — 8 vCPU, 32 GB RAM" },
    { value: "Standard_D16s_v5",label: "D16s v5 — 16 vCPU, 64 GB RAM" },
    { value: "Standard_D32s_v5",label: "D32s v5 — 32 vCPU, 128 GB RAM" },
  ],
  "Compute Optimized": [
    { value: "Standard_F2s_v2", label: "F2s v2 — 2 vCPU, 4 GB RAM" },
    { value: "Standard_F4s_v2", label: "F4s v2 — 4 vCPU, 8 GB RAM" },
    { value: "Standard_F8s_v2", label: "F8s v2 — 8 vCPU, 16 GB RAM" },
    { value: "Standard_F16s_v2",label: "F16s v2 — 16 vCPU, 32 GB RAM" },
  ],
  "Memory Optimized": [
    { value: "Standard_E2s_v5", label: "E2s v5 — 2 vCPU, 16 GB RAM" },
    { value: "Standard_E4s_v5", label: "E4s v5 — 4 vCPU, 32 GB RAM" },
    { value: "Standard_E8s_v5", label: "E8s v5 — 8 vCPU, 64 GB RAM" },
    { value: "Standard_E16s_v5",label: "E16s v5 — 16 vCPU, 128 GB RAM" },
    { value: "Standard_M8ms",   label: "M8ms — 8 vCPU, 218 GB RAM" },
  ],
  "Storage Optimized": [
    { value: "Standard_L8s_v3", label: "L8s v3 — 8 vCPU, 64 GB RAM" },
    { value: "Standard_L16s_v3",label: "L16s v3 — 16 vCPU, 128 GB RAM" },
    { value: "Standard_L32s_v3",label: "L32s v3 — 32 vCPU, 256 GB RAM" },
  ],
  "GPU": [
    { value: "Standard_NC6s_v3",  label: "NC6s v3 — 6 vCPU, 112 GB RAM, 1× V100" },
    { value: "Standard_NC12s_v3", label: "NC12s v3 — 12 vCPU, 224 GB RAM, 2× V100" },
    { value: "Standard_NV6ads_A10_v5", label: "NV6ads A10 — 6 vCPU, 55 GB RAM, 1/6× A10" },
  ],
};

const DISK_TYPES = [
  { value: "Premium_LRS",     label: "Premium SSD LRS (recommended)" },
  { value: "StandardSSD_LRS", label: "Standard SSD LRS" },
  { value: "Standard_LRS",    label: "Standard HDD LRS" },
  { value: "UltraSSD_LRS",    label: "Ultra Disk LRS (high perf)" },
];

const CRITICALITY_OPTIONS = ["Critical", "High", "Medium", "Low"];
const COMMON_PORTS = [
  { port: 22,   label: "SSH (22)" },
  { port: 3389, label: "RDP (3389)" },
  { port: 80,   label: "HTTP (80)" },
  { port: 443,  label: "HTTPS (443)" },
  { port: 8080, label: "HTTP-alt (8080)" },
  { port: 5432, label: "PostgreSQL (5432)" },
  { port: 3306, label: "MySQL (3306)" },
  { port: 1433, label: "MSSQL (1433)" },
];

const STEPS = [
  { id: 1, label: "Subscription & RG",  icon: Server },
  { id: 2, label: "OS & VM Size",        icon: Server },
  { id: 3, label: "Network",             icon: Network },
  { id: 4, label: "Authentication",      icon: Server },
  { id: 5, label: "Storage",             icon: HardDrive },
  { id: 6, label: "Mandatory Tags",      icon: Tag },
  { id: 7, label: "Review & Create",     icon: CheckCircle },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function AzureVMModal({ onClose, onSuccess }) {
  const [step, setStep]             = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  // Step 1 — Subscription & RG
  const [subscription, setSubscription]       = useState("nonprod");
  const [createRG, setCreateRG]               = useState(true);
  const [resourceGroup, setResourceGroup]     = useState("");
  const [existingRGs, setExistingRGs]         = useState([]);
  const [location, setLocation]               = useState("eastus");
  const [locations, setLocations]             = useState([]);
  const [loadingRGs, setLoadingRGs]           = useState(false);
  const [loadingLocs, setLoadingLocs]         = useState(false);

  // Step 2 — OS & VM
  const [vmName, setVmName]             = useState("");
  const [osType, setOsType]             = useState("Linux");
  const [selectedImage, setSelectedImage] = useState(OS_IMAGES.Linux[0]);
  const [vmSizeCategory, setVmSizeCategory] = useState("General Purpose");
  const [vmSize, setVmSize]             = useState("Standard_B2s");

  // Step 3 — Network
  const [vnets, setVnets]               = useState([]);
  const [selectedVnet, setSelectedVnet] = useState(null);
  const [subnets, setSubnets]           = useState([]);
  const [subnetId, setSubnetId]         = useState("");
  const [enablePublicIP, setEnablePublicIP] = useState(false);
  const [allowedPorts, setAllowedPorts] = useState([22, 80, 443]);
  const [customPort, setCustomPort]     = useState("");
  const [loadingVnets, setLoadingVnets] = useState(false);
  const [loadingSubnets, setLoadingSubnets] = useState(false);

  // Step 4 — Auth
  const [adminUsername, setAdminUsername] = useState("azureuser");
  const [authMethod, setAuthMethod]       = useState("ssh");   // ssh | password
  const [sshPublicKey, setSshPublicKey]   = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 5 — Storage
  const [osDiskType, setOsDiskType]   = useState("Premium_LRS");
  const [osDiskSize, setOsDiskSize]   = useState(128);

  // Step 6 — Mandatory Tags
  const [appName, setAppName]           = useState("");
  const [appOwner, setAppOwner]         = useState("");
  const [criticality, setCriticality]   = useState("Medium");
  const [emailId, setEmailId]           = useState("");
  const [environment, setEnvironment]   = useState("dev");
  const [startDate, setStartDate]       = useState("");
  const [extraTags, setExtraTags]       = useState([{ key: "", value: "" }]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (step === 1) {
      setLoadingLocs(true);
      API.get(`/azure/vms/locations?subscription=${subscription}`)
        .then(r => setLocations(r.data))
        .catch(() => setLocations([]))
        .finally(() => setLoadingLocs(false));

      if (!createRG) {
        setLoadingRGs(true);
        API.get(`/azure/vms/resource-groups?subscription=${subscription}`)
          .then(r => setExistingRGs(r.data))
          .catch(() => setExistingRGs([]))
          .finally(() => setLoadingRGs(false));
      }
    }
  }, [step, subscription, createRG]);

  useEffect(() => {
    if (step === 3) {
      setLoadingVnets(true);
      API.get(`/azure/vms/vnets?subscription=connectivity`)
        .then(r => { setVnets(r.data); if (r.data[0]) setSelectedVnet(r.data[0]); })
        .catch(() => setVnets([]))
        .finally(() => setLoadingVnets(false));
    }
  }, [step]);

  useEffect(() => {
    if (selectedVnet) {
      const rg = selectedVnet.resource_group;
      setLoadingSubnets(true);
      API.get(`/azure/vms/vnets/${rg}/${selectedVnet.name}/subnets?subscription=connectivity`)
        .then(r => { setSubnets(r.data); if (r.data[0]) setSubnetId(r.data[0].id); })
        .catch(() => setSubnets([]))
        .finally(() => setLoadingSubnets(false));
    }
  }, [selectedVnet]);

  useEffect(() => {
    setSelectedImage(OS_IMAGES[osType][0]);
    if (osType === "Windows") {
      setAuthMethod("password");
      if (!allowedPorts.includes(3389)) setAllowedPorts(p => [...p.filter(x => x !== 22), 3389]);
    } else {
      setAuthMethod("ssh");
      if (!allowedPorts.includes(22)) setAllowedPorts(p => [...p.filter(x => x !== 3389), 22]);
    }
  }, [osType]);

  // ── Validation ────────────────────────────────────────────────────────────

  const validateStep = () => {
    setError("");
    if (step === 1) {
      if (!resourceGroup.trim()) return setError("Resource group name is required") || false;
      if (!location) return setError("Location is required") || false;
    }
    if (step === 2) {
      if (!vmName.trim()) return setError("VM name is required") || false;
      if (!/^[a-zA-Z][a-zA-Z0-9-]{0,14}$/.test(vmName)) return setError("VM name: 1-15 chars, letters/numbers/hyphens, start with letter") || false;
    }
    if (step === 3) {
      if (!subnetId) return setError("Please select a subnet") || false;
    }
    if (step === 4) {
      if (!adminUsername.trim()) return setError("Admin username is required") || false;
      if (authMethod === "password") {
        if (!adminPassword) return setError("Password is required") || false;
        if (adminPassword.length < 12) return setError("Password must be at least 12 characters") || false;
        if (adminPassword !== confirmPassword) return setError("Passwords do not match") || false;
      }
      if (authMethod === "ssh" && !sshPublicKey.trim()) return setError("SSH public key is required") || false;
    }
    if (step === 6) {
      if (!appName.trim())  return setError("Application Name is required (mandatory tag)") || false;
      if (!appOwner.trim()) return setError("Application Owner is required (mandatory tag)") || false;
      if (!emailId.trim())  return setError("Email ID is required (mandatory tag)") || false;
      if (!startDate)       return setError("Start Date is required (mandatory tag)") || false;
    }
    return true;
  };

  const nextStep = () => { if (validateStep()) setStep(s => s + 1); };
  const prevStep = () => { setError(""); setStep(s => s - 1); };

  // ── Port helpers ──────────────────────────────────────────────────────────

  const togglePort = (port) => {
    setAllowedPorts(p => p.includes(port) ? p.filter(x => x !== port) : [...p, port]);
  };

  const addCustomPort = () => {
    const p = parseInt(customPort);
    if (p > 0 && p <= 65535 && !allowedPorts.includes(p)) {
      setAllowedPorts(prev => [...prev, p]);
      setCustomPort("");
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setError("");

    const extraTagMap = {};
    extraTags.filter(t => t.key.trim()).forEach(t => { extraTagMap[t.key] = t.value; });

    const payload = {
      subscription,
      resource_group_name:   resourceGroup,
      create_resource_group: createRG,
      location,
      vm_size:   vmSize,
      os_type:   osType,
      image_publisher: selectedImage.publisher,
      image_offer:     selectedImage.offer,
      image_sku:       selectedImage.sku,
      image_version:   "latest",
      admin_username:  adminUsername,
      admin_password:  authMethod === "password" ? adminPassword : "",
      ssh_public_key:  authMethod === "ssh" ? sshPublicKey : "",
      disable_password_authentication: authMethod === "ssh",
      subnet_id:      subnetId,
      enable_public_ip: enablePublicIP,
      allowed_ports:  allowedPorts,
      os_disk_type:   osDiskType,
      os_disk_size_gb: osDiskSize,
      application_name:     appName,
      application_owner:    appOwner,
      business_criticality: criticality,
      email_id:             emailId,
      start_date:           startDate,
      tags: {
        environment,
        application_name:     appName,
        application_owner:    appOwner,
        business_criticality: criticality,
        email_id:             emailId,
        start_date:           startDate,
        ...extraTagMap,
      },
    };

    try {
      await API.post("/requests", {
        resource_name:  vmName,
        resource_type:  "azure_vm",
        cloud_provider: "azure",
        region:         location,
        payload,
      });
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to submit VM request");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const inputCls  = "w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400";
  const labelCls  = "block text-xs text-gray-400 mb-1";
  const selectCls = `${inputCls} cursor-pointer`;

  const StepContent = () => {
    switch (step) {
      // ── Step 1 ─────────────────────────────────────────────────────────
      case 1: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Subscription & Resource Group</h3>

          <div>
            <label className={labelCls}>Target Subscription *</label>
            <select value={subscription} onChange={e => setSubscription(e.target.value)} className={selectCls}>
              {SUBSCRIPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Network resources always route to the Connectivity subscription automatically.
            </p>
          </div>

          <div>
            <label className={labelCls}>Resource Group *</label>
            <div className="flex gap-3 mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" checked={createRG} onChange={() => setCreateRG(true)} /> Create new
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" checked={!createRG} onChange={() => setCreateRG(false)} /> Use existing
              </label>
            </div>
            {createRG ? (
              <input value={resourceGroup} onChange={e => setResourceGroup(e.target.value)} placeholder="rg-myapp-prod" className={inputCls} />
            ) : (
              <select value={resourceGroup} onChange={e => setResourceGroup(e.target.value)} className={selectCls} disabled={loadingRGs}>
                <option value="">{loadingRGs ? "Loading..." : "Select resource group"}</option>
                {existingRGs.map(rg => <option key={rg.name} value={rg.name}>{rg.name} ({rg.location})</option>)}
              </select>
            )}
          </div>

          <div>
            <label className={labelCls}>Region / Location *</label>
            <select value={location} onChange={e => setLocation(e.target.value)} className={selectCls} disabled={loadingLocs}>
              <option value="">{loadingLocs ? "Loading regions..." : "Select region"}</option>
              {locations.length > 0
                ? locations.map(l => <option key={l.name} value={l.name}>{l.display_name} ({l.name})</option>)
                : [
                    ["eastus","East US"],["eastus2","East US 2"],["westus","West US"],
                    ["westus2","West US 2"],["westus3","West US 3"],["centralus","Central US"],
                    ["northeurope","North Europe"],["westeurope","West Europe"],["uksouth","UK South"],
                    ["ukwest","UK West"],["francecentral","France Central"],["germanywestcentral","Germany West Central"],
                    ["swedencentral","Sweden Central"],["switzerlandnorth","Switzerland North"],
                    ["australiaeast","Australia East"],["australiasoutheast","Australia Southeast"],
                    ["southeastasia","Southeast Asia"],["eastasia","East Asia"],
                    ["japaneast","Japan East"],["japanwest","Japan West"],
                    ["centralindia","Central India"],["southindia","South India"],["westindia","West India"],
                    ["canadacentral","Canada Central"],["canadaeast","Canada East"],
                    ["brazilsouth","Brazil South"],["southafricanorth","South Africa North"],
                    ["uaenorth","UAE North"],["koreacentral","Korea Central"],
                  ].map(([v, l]) => <option key={v} value={v}>{l} ({v})</option>)
              }
            </select>
          </div>
        </div>
      );

      // ── Step 2 ─────────────────────────────────────────────────────────
      case 2: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">OS Image & VM Size</h3>

          <div>
            <label className={labelCls}>VM Name * (max 15 chars)</label>
            <input value={vmName} onChange={e => setVmName(e.target.value)} placeholder="my-app-vm" maxLength={15} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Operating System</label>
            <div className="flex gap-3">
              {["Linux","Windows"].map(os => (
                <button key={os} onClick={() => setOsType(os)}
                  className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${osType === os ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:border-blue-500"}`}>
                  {os}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>OS Image</label>
            <select value={selectedImage.label} onChange={e => setSelectedImage(OS_IMAGES[osType].find(i => i.label === e.target.value))} className={selectCls}>
              {OS_IMAGES[osType].map(img => <option key={img.label} value={img.label}>{img.label}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {selectedImage.publisher} / {selectedImage.offer} / {selectedImage.sku}
            </p>
          </div>

          <div>
            <label className={labelCls}>VM Size Category</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {Object.keys(VM_SIZES).map(cat => (
                <button key={cat} onClick={() => { setVmSizeCategory(cat); setVmSize(VM_SIZES[cat][0].value); }}
                  className={`px-3 py-1 rounded text-xs border transition-colors ${vmSizeCategory === cat ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:border-blue-500"}`}>
                  {cat}
                </button>
              ))}
            </div>
            <select value={vmSize} onChange={e => setVmSize(e.target.value)} className={selectCls}>
              {VM_SIZES[vmSizeCategory].map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      );

      // ── Step 3 ─────────────────────────────────────────────────────────
      case 3: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Network Configuration</h3>
          <p className="text-xs text-gray-400">VNets are fetched from the <span className="text-blue-400">Connectivity subscription</span> (hub networking). Subnet IDs are passed to the VM in {subscription === "prod" ? "Production" : "Non-Production"}.</p>

          <div>
            <label className={labelCls}>Virtual Network (from Connectivity sub)</label>
            <select value={selectedVnet?.name || ""} onChange={e => setSelectedVnet(vnets.find(v => v.name === e.target.value))} className={selectCls} disabled={loadingVnets}>
              <option value="">{loadingVnets ? "Loading VNets..." : "Select VNet"}</option>
              {vnets.map(v => <option key={v.id} value={v.name}>{v.name} ({v.location}) — {v.address_space?.join(", ")}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Subnet *</label>
            <select value={subnetId} onChange={e => setSubnetId(e.target.value)} className={selectCls} disabled={loadingSubnets || !selectedVnet}>
              <option value="">{loadingSubnets ? "Loading subnets..." : !selectedVnet ? "Select a VNet first" : "Select subnet"}</option>
              {subnets.map(s => <option key={s.id} value={s.id}>{s.name} — {s.address_prefix}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Public IP Address</p>
              <p className="text-xs text-gray-400">Assigns a static public IP (Standard SKU)</p>
            </div>
            <button onClick={() => setEnablePublicIP(p => !p)}
              className={`relative w-11 h-6 rounded-full transition-colors ${enablePublicIP ? "bg-blue-600" : "bg-gray-600"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enablePublicIP ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div>
            <label className={labelCls}>Inbound Port Rules</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {COMMON_PORTS.map(({ port, label }) => (
                <label key={port} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs transition-colors ${allowedPorts.includes(port) ? "bg-blue-900/40 border-blue-500 text-blue-300" : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"}`}>
                  <input type="checkbox" checked={allowedPorts.includes(port)} onChange={() => togglePort(port)} className="accent-blue-500" />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={customPort} onChange={e => setCustomPort(e.target.value)} placeholder="Custom port (e.g. 8443)" type="number" min={1} max={65535} className={`${inputCls} flex-1`}
                onKeyDown={e => e.key === "Enter" && addCustomPort()} />
              <button onClick={addCustomPort} className="px-3 py-2 bg-blue-600 rounded text-sm hover:bg-blue-700">Add</button>
            </div>
            {allowedPorts.filter(p => !COMMON_PORTS.find(c => c.port === p)).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {allowedPorts.filter(p => !COMMON_PORTS.find(c => c.port === p)).map(p => (
                  <span key={p} className="flex items-center gap-1 px-2 py-0.5 bg-gray-600 rounded text-xs">
                    {p} <button onClick={() => setAllowedPorts(pts => pts.filter(x => x !== p))} className="text-red-400 hover:text-red-300">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      );

      // ── Step 4 ─────────────────────────────────────────────────────────
      case 4: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Authentication</h3>

          <div>
            <label className={labelCls}>Admin Username *</label>
            <input value={adminUsername} onChange={e => setAdminUsername(e.target.value)} placeholder="azureuser" className={inputCls} />
          </div>

          {osType === "Linux" && (
            <div>
              <label className={labelCls}>Authentication Method</label>
              <div className="flex gap-3">
                {[["ssh","SSH Public Key"],["password","Password"]].map(([v,l]) => (
                  <button key={v} onClick={() => setAuthMethod(v)}
                    className={`flex-1 py-2 rounded text-sm border transition-colors ${authMethod === v ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:border-blue-500"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(authMethod === "ssh" && osType === "Linux") && (
            <div>
              <label className={labelCls}>SSH Public Key *</label>
              <textarea value={sshPublicKey} onChange={e => setSshPublicKey(e.target.value)} rows={4}
                placeholder="ssh-rsa AAAAB3NzaC1yc2E..." className={`${inputCls} font-mono text-xs resize-none`} />
            </div>
          )}

          {(authMethod === "password" || osType === "Windows") && (
            <>
              <div>
                <label className={labelCls}>Password * (min 12 chars, must include uppercase, lowercase, digit, special)</label>
                <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Confirm Password *</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} />
                {confirmPassword && adminPassword !== confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>
              {osType === "Windows" && (
                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded p-3 text-xs text-yellow-300">
                  Windows VMs require RDP (port 3389). Make sure it is enabled in the Network step.
                </div>
              )}
            </>
          )}
        </div>
      );

      // ── Step 5 ─────────────────────────────────────────────────────────
      case 5: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Storage</h3>

          <div>
            <label className={labelCls}>OS Disk Type</label>
            <select value={osDiskType} onChange={e => setOsDiskType(e.target.value)} className={selectCls}>
              {DISK_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>OS Disk Size (GB)</label>
            <div className="flex items-center gap-3">
              <input type="range" min={32} max={4096} step={32} value={osDiskSize} onChange={e => setOsDiskSize(Number(e.target.value))} className="flex-1 accent-blue-500" />
              <span className="text-sm font-mono w-20 text-right">{osDiskSize} GB</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1"><span>32 GB</span><span>4096 GB</span></div>
          </div>

          <div className="bg-gray-700/50 rounded p-3 text-xs text-gray-400">
            <p className="font-medium text-gray-300 mb-1">Disk Type Guide</p>
            <p>• <span className="text-white">Premium SSD</span> — for production, databases, high IOPS workloads</p>
            <p>• <span className="text-white">Standard SSD</span> — for dev/test, light workloads</p>
            <p>• <span className="text-white">Standard HDD</span> — for backups, archival, lowest cost</p>
            <p>• <span className="text-white">Ultra Disk</span> — for mission-critical, sub-ms latency</p>
          </div>
        </div>
      );

      // ── Step 6 ─────────────────────────────────────────────────────────
      case 6: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Mandatory Tags</h3>
          <div className="bg-yellow-900/20 border border-yellow-600/40 rounded p-3 text-xs text-yellow-300">
            These tags are required on all Azure resource groups per organizational policy.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Application Name *</label>
              <input value={appName} onChange={e => setAppName(e.target.value)} placeholder="My App" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Application Owner *</label>
              <input value={appOwner} onChange={e => setAppOwner(e.target.value)} placeholder="John Smith" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email ID *</label>
              <input type="email" value={emailId} onChange={e => setEmailId(e.target.value)} placeholder="owner@company.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Business Criticality *</label>
              <select value={criticality} onChange={e => setCriticality(e.target.value)} className={selectCls}>
                {CRITICALITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Environment *</label>
              <select value={environment} onChange={e => setEnvironment(e.target.value)} className={selectCls}>
                <option value="dev">Development</option>
                <option value="staging">Staging</option>
                <option value="prod">Production</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Start Date *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Additional Tags (optional)</label>
            {extraTags.map((tag, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={tag.key} onChange={e => setExtraTags(t => t.map((x,j) => j===i ? {...x, key: e.target.value} : x))}
                  placeholder="Key" className={`${inputCls} flex-1`} />
                <input value={tag.value} onChange={e => setExtraTags(t => t.map((x,j) => j===i ? {...x, value: e.target.value} : x))}
                  placeholder="Value" className={`${inputCls} flex-1`} />
                <button onClick={() => setExtraTags(t => t.filter((_,j) => j !== i))} className="text-red-400 hover:text-red-300 px-2">×</button>
              </div>
            ))}
            <button onClick={() => setExtraTags(t => [...t, {key:"",value:""}])} className="text-xs text-blue-400 hover:text-blue-300">+ Add tag</button>
          </div>
        </div>
      );

      // ── Step 7 — Review ────────────────────────────────────────────────
      case 7: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Review & Create</h3>

          {[
            ["Subscription",      SUBSCRIPTIONS.find(s => s.value === subscription)?.label],
            ["Resource Group",    `${resourceGroup} (${createRG ? "new" : "existing"})`],
            ["Location",          location],
            ["VM Name",           vmName],
            ["OS Type",           osType],
            ["Image",             selectedImage.label],
            ["VM Size",           vmSize],
            ["Subnet",            subnets.find(s => s.id === subnetId)?.name || subnetId],
            ["Public IP",         enablePublicIP ? "Yes (Static)" : "No"],
            ["Inbound Ports",     allowedPorts.join(", ")],
            ["Admin Username",    adminUsername],
            ["Auth Method",       authMethod === "ssh" ? "SSH Key" : "Password"],
            ["OS Disk Type",      DISK_TYPES.find(d => d.value === osDiskType)?.label],
            ["OS Disk Size",      `${osDiskSize} GB`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm border-b border-gray-700 pb-1">
              <span className="text-gray-400">{k}</span>
              <span className="text-white font-medium">{v}</span>
            </div>
          ))}

          <div className="mt-2">
            <p className="text-xs text-gray-400 mb-1 font-medium">Mandatory Tags</p>
            {[
              ["Application Name", appName],
              ["Application Owner", appOwner],
              ["Business Criticality", criticality],
              ["Email ID", emailId],
              ["Environment", environment],
              ["Start Date", startDate],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs border-b border-gray-700/50 pb-1 mb-1">
                <span className="text-gray-400">{k}</span>
                <span className="text-yellow-300">{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-blue-900/20 border border-blue-600/30 rounded p-3 text-xs text-blue-300">
            This will create an approval request. An admin must approve before resources are provisioned.
          </div>
        </div>
      );

      default: return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col text-white">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold">Create Azure Virtual Machine</h2>
            <p className="text-xs text-gray-400">Step {step} of {STEPS.length} — {STEPS[step-1].label}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4">
          <div className="flex gap-1">
            {STEPS.map(s => (
              <div key={s.id} className={`h-1 flex-1 rounded-full transition-colors ${s.id <= step ? "bg-blue-500" : "bg-gray-600"}`} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <StepContent />
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-700">
          <button onClick={prevStep} disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-sm">
            <ChevronLeft size={16} /> Back
          </button>

          {step < STEPS.length ? (
            <button onClick={nextStep} className="flex items-center gap-2 px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-sm font-medium">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-60 text-sm font-medium">
              {submitting ? <><Loader size={16} className="animate-spin" /> Submitting...</> : <><CheckCircle size={16} /> Create VM</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
