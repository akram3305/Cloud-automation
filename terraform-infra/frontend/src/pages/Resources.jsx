import { useState, useEffect, useCallback } from "react"
import { useTheme } from "../context/ThemeContext"
import { listRequests, listVMs, listBuckets, deleteBucket, startVM, stopVM, listVPCs, listLambdas, listLoadBalancers } from "../api/api"
import api from "../api/api"
import CreateVMModal from "../components/CreateVMModal"
import ScheduleModal from "../components/ScheduleModal"
import VPCModal from "../components/VPCModal"
import SGModal from "../components/SGModal"
import EC2ConnectionInfo from "../components/EC2ConnectionInfo"

const ACCESS_CODE = "AIONOS"
const STATUS_COLORS = { running:"#00d4aa",active:"#00d4aa",available:"#00d4aa",ACTIVE:"#00d4aa",stopped:"#f59e0b",pending:"#3b82f6",provisioning:"#a78bfa",failed:"#f43f5e",FAILED:"#f43f5e",CREATING:"#3b82f6" }
const ALL_REGIONS = ["ap-south-1","ap-south-2","ap-southeast-1","ap-southeast-2","ap-northeast-1","ap-northeast-2","ap-northeast-3","us-east-1","us-east-2","us-west-1","us-west-2","eu-west-1","eu-west-2","eu-west-3","eu-central-1","eu-north-1","ca-central-1","sa-east-1","me-south-1","af-south-1"]
const S3_REGIONS = ["ap-south-1","ap-southeast-1","us-east-1","us-east-2","us-west-2","eu-west-1","eu-central-1"]

const SERVICES = [
  { id:"ec2",        name:"EC2 Instance",    desc:"Virtual servers",          cat:"Compute",    color:"#FF9900", ready:true,  icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
  { id:"s3",         name:"S3 Bucket",       desc:"Scalable object storage",  cat:"Storage",    color:"#00d4aa", ready:true,  icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { id:"rds",        name:"RDS Database",    desc:"Managed relational DB",    cat:"Database",   color:"#3b82f6", ready:false, icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
  { id:"vpc",        name:"VPC",             desc:"Isolated virtual network", cat:"Networking", color:"#a78bfa", ready:true,  icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064" },
  { id:"elb",        name:"Load Balancer",   desc:"Distribute traffic",       cat:"Networking", color:"#f97316", ready:false, icon:"M8 9l4-4 4 4m0 6l-4 4-4-4" },
  { id:"lambda",     name:"Lambda Function", desc:"Run code serverless",      cat:"Compute",    color:"#f59e0b", ready:false, icon:"M13 10V3L4 14h7v7l9-11h-7z" },
  { id:"cloudfront", name:"CloudFront CDN",  desc:"Global content delivery",  cat:"Networking", color:"#06b6d4", ready:false, icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945" },
  { id:"elasticache",name:"ElastiCache",     desc:"In-memory caching",        cat:"Database",   color:"#ec4899", ready:false, icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" },
  { id:"sns",        name:"SNS Topic",       desc:"Push notifications",       cat:"Messaging",  color:"#f43f5e", ready:false, icon:"M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
  { id:"sqs",        name:"SQS Queue",       desc:"Managed message queuing",  cat:"Messaging",  color:"#84cc16", ready:false, icon:"M4 6h16M4 10h16M4 14h16M4 18h16" },
  { id:"security-group", name:"Security Group", desc:"Firewall rules", cat:"Networking", color:"#f97316", ready:true, icon:"M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { id:"iam",        name:"IAM Role",        desc:"Identity & access mgmt",   cat:"Security",   color:"#f59e0b", ready:true,  icon:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
]

const CATS = ["All","Compute","Storage","Database","Networking","Messaging","Security"]

const EKS_INSTANCE_GROUPS = [
  { group:"General Purpose", color:"#3b82f6", types:[
    {t:"t3.medium",c:2,r:"4 GiB",p:"$0.042/hr"},{t:"t3.large",c:2,r:"8 GiB",p:"$0.083/hr"},
    {t:"t3.xlarge",c:4,r:"16 GiB",p:"$0.166/hr"},{t:"t3.2xlarge",c:8,r:"32 GiB",p:"$0.333/hr"},
    {t:"m5.large",c:2,r:"8 GiB",p:"$0.096/hr"},{t:"m5.xlarge",c:4,r:"16 GiB",p:"$0.192/hr"},
    {t:"m5.2xlarge",c:8,r:"32 GiB",p:"$0.384/hr"},{t:"m5.4xlarge",c:16,r:"64 GiB",p:"$0.768/hr"},
  ]},
  { group:"Compute Optimized", color:"#f59e0b", types:[
    {t:"c5.large",c:2,r:"4 GiB",p:"$0.085/hr"},{t:"c5.xlarge",c:4,r:"8 GiB",p:"$0.170/hr"},
    {t:"c5.2xlarge",c:8,r:"16 GiB",p:"$0.340/hr"},{t:"c5.4xlarge",c:16,r:"32 GiB",p:"$0.680/hr"},
    {t:"c5a.xlarge",c:4,r:"8 GiB",p:"$0.154/hr"},{t:"c5a.2xlarge",c:8,r:"16 GiB",p:"$0.308/hr"},
  ]},
  { group:"Memory Optimized", color:"#a78bfa", types:[
    {t:"r5.large",c:2,r:"16 GiB",p:"$0.126/hr"},{t:"r5.xlarge",c:4,r:"32 GiB",p:"$0.252/hr"},
    {t:"r5.2xlarge",c:8,r:"64 GiB",p:"$0.504/hr"},{t:"r5.4xlarge",c:16,r:"128 GiB",p:"$1.008/hr"},
    {t:"r6g.large",c:2,r:"16 GiB",p:"$0.101/hr"},{t:"r6g.xlarge",c:4,r:"32 GiB",p:"$0.201/hr"},
  ]},
  { group:"GPU / ML", color:"#f43f5e", types:[
    {t:"g4dn.xlarge",c:4,r:"16 GiB",p:"$0.526/hr"},{t:"g4dn.2xlarge",c:8,r:"32 GiB",p:"$0.752/hr"},
    {t:"g4dn.4xlarge",c:16,r:"64 GiB",p:"$1.204/hr"},{t:"g5.xlarge",c:4,r:"16 GiB",p:"$1.006/hr"},
    {t:"g5.2xlarge",c:8,r:"32 GiB",p:"$1.212/hr"},{t:"p3.2xlarge",c:8,r:"61 GiB",p:"$3.060/hr"},
  ]},
  { group:"ARM Graviton", color:"#00d4aa", types:[
    {t:"t4g.medium",c:2,r:"4 GiB",p:"$0.034/hr"},{t:"t4g.large",c:2,r:"8 GiB",p:"$0.067/hr"},
    {t:"t4g.xlarge",c:4,r:"16 GiB",p:"$0.134/hr"},{t:"m6g.large",c:2,r:"8 GiB",p:"$0.077/hr"},
    {t:"m6g.xlarge",c:4,r:"16 GiB",p:"$0.154/hr"},{t:"c6g.large",c:2,r:"4 GiB",p:"$0.068/hr"},
  ]},
]

const K8S_VERSIONS = ["1.35","1.34","1.33","1.32"]

function LockIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{display:"inline",marginRight:"3px",verticalAlign:"middle"}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
}

export default function Resources() {
  const { dark } = useTheme()
  const [catFilter, setCat]    = useState("All")
  const [search, setSearch]    = useState("")
  const [vms,setVms]           = useState([])
  const [reqs,setReqs]         = useState([])
  const [s3,setS3]             = useState([])
  const [vpcs,setVpcs]         = useState([])
  const [lambdas,setLambdas]   = useState([])
  const [lbs,setLbs]           = useState([])
  const [eksClusters,setEKS]   = useState([])
  const [iamRoles,setIAM]      = useState([])
  const [keypairs,setKPs]      = useState([])
  const [loading,setLoading]   = useState(true)
  const [success,setSuccess]   = useState("")
  const [actionId,setActionId] = useState(null)
  const [expanded,setExpanded] = useState({})
  const [revealed,setRevealed] = useState({})
  const [showVMModal,setVMModal]   = useState(false)
  const [showS3Modal,setS3Modal]   = useState(false)
  const [showEKSModal,setEKSModal] = useState(false)
  const [showVPCModal,setVPCModal]   = useState(false)
  const [showSGModal,setSGModal]     = useState(false)
  const [connVM,setConnVM]           = useState(null)
  const [showIAMModal,setIAMModal] = useState(false)
  const [schedVM,setSchedVM]       = useState(null)
  const [s3Form,setS3Form]         = useState({name:"",region:"ap-south-1",versioning:false,public:false,encryption:"AES256",project:"",owner:"",environment:"dev"})
  const [s3Creating,setS3C]        = useState(false)
  const [s3Err,setS3Err]           = useState("")
  const [vpcForm,setVPCForm]       = useState({name:"",cidr:"10.0.0.0/16",region:"ap-south-1",enable_dns:true})
  const [vpcCreating,setVPCC]      = useState(false)
  const [vpcErr,setVPCErr]         = useState("")
  const [iamForm,setIAMForm]       = useState({name:"",role_type:"eks-cluster",description:"Created by AIonOS Platform"})
  const [iamCreating,setIAMC]      = useState(false)
  const [iamErr,setIAMErr]         = useState("")
  const [eksStep,setEksStep]       = useState(0)
  const [eksForm,setEksForm]       = useState({name:"",region:"ap-south-1",kubernetes_version:"1.32",role_arn:"",subnet_ids:[],security_group_ids:[],node_instance_type:"t3.medium",node_count:2,min_nodes:1,max_nodes:5})
  const [eksCreating,setEksC]      = useState(false)
  const [eksErr,setEksErr]         = useState("")
  const [prereqs,setPrereqs]       = useState(null)
  const [loadingPre,setLoadPre]    = useState(false)
  const [instGroup,setInstGroup]   = useState("General Purpose")

  const bg      = dark?"#070c18":"#f0f4f8"
  const surface = dark?"#0f172a":"#ffffff"
  const border  = dark?"#1e293b":"#e2e8f0"
  const text    = dark?"#f1f5f9":"#0f172a"
  const muted   = dark?"#475569":"#64748b"
  const subtle  = dark?"#1e293b":"#f8fafc"
  const inp     = {padding:"8px 12px",border:"1px solid "+border,borderRadius:"8px",fontSize:"13px",width:"100%",background:surface,color:text}

  const fetchAll = useCallback(async () => {
    try {
      const [vr,rr,sr,vpcr,lr,lbr] = await Promise.all([
        listVMs(), listRequests(), listBuckets(),
        listVPCs().catch(()=>({data:[]})),
        listLambdas().catch(()=>({data:[]})),
        listLoadBalancers().catch(()=>({data:[]})),
      ])
      setVms(vr.data); setReqs(rr.data.filter(r=>!["completed","rejected"].includes(r.status)))
      setS3(sr.data); setVpcs(vpcr.data); setLambdas(lr.data); setLbs(lbr.data)
    } catch(e){console.error(e)} finally{setLoading(false)}
  },[])

  const fetchEKS = useCallback(async()=>{ try{const {data}=await api.get("/eks/clusters");setEKS(data)}catch(e){console.error(e)} },[])
  const fetchIAM = useCallback(async()=>{ try{const [rr,kpr]=await Promise.all([api.get("/iam/roles").catch(()=>({data:[]})),api.get("/iam/keypairs?region=all").catch(()=>({data:[]}))]); setIAM(rr.data); setKPs(kpr.data)}catch(e){console.error(e)} },[])

  useEffect(()=>{fetchAll();fetchEKS();fetchIAM()},[fetchAll,fetchEKS,fetchIAM])
  useEffect(()=>{const id=setInterval(fetchAll,10000);return()=>clearInterval(id)},[fetchAll])

  function toggleSection(type){
    if(expanded[type]){setExpanded(p=>({...p,[type]:false}));return}
    if(!revealed[type]){
      const code=window.prompt("Enter access code to unlock:")
      if(!code)return
      if(code.toUpperCase()!==ACCESS_CODE){alert("Incorrect access code");return}
      setRevealed(p=>({...p,[type]:true}))
    }
    setExpanded(p=>({...p,[type]:true}))
    if(type==="eks")fetchEKS()
    if(type==="iam")fetchIAM()
  }
  function lockSection(type,e){e.stopPropagation();setExpanded(p=>({...p,[type]:false}));setRevealed(p=>({...p,[type]:false}))}

  async function handleStart(vm){setActionId(vm.id+"-start");try{await startVM(vm.id);fetchAll()}catch(e){alert(e.message)}finally{setActionId(null)}}
  async function handleStop(vm){setActionId(vm.id+"-stop");try{await stopVM(vm.id);fetchAll()}catch(e){alert(e.message)}finally{setActionId(null)}}
  async function handleDeleteBucket(name){if(!window.confirm("Delete bucket "+name+"?"))return;try{await deleteBucket(name,true);setSuccess("Deleted "+name);fetchAll();setTimeout(()=>setSuccess(""),3000)}catch(e){alert(e.message)}}

  async function handleS3Create(){
    if(!s3Form.name.trim()){setS3Err("Name required");return}
    if(!s3Form.project.trim()){setS3Err("Project name is required");return}
    if(!s3Form.owner.trim()){setS3Err("Owner is required");return}
    setS3C(true);setS3Err("")
    try{
      await api.post("/requests",{
        resource_name:s3Form.name,resource_type:"s3",region:s3Form.region,
        payload:{name:s3Form.name,region:s3Form.region,versioning:s3Form.versioning,encryption:s3Form.encryption,
          tags:{project:s3Form.project,owner:s3Form.owner,environment:s3Form.environment,CreatedBy:"AIonOS-Platform"}}
      })
      setSuccess("S3 bucket request submitted — pending admin approval")
      setS3Modal(false)
      setS3Form({name:"",region:"ap-south-1",versioning:false,public:false,encryption:"AES256",project:"",owner:"",environment:"dev"})
      setTimeout(()=>setSuccess(""),5000)
    }
    catch(e){setS3Err(e.response?.data?.detail||e.message)}finally{setS3C(false)}
  }

  async function handleVPCCreate(){
    if(!vpcForm.name.trim()){setVPCErr("Name required");return}
    setVPCC(true);setVPCErr("")
    try{await api.post("/vpc/create",vpcForm);setSuccess("VPC "+vpcForm.name+" created");setVPCModal(false);setVPCForm({name:"",cidr:"10.0.0.0/16",region:"ap-south-1",enable_dns:true});fetchAll();setTimeout(()=>setSuccess(""),3000)}
    catch(e){setVPCErr(e.response?.data?.detail||e.message)}finally{setVPCC(false)}
  }

  async function handleIAMCreate(){
    if(!iamForm.name.trim()){setIAMErr("Name required");return}
    setIAMC(true);setIAMErr("")
    try{const {data}=await api.post("/iam/roles/create",iamForm);setSuccess(data.message);setIAMModal(false);setIAMForm({name:"",role_type:"eks-cluster",description:"Created by AIonOS Platform"});fetchIAM();setTimeout(()=>setSuccess(""),5000)}
    catch(e){setIAMErr(e.response?.data?.detail||e.message)}finally{setIAMC(false)}
  }

  async function loadPrereqs(region){setLoadPre(true);try{const {data}=await api.get(`/eks/prerequisites?region=${region}`);setPrereqs(data);if(data.iam_roles?.length>0)setEksForm(p=>({...p,role_arn:data.iam_roles[0].arn}))}catch(e){console.error(e)}finally{setLoadPre(false)}}

  async function handleEKSCreate(){
    if(!eksForm.name){setEksErr("Name required");return}
    if(!eksForm.role_arn){setEksErr("IAM Role ARN required");return}
    if(eksForm.subnet_ids.length<2){setEksErr("Select at least 2 subnets");return}
    setEksC(true);setEksErr("")
    try{const {data}=await api.post("/eks/clusters",eksForm);setSuccess(data.message);setEKSModal(false);setEksStep(0);fetchEKS();setTimeout(()=>setSuccess(""),8000)}
    catch(e){setEksErr(e.response?.data?.detail||e.message)}finally{setEksC(false)}
  }

  async function handleDeleteEKS(name,region){if(!window.confirm(`Delete cluster ${name}?`))return;try{await api.delete(`/eks/clusters/${name}?region=${region}`);setSuccess("Deletion started");fetchEKS();setTimeout(()=>setSuccess(""),5000)}catch(e){alert(e.message)}}
  async function handleDeleteRole(name){if(!window.confirm(`Delete role ${name}?`))return;try{await api.delete(`/iam/roles/${name}`);setSuccess("Role deleted");fetchIAM();setTimeout(()=>setSuccess(""),3000)}catch(e){alert(e.message)}}
  async function handleCreateKP(){const n=window.prompt("Key pair name:");if(!n)return;const r=window.prompt("Region:")||"ap-south-1";try{const {data}=await api.post(`/iam/keypairs/create?name=${n}&region=${r}`);const blob=new Blob([data.private_key],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=n+".pem";a.click();URL.revokeObjectURL(url);setSuccess(`Key pair ${n} created and downloaded`);fetchIAM();setTimeout(()=>setSuccess(""),5000)}catch(e){alert(e.message)}}
  async function handleDeleteKP(name,region){if(!window.confirm(`Delete key pair ${name}?`))return;try{await api.delete(`/iam/keypairs/${name}?region=${region||"ap-south-1"}`);setSuccess("Key pair deleted");fetchIAM();setTimeout(()=>setSuccess(""),3000)}catch(e){alert(e.message)}}

  function handleServiceClick(svc){
    if(svc.id==="ec2")setVMModal(true)
    else if(svc.id==="s3")setS3Modal(true)
    else if(svc.id==="eks"){setEKSModal(true);setEksStep(0);loadPrereqs(eksForm.region)}
    else if(svc.id==="vpc")setVPCModal(true)
    else if(svc.id==="security-group")setSGModal(true)
    else if(svc.id==="iam")setIAMModal(true)
    else alert(`${svc.name} provisioning coming soon!`)
  }

  const filteredServices = SERVICES.filter(s=>(catFilter==="All"||s.cat===catFilter)&&(!search||s.name.toLowerCase().includes(search.toLowerCase())))

  const GROUPS = [
    { type:"ec2",     label:"EC2 Instances",    color:"#FF9900", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2", count:vms.length, extra:<button onClick={e=>{e.stopPropagation();setVMModal(true)}} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"600",cursor:"pointer",border:"none",background:"#FF9900",color:"#fff"}}>+ Launch</button> },
    { type:"s3",      label:"S3 Buckets",       color:"#00d4aa", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4", count:s3.length, extra:<button onClick={e=>{e.stopPropagation();setS3Modal(true)}} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"600",cursor:"pointer",border:"none",background:"#00d4aa",color:"#0a0f1e"}}>+ Create</button> },
    { type:"eks",     label:"EKS Clusters",     color:"#06b6d4", icon:"M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z", count:eksClusters.length, extra:<button onClick={e=>{e.stopPropagation();setEKSModal(true);setEksStep(0);loadPrereqs(eksForm.region)}} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"600",cursor:"pointer",border:"none",background:"#06b6d4",color:"#fff"}}>+ Create</button> },
    { type:"vpc",     label:"VPCs",             color:"#a78bfa", icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064", count:vpcs.length, extra:<button onClick={e=>{e.stopPropagation();setVPCModal(true)}} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"600",cursor:"pointer",border:"none",background:"#a78bfa",color:"#fff"}}>+ Create</button> },
    { type:"lambda",  label:"Lambda Functions", color:"#f59e0b", icon:"M13 10V3L4 14h7v7l9-11h-7z", count:lambdas.length },
    { type:"elb",     label:"Load Balancers",   color:"#f97316", icon:"M8 9l4-4 4 4m0 6l-4 4-4-4", count:lbs.length },
    { type:"iam",     label:"IAM Roles",        color:"#84cc16", icon:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", count:iamRoles.length, extra:<button onClick={e=>{e.stopPropagation();setIAMModal(true)}} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"600",cursor:"pointer",border:"none",background:"#84cc16",color:"#fff"}}>+ Create</button> },
    { type:"keypairs",label:"Key Pairs",        color:"#14b8a6", icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", count:keypairs.length, extra:<button onClick={e=>{e.stopPropagation();handleCreateKP()}} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:"600",cursor:"pointer",border:"none",background:"#14b8a6",color:"#fff"}}>+ Create</button> },
    { type:"request", label:"Pending Requests", color:"#a78bfa", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", count:reqs.length },
  ]

  function makeRows(type){
    if(type==="ec2")return vms.map(v=>({id:v.id,label:v.name,status:v.state,region:v.region,detail:v.instance_type,
      environment:v.environment||"dev",project:v.project_tag||"",owner:v.owner_tag||v.owner_username||"",
      actions:<div style={{display:"flex",gap:"6px"}}>
        {v.state==="stopped"&&<button onClick={()=>handleStart(v)} disabled={actionId===v.id+"-start"} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #00d4aa40",background:"#00d4aa15",color:"#00d4aa"}}>{actionId===v.id+"-start"?"...":"Start"}</button>}
        {v.state==="running"&&<button onClick={()=>handleStop(v)} disabled={actionId===v.id+"-stop"} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #f59e0b40",background:"#f59e0b15",color:"#f59e0b"}}>{actionId===v.id+"-stop"?"...":"Stop"}</button>}
        <button onClick={()=>setConnVM(v)} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #00d4aa40",background:"#00d4aa15",color:"#00d4aa"}}>Connect</button>
        <button onClick={(e)=>{e.stopPropagation();setSchedVM(v)}} style={{padding:"3px 10px",borderRadius:"6px",fontSize:"11px",cursor:"pointer",border:"1px solid #3b82f640",background:"#3b82f615",color:"#3b82f6"}}>{(v.auto_start||v.auto_stop)?"Scheduled":"Schedule"}</button>
      </div>}))
    if(type==="s3")return s3.map(b=>({id:b.name,label:b.name,status:"active",region:b.region,detail:new Date(b.created).toLocaleDateString("en-IN"),
      environment:b.tags?.Environment||"",project:b.tags?.Project||"",owner:b.tags?.Owner||"",
      actions:null}))
    if(type==="eks")return eksClusters.map(c=>({id:c.name,label:c.name,status:c.status,region:c.region,detail:`K8s ${c.version} — ${c.total_nodes||0} nodes`,
      environment:"",project:"",owner:"",
      actions:null}))
    if(type==="vpc")return vpcs.map(v=>({id:v.id,label:v.name||v.id,status:v.is_default?"default":"custom",region:v.region,detail:v.cidr,environment:v.environment||"",project:v.project||"",owner:v.owner||"",actions:null}))
    if(type==="lambda")return lambdas.map(l=>({id:l.name,label:l.name,status:"active",region:l.region,detail:l.runtime+" - "+l.size_kb+" KB",environment:l.environment||"",project:l.project||"",owner:l.owner||"",actions:null}))
    if(type==="elb")return lbs.map(lb=>({id:lb.name,label:lb.name,status:lb.state,region:lb.region,detail:lb.type,environment:lb.environment||"",project:lb.project||"",owner:lb.owner||"",actions:null}))
    if(type==="iam")return iamRoles.map(r=>({id:r.name,label:r.name,status:r.type,region:"global",detail:r.arn?.slice(-40)||"",environment:"",project:"",owner:"",actions:null}))
    if(type==="keypairs")return keypairs.map(kp=>({id:kp.name,label:kp.name,status:kp.type||"rsa",region:kp.region||"ap-south-1",detail:kp.id,environment:"",project:"",owner:"",actions:null}))
    if(type==="request")return reqs.map(r=>({id:r.id,label:r.resource_name,status:r.status,region:"--",detail:r.resource_type+" by "+r.username,environment:"",project:"",owner:"",actions:null}))
    return []
  }

  const EKS_STEPS=["Cluster","Network","Nodes","Review"]
  const curGroup = EKS_INSTANCE_GROUPS.find(g=>g.group===instGroup)

  return (
    <div style={{padding:"28px",background:bg,minHeight:"100vh",transition:"all 0.3s"}}>
      <div style={{marginBottom:"24px"}}>
        <h1 style={{fontSize:"24px",fontWeight:"700",color:text,margin:0}}>Resources</h1>
        <p style={{fontSize:"13px",color:muted,marginTop:"4px"}}>{vms.length} EC2 — {s3.length} S3 — {eksClusters.length} EKS — {vpcs.length} VPC — {lambdas.length} Lambda — {lbs.length} LB — {iamRoles.length} IAM — {keypairs.length} Keys</p>
      </div>

      {success&&<div style={{background:"#00d4aa15",border:"1px solid #00d4aa30",color:"#00d4aa",padding:"12px 16px",borderRadius:"10px",marginBottom:"16px",fontSize:"13px"}}>{success}</div>}

      {/* AWS Service Catalog */}
      <div style={{background:surface,border:"1px solid "+border,borderRadius:"16px",padding:"20px",marginBottom:"20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"10px"}}>
          <div style={{fontSize:"15px",fontWeight:"600",color:text}}>AWS Service Catalog</div>
          <input type="text" placeholder="Search services..." value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,width:"200px"}} />
        </div>
        <div style={{display:"flex",gap:"6px",marginBottom:"14px",flexWrap:"wrap"}}>
          {CATS.map(c=>(
            <button key={c} onClick={()=>setCat(c)} style={{padding:"4px 12px",borderRadius:"20px",fontSize:"11px",fontWeight:"500",cursor:"pointer",border:"1px solid "+(catFilter===c?"#00d4aa40":border),background:catFilter===c?"#00d4aa15":surface,color:catFilter===c?"#00d4aa":muted,transition:"all 0.15s"}}>{c}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:"10px"}}>
          {filteredServices.map((svc,i)=>(
            <div key={svc.id} onClick={()=>handleServiceClick(svc)}
              style={{border:"1px solid "+border,borderRadius:"12px",padding:"14px",cursor:"pointer",transition:"all 0.2s",position:"relative",animation:`fadeUp 0.4s ease ${i*20}ms both`}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=svc.color+"60";e.currentTarget.style.background=svc.color+"08";e.currentTarget.style.transform="translateY(-2px)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=border;e.currentTarget.style.background="transparent";e.currentTarget.style.transform="translateY(0)"}}>
              {svc.ready&&<div style={{position:"absolute",top:"8px",right:"8px",fontSize:"9px",fontWeight:"700",background:svc.color+"20",color:svc.color,padding:"1px 6px",borderRadius:"4px"}}>READY</div>}
              <div style={{width:"32px",height:"32px",borderRadius:"8px",background:svc.color+"20",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"8px"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={svc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={svc.icon}/></svg>
              </div>
              <div style={{fontSize:"12px",fontWeight:"600",color:text,marginBottom:"2px"}}>{svc.name}</div>
              <div style={{fontSize:"10px",color:muted,marginBottom:"4px"}}>{svc.desc}</div>
              <div style={{fontSize:"9px",fontWeight:"600",color:svc.color}}>{svc.cat}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Locked Resource Sections */}
      <div style={{fontSize:"13px",fontWeight:"600",color:muted,marginBottom:"10px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Your Resources</div>
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {GROUPS.map(group=>{
          const rows=makeRows(group.type)
          const isExp=expanded[group.type]
          const isRev=revealed[group.type]
          return (
            <div key={group.type} style={{background:surface,border:"1px solid "+(isExp?group.color+"50":border),borderRadius:"14px",overflow:"hidden",transition:"all 0.3s"}}>
              <div onClick={()=>toggleSection(group.type)} style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",background:isExp?(dark?group.color+"10":group.color+"06"):"transparent",transition:"background 0.2s"}}>
                <div style={{width:"32px",height:"32px",borderRadius:"9px",background:group.color+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={group.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={group.icon}/></svg>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                    <span style={{fontSize:"13px",fontWeight:"600",color:text}}>{group.label}</span>
                    <span style={{background:group.color+"20",color:group.color,padding:"1px 8px",borderRadius:"10px",fontSize:"11px",fontWeight:"600"}}>{rows.length}</span>
                    {!isRev&&<span style={{background:"#f59e0b15",color:"#f59e0b",padding:"1px 8px",borderRadius:"10px",fontSize:"10px",fontWeight:"600"}}><LockIcon/>LOCKED</span>}
                    {isExp&&isRev&&group.extra&&<span onClick={e=>e.stopPropagation()}>{group.extra}</span>}
                  </div>
                  <div style={{fontSize:"10px",color:muted,marginTop:"1px"}}>{isRev?(isExp?"Click to collapse":"Click to expand"):"Click to unlock — code: AIONOS"}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  {isRev&&<button onClick={e=>lockSection(group.type,e)} style={{padding:"3px 8px",borderRadius:"6px",fontSize:"10px",fontWeight:"600",cursor:"pointer",border:"1px solid #f59e0b40",background:"#f59e0b15",color:"#f59e0b"}}>Lock</button>}
                  <span style={{fontSize:"16px",color:muted,display:"inline-block",transition:"transform 0.25s",transform:isExp?"rotate(90deg)":"rotate(0deg)"}}>&#x203A;</span>
                </div>
              </div>
              {isExp&&isRev&&(
                <div style={{borderTop:"1px solid "+border}}>
                  {rows.length===0 ? (
                    <div style={{padding:"24px",textAlign:"center",color:muted,fontSize:"13px"}}>No {group.label.toLowerCase()} found</div>
                  ) : group.type === "eks" ? (
                    /* ── EKS card view — matches EKS.jsx style ── */
                    <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:"12px"}}>
                      {eksClusters.map((c,i)=>{
                        const sc = STATUS_COLORS[c.status] || "#64748b"
                        return (
                          <div key={i} style={{background:subtle,border:"1px solid "+(c.status==="ACTIVE"?"#00d4aa30":border),borderRadius:"12px",padding:"16px 18px",transition:"all 0.2s",animation:`fadeUp 0.4s ease ${i*60}ms both`}}>
                            {/* Cluster header */}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px"}}>
                              <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
                                <div style={{width:"40px",height:"40px",borderRadius:"10px",background:"#06b6d420",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0}}>⚙️</div>
                                <div>
                                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px",flexWrap:"wrap"}}>
                                    <span style={{fontSize:"14px",fontWeight:"700",color:text}}>{c.name}</span>
                                    <span style={{background:sc+"20",color:sc,padding:"2px 9px",borderRadius:"10px",fontSize:"11px",fontWeight:"600"}}>{c.status}</span>
                                    <span style={{background:"#3b82f620",color:"#3b82f6",padding:"2px 9px",borderRadius:"10px",fontSize:"11px",fontWeight:"600"}}>K8s {c.version}</span>
                                    <span style={{background:"#a78bfa20",color:"#a78bfa",padding:"2px 9px",borderRadius:"10px",fontSize:"11px"}}>{c.total_nodes||0} nodes</span>
                                    {c.status==="CREATING"&&<span style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"#3b82f6"}}><span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#3b82f6",display:"inline-block",animation:"pulse 1.5s infinite"}}/> Provisioning…</span>}
                                  </div>
                                  <div style={{fontSize:"12px",color:muted,display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
                                    <span>📍 {c.region}</span>
                                    {c.endpoint && <span style={{fontFamily:"monospace",fontSize:"10px"}}>🔗 {c.endpoint.slice(0,48)}…</span>}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Node groups */}
                            {c.node_groups && c.node_groups.length > 0 ? (
                              <div style={{borderTop:"1px solid "+border,paddingTop:"10px"}}>
                                <div style={{fontSize:"10px",fontWeight:"700",color:muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px"}}>
                                  Node Groups ({c.node_groups.length})
                                </div>
                                <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                                  {c.node_groups.map((ng,ni)=>{
                                    const ngc = STATUS_COLORS[ng.status]||"#64748b"
                                    return (
                                      <div key={ni} style={{background:dark?"rgba(255,255,255,0.03)":"#ffffff",border:"1px solid "+border,borderRadius:"8px",padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px"}}>
                                        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                                          <span style={{fontSize:"14px"}}>🖥</span>
                                          <div>
                                            <div style={{fontSize:"12px",fontWeight:"600",color:text}}>{ng.name}</div>
                                            <div style={{fontSize:"10px",color:muted}}>{ng.instance_type} · {ng.capacity_type||"ON_DEMAND"}</div>
                                          </div>
                                        </div>
                                        <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                                          <span style={{background:ngc+"20",color:ngc,padding:"2px 8px",borderRadius:"8px",fontSize:"10px",fontWeight:"600"}}>{ng.status}</span>
                                          <div style={{fontSize:"11px",color:muted}}>
                                            Desired <strong style={{color:text}}>{ng.desired}</strong>
                                            <span style={{margin:"0 4px"}}>·</span>
                                            Min <strong style={{color:text}}>{ng.min}</strong>
                                            <span style={{margin:"0 4px"}}>·</span>
                                            Max <strong style={{color:text}}>{ng.max}</strong>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : c.status === "ACTIVE" ? (
                              <div style={{borderTop:"1px solid "+border,paddingTop:"8px",fontSize:"11px",color:muted}}>
                                No node groups found — may still be provisioning. Auto-refreshes every 10s.
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{background:subtle}}>{["Name","Status","Environment","Project","Owner","Region","Details","Actions"].map(h=><th key={h} style={{padding:"8px 16px",textAlign:"left",fontSize:"10px",fontWeight:"600",color:muted,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{rows.map((row,i)=>{
                        const sc=STATUS_COLORS[row.status]||"#64748b"
                        const envColor={prod:"#f43f5e",staging:"#f59e0b",dev:"#00d4aa"}[row.environment]||"#64748b"
                        return(
                        <tr key={i} style={{borderTop:"1px solid "+border}} onMouseEnter={e=>e.currentTarget.style.background=dark?"#ffffff04":"#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"11px 16px",fontSize:"12px",fontWeight:"600",color:text,maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.label}</td>
                          <td style={{padding:"11px 16px"}}><span style={{background:sc+"15",color:sc,padding:"2px 8px",borderRadius:"20px",fontSize:"10px",fontWeight:"600"}}>{row.status}</span></td>
                          <td style={{padding:"11px 16px"}}>{row.environment?<span style={{background:envColor+"18",color:envColor,border:"1px solid "+envColor+"40",padding:"1px 8px",borderRadius:"6px",fontSize:"10px",fontWeight:"700",textTransform:"uppercase"}}>{row.environment}</span>:<span style={{color:muted,fontSize:"11px"}}>—</span>}</td>
                          <td style={{padding:"11px 16px",fontSize:"11px",color:row.project?text:muted,maxWidth:"120px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.project||"—"}</td>
                          <td style={{padding:"11px 16px",fontSize:"11px",color:row.owner?text:muted,maxWidth:"120px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.owner||"—"}</td>
                          <td style={{padding:"11px 16px",fontSize:"11px",color:muted,whiteSpace:"nowrap"}}>{row.region}</td>
                          <td style={{padding:"11px 16px",fontSize:"11px",color:muted,maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.detail}</td>
                          <td style={{padding:"11px 16px"}}>{row.actions}</td>
                        </tr>
                      )})}</tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {showSGModal&&<SGModal onClose={()=>setSGModal(false)} onSuccess={()=>{setSGModal(false);setSuccess("Security group created");fetchAll()}} />}
      {connVM&&<EC2ConnectionInfo vm={connVM} onClose={()=>setConnVM(null)} />}
      {showVMModal&&<CreateVMModal onClose={()=>setVMModal(false)} onSuccess={()=>{setVMModal(false);setSuccess("EC2 request submitted");fetchAll()}} />}
      {schedVM&&<ScheduleModal vm={schedVM} onClose={()=>setSchedVM(null)} onSaved={()=>{setSchedVM(null);fetchAll()}} />}

      {/* S3 Modal */}
      {showS3Modal&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"20px"}}>
          <div style={{background:surface,borderRadius:"14px",border:"1px solid "+border,width:"100%",maxWidth:"480px",maxHeight:"92vh",overflow:"auto"}}>
            <div style={{padding:"18px 24px",borderBottom:"1px solid "+border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:"15px",fontWeight:"600",color:text}}>Create S3 Bucket</div><div style={{fontSize:"12px",color:muted,marginTop:"2px"}}>Request will go for admin approval</div></div>
              <button onClick={()=>setS3Modal(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",color:muted}}>x</button>
            </div>
            <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:"12px"}}>
              {s3Err&&<div style={{background:"#f43f5e15",color:"#f43f5e",padding:"10px",borderRadius:"8px",fontSize:"13px"}}>{s3Err}</div>}
              <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>Bucket name *</label><input style={inp} placeholder="my-bucket" value={s3Form.name} onChange={e=>setS3Form(p=>({...p,name:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")}))} /></div>
              <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>Region</label><select style={inp} value={s3Form.region} onChange={e=>setS3Form(p=>({...p,region:e.target.value}))}>{S3_REGIONS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
              <div style={{display:"flex",gap:"8px"}}>{[{v:"AES256",l:"SSE-S3"},{v:"aws:kms",l:"SSE-KMS"},{v:"none",l:"None"}].map(opt=><div key={opt.v} onClick={()=>setS3Form(p=>({...p,encryption:opt.v}))} style={{flex:1,padding:"8px",borderRadius:"8px",cursor:"pointer",border:"1px solid "+(s3Form.encryption===opt.v?"#00d4aa40":border),background:s3Form.encryption===opt.v?"#00d4aa10":surface,textAlign:"center"}}><div style={{fontSize:"12px",fontWeight:"600",color:s3Form.encryption===opt.v?"#00d4aa":text}}>{opt.l}</div></div>)}</div>
              <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"12px",color:text}}><input type="checkbox" checked={s3Form.versioning} onChange={e=>setS3Form(p=>({...p,versioning:e.target.checked}))} />Enable Versioning</label>
              {/* ── Tags ── */}
              <div style={{borderTop:"1px solid "+border,paddingTop:"12px"}}>
                <div style={{fontSize:"12px",fontWeight:"600",color:text,marginBottom:"10px"}}>Tags (required)</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"10px"}}>
                  <div><label style={{display:"block",fontSize:"11px",color:muted,marginBottom:"4px"}}>Project Name *</label><input style={inp} placeholder="AIonOS-Platform" value={s3Form.project} onChange={e=>setS3Form(p=>({...p,project:e.target.value}))} /></div>
                  <div><label style={{display:"block",fontSize:"11px",color:muted,marginBottom:"4px"}}>Owner *</label><input style={inp} placeholder="akram-khan" value={s3Form.owner} onChange={e=>setS3Form(p=>({...p,owner:e.target.value}))} /></div>
                </div>
                <div><label style={{display:"block",fontSize:"11px",color:muted,marginBottom:"6px"}}>Environment *</label>
                  <div style={{display:"flex",gap:"8px"}}>
                    {["dev","staging","prod"].map(env=>(
                      <button key={env} type="button" onClick={()=>setS3Form(p=>({...p,environment:env}))}
                        style={{flex:1,padding:"7px",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:"600",
                          border:"1px solid "+(s3Form.environment===env?"#00d4aa40":border),
                          background:s3Form.environment===env?"#00d4aa15":surface,
                          color:s3Form.environment===env?"#00d4aa":muted}}>
                        {env}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{padding:"14px 24px",borderTop:"1px solid "+border,display:"flex",justifyContent:"flex-end",gap:"10px"}}>
              <button onClick={()=>setS3Modal(false)} style={{padding:"8px 16px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",border:"1px solid "+border,background:"transparent",color:text}}>Cancel</button>
              <button onClick={handleS3Create} disabled={s3Creating} style={{padding:"8px 16px",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer",border:"none",background:"#00d4aa",color:"#0a0f1e",opacity:s3Creating?0.7:1}}>{s3Creating?"Submitting...":"Submit Request"}</button>
            </div>
          </div>
        </div>
      )}

      {/* VPC Modal */}
      {showVPCModal&&<VPCModal onClose={()=>setVPCModal(false)} onSuccess={()=>{setVPCModal(false);setSuccess("VPC created");fetchAll()}} />}

      {/* IAM Modal */}
      {showIAMModal&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"20px"}}>
          <div style={{background:surface,borderRadius:"14px",border:"1px solid "+border,width:"100%",maxWidth:"480px"}}>
            <div style={{padding:"18px 24px",borderBottom:"1px solid "+border,display:"flex",justifyContent:"space-between"}}><div style={{fontSize:"15px",fontWeight:"600",color:text}}>Create IAM Role</div><button onClick={()=>setIAMModal(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",color:muted}}>x</button></div>
            <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:"12px"}}>
              {iamErr&&<div style={{background:"#f43f5e15",color:"#f43f5e",padding:"10px",borderRadius:"8px",fontSize:"13px"}}>{iamErr}</div>}
              <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>Role name</label><input style={inp} placeholder="eks-cluster-role" value={iamForm.name} onChange={e=>setIAMForm(p=>({...p,name:e.target.value}))} /></div>
              <div>
                <label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"8px"}}>Role type</label>
                {[{id:"eks-cluster",label:"EKS Cluster Role",color:"#00d4aa",desc:"AmazonEKSClusterPolicy + AmazonEKSVPCResourceController"},
                  {id:"eks-node",label:"EKS Node Role",color:"#FF9900",desc:"EKSWorkerNodePolicy + EKS_CNI_Policy + ECRReadOnly"},
                  {id:"ec2",label:"EC2 Instance Role",color:"#3b82f6",desc:"AmazonSSMManagedInstanceCore"},
                ].map(rt=>(
                  <div key={rt.id} onClick={()=>setIAMForm(p=>({...p,role_type:rt.id}))}
                    style={{padding:"10px 14px",borderRadius:"8px",cursor:"pointer",border:"1px solid "+(iamForm.role_type===rt.id?rt.color+"40":border),background:iamForm.role_type===rt.id?rt.color+"10":"transparent",marginBottom:"6px"}}>
                    <div style={{fontSize:"13px",fontWeight:"600",color:iamForm.role_type===rt.id?rt.color:text}}>{rt.label}</div>
                    <div style={{fontSize:"11px",color:muted,marginTop:"2px"}}>{rt.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:"14px 24px",borderTop:"1px solid "+border,display:"flex",justifyContent:"flex-end",gap:"10px"}}>
              <button onClick={()=>setIAMModal(false)} style={{padding:"8px 16px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",border:"1px solid "+border,background:"transparent",color:text}}>Cancel</button>
              <button onClick={handleIAMCreate} disabled={iamCreating} style={{padding:"8px 16px",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer",border:"none",background:"#84cc16",color:"#fff",opacity:iamCreating?0.7:1}}>{iamCreating?"Creating...":"Create Role"}</button>
            </div>
          </div>
        </div>
      )}

      {/* EKS Modal */}
      {showEKSModal&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"16px"}}>
          <div style={{background:surface,borderRadius:"18px",border:"1px solid "+border,width:"100%",maxWidth:"680px",maxHeight:"92vh",overflow:"auto"}}>
            <div style={{padding:"20px 24px",borderBottom:"1px solid "+border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:"17px",fontWeight:"700",color:text}}>Create EKS Cluster</div><div style={{fontSize:"12px",color:muted,marginTop:"2px"}}>Managed Kubernetes on AWS</div></div>
              <button onClick={()=>setEKSModal(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"22px",color:muted}}>x</button>
            </div>
            <div style={{padding:"14px 24px",borderBottom:"1px solid "+border,display:"flex",gap:"0"}}>
              {EKS_STEPS.map((s,i)=>(
                <div key={s} style={{display:"flex",alignItems:"center",flex:i<EKS_STEPS.length-1?1:"auto"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <div style={{width:"24px",height:"24px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"700",background:i<eksStep?"#06b6d4":i===eksStep?"#06b6d420":subtle,color:i<eksStep?"#fff":i===eksStep?"#06b6d4":muted,border:i===eksStep?"2px solid #06b6d4":"2px solid "+(i<eksStep?"#06b6d4":border)}}>{i<eksStep?"✓":i+1}</div>
                    <span style={{fontSize:"12px",fontWeight:i===eksStep?"600":"400",color:i===eksStep?text:muted}}>{s}</span>
                  </div>
                  {i<EKS_STEPS.length-1&&<div style={{flex:1,height:"2px",background:i<eksStep?"#06b6d4":border,margin:"0 8px"}}/>}
                </div>
              ))}
            </div>
            {eksErr&&<div style={{margin:"12px 24px 0",background:"#f43f5e15",color:"#f43f5e",padding:"10px",borderRadius:"8px",fontSize:"13px"}}>{eksErr}</div>}
            <div style={{padding:"20px 24px"}}>
              {eksStep===0&&(
                <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
                    <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>Cluster name *</label><input style={inp} placeholder="my-cluster" value={eksForm.name} onChange={e=>setEksForm(p=>({...p,name:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")}))} /></div>
                    <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>Region</label><select style={inp} value={eksForm.region} onChange={e=>{setEksForm(p=>({...p,region:e.target.value,subnet_ids:[],security_group_ids:[]}));loadPrereqs(e.target.value)}}>{ALL_REGIONS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                  </div>
                  <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"8px"}}>Kubernetes version</label>
                    <div style={{display:"flex",gap:"8px"}}>{K8S_VERSIONS.map(v=><button key={v} onClick={()=>setEksForm(p=>({...p,kubernetes_version:v}))} style={{flex:1,padding:"10px",borderRadius:"8px",cursor:"pointer",border:"1px solid "+(eksForm.kubernetes_version===v?"#06b6d440":border),background:eksForm.kubernetes_version===v?"#06b6d415":surface,color:eksForm.kubernetes_version===v?"#06b6d4":text,fontWeight:"600",fontSize:"13px"}}>{v}{v==="1.29"?" ★":""}</button>)}</div>
                  </div>
                  <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>IAM Cluster Role ARN *</label>
                    {loadingPre?<div style={{color:muted,fontSize:"12px",padding:"8px"}}>Loading roles...</div>:prereqs?.iam_roles?.length>0?
                      <select style={inp} value={eksForm.role_arn} onChange={e=>setEksForm(p=>({...p,role_arn:e.target.value}))}><option value="">Select role...</option>{prereqs.iam_roles.map(r=><option key={r.arn} value={r.arn}>{r.name}</option>)}</select>:
                      <><input style={inp} placeholder="arn:aws:iam::471112761145:role/eks-role" value={eksForm.role_arn} onChange={e=>setEksForm(p=>({...p,role_arn:e.target.value}))} /><div style={{fontSize:"11px",color:"#f59e0b",marginTop:"4px"}}>No EKS roles found. Use IAM section to create one first.</div></>}
                  </div>
                </div>
              )}
              {eksStep===1&&(
                <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                  {prereqs?<>
                    <div style={{background:prereqs.ready?"#00d4aa10":"#f59e0b10",border:"1px solid "+(prereqs.ready?"#00d4aa30":"#f59e0b30"),borderRadius:"8px",padding:"10px 14px",fontSize:"12px"}}>
                      {prereqs.ready?<span style={{color:"#00d4aa"}}>✓ Prerequisites ready — {prereqs.subnets?.length} subnets available</span>:<span style={{color:"#f59e0b"}}>⚠ Need at least 2 subnets in different AZs</span>}
                    </div>
                    <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"8px"}}>Subnets * (select 2+ in different AZs)</label>
                      <div style={{border:"1px solid "+border,borderRadius:"8px",padding:"8px",maxHeight:"180px",overflowY:"auto"}}>
                        {prereqs.subnets?.map(s=><label key={s.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"6px 8px",borderRadius:"6px",cursor:"pointer",background:eksForm.subnet_ids.includes(s.id)?"#06b6d410":"transparent"}}>
                          <input type="checkbox" checked={eksForm.subnet_ids.includes(s.id)} onChange={()=>setEksForm(p=>({...p,subnet_ids:p.subnet_ids.includes(s.id)?p.subnet_ids.filter(x=>x!==s.id):[...p.subnet_ids,s.id]}))} />
                          <span style={{fontSize:"12px",color:text,flex:1}}>{s.name||s.id}</span>
                          <span style={{fontSize:"10px",color:muted}}>{s.az} — {s.cidr}</span>
                        </label>)}
                      </div>
                      <div style={{fontSize:"11px",color:muted,marginTop:"4px"}}>{eksForm.subnet_ids.length} selected</div>
                    </div>
                  </>:<div style={{padding:"32px",textAlign:"center",color:muted}}>Loading network info...</div>}
                </div>
              )}
              {eksStep===2&&(
                <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                  <div><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"8px"}}>Instance category</label>
                    <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}>
                      {EKS_INSTANCE_GROUPS.map(g=><button key={g.group} onClick={()=>setInstGroup(g.group)} style={{padding:"5px 12px",borderRadius:"20px",fontSize:"11px",fontWeight:"500",cursor:"pointer",border:"1px solid "+(instGroup===g.group?g.color+"60":border),background:instGroup===g.group?g.color+"15":surface,color:instGroup===g.group?g.color:muted}}>{g.group}</button>)}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px"}}>
                      {curGroup?.types.map(t=><div key={t.t} onClick={()=>setEksForm(p=>({...p,node_instance_type:t.t}))} style={{padding:"8px 10px",borderRadius:"8px",cursor:"pointer",border:"1px solid "+(eksForm.node_instance_type===t.t?curGroup.color+"60":border),background:eksForm.node_instance_type===t.t?curGroup.color+"15":surface}}>
                        <div style={{fontSize:"11px",fontWeight:"700",color:eksForm.node_instance_type===t.t?curGroup.color:text}}>{t.t}</div>
                        <div style={{fontSize:"10px",color:muted}}>{t.c}CPU/{t.r}</div>
                        <div style={{fontSize:"10px",color:"#f59e0b"}}>{t.p}</div>
                      </div>)}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px"}}>
                    {[["node_count","Desired","2"],["min_nodes","Min","1"],["max_nodes","Max","5"]].map(([key,label,ph])=><div key={key}><label style={{display:"block",fontSize:"12px",color:muted,marginBottom:"5px"}}>{label} nodes</label><input type="number" style={inp} min={1} max={50} value={eksForm[key]} onChange={e=>setEksForm(p=>({...p,[key]:parseInt(e.target.value)||1}))} /></div>)}
                  </div>
                  <div style={{background:"#3b82f610",border:"1px solid #3b82f630",borderRadius:"8px",padding:"10px 14px",fontSize:"12px"}}>
                    <span style={{color:"#3b82f6",fontWeight:"600"}}>Est. cost: </span>~${(eksForm.node_count*0.12).toFixed(2)}/hr for {eksForm.node_count} × {eksForm.node_instance_type} + $0.10/hr EKS control plane
                  </div>
                </div>
              )}
              {eksStep===3&&(
                <div style={{background:subtle,borderRadius:"12px",padding:"18px",border:"1px solid "+border}}>
                  <div style={{fontSize:"14px",fontWeight:"600",color:text,marginBottom:"14px"}}>Cluster Configuration</div>
                  {[["Name",eksForm.name],["Region",eksForm.region],["K8s Version",eksForm.kubernetes_version],["IAM Role",eksForm.role_arn?.split("/").pop()||"--"],["Subnets",eksForm.subnet_ids.length+" selected"],["Node Type",eksForm.node_instance_type],["Nodes",`${eksForm.node_count} (min:${eksForm.min_nodes} max:${eksForm.max_nodes})`]].map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+border}}>
                      <span style={{fontSize:"12px",color:muted}}>{k}</span>
                      <span style={{fontSize:"12px",fontWeight:"600",color:text}}>{v}</span>
                    </div>
                  ))}
                  <div style={{background:"#f59e0b10",border:"1px solid #f59e0b30",borderRadius:"8px",padding:"10px",marginTop:"12px",fontSize:"12px",color:"#f59e0b"}}>EKS cluster creation takes 10-15 minutes.</div>
                </div>
              )}
            </div>
            <div style={{padding:"16px 24px",borderTop:"1px solid "+border,display:"flex",justifyContent:"space-between"}}>
              <button onClick={eksStep===0?()=>setEKSModal(false):()=>setEksStep(s=>s-1)} style={{padding:"9px 18px",borderRadius:"8px",fontSize:"13px",cursor:"pointer",border:"1px solid "+border,background:"transparent",color:text}}>{eksStep===0?"Cancel":"Back"}</button>
              <button onClick={eksStep<EKS_STEPS.length-1?()=>{setEksErr("");setEksStep(s=>s+1)}:handleEKSCreate} disabled={eksCreating} style={{padding:"9px 22px",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer",border:"none",background:"#06b6d4",color:"#fff",opacity:eksCreating?0.7:1}}>{eksCreating?"Creating...":(eksStep<EKS_STEPS.length-1?"Next →":"Create Cluster")}</button>
            </div>
          </div>
        </div>
      )}
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}"}</style>
    </div>
  )
}
