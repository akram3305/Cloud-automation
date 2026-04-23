import { Routes, Route, Navigate } from "react-router-dom"
import { useTheme } from "./context/ThemeContext"
import { ToastProvider } from "./context/ToastContext"
import Login          from "./pages/Login"
import Dashboard           from "./pages/Dashboard"
import MultiCloudDashboard from "./pages/MultiCloudDashboard"
import Compute        from "./pages/Compute"
import Approvals      from "./pages/Approvals"
import Cost           from "./pages/Cost"
import Resources      from "./pages/Resources"
import Activity       from "./pages/Activity"
import EKS            from "./pages/EKS"
import Storage        from "./pages/Storage"
import Network        from "./pages/Network"
import IAM            from "./pages/IAM"
import Kubernetes     from "./pages/Kubernetes"
import KubernetesHub  from "./pages/KubernetesHub"
import TFState        from "./pages/TFState"
import Pipeline       from "./pages/Pipeline"
import AzureDashboard from "./pages/AzureDashboard"
import AzureCompute   from "./pages/AzureCompute"
import AzureStorage   from "./pages/AzureStorage"
import AzureNetwork   from "./pages/AzureNetwork"
import AzureCostByRG  from "./pages/AzureCostByRG"
import GCPDashboard      from "./pages/GCPDashboard"
import GCPCompute        from "./pages/GCPCompute"
import GCPCost           from "./pages/GCPCost"
import GCPNetwork        from "./pages/GCPNetwork"
import GCPVPCCreate      from "./pages/GCPVPCCreate"
import GCPStorage        from "./pages/GCPStorage"
import GCPStorageCreate  from "./pages/GCPStorageCreate"
import AzureServices    from "./pages/AzureServices"
import GCPServices      from "./pages/GCPServices"
import ServiceCatalog    from "./pages/ServiceCatalog"
import EC2Launch         from "./pages/EC2Launch"
import AzureVMLaunch     from "./pages/AzureVMLaunch"
import GCPComputeLaunch  from "./pages/GCPComputeLaunch"
import GCPKubernetes     from "./pages/GCPKubernetes"
import GCPGKECreate        from "./pages/GCPGKECreate"
import ResourceMonitoring  from "./pages/ResourceMonitoring"
import Sidebar             from "./components/Sidebar"

function PrivateLayout({ children }) {
  const { dark } = useTheme()
  const token = localStorage.getItem("token")
  if (!token) return <Navigate to="/login" replace />
  return (
    <div style={{ display:"flex", minHeight:"100vh", background: dark ? "#070c18" : "#f0f4f8", transition:"background 0.3s ease" }}>
      <Sidebar />
      <main style={{ flex:1, minWidth:0, overflowY:"auto", minHeight:"100vh" }}>
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login"            element={<Login />} />

        {/* ── Platform ── */}
        <Route path="/overview"         element={<PrivateLayout><MultiCloudDashboard /></PrivateLayout>} />
        <Route path="/monitoring"       element={<PrivateLayout><ResourceMonitoring /></PrivateLayout>} />

        {/* ── AWS ── */}
        <Route path="/"                 element={<PrivateLayout><Dashboard /></PrivateLayout>} />
        <Route path="/compute"          element={<PrivateLayout><Compute /></PrivateLayout>} />
        <Route path="/approvals"        element={<PrivateLayout><Approvals /></PrivateLayout>} />
        <Route path="/cost"             element={<PrivateLayout><Cost /></PrivateLayout>} />
        <Route path="/eks"              element={<PrivateLayout><EKS /></PrivateLayout>} />
        <Route path="/activity"         element={<PrivateLayout><Activity /></PrivateLayout>} />
        <Route path="/resources"        element={<PrivateLayout><Resources /></PrivateLayout>} />
        <Route path="/storage"          element={<PrivateLayout><Storage /></PrivateLayout>} />
        <Route path="/network"          element={<PrivateLayout><Network /></PrivateLayout>} />
        <Route path="/iam"              element={<PrivateLayout><IAM /></PrivateLayout>} />
        <Route path="/kubernetes"       element={<PrivateLayout><KubernetesHub /></PrivateLayout>} />
        <Route path="/tfstate"          element={<PrivateLayout><TFState /></PrivateLayout>} />
        <Route path="/pipeline/:id"     element={<PrivateLayout><Pipeline /></PrivateLayout>} />

        {/* ── Azure ── */}
        <Route path="/azure"            element={<PrivateLayout><AzureDashboard /></PrivateLayout>} />
        <Route path="/azure/compute"    element={<PrivateLayout><AzureCompute /></PrivateLayout>} />
        <Route path="/azure/storage"    element={<PrivateLayout><AzureStorage /></PrivateLayout>} />
        <Route path="/azure/network"    element={<PrivateLayout><AzureNetwork /></PrivateLayout>} />
        <Route path="/azure/cost"       element={<PrivateLayout><AzureCostByRG /></PrivateLayout>} />
        <Route path="/azure/services"        element={<PrivateLayout><AzureServices /></PrivateLayout>} />

        {/* ── GCP ── */}
        <Route path="/gcp"                   element={<PrivateLayout><GCPDashboard /></PrivateLayout>} />
        <Route path="/gcp/compute"           element={<PrivateLayout><GCPCompute /></PrivateLayout>} />
        <Route path="/gcp/compute/create"    element={<PrivateLayout><GCPComputeLaunch /></PrivateLayout>} />
        <Route path="/gcp/cost"              element={<PrivateLayout><GCPCost /></PrivateLayout>} />
        <Route path="/gcp/network"            element={<PrivateLayout><GCPNetwork /></PrivateLayout>} />
        <Route path="/gcp/network/create"   element={<PrivateLayout><GCPVPCCreate /></PrivateLayout>} />
        <Route path="/gcp/storage"           element={<PrivateLayout><GCPStorage /></PrivateLayout>} />
        <Route path="/gcp/storage/create"    element={<PrivateLayout><GCPStorageCreate /></PrivateLayout>} />
        <Route path="/gcp/kubernetes"        element={<PrivateLayout><GCPKubernetes /></PrivateLayout>} />
        <Route path="/gcp/kubernetes/create" element={<PrivateLayout><GCPGKECreate /></PrivateLayout>} />
        <Route path="/gcp/services"          element={<PrivateLayout><GCPServices /></PrivateLayout>} />

        {/* ── Service Catalog & Launch Wizards ── */}
        <Route path="/services"              element={<PrivateLayout><ServiceCatalog /></PrivateLayout>} />
        <Route path="/compute/create"        element={<PrivateLayout><EC2Launch /></PrivateLayout>} />
        <Route path="/azure/compute/create"  element={<PrivateLayout><AzureVMLaunch /></PrivateLayout>} />

        <Route path="*"                      element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
