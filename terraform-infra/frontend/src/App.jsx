import { Routes, Route, Navigate } from "react-router-dom"
import { useTheme } from "./context/ThemeContext"
import Login      from "./pages/Login"
import Dashboard  from "./pages/Dashboard"
import Compute    from "./pages/Compute"
import Approvals  from "./pages/Approvals"
import Cost       from "./pages/Cost"
import Resources  from "./pages/Resources"
import Activity   from "./pages/Activity"
import EKS        from "./pages/EKS"
import Storage    from "./pages/Storage"
import Network    from "./pages/Network"
import IAM        from "./pages/IAM"
import Kubernetes from "./pages/Kubernetes"
import Sidebar    from "./components/Sidebar"

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
    <Routes>
      <Route path="/login"      element={<Login />} />
      <Route path="/"           element={<PrivateLayout><Dashboard /></PrivateLayout>} />
      <Route path="/compute"    element={<PrivateLayout><Compute /></PrivateLayout>} />
      <Route path="/approvals"  element={<PrivateLayout><Approvals /></PrivateLayout>} />
      <Route path="/cost"       element={<PrivateLayout><Cost /></PrivateLayout>} />
      <Route path="/eks"        element={<PrivateLayout><EKS /></PrivateLayout>} />
      <Route path="/activity"   element={<PrivateLayout><Activity /></PrivateLayout>} />
      <Route path="/resources"  element={<PrivateLayout><Resources /></PrivateLayout>} />
      <Route path="/storage"    element={<PrivateLayout><Storage /></PrivateLayout>} />
      <Route path="/network"    element={<PrivateLayout><Network /></PrivateLayout>} />
      <Route path="/iam"        element={<PrivateLayout><IAM /></PrivateLayout>} />
      <Route path="/kubernetes" element={<PrivateLayout><Kubernetes /></PrivateLayout>} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  )
}