import { useState, useRef, useEffect, useCallback } from "react"
import { NavLink, useNavigate, useLocation } from "react-router-dom"
import NotificationBell from "./NotificationBell"
import { useTheme } from "../context/ThemeContext"
import { listRequests, searchResources } from "../api/api"

// ── Search index ──────────────────────────────────────────────────────────
const SEARCH_INDEX = [
  { cloud:"platform", label:"Cloud Overview",    path:"/overview",            cat:"Platform",   icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { cloud:"platform", label:"Approvals",         path:"/approvals",           cat:"Platform",   icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { cloud:"platform", label:"Activity Log",      path:"/activity",            cat:"Platform",   icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { cloud:"platform", label:"TF State & Logs",   path:"/tfstate",             cat:"Platform",   icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { cloud:"aws",   label:"AWS Dashboard",        path:"/",                    cat:"AWS",        icon:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { cloud:"aws",   label:"EC2 Instances",        path:"/compute",             cat:"AWS Compute",   icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
  { cloud:"aws",   label:"EKS Clusters",         path:"/eks",                 cat:"AWS Compute",   icon:"M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
  { cloud:"aws",   label:"S3 Buckets",           path:"/storage",             cat:"AWS Storage",   icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
  { cloud:"aws",   label:"VPC Network",          path:"/network",             cat:"AWS Network",   icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { cloud:"aws",   label:"IAM & Keys",           path:"/iam",                 cat:"AWS Security",  icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" },
  { cloud:"aws",   label:"Cost Explorer",        path:"/cost",                cat:"AWS Ops",       icon:"M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { cloud:"azure", label:"Azure VMs",            path:"/azure/compute",       cat:"Azure Compute", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
  { cloud:"azure", label:"Blob Storage",         path:"/azure/storage",       cat:"Azure Storage", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" },
  { cloud:"azure", label:"VNet & Subnets",       path:"/azure/network",       cat:"Azure Network", icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945" },
  { cloud:"gcp",   label:"GCP Compute Engine",   path:"/gcp/compute",         cat:"GCP Compute",   icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
  { cloud:"gcp",   label:"GCP Cloud Storage",    path:"/gcp/storage",         cat:"GCP Storage",   icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" },
  { cloud:"gcp",   label:"GCP VPC Networks",     path:"/gcp/network",         cat:"GCP Network",   icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945" },
  { cloud:"azure", label:"Azure All Services",   path:"/azure/services",      cat:"Azure",          icon:"M4 6h16M4 10h16M4 14h16M4 18h16" },
  { cloud:"gcp",   label:"GCP All Services",     path:"/gcp/services",        cat:"GCP",            icon:"M4 6h16M4 10h16M4 14h16M4 18h16" },
  { cloud:"gcp",   label:"GCP Projects & Billing", path:"/gcp/projects",       cat:"GCP Org",        icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { cloud:"platform", label:"Kubernetes Hub",   path:"/kubernetes",          cat:"Platform",   icon:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { cloud:"platform", label:"Monitoring",       path:"/monitoring",          cat:"Platform",   icon:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { cloud:"platform", label:"Org Projects",     path:"/org-projects",        cat:"Platform",   icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { cloud:"platform", label:"Blueprints",       path:"/blueprints",          cat:"Platform",   icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { cloud:"platform", label:"Settings",         path:"/settings",            cat:"Platform",   icon:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
]

// ── Cloud config ──────────────────────────────────────────────────────────
const CLOUDS = {
  aws:   { label:"Amazon Web Services", short:"AWS", color:"#FF9900", activeColor:"#00d4aa", gradient:"linear-gradient(135deg,#FF9900,#FFB347)", shadow:"rgba(255,153,0,0.35)", activeBg:"rgba(0,212,170,0.08)" },
  azure: { label:"Microsoft Azure",    short:"AZ",  color:"#0078D4", activeColor:"#50e6ff", gradient:"linear-gradient(135deg,#0078D4,#50e6ff)", shadow:"rgba(0,120,212,0.3)",  activeBg:"rgba(0,120,212,0.08)" },
  gcp:   { label:"Google Cloud",       short:"GCP", color:"#4285F4", activeColor:"#34A853", gradient:"linear-gradient(135deg,#4285F4,#34A853,#FBBC04,#EA4335)", shadow:"rgba(66,133,244,0.3)",  activeBg:"rgba(66,133,244,0.08)" },
}

// ── Navigation tree ───────────────────────────────────────────────────────
const NAV = {
  aws: [
    { cat:"OVERVIEW", links:[
      { label:"Dashboard",      path:"/",          icon:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { label:"All Services",   path:"/services",  icon:"M4 6h16M4 10h16M4 14h16M4 18h16" },
    ]},
    { cat:"COMPUTE", links:[
      { label:"EC2 Instances",  path:"/compute",   icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
      { label:"EKS Clusters",   path:"/eks",       icon:"M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
    ]},
    { cat:"STORAGE", links:[
      { label:"S3 Buckets",     path:"/storage",   icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
    ]},
    { cat:"NETWORKING", links:[
      { label:"VPC Networks",   path:"/network",   icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    ]},
    { cat:"SECURITY", links:[
      { label:"IAM & Keys",     path:"/iam",       icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" },
    ]},
    { cat:"COST & OPS", links:[
      { label:"Cost Explorer",  path:"/cost",      icon:"M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    ]},
  ],
  azure: [
    { cat:"OVERVIEW", links:[
      { label:"Azure Dashboard",   path:"/azure",             icon:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { label:"All Services",      path:"/azure/services",    icon:"M4 6h16M4 10h16M4 14h16M4 18h16" },
    ]},
    { cat:"COMPUTE", links:[
      { label:"Virtual Machines",  path:"/azure/compute",     icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
      { label:"AKS Clusters",      path:null,                 icon:"M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18", soon:true },
      { label:"App Services",      path:null,                 icon:"M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z", soon:true },
      { label:"Azure Functions",   path:null,                 icon:"M13 2L3 14h9l-1 8 10-12h-9l1-8z", soon:true },
    ]},
    { cat:"STORAGE", links:[
      { label:"Blob Storage",      path:"/azure/storage",     icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
      { label:"Azure SQL Database",path:null,                 icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7", soon:true },
      { label:"Cosmos DB",         path:null,                 icon:"M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z", soon:true },
    ]},
    { cat:"NETWORKING", links:[
      { label:"VNet & Subnets",    path:"/azure/network",     icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label:"Azure Load Balancer",path:null,                icon:"M9 17H7A5 5 0 013 12v0a5 5 0 014-4.9M15 17h2a5 5 0 005-5v0a5 5 0 00-4-4.9", soon:true },
    ]},
    { cat:"SECURITY", links:[
      { label:"Azure Active Dir",  path:null,                 icon:"M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", soon:true },
      { label:"Key Vault",         path:null,                 icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", soon:true },
    ]},
    { cat:"COST & OPS", links:[
      { label:"Cost by RG",        path:"/azure/cost",        icon:"M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label:"Azure Monitor",     path:null,                 icon:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", soon:true },
    ]},
  ],
  gcp: [
    { cat:"OVERVIEW", links:[
      { label:"GCP Dashboard",     path:"/gcp",              icon:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { label:"All Services",      path:"/gcp/services",     icon:"M4 6h16M4 10h16M4 14h16M4 18h16" },
    ]},
    { cat:"COMPUTE", links:[
      { label:"Compute Engine",    path:"/gcp/compute",      icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
      { label:"Launch Instance",   path:"/gcp/compute/create",icon:"M12 4v16m8-8H4" },
      { label:"GKE Clusters",      path:"/gcp/kubernetes",   icon:"M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
      { label:"Create GKE Cluster",path:"/gcp/kubernetes/create", icon:"M12 4v16m8-8H4" },
      { label:"Cloud Run",         path:null,                icon:"M13 2L3 14h9l-1 8 10-12h-9l1-8z", soon:true },
    ]},
    { cat:"STORAGE", links:[
      { label:"Cloud Storage",     path:"/gcp/storage",      icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
      { label:"Create Bucket",     path:"/gcp/storage/create",icon:"M12 4v16m8-8H4" },
      { label:"BigQuery",          path:null,                icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7", soon:true },
      { label:"Cloud SQL",         path:null,                icon:"M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z", soon:true },
    ]},
    { cat:"NETWORKING", links:[
      { label:"VPC Networks",      path:"/gcp/network",      icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { label:"Cloud DNS",         path:null,                icon:"M21 12a9 9 0 11-18 0 9 9 0 0118 0z", soon:true },
    ]},
    { cat:"SERVERLESS", links:[
      { label:"Cloud Functions",   path:null,                icon:"M13 2L3 14h9l-1 8 10-12h-9l1-8z", soon:true },
      { label:"Pub/Sub",           path:null,                icon:"M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", soon:true },
    ]},
    { cat:"ORGANIZATION", links:[
      { label:"Projects & Billing", path:"/gcp/projects",     icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    ]},
  ],
}

const PLATFORM_NAV = [
  { label:"Cloud Overview",   path:"/overview",  badge:null,
    icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    color:"#00d4aa" },
  { label:"Approvals",        path:"/approvals", badge:"pending",
    icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    color:"#f59e0b" },
  { label:"Activity Log",     path:"/activity",  badge:null,
    icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    color:"#a78bfa" },
  { label:"TF State & Logs",  path:"/tfstate",   badge:null,
    icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
    color:"#3b82f6" },
  { label:"Kubernetes Hub",   path:"/kubernetes", badge:null,
    icon:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    color:"#a78bfa" },
  { label:"Monitoring",      path:"/monitoring", badge:null,
    icon:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    color:"#f59e0b" },
  { label:"Org Projects",   path:"/org-projects", badge:null,
    icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    color:"#34A853", adminOnly: false },
  { label:"Blueprints",     path:"/blueprints", badge:null,
    icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    color:"#f59e0b", adminOnly: false },
  { label:"Settings",       path:"/settings", badge:null,
    icon:"M12 2a10 10 0 00-6.36 17.72M12 2a10 10 0 016.36 17.72M12 2v4M12 22v-4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M22 12h-4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
    color:"#a78bfa", adminOnly: true },
]

const PLATFORM_PATHS = ["/overview", "/approvals", "/activity", "/tfstate", "/kubernetes", "/monitoring", "/org-projects", "/blueprints", "/settings"]

function detectCloud(path) {
  if (PLATFORM_PATHS.includes(path)) return "platform"
  if (path.startsWith("/azure")) return "azure"
  if (path.startsWith("/gcp"))   return "gcp"
  return "aws"
}

function SvgIcon({ d, size=12, stroke="currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function CloudBadge({ cloud, size=28 }) {
  const c = CLOUDS[cloud]
  return (
    <div style={{
      width:size, height:size, borderRadius:8, flexShrink:0,
      background:c.gradient, display:"flex", alignItems:"center", justifyContent:"center",
      boxShadow:`0 2px 10px ${c.shadow}`,
      fontSize: cloud==="gcp"?8:10, fontWeight:800, color:"#fff", letterSpacing:"-0.3px",
    }}>{c.short}</div>
  )
}

export default function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { dark, toggle } = useTheme()
  const user = JSON.parse(localStorage.getItem("user") || "{}")
  const searchRef = useRef(null)

  const [openCloud,      setOpenCloud]      = useState(() => detectCloud(location.pathname))
  const [searchQ,        setSearchQ]        = useState("")
  const [resourceResults, setResourceResults] = useState([])
  const [searchLoading,  setSearchLoading]  = useState(false)
  const [pendingCount,   setPendingCount]   = useState(0)
  const debounceRef = useRef(null)

  useEffect(() => {
    listRequests().then(r => {
      const items = r.data || []
      setPendingCount(items.filter(x => x.status === "pending").length)
    }).catch(() => {})
  }, [location.pathname])


  useEffect(() => {
    const cloud = detectCloud(location.pathname)
    if (cloud !== "platform") setOpenCloud(cloud)
  }, [location.pathname])

  const searchResults = searchQ.trim().length > 0
    ? SEARCH_INDEX.filter(s => s.label.toLowerCase().includes(searchQ.toLowerCase()))
    : []

  // Debounced backend resource search
  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 2) { setResourceResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchLoading(true)
      searchResources(q)
        .then(r => setResourceResults(r.data?.results || []))
        .catch(() => setResourceResults([]))
        .finally(() => setSearchLoading(false))
    }, 320)
    return () => clearTimeout(debounceRef.current)
  }, [searchQ])

  // ── Theme tokens ──────────────────────────────────────────────────
  const sidebarBg   = dark ? "linear-gradient(180deg,#07091a 0%,#0b1225 50%,#07091a 100%)" : "linear-gradient(180deg,#f8faff 0%,#eef2ff 100%)"
  const borderColor = dark ? "rgba(255,255,255,0.05)" : "rgba(99,102,241,0.1)"
  const textPrimary = dark ? "#e2e8f0" : "#1e293b"
  const textMuted   = dark ? "#64748b" : "#94a3b8"
  const surfaceHov  = dark ? "rgba(255,255,255,0.05)" : "rgba(99,102,241,0.05)"
  const glassCard   = dark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.7)"

  const CLOUD_ACTIVE = {
    aws:   { bg:"rgba(0,212,170,0.12)",  border:"#00d4aa", color:"#00d4aa" },
    azure: { bg:"rgba(0,120,212,0.15)",  border:"#0078D4", color:"#50e6ff" },
    gcp:   { bg:"rgba(66,133,244,0.15)", border:"#4285F4", color:"#34A853" },
  }

  function NavItem({ link, cloud }) {
    const ac = CLOUD_ACTIVE[cloud]
    if (link.soon) {
      return (
        <div style={{
          display:"flex", alignItems:"center", gap:9, padding:"6px 12px",
          borderRadius:9, marginBottom:1, fontSize:12, color:textMuted,
          opacity:0.45, cursor:"default",
        }}>
          <div style={{ width:22, height:22, borderRadius:6, flexShrink:0,
            background:`${CLOUDS[cloud].color}10`,
            display:"flex", alignItems:"center", justifyContent:"center",
            border:`1px solid ${CLOUDS[cloud].color}15` }}>
            <SvgIcon d={link.icon} stroke={CLOUDS[cloud].color+"80"} />
          </div>
          <span style={{ flex:1 }}>{link.label}</span>
          <span style={{
            fontSize:8, background:`${CLOUDS[cloud].color}10`, color:CLOUDS[cloud].color+"90",
            border:`1px solid ${CLOUDS[cloud].color}20`, borderRadius:4, padding:"1px 5px",
            fontWeight:700, letterSpacing:"0.06em",
          }}>SOON</span>
        </div>
      )
    }
    return (
      <NavLink to={link.path}
        end={link.path==="/"||link.path==="/azure"||link.path==="/gcp"}
        style={({ isActive }) => ({
          display:"flex", alignItems:"center", gap:9, padding:"6px 12px",
          borderRadius:9, marginBottom:1, fontSize:12, textDecoration:"none",
          fontWeight:isActive?600:400,
          color:isActive ? ac.color : textMuted,
          background:isActive ? ac.bg : "transparent",
          borderLeft:isActive ? `2px solid ${ac.border}` : "2px solid transparent",
          transition:"all 0.15s ease",
        })}
        onMouseEnter={e=>{ if(!e.currentTarget.dataset.active){e.currentTarget.style.background=surfaceHov;e.currentTarget.style.color=textPrimary} }}
        onMouseLeave={e=>{ const ia=location.pathname===link.path||(link.path!=="/"&&location.pathname.startsWith(link.path)); if(!ia){e.currentTarget.style.background="transparent";e.currentTarget.style.color=textMuted} }}
      >
        <div style={{ width:22, height:22, borderRadius:6, flexShrink:0,
          background:`${CLOUDS[cloud].color}10`,
          display:"flex", alignItems:"center", justifyContent:"center",
          border:`1px solid ${CLOUDS[cloud].color}15` }}>
          <SvgIcon d={link.icon} stroke={CLOUDS[cloud].color} />
        </div>
        {link.label}
      </NavLink>
    )
  }

  function CloudSection({ cloudKey }) {
    const c = CLOUDS[cloudKey]
    const sections = NAV[cloudKey]
    const isOpen = openCloud === cloudKey
    const isActiveCloud = detectCloud(location.pathname) === cloudKey

    return (
      <div style={{ marginBottom:4 }}>
        <button
          onClick={() => setOpenCloud(p => p===cloudKey ? null : cloudKey)}
          style={{
            width:"100%", display:"flex", alignItems:"center", gap:9, padding:"9px 10px",
            borderRadius:12, cursor:"pointer",
            border:`1px solid ${isOpen||isActiveCloud ? c.color+"55" : borderColor}`,
            background:isOpen||isActiveCloud ? c.activeBg : glassCard,
            boxShadow:isOpen||isActiveCloud ? `0 0 24px ${c.shadow}30,inset 0 0 0 1px ${c.color}10` : "none",
            transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={e=>{ if(!isOpen&&!isActiveCloud){e.currentTarget.style.borderColor=c.color+"33";e.currentTarget.style.background=c.activeBg+"80"} }}
          onMouseLeave={e=>{ if(!isOpen&&!isActiveCloud){e.currentTarget.style.borderColor=borderColor;e.currentTarget.style.background=glassCard} }}
        >
          <CloudBadge cloud={cloudKey} />
          <div style={{ flex:1, textAlign:"left" }}>
            <div style={{ fontSize:12, fontWeight:600, color:isOpen||isActiveCloud ? c.color : textPrimary, letterSpacing:"-0.1px" }}>
              {c.label}
            </div>
          </div>
          {isActiveCloud && (
            <div style={{ width:5, height:5, borderRadius:"50%", background:c.color,
              boxShadow:`0 0 6px ${c.color}`, marginRight:4 }} />
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke={isOpen?c.color:textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition:"transform 0.28s ease", transform:isOpen?"rotate(90deg)":"rotate(0deg)", flexShrink:0 }}>
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>

        <div style={{
          overflow:"hidden",
          maxHeight:isOpen ? "1200px" : "0",
          opacity:isOpen ? 1 : 0,
          transition:"max-height 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
        }}>
          <div style={{
            margin:"3px 0 0", padding:"5px 3px 6px",
            background:dark ? `${c.color}05` : `${c.color}06`,
            borderRadius:10, border:`1px solid ${c.color}15`,
          }}>
            {sections.map(sec => (
              <div key={sec.cat}>
                <div style={{
                  fontSize:"8.5px", fontWeight:800, letterSpacing:"0.13em", textTransform:"uppercase",
                  color:`${c.color}`, opacity:0.65, padding:"7px 12px 2px",
                  display:"flex", alignItems:"center", gap:5,
                }}>
                  <div style={{ flex:1, height:"1px", background:`linear-gradient(90deg,${c.color}50,transparent)` }} />
                  <span>{sec.cat}</span>
                </div>
                {sec.links.map(link => <NavItem key={link.label} link={link} cloud={cloudKey} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width:256, minHeight:"100vh", background:sidebarBg,
      borderRight:`1px solid ${borderColor}`, display:"flex", flexDirection:"column",
      flexShrink:0, position:"relative", transition:"all 0.3s ease" }}>

      <style>{`
        @keyframes sb-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        @keyframes sb-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .sb-search::placeholder{color:#64748b}
        .sb-search:focus{outline:none}
        .sb-sr-item:hover{background:rgba(255,255,255,0.06)!important}
        .sb-btn-plain{background:none;border:none;cursor:pointer;padding:0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.18);border-radius:4px}
      `}</style>

      {dark && <>
        <div style={{ position:"absolute", top:-40, left:-30, width:160, height:160,
          background:"radial-gradient(circle,rgba(0,212,170,0.07) 0%,transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:60, right:-20, width:120, height:120,
          background:"radial-gradient(circle,rgba(59,130,246,0.05) 0%,transparent 70%)", pointerEvents:"none" }} />
      </>}

      {/* ── Header ── */}
      <div style={{ padding:"15px 12px 11px", borderBottom:`1px solid ${borderColor}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:11 }}>
          <div style={{ width:34, height:34, borderRadius:10, flexShrink:0,
            background:"linear-gradient(135deg,#00d4aa 0%,#0ea5e9 100%)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 0 18px rgba(0,212,170,0.4), 0 2px 8px rgba(0,0,0,0.3)",
            animation:"sb-float 4s ease-in-out infinite" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:15, letterSpacing:"-0.3px",
              background:"linear-gradient(90deg,#00d4aa,#0ea5e9)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>AIonOS</div>
            <div style={{ fontSize:9.5, color:textMuted, letterSpacing:"0.05em" }}>Multi-Cloud Platform</div>
          </div>
          <NotificationBell />
          <button
            onClick={toggle}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
              border: `1px solid ${borderColor}`,
              cursor: "pointer", transition: "all 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"}
          >
            {dark ? (
              /* sun — click to go light */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1"  x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1"  y1="12" x2="3"  y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              /* moon — click to go dark */
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </button>
        </div>

        <div style={{ position:"relative" }}>
          <div style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", opacity:0.6 }}>
            <SvgIcon d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" size={13} stroke={textMuted} />
          </div>
          <input ref={searchRef} className="sb-search" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            placeholder="Search services, resources..."
            style={{
              width:"100%", boxSizing:"border-box",
              background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)",
              border:`1px solid ${borderColor}`, borderRadius:9,
              padding:"7px 10px 7px 30px", fontSize:12, color:textPrimary,
              transition:"border 0.2s", fontFamily:"inherit",
            }}
            onFocus={e=>e.currentTarget.style.borderColor="#00d4aa55"}
            onBlur={e=>e.currentTarget.style.borderColor=borderColor}
          />
          {searchQ && (
            <button className="sb-btn-plain" onClick={()=>setSearchQ("")}
              style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", color:textMuted }}>
              <SvgIcon d="M18 6L6 18M6 6l12 12" size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex:1, padding:"8px 8px", overflowY:"auto" }}>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:"9px", fontWeight:700, letterSpacing:"0.12em", color:textMuted, padding:"6px 12px 4px", textTransform:"uppercase" }}>Results</div>
            {searchResults.map(r => (
              <button key={r.path} className="sb-btn-plain sb-sr-item"
                onClick={()=>{navigate(r.path);setSearchQ("")}}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"7px 12px", borderRadius:9, marginBottom:1, background:"transparent", color:textMuted, transition:"all 0.15s ease", textAlign:"left" }}>
                <div style={{ width:22, height:22, borderRadius:6, flexShrink:0, background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <SvgIcon d={r.icon} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:textPrimary, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.label}</div>
                  <div style={{ fontSize:10, color:textMuted }}>{r.cat}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {searchQ && searchResults.length===0 && resourceResults.length===0 && !searchLoading && (
          <div style={{ padding:"20px 12px", textAlign:"center", color:textMuted, fontSize:12 }}>No results for "{searchQ}"</div>
        )}

        {/* Resource results from backend */}
        {(resourceResults.length > 0 || (searchLoading && searchQ.length >= 2)) && (
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:"9px", fontWeight:700, letterSpacing:"0.12em", color:"#00d4aa", padding:"6px 12px 4px", textTransform:"uppercase", display:"flex", alignItems:"center", gap:6 }}>
              Resources
              {searchLoading && <span style={{ width:8, height:8, borderRadius:"50%", border:"1.5px solid #00d4aa", borderTopColor:"transparent", display:"inline-block", animation:"spin 0.6s linear infinite" }} />}
            </div>
            {resourceResults.map(r => {
              const cloudColors = { aws:"#FF9900", gcp:"#4285F4", azure:"#0078D4" }
              const statusDots  = { running:"#22c55e", RUNNING:"#22c55e", stopped:"#f59e0b", STOPPED:"#f59e0b", pending:"#3b82f6", approved:"#22c55e", rejected:"#ef4444" }
              const cc = cloudColors[r.cloud] || "#64748b"
              const sd = statusDots[r.status] || "#64748b"
              return (
                <button key={r.id} className="sb-btn-plain sb-sr-item"
                  onClick={()=>{ navigate(r.link); setSearchQ("") }}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"7px 12px", borderRadius:9, marginBottom:1, background:"transparent", color:textMuted, transition:"all 0.15s ease", textAlign:"left" }}>
                  {/* cloud badge */}
                  <span style={{ fontSize:"9px", fontWeight:700, padding:"2px 5px", borderRadius:4, background:`${cc}18`, color:cc, flexShrink:0, textTransform:"uppercase" }}>{r.cloud}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:textPrimary, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.name}</div>
                    <div style={{ fontSize:10, color:textMuted }}>{r.type}{r.meta ? ` · ${r.meta}` : ""}</div>
                  </div>
                  {/* status dot */}
                  <span style={{ width:6, height:6, borderRadius:"50%", background:sd, flexShrink:0 }} />
                </button>
              )
            })}
          </div>
        )}

        {/* ── PLATFORM SECTION ── */}
        {!searchQ && (
          <>
            <div style={{ fontSize:"8.5px", fontWeight:800, letterSpacing:"0.14em", textTransform:"uppercase",
              color:"#00d4aa", opacity:0.7, padding:"4px 12px 4px",
              display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:16, height:1, background:"linear-gradient(90deg,#00d4aa60,transparent)" }} />
              PLATFORM
            </div>
            <div style={{ marginBottom:8, background:dark?"rgba(0,212,170,0.03)":"rgba(0,212,170,0.04)",
              borderRadius:11, border:`1px solid rgba(0,212,170,0.1)`, padding:"3px" }}>
              {PLATFORM_NAV.filter(item => !item.adminOnly || user.role === "admin").map(item => {
                const isActive = location.pathname === item.path
                const badgeVal = item.badge === "pending" ? pendingCount : 0
                return (
                  <NavLink key={item.path} to={item.path}
                    style={({ isActive: ia }) => ({
                      display:"flex", alignItems:"center", gap:9, padding:"7px 11px",
                      borderRadius:9, marginBottom:1, textDecoration:"none",
                      fontWeight:ia?600:400, fontSize:12,
                      color:ia ? item.color : textMuted,
                      background:ia ? `${item.color}15` : "transparent",
                      borderLeft:ia ? `2px solid ${item.color}` : "2px solid transparent",
                      transition:"all 0.15s ease",
                    })}
                    onMouseEnter={e=>{if(!e.currentTarget.getAttribute("aria-current")){e.currentTarget.style.background=`${item.color}10`;e.currentTarget.style.color=item.color}}}
                    onMouseLeave={e=>{if(!e.currentTarget.getAttribute("aria-current")){e.currentTarget.style.background="transparent";e.currentTarget.style.color=textMuted}}}
                  >
                    <div style={{ width:24, height:24, borderRadius:7, flexShrink:0,
                      background:`${item.color}15`,
                      border:`1px solid ${item.color}25`,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <SvgIcon d={item.icon} size={13} stroke={item.color} />
                    </div>
                    <span style={{ flex:1 }}>{item.label}</span>
                    {badgeVal > 0 && (
                      <span style={{
                        minWidth:18, height:18, borderRadius:9, padding:"0 5px",
                        background:"#f59e0b", color:"#fff",
                        fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center",
                        boxShadow:"0 0 8px rgba(245,158,11,0.5)", animation:"sb-pulse 2s ease infinite",
                      }}>{badgeVal}</span>
                    )}
                    {item.label === "Cloud Overview" && (
                      <span style={{ fontSize:8, background:"rgba(0,212,170,0.15)", color:"#00d4aa",
                        border:"1px solid rgba(0,212,170,0.3)", borderRadius:4, padding:"1px 5px", fontWeight:700 }}>NEW</span>
                    )}
                  </NavLink>
                )
              })}
            </div>

            {/* ── Divider ── */}
            <div style={{ fontSize:"8.5px", fontWeight:800, letterSpacing:"0.14em", textTransform:"uppercase",
              color:textMuted, opacity:0.6, padding:"4px 12px 4px",
              display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:16, height:1, background:`linear-gradient(90deg,${borderColor},transparent)` }} />
              CLOUD PROVIDERS
            </div>

            <CloudSection cloudKey="aws" />
            <CloudSection cloudKey="azure" />
            <CloudSection cloudKey="gcp" />
          </>
        )}
      </nav>

      {/* ── Footer ── */}
      <div style={{ padding:"10px 8px 14px", borderTop:`1px solid ${borderColor}` }}>
        <button onClick={toggle} style={{
          width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 11px",
          borderRadius:10, border:`1px solid ${borderColor}`, background:glassCard,
          cursor:"pointer", marginBottom:8, transition:"all 0.2s ease",
        }}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
          onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          <div style={{ width:32, height:17, borderRadius:20,
            background:dark?"linear-gradient(90deg,#00d4aa,#0ea5e9)":"linear-gradient(90deg,#94a3b8,#cbd5e1)",
            position:"relative", transition:"all 0.3s", flexShrink:0,
            boxShadow:dark?"0 0 10px rgba(0,212,170,0.3)":"none" }}>
            <div style={{ position:"absolute", top:2, left:dark?17:2, width:13, height:13,
              borderRadius:"50%", background:"#fff", transition:"left 0.3s cubic-bezier(0.34,1.56,0.64,1)",
              boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }} />
          </div>
          <span style={{ fontSize:12, fontWeight:500, color:textMuted }}>{dark?"Dark mode":"Light mode"}</span>
          <span style={{ marginLeft:"auto", fontSize:10, color:dark?"#00d4aa60":"#94a3b8", fontFamily:"monospace" }}>{dark?"●":"○"}</span>
        </button>

        <div style={{ display:"flex", alignItems:"center", gap:9, padding:"10px 11px", borderRadius:12,
          background:dark?"linear-gradient(90deg,rgba(0,212,170,0.07),rgba(14,165,233,0.04))":"linear-gradient(90deg,rgba(0,212,170,0.06),rgba(14,165,233,0.03))",
          border:`1px solid ${dark?"rgba(0,212,170,0.14)":"rgba(0,212,170,0.18)"}` }}>
          <div style={{ width:30, height:30, borderRadius:9, flexShrink:0,
            background:"linear-gradient(135deg,#00d4aa,#0ea5e9)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 0 12px rgba(0,212,170,0.3)", fontSize:12, fontWeight:700, color:"#fff" }}>
            {(user.username||"U")[0].toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:textPrimary, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {user.username||"user"}
            </div>
            <div style={{ fontSize:9.5, color:"#00d4aa", textTransform:"capitalize", marginTop:1 }}>
              {user.role||"viewer"} · Online
            </div>
          </div>
          <button onClick={()=>{localStorage.removeItem("token");localStorage.removeItem("user");navigate("/login")}}
            title="Logout" style={{ background:"rgba(244,63,94,0.1)", border:"1px solid rgba(244,63,94,0.2)",
              cursor:"pointer", padding:5, borderRadius:7, color:"#f43f5e",
              display:"flex", alignItems:"center", transition:"all 0.15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(244,63,94,0.2)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(244,63,94,0.1)"}>
            <SvgIcon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" size={13} />
          </button>
        </div>

        <div style={{ textAlign:"center", marginTop:8, fontSize:9, color:textMuted, letterSpacing:"0.06em" }}>
          AIonOS v1.0 · <span style={{ color:"#00d4aa60" }}>3 Clouds</span>
        </div>
      </div>
    </div>
  )
}
