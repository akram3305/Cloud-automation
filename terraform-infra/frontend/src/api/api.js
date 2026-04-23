import axios from "axios"

const api = axios.create({ baseURL: "/api", timeout: 300000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)

export const login = (username, password) => api.post("/auth/login", { username, password })
export const getMe = () => api.get("/auth/me")
export const createRequest = (data) => api.post("/requests", data)
export const listRequests = () => api.get("/requests")
export const approveRequest = (id, reason) => api.patch(`/requests/${id}/approve`, { reason })
export const rejectRequest = (id, reason) => api.patch(`/requests/${id}/reject`, { reason })
export const getRequestLogs = (id) => api.get(`/requests/${id}/logs`)
export const listVMs = () => api.get("/vms")
export const startVM = (id) => api.post(`/vms/${id}/start`)
export const stopVM = (id) => api.post(`/vms/${id}/stop`)
export const deleteVM = (id) => api.delete(`/vms/${id}`)
export const getPriceEstimate = (instanceType, region) => api.get("/cost/estimate", { params: { instance_type: instanceType, region } })
export const getInstances = (params) => api.get("/cost/instances", { params })
export const getCostOverview = () => api.get("/cost/overview")
export const getDailyCost = () => api.get("/cost/daily")
export const getServiceCost = () => api.get("/cost/services")
export const getResourceCosts = () => api.get("/cost/resources")


export const listBuckets      = ()             => api.get('/s3/buckets')
export const createBucket     = (data)         => api.post('/s3/create', data)
export const deleteBucket = (name, force) => api.delete('/s3/buckets/'+name+(force?'?force=true':''))
export const listObjects      = (bucket, prefix) => api.get('/s3/buckets/'+bucket+'/objects', { params: { prefix } })
export const deleteObject     = (bucket, key)  => api.delete('/s3/buckets/'+bucket+'/objects?key='+encodeURIComponent(key))
export const getDownloadUrl   = (bucket, key)  => api.get('/s3/buckets/'+bucket+'/download', { params: { key } })
export const getS3Stats = () => api.get('/s3/stats')
export const listVPCs          = ()     => api.get('/infra/vpcs')
export const listLambdas       = ()     => api.get('/infra/lambdas')
export const listLoadBalancers = ()     => api.get('/infra/loadbalancers')
export const listRDSInstances  = ()     => api.get('/infra/rds')
export const listCloudWatchAlarms = ()  => api.get('/infra/cloudwatch')
export const setSchedule = (id, autoStart, autoStop) => api.patch('/vms/'+id+'/set-schedule', { auto_start: autoStart, auto_stop: autoStop })
export const listEKSClusters = () => api.get('/eks/clusters')
export const getEKSPrereqs = (region) => api.get('/eks/prerequisites?region='+region)
export const createEKSCluster = (data) => api.post('/eks/clusters', data)
export const deleteEKSCluster = (name, region) => api.delete('/eks/clusters/'+name+'?region='+region)
export const submitApproval = (data) => api.post('/approvals/request', data)
export const listApprovals = () => api.get('/approvals')
export const reviewApproval = (id, data) => api.patch('/approvals/'+id+'/review', data)
export const listVPCsFull = (r) => api.get('/vpc/list?region='+(r||'all'))
export const createVPC = (d) => api.post('/vpc/create',d)
export const createSubnet = (d) => api.post('/vpc/subnet/create',d)
export const deleteVPC = (id,r) => api.delete('/vpc/'+id+'?region='+(r||'ap-south-1'))
export const listSGs = (r,v) => api.get('/vpc/security-groups?region='+(r||'ap-south-1')+(v?'&vpc_id='+v:''))
export const createSG = (d) => api.post('/vpc/security-groups/create',d)
export const deleteSG = (id,r) => api.delete('/vpc/security-groups/'+id+'?region='+(r||'ap-south-1'))
export const updateSGRules = (id, region, rules_in) => api.patch('/vpc/security-groups/'+id+'/rules', { region, rules_in })
export const listIAMRoles = () => api.get('/iam/roles')
export const listEKSRoles = () => api.get('/iam/roles/eks')
export const createIAMRole = (d) => api.post('/iam/roles/create',d)
export const deleteIAMRole = (n) => api.delete('/iam/roles/'+n)
export const listKeypairs    = (r)    => api.get('/iam/keypairs?region='+(r||'all'))
export const createKeypair   = (n,r)  => api.post('/iam/keypairs/create', {name:n, region:r||'ap-south-1'})
export const deleteKeypair   = (n,r)  => api.delete('/iam/keypairs/'+n+'?region='+(r||'ap-south-1'))
export const downloadKeypair = (name) => api.get('/iam/keypairs/'+encodeURIComponent(name)+'/download')
export default api





export const getForecast       = ()         => api.get('/cost/forecast')
export const getVMCosts        = ()         => api.get('/cost/vms/realtime')
export const getMonthlyCost    = (months=6) => api.get('/cost/monthly', { params: { months } })
export const getActivityLogs   = (limit=50, hours=72) => api.get('/logs/activity', { params: { limit, hours } })
export const getAlerts         = (unreadOnly=false)   => api.get('/alerts', { params: { unread_only: unreadOnly } })
export const getAlertCount     = ()                   => api.get('/alerts/unread/count')
export const markAlertRead     = (id)                 => api.patch(`/alerts/${id}/read`)
export const markAllAlertsRead = ()                   => api.patch('/alerts/read-all')
export const getEC2InstanceCosts = (month=null)       => api.get('/cost/ec2/instances', month ? { params: { month } } : {})

export const setupEKSRoles    = ()                           => api.post('/eks/setup-roles')
export const getPipeline      = (id)                         => api.get(`/requests/${id}/pipeline`)

// ── Terraform State & Logs ─────────────────────────────────────────
export const getEnvTFState = (env)                            => api.get(`/logs/state/${env}/tfstate`)
export const getEnvLogs    = (env)                            => api.get(`/logs/state/${env}/logs`)
export const getLogFile    = (env, cloud, reqId, filename)    => api.get(`/logs/state/${env}/logs/${cloud}/${reqId}/${filename}`)
export const getCloudIndex = (cloud)                          => api.get(`/logs/cloud/${cloud}/index`)
export const getCloudLog   = (cloud, env)                     => api.get(`/logs/cloud/${cloud}/${env}/log`)

// ── Azure VM ───────────────────────────────────────────────────────────────
export const azureHealth       = ()                            => api.get('/azure/vms/health')
export const listAzureVMs      = (sub='nonprod', rg=null)      => api.get('/azure/vms', { params: { subscription: sub, resource_group: rg } })
export const getAzureVM        = (rg, name, sub='nonprod')     => api.get(`/azure/vms/${rg}/${name}`, { params: { subscription: sub } })
export const startAzureVM      = (rg, name, sub='nonprod')     => api.post(`/azure/vms/${rg}/${name}/start`, null, { params: { subscription: sub } })
export const stopAzureVM       = (rg, name, sub='nonprod', deallocate=true) => api.post(`/azure/vms/${rg}/${name}/stop`, null, { params: { subscription: sub, deallocate } })
export const restartAzureVM    = (rg, name, sub='nonprod')     => api.post(`/azure/vms/${rg}/${name}/restart`, null, { params: { subscription: sub } })
export const deleteAzureVM     = (rg, name, sub='nonprod')     => api.delete(`/azure/vms/${rg}/${name}`, { params: { subscription: sub } })
export const listAzureVMSizes  = (location, sub='nonprod')     => api.get(`/azure/vms/sizes/${location}`, { params: { subscription: sub } })
export const listAzureRGs      = (sub='nonprod')               => api.get('/azure/vms/resource-groups', { params: { subscription: sub } })
export const listAzureVNets    = (sub='connectivity')          => api.get('/azure/vms/vnets', { params: { subscription: sub } })
export const listAzureSubnets  = (rg, vnet, sub='connectivity')=> api.get(`/azure/vms/vnets/${rg}/${vnet}/subnets`, { params: { subscription: sub } })
export const listAzureLocations    = (sub='nonprod')               => api.get('/azure/vms/locations', { params: { subscription: sub } })
export const createAzureVM         = (data)                        => api.post('/azure/vms/create', data)
export const getAzureVMConnectInfo = (rg, name, sub='nonprod')     => api.get(`/azure/vms/${rg}/${name}/connect`, { params: { subscription: sub } })
export const getAzureVMSchedule    = (rg, name, sub='nonprod')     => api.get(`/azure/vms/${rg}/${name}/schedule`, { params: { subscription: sub } })
export const setAzureVMSchedule    = (rg, name, sub='nonprod', d)  => api.post(`/azure/vms/${rg}/${name}/schedule`, d, { params: { subscription: sub } })
export const getAzureCostByRG      = (sub='nonprod')               => api.get('/azure/vms/cost-by-rg', { params: { subscription: sub } })

// ── Azure Storage ──────────────────────────────────────────────────────────
export const listAzureStorageAccounts  = (sub='nonprod')                           => api.get('/azure/storage/accounts', { params: { subscription: sub } })
export const createAzureStorageAccount = (data)                                    => api.post('/azure/storage/accounts', data)
export const deleteAzureStorageAccount = (rg, name, sub='nonprod')                 => api.delete(`/azure/storage/accounts/${rg}/${name}`, { params: { subscription: sub } })
export const listAzureContainers       = (acct, rg, sub='nonprod')                 => api.get(`/azure/storage/${acct}/containers`, { params: { resource_group: rg, subscription: sub } })
export const createAzureContainer      = (acct, data)                              => api.post(`/azure/storage/${acct}/containers`, data)
export const deleteAzureContainer      = (acct, name, rg, sub='nonprod')           => api.delete(`/azure/storage/${acct}/containers/${name}`, { params: { resource_group: rg, subscription: sub } })
export const listAzureFileShares       = (acct, rg, sub='nonprod')                 => api.get(`/azure/storage/${acct}/fileshares`, { params: { resource_group: rg, subscription: sub } })
export const createAzureFileShare      = (acct, data)                              => api.post(`/azure/storage/${acct}/fileshares`, data)
export const deleteAzureFileShare      = (acct, name, rg, sub='nonprod')           => api.delete(`/azure/storage/${acct}/fileshares/${name}`, { params: { resource_group: rg, subscription: sub } })
export const listAzureQueues           = (acct, rg, sub='nonprod')                 => api.get(`/azure/storage/${acct}/queues`, { params: { resource_group: rg, subscription: sub } })
export const createAzureQueue          = (acct, data)                              => api.post(`/azure/storage/${acct}/queues`, data)
export const deleteAzureQueue          = (acct, name, rg, sub='nonprod')           => api.delete(`/azure/storage/${acct}/queues/${name}`, { params: { resource_group: rg, subscription: sub } })
export const listAzureTables           = (acct, rg, sub='nonprod')                 => api.get(`/azure/storage/${acct}/tables`, { params: { resource_group: rg, subscription: sub } })
export const createAzureTable          = (acct, data)                              => api.post(`/azure/storage/${acct}/tables`, data)
export const deleteAzureTable          = (acct, name, rg, sub='nonprod')           => api.delete(`/azure/storage/${acct}/tables/${name}`, { params: { resource_group: rg, subscription: sub } })

// ── GCP ───────────────────────────────────────────────────────────────────
export const gcpHealth         = ()                            => api.get('/gcp/health')
export const listGCPInstances  = (project=null, zone=null)     => api.get('/gcp/instances', { params: { project, zone } })
export const createGCPInstance = (data)                        => api.post('/gcp/instances', data)
export const startGCPInstance  = (name, zone)                  => api.post(`/gcp/instances/${zone}/${name}/start`)
export const stopGCPInstance   = (name, zone)                  => api.post(`/gcp/instances/${zone}/${name}/stop`)
export const deleteGCPInstance = (name, zone)                  => api.delete(`/gcp/instances/${zone}/${name}`)
export const getGCPInstanceConnectInfo = (name, zone, project=null) => api.get(`/gcp/instances/${zone}/${name}/connect`, project ? { params: { project } } : {})
export const getGCPInstanceSchedule    = (name, zone, project=null) => api.get(`/gcp/instances/${zone}/${name}/schedule`, project ? { params: { project } } : {})
export const setGCPInstanceSchedule    = (name, zone, data, project=null) => api.post(`/gcp/instances/${zone}/${name}/schedule`, data, project ? { params: { project } } : {})
export const getGCPInstanceFirewall     = (name, zone, project=null) => api.get(`/gcp/instances/${zone}/${name}/firewall`, project ? { params: { project } } : {})
export const updateGCPInstanceFirewall  = (name, zone, data) => api.put(`/gcp/instances/${zone}/${name}/firewall`, data)
export const getGCPInstanceSSHKey       = (name, zone) => api.get(`/gcp/instances/${zone}/${name}/ssh-key`)
export const fixGCPInstanceSSHKey       = (name, zone) => api.post(`/gcp/instances/${zone}/${name}/fix-ssh-key`)
export const regenerateGCPSSHKey        = (name, zone, username="gcpuser", project=null) => api.post(`/gcp/instances/${zone}/${name}/regenerate-ssh-key`, null, { params: { username, ...(project ? { project } : {}) } })
export const getGCPCost        = (project=null)                => api.get('/gcp/cost', project ? { params: { project } } : {})
export const listGCPNetworks    = (project=null)               => api.get('/gcp/networks', project ? { params: { project } } : {})
export const listGCPSubnetworks = (params={})                  => api.get('/gcp/subnetworks', { params })
export const listGCPBuckets     = (project=null)               => api.get('/gcp/storage/buckets', project ? { params: { project } } : {})
export const generateGCPSSHKey  = (instanceName, username="gcpuser") => api.post('/gcp/generate-ssh-key', null, { params: { instance_name: instanceName, username } })

// ── GCP Kubernetes (GKE) ──────────────────────────────────────────────────
export const createGKECluster   = (data)                       => api.post('/gcp/kubernetes', data)
export const listGKEClusters    = ()                           => api.get('/gcp/kubernetes/clusters')

// ── Monitoring / Utilization / Budget ─────────────────────────────────────
export const getUtilization      = ()      => api.get('/monitoring/utilization')
export const refreshUtilization  = ()      => api.post('/monitoring/utilization/refresh')
export const getBudgets          = ()      => api.get('/monitoring/budgets')
export const createBudget        = (data)  => api.post('/monitoring/budgets', data)
export const updateBudget        = (id, d) => api.put('/monitoring/budgets/'+id, d)
export const deleteBudget        = (id)    => api.delete('/monitoring/budgets/'+id)
export const getBudgetAlerts     = ()      => api.get('/monitoring/budget-alerts')
export const triggerBudgetCheck  = ()      => api.post('/monitoring/budget-check')

// ── Per-resource VM budgets ───────────────────────────────────────────────────
export const listVMBudgets       = ()          => api.get('/monitoring/vm-budgets')
export const getVMBudgetByRes    = (vmId)      => api.get(`/monitoring/vm-budgets/resource/${encodeURIComponent(vmId)}`)
export const createVMBudget      = (data)      => api.post('/monitoring/vm-budgets', data)
export const updateVMBudget      = (id, data)  => api.put(`/monitoring/vm-budgets/${id}`, data)
export const deleteVMBudget      = (id)        => api.delete(`/monitoring/vm-budgets/${id}`)
export const getVMBudgetAlerts   = ()          => api.get('/monitoring/vm-budget-alerts')
