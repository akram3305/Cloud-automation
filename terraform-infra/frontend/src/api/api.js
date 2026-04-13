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
export const listKeypairs = (r) => api.get('/iam/keypairs?region='+(r||'all'))
export const createKeypair = (n,r) => api.post('/iam/keypairs/create', {name:n, region:r||'ap-south-1'})
export const deleteKeypair = (n,r) => api.delete('/iam/keypairs/'+n+'?region='+(r||'ap-south-1'))
export default api





export const getForecast       = ()         => api.get('/cost/forecast')
export const getVMCosts        = ()         => api.get('/cost/vms/realtime')
export const getMonthlyCost    = (months=6) => api.get('/cost/monthly', { params: { months } })
export const getActivityLogs   = (limit=50, hours=72) => api.get('/logs/activity', { params: { limit, hours } })

export const setupEKSRoles    = ()                           => api.post('/eks/setup-roles')
export const getPipeline      = (id)                         => api.get(`/requests/${id}/pipeline`)

// ── Terraform State & Logs ─────────────────────────────────────────
export const getEnvTFState = (env)                       => api.get(`/logs/state/${env}/tfstate`)
export const getEnvLogs    = (env)                       => api.get(`/logs/state/${env}/logs`)
export const getLogFile    = (env, reqId, filename)      => api.get(`/logs/state/${env}/logs/${reqId}/${filename}`)
