import { useEffect, useMemo, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { createRequest, listGCPNetworks, listGCPSubnetworks, generateGCPSSHKey } from "../api/api"
import StartupScriptPicker from "../components/StartupScriptPicker"
import CrossCloudPricing from "../components/CrossCloudPricing"

// ── All GCP regions ────────────────────────────────────────────────────────
const GCP_REGIONS = [
  // Americas
  { name:"us-central1",              display:"Iowa, USA",                geo:"Americas",       zones:["a","b","c","f"] },
  { name:"us-east1",                 display:"South Carolina, USA",      geo:"Americas",       zones:["b","c","d"] },
  { name:"us-east4",                 display:"N. Virginia, USA",         geo:"Americas",       zones:["a","b","c"] },
  { name:"us-east5",                 display:"Columbus, USA",            geo:"Americas",       zones:["a","b","c"] },
  { name:"us-south1",                display:"Dallas, USA",              geo:"Americas",       zones:["a","b","c"] },
  { name:"us-west1",                 display:"Oregon, USA",              geo:"Americas",       zones:["a","b","c"] },
  { name:"us-west2",                 display:"Los Angeles, USA",         geo:"Americas",       zones:["a","b","c"] },
  { name:"us-west3",                 display:"Salt Lake City, USA",      geo:"Americas",       zones:["a","b","c"] },
  { name:"us-west4",                 display:"Las Vegas, USA",           geo:"Americas",       zones:["a","b","c"] },
  { name:"northamerica-northeast1",  display:"Montréal, Canada",         geo:"Americas",       zones:["a","b","c"] },
  { name:"northamerica-northeast2",  display:"Toronto, Canada",          geo:"Americas",       zones:["a","b","c"] },
  { name:"southamerica-east1",       display:"São Paulo, Brazil",        geo:"Americas",       zones:["a","b","c"] },
  { name:"southamerica-west1",       display:"Santiago, Chile",          geo:"Americas",       zones:["a","b","c"] },
  // Europe
  { name:"europe-central2",          display:"Warsaw, Poland",           geo:"Europe",         zones:["a","b","c"] },
  { name:"europe-north1",            display:"Hamina, Finland",          geo:"Europe",         zones:["a","b","c"] },
  { name:"europe-southwest1",        display:"Madrid, Spain",            geo:"Europe",         zones:["a","b","c"] },
  { name:"europe-west1",             display:"St. Ghislain, Belgium",    geo:"Europe",         zones:["b","c","d"] },
  { name:"europe-west2",             display:"London, UK",               geo:"Europe",         zones:["a","b","c"] },
  { name:"europe-west3",             display:"Frankfurt, Germany",       geo:"Europe",         zones:["a","b","c"] },
  { name:"europe-west4",             display:"Eemshaven, Netherlands",   geo:"Europe",         zones:["a","b","c"] },
  { name:"europe-west6",             display:"Zurich, Switzerland",      geo:"Europe",         zones:["a","b","c"] },
  { name:"europe-west8",             display:"Milan, Italy",             geo:"Europe",         zones:["a","b","c"] },
  { name:"europe-west9",             display:"Paris, France",            geo:"Europe",         zones:["a","b","c"] },
  { name:"europe-west10",            display:"Berlin, Germany",          geo:"Europe",         zones:["a","b","c"] },
  { name:"europe-west12",            display:"Turin, Italy",             geo:"Europe",         zones:["a","b","c"] },
  // Asia Pacific
  { name:"asia-east1",               display:"Changhua County, Taiwan",  geo:"Asia Pacific",   zones:["a","b","c"] },
  { name:"asia-east2",               display:"Hong Kong",                geo:"Asia Pacific",   zones:["a","b","c"] },
  { name:"asia-northeast1",          display:"Tokyo, Japan",             geo:"Asia Pacific",   zones:["a","b","c"] },
  { name:"asia-northeast2",          display:"Osaka, Japan",             geo:"Asia Pacific",   zones:["a","b","c"] },
  { name:"asia-northeast3",          display:"Seoul, South Korea",       geo:"Asia Pacific",   zones:["a","b","c"] },
  { name:"asia-south1",              display:"Mumbai, India",            geo:"Asia Pacific",   zones:["a","b","c"] },
  { name:"asia-south2",              display:"Delhi, India",             geo:"Asia Pacific",   zones:["a","b","c"] },
  { name:"asia-southeast1",          display:"Jurong West, Singapore",   geo:"Asia Pacific",   zones:["a","b","c"] },
  { name:"asia-southeast2",          display:"Jakarta, Indonesia",       geo:"Asia Pacific",   zones:["a","b","c"] },
  { name:"australia-southeast1",     display:"Sydney, Australia",        geo:"Asia Pacific",   zones:["a","b","c"] },
  { name:"australia-southeast2",     display:"Melbourne, Australia",     geo:"Asia Pacific",   zones:["a","b","c"] },
  // Middle East & Africa
  { name:"me-central1",              display:"Doha, Qatar",              geo:"Middle East",    zones:["a","b","c"] },
  { name:"me-central2",              display:"Dammam, Saudi Arabia",     geo:"Middle East",    zones:["a","b","c"] },
  { name:"me-west1",                 display:"Tel Aviv, Israel",         geo:"Middle East",    zones:["a","b","c"] },
  { name:"africa-south1",            display:"Johannesburg, South Africa",geo:"Africa",        zones:["a","b","c"] },
].map(r => ({ ...r, zones: r.zones.map(z => `${r.name}-${z}`) }))

// ── All machine type families ──────────────────────────────────────────────
const MACHINE_FAMILIES = [
  {
    id:"e2", family:"E2", label:"E2 — Cost Optimised", color:"#34A853",
    desc:"Best price-performance. Suitable for most general workloads, web serving, and small databases.",
    types:[
      { name:"e2-micro",        vcpu:"0.25", ram:"1 GiB",   price:0.0084,  shared:true },
      { name:"e2-small",        vcpu:"0.5",  ram:"2 GiB",   price:0.0168,  shared:true },
      { name:"e2-medium",       vcpu:"1",    ram:"4 GiB",   price:0.0336,  shared:true, recommended:true },
      { name:"e2-standard-2",   vcpu:2,      ram:"8 GiB",   price:0.0671 },
      { name:"e2-standard-4",   vcpu:4,      ram:"16 GiB",  price:0.1342 },
      { name:"e2-standard-8",   vcpu:8,      ram:"32 GiB",  price:0.2684 },
      { name:"e2-standard-16",  vcpu:16,     ram:"64 GiB",  price:0.5368 },
      { name:"e2-standard-32",  vcpu:32,     ram:"128 GiB", price:1.0736 },
      { name:"e2-highmem-2",    vcpu:2,      ram:"16 GiB",  price:0.0900 },
      { name:"e2-highmem-4",    vcpu:4,      ram:"32 GiB",  price:0.1800 },
      { name:"e2-highmem-8",    vcpu:8,      ram:"64 GiB",  price:0.3601 },
      { name:"e2-highmem-16",   vcpu:16,     ram:"128 GiB", price:0.7201 },
      { name:"e2-highcpu-2",    vcpu:2,      ram:"2 GiB",   price:0.0497 },
      { name:"e2-highcpu-4",    vcpu:4,      ram:"4 GiB",   price:0.0994 },
      { name:"e2-highcpu-8",    vcpu:8,      ram:"8 GiB",   price:0.1988 },
      { name:"e2-highcpu-16",   vcpu:16,     ram:"16 GiB",  price:0.3976 },
      { name:"e2-highcpu-32",   vcpu:32,     ram:"32 GiB",  price:0.7953 },
    ],
  },
  {
    id:"n1", family:"N1", label:"N1 — General Purpose", color:"#4285F4",
    desc:"First generation general-purpose VMs. Supports custom machine types and local SSD.",
    types:[
      { name:"n1-standard-1",   vcpu:1,   ram:"3.75 GiB", price:0.0475 },
      { name:"n1-standard-2",   vcpu:2,   ram:"7.5 GiB",  price:0.0950 },
      { name:"n1-standard-4",   vcpu:4,   ram:"15 GiB",   price:0.1900 },
      { name:"n1-standard-8",   vcpu:8,   ram:"30 GiB",   price:0.3800 },
      { name:"n1-standard-16",  vcpu:16,  ram:"60 GiB",   price:0.7600 },
      { name:"n1-standard-32",  vcpu:32,  ram:"120 GiB",  price:1.5200 },
      { name:"n1-standard-64",  vcpu:64,  ram:"240 GiB",  price:3.0400 },
      { name:"n1-standard-96",  vcpu:96,  ram:"360 GiB",  price:4.5600 },
      { name:"n1-highmem-2",    vcpu:2,   ram:"13 GiB",   price:0.1184 },
      { name:"n1-highmem-4",    vcpu:4,   ram:"26 GiB",   price:0.2368 },
      { name:"n1-highmem-8",    vcpu:8,   ram:"52 GiB",   price:0.4736 },
      { name:"n1-highmem-16",   vcpu:16,  ram:"104 GiB",  price:0.9472 },
      { name:"n1-highmem-32",   vcpu:32,  ram:"208 GiB",  price:1.8944 },
      { name:"n1-highmem-64",   vcpu:64,  ram:"416 GiB",  price:3.7888 },
      { name:"n1-highmem-96",   vcpu:96,  ram:"624 GiB",  price:5.6832 },
      { name:"n1-highcpu-2",    vcpu:2,   ram:"1.8 GiB",  price:0.0709 },
      { name:"n1-highcpu-4",    vcpu:4,   ram:"3.6 GiB",  price:0.1418 },
      { name:"n1-highcpu-8",    vcpu:8,   ram:"7.2 GiB",  price:0.2836 },
      { name:"n1-highcpu-16",   vcpu:16,  ram:"14.4 GiB", price:0.5672 },
      { name:"n1-highcpu-32",   vcpu:32,  ram:"28.8 GiB", price:1.1344 },
      { name:"n1-highcpu-64",   vcpu:64,  ram:"57.6 GiB", price:2.2688 },
      { name:"n1-highcpu-96",   vcpu:96,  ram:"86.4 GiB", price:3.4032 },
    ],
  },
  {
    id:"n2", family:"N2", label:"N2 — Balanced", color:"#4285F4",
    desc:"Latest Intel-based balanced VMs for high performance enterprise workloads.",
    types:[
      { name:"n2-standard-2",   vcpu:2,   ram:"8 GiB",    price:0.0971 },
      { name:"n2-standard-4",   vcpu:4,   ram:"16 GiB",   price:0.1942, recommended:true },
      { name:"n2-standard-8",   vcpu:8,   ram:"32 GiB",   price:0.3885 },
      { name:"n2-standard-16",  vcpu:16,  ram:"64 GiB",   price:0.7769 },
      { name:"n2-standard-32",  vcpu:32,  ram:"128 GiB",  price:1.5539 },
      { name:"n2-standard-48",  vcpu:48,  ram:"192 GiB",  price:2.3308 },
      { name:"n2-standard-64",  vcpu:64,  ram:"256 GiB",  price:3.1077 },
      { name:"n2-standard-80",  vcpu:80,  ram:"320 GiB",  price:3.8847 },
      { name:"n2-standard-96",  vcpu:96,  ram:"384 GiB",  price:4.6616 },
      { name:"n2-standard-128", vcpu:128, ram:"512 GiB",  price:6.2154 },
      { name:"n2-highmem-2",    vcpu:2,   ram:"16 GiB",   price:0.1310 },
      { name:"n2-highmem-4",    vcpu:4,   ram:"32 GiB",   price:0.2620 },
      { name:"n2-highmem-8",    vcpu:8,   ram:"64 GiB",   price:0.5241 },
      { name:"n2-highmem-16",   vcpu:16,  ram:"128 GiB",  price:1.0482 },
      { name:"n2-highmem-32",   vcpu:32,  ram:"256 GiB",  price:2.0963 },
      { name:"n2-highmem-48",   vcpu:48,  ram:"384 GiB",  price:3.1445 },
      { name:"n2-highmem-64",   vcpu:64,  ram:"512 GiB",  price:4.1927 },
      { name:"n2-highmem-80",   vcpu:80,  ram:"640 GiB",  price:5.2408 },
      { name:"n2-highcpu-2",    vcpu:2,   ram:"2 GiB",    price:0.0757 },
      { name:"n2-highcpu-4",    vcpu:4,   ram:"4 GiB",    price:0.1514 },
      { name:"n2-highcpu-8",    vcpu:8,   ram:"8 GiB",    price:0.3028 },
      { name:"n2-highcpu-16",   vcpu:16,  ram:"16 GiB",   price:0.6056 },
      { name:"n2-highcpu-32",   vcpu:32,  ram:"32 GiB",   price:1.2113 },
      { name:"n2-highcpu-48",   vcpu:48,  ram:"48 GiB",   price:1.8169 },
      { name:"n2-highcpu-64",   vcpu:64,  ram:"64 GiB",   price:2.4225 },
      { name:"n2-highcpu-80",   vcpu:80,  ram:"80 GiB",   price:3.0282 },
      { name:"n2-highcpu-96",   vcpu:96,  ram:"96 GiB",   price:3.6338 },
    ],
  },
  {
    id:"n2d", family:"N2D", label:"N2D — AMD EPYC", color:"#EA4335",
    desc:"AMD EPYC-based VMs for better price-performance. Ideal for memory-bound and compute workloads.",
    types:[
      { name:"n2d-standard-2",  vcpu:2,   ram:"8 GiB",    price:0.0872 },
      { name:"n2d-standard-4",  vcpu:4,   ram:"16 GiB",   price:0.1743 },
      { name:"n2d-standard-8",  vcpu:8,   ram:"32 GiB",   price:0.3487 },
      { name:"n2d-standard-16", vcpu:16,  ram:"64 GiB",   price:0.6974 },
      { name:"n2d-standard-32", vcpu:32,  ram:"128 GiB",  price:1.3947 },
      { name:"n2d-standard-48", vcpu:48,  ram:"192 GiB",  price:2.0921 },
      { name:"n2d-standard-64", vcpu:64,  ram:"256 GiB",  price:2.7894 },
      { name:"n2d-standard-80", vcpu:80,  ram:"320 GiB",  price:3.4868 },
      { name:"n2d-standard-96", vcpu:96,  ram:"384 GiB",  price:4.1841 },
      { name:"n2d-standard-128",vcpu:128, ram:"512 GiB",  price:5.5789 },
      { name:"n2d-highmem-2",   vcpu:2,   ram:"16 GiB",   price:0.1178 },
      { name:"n2d-highmem-4",   vcpu:4,   ram:"32 GiB",   price:0.2356 },
      { name:"n2d-highmem-8",   vcpu:8,   ram:"64 GiB",   price:0.4712 },
      { name:"n2d-highmem-16",  vcpu:16,  ram:"128 GiB",  price:0.9424 },
      { name:"n2d-highmem-32",  vcpu:32,  ram:"256 GiB",  price:1.8848 },
      { name:"n2d-highmem-48",  vcpu:48,  ram:"384 GiB",  price:2.8272 },
      { name:"n2d-highmem-64",  vcpu:64,  ram:"512 GiB",  price:3.7696 },
      { name:"n2d-highmem-96",  vcpu:96,  ram:"768 GiB",  price:5.6544 },
      { name:"n2d-highcpu-2",   vcpu:2,   ram:"2 GiB",    price:0.0681 },
      { name:"n2d-highcpu-4",   vcpu:4,   ram:"4 GiB",    price:0.1362 },
      { name:"n2d-highcpu-8",   vcpu:8,   ram:"8 GiB",    price:0.2724 },
      { name:"n2d-highcpu-16",  vcpu:16,  ram:"16 GiB",   price:0.5448 },
      { name:"n2d-highcpu-32",  vcpu:32,  ram:"32 GiB",   price:1.0897 },
      { name:"n2d-highcpu-48",  vcpu:48,  ram:"48 GiB",   price:1.6345 },
      { name:"n2d-highcpu-64",  vcpu:64,  ram:"64 GiB",   price:2.1793 },
      { name:"n2d-highcpu-80",  vcpu:80,  ram:"80 GiB",   price:2.7241 },
      { name:"n2d-highcpu-96",  vcpu:96,  ram:"96 GiB",   price:3.2690 },
    ],
  },
  {
    id:"t2d", family:"T2D", label:"T2D — Tau (AMD)", color:"#FBBC04",
    desc:"AMD EPYC Milan-based. Scale-out workloads, web servers, containerised microservices.",
    types:[
      { name:"t2d-standard-1",  vcpu:1,  ram:"4 GiB",    price:0.0422 },
      { name:"t2d-standard-2",  vcpu:2,  ram:"8 GiB",    price:0.0845 },
      { name:"t2d-standard-4",  vcpu:4,  ram:"16 GiB",   price:0.1689 },
      { name:"t2d-standard-8",  vcpu:8,  ram:"32 GiB",   price:0.3379 },
      { name:"t2d-standard-16", vcpu:16, ram:"64 GiB",   price:0.6757 },
      { name:"t2d-standard-32", vcpu:32, ram:"128 GiB",  price:1.3515 },
      { name:"t2d-standard-48", vcpu:48, ram:"192 GiB",  price:2.0272 },
      { name:"t2d-standard-60", vcpu:60, ram:"240 GiB",  price:2.5340 },
    ],
  },
  {
    id:"t2a", family:"T2A", label:"T2A — Tau (ARM)", color:"#FBBC04",
    desc:"Ampere Altra ARM-based. Best price-performance for scale-out workloads on ARM architecture.",
    types:[
      { name:"t2a-standard-1",  vcpu:1,  ram:"4 GiB",    price:0.0385 },
      { name:"t2a-standard-2",  vcpu:2,  ram:"8 GiB",    price:0.0770 },
      { name:"t2a-standard-4",  vcpu:4,  ram:"16 GiB",   price:0.1540 },
      { name:"t2a-standard-8",  vcpu:8,  ram:"32 GiB",   price:0.3080 },
      { name:"t2a-standard-16", vcpu:16, ram:"64 GiB",   price:0.6160 },
      { name:"t2a-standard-32", vcpu:32, ram:"128 GiB",  price:1.2320 },
      { name:"t2a-standard-48", vcpu:48, ram:"192 GiB",  price:1.8480 },
    ],
  },
  {
    id:"c2", family:"C2", label:"C2 — Compute Optimised", color:"#FF6D00",
    desc:"Highest performance per core. Best for compute-intensive workloads, HPC, gaming, EDA.",
    types:[
      { name:"c2-standard-4",   vcpu:4,  ram:"16 GiB",   price:0.2088 },
      { name:"c2-standard-8",   vcpu:8,  ram:"32 GiB",   price:0.4176 },
      { name:"c2-standard-16",  vcpu:16, ram:"64 GiB",   price:0.8352 },
      { name:"c2-standard-30",  vcpu:30, ram:"120 GiB",  price:1.5660 },
      { name:"c2-standard-60",  vcpu:60, ram:"240 GiB",  price:3.1321 },
    ],
  },
  {
    id:"c2d", family:"C2D", label:"C2D — Compute Optimised (AMD)", color:"#FF6D00",
    desc:"AMD EPYC Milan compute-optimised. Largest VM sizes in GCP, ideal for HPC and large workloads.",
    types:[
      { name:"c2d-standard-2",   vcpu:2,   ram:"8 GiB",   price:0.0985 },
      { name:"c2d-standard-4",   vcpu:4,   ram:"16 GiB",  price:0.1970 },
      { name:"c2d-standard-8",   vcpu:8,   ram:"32 GiB",  price:0.3940 },
      { name:"c2d-standard-16",  vcpu:16,  ram:"64 GiB",  price:0.7880 },
      { name:"c2d-standard-32",  vcpu:32,  ram:"128 GiB", price:1.5760 },
      { name:"c2d-standard-56",  vcpu:56,  ram:"224 GiB", price:2.7580 },
      { name:"c2d-standard-112", vcpu:112, ram:"448 GiB", price:5.5160 },
      { name:"c2d-highmem-4",    vcpu:4,   ram:"32 GiB",  price:0.2652 },
      { name:"c2d-highmem-8",    vcpu:8,   ram:"64 GiB",  price:0.5304 },
      { name:"c2d-highmem-16",   vcpu:16,  ram:"128 GiB", price:1.0608 },
      { name:"c2d-highmem-32",   vcpu:32,  ram:"256 GiB", price:2.1216 },
      { name:"c2d-highmem-56",   vcpu:56,  ram:"448 GiB", price:3.7128 },
      { name:"c2d-highmem-112",  vcpu:112, ram:"896 GiB", price:7.4256 },
      { name:"c2d-highcpu-4",    vcpu:4,   ram:"8 GiB",   price:0.1743 },
      { name:"c2d-highcpu-8",    vcpu:8,   ram:"16 GiB",  price:0.3487 },
      { name:"c2d-highcpu-16",   vcpu:16,  ram:"32 GiB",  price:0.6974 },
      { name:"c2d-highcpu-32",   vcpu:32,  ram:"64 GiB",  price:1.3947 },
      { name:"c2d-highcpu-56",   vcpu:56,  ram:"112 GiB", price:2.4407 },
      { name:"c2d-highcpu-112",  vcpu:112, ram:"224 GiB", price:4.8814 },
    ],
  },
  {
    id:"m1", family:"M1", label:"M1 — Memory Optimised", color:"#9333ea",
    desc:"Ultra-high memory VMs for SAP HANA, in-memory databases. Up to 4 TB RAM.",
    types:[
      { name:"m1-ultramem-40",  vcpu:40,  ram:"961 GiB",  price:6.3040 },
      { name:"m1-ultramem-80",  vcpu:80,  ram:"1922 GiB", price:12.608 },
      { name:"m1-ultramem-160", vcpu:160, ram:"3844 GiB", price:25.216 },
      { name:"m1-megamem-96",   vcpu:96,  ram:"1433 GiB", price:10.674 },
    ],
  },
  {
    id:"m2", family:"M2", label:"M2 — Memory Optimised (Gen 2)", color:"#9333ea",
    desc:"Second generation memory-optimised. Up to 12 TB RAM for the largest SAP HANA workloads.",
    types:[
      { name:"m2-ultramem-208",  vcpu:208, ram:"5888 GiB",  price:42.392 },
      { name:"m2-ultramem-416",  vcpu:416, ram:"11776 GiB", price:84.785 },
      { name:"m2-megamem-416",   vcpu:416, ram:"5888 GiB",  price:57.271 },
      { name:"m2-hypermem-416",  vcpu:416, ram:"8832 GiB",  price:68.473 },
    ],
  },
  {
    id:"a2", family:"A2", label:"A2 — GPU (NVIDIA A100)", color:"#f43f5e",
    desc:"NVIDIA A100 40GB/80GB GPUs for AI/ML training, inference, HPC, and scientific computing.",
    types:[
      { name:"a2-highgpu-1g",   vcpu:12,  ram:"85 GiB",   price:3.6700,  gpu:"1× A100 40GB" },
      { name:"a2-highgpu-2g",   vcpu:24,  ram:"170 GiB",  price:7.3400,  gpu:"2× A100 40GB" },
      { name:"a2-highgpu-4g",   vcpu:48,  ram:"340 GiB",  price:14.680,  gpu:"4× A100 40GB" },
      { name:"a2-highgpu-8g",   vcpu:96,  ram:"680 GiB",  price:29.360,  gpu:"8× A100 40GB" },
      { name:"a2-megagpu-16g",  vcpu:96,  ram:"1360 GiB", price:55.739,  gpu:"16× A100 40GB" },
      { name:"a2-ultragpu-1g",  vcpu:12,  ram:"170 GiB",  price:5.0688,  gpu:"1× A100 80GB" },
      { name:"a2-ultragpu-2g",  vcpu:24,  ram:"340 GiB",  price:10.138,  gpu:"2× A100 80GB" },
      { name:"a2-ultragpu-4g",  vcpu:48,  ram:"680 GiB",  price:20.275,  gpu:"4× A100 80GB" },
      { name:"a2-ultragpu-8g",  vcpu:96,  ram:"1360 GiB", price:40.550,  gpu:"8× A100 80GB" },
    ],
  },
  {
    id:"g2", family:"G2", label:"G2 — GPU (NVIDIA L4)", color:"#f43f5e",
    desc:"NVIDIA L4 GPUs optimised for AI inference, video transcoding, and virtual workstations.",
    types:[
      { name:"g2-standard-4",   vcpu:4,   ram:"16 GiB",   price:0.7260,  gpu:"1× L4 24GB" },
      { name:"g2-standard-8",   vcpu:8,   ram:"32 GiB",   price:1.0986,  gpu:"1× L4 24GB" },
      { name:"g2-standard-12",  vcpu:12,  ram:"48 GiB",   price:1.4713,  gpu:"1× L4 24GB" },
      { name:"g2-standard-16",  vcpu:16,  ram:"64 GiB",   price:1.8440,  gpu:"1× L4 24GB" },
      { name:"g2-standard-24",  vcpu:24,  ram:"96 GiB",   price:3.6880,  gpu:"2× L4 24GB" },
      { name:"g2-standard-32",  vcpu:32,  ram:"128 GiB",  price:3.6880,  gpu:"2× L4 24GB" },
      { name:"g2-standard-48",  vcpu:48,  ram:"192 GiB",  price:7.3760,  gpu:"4× L4 24GB" },
      { name:"g2-standard-96",  vcpu:96,  ram:"384 GiB",  price:14.752,  gpu:"8× L4 24GB" },
    ],
  },
]

// ── Boot images ─────────────────────────────────────────────────────────────
const BOOT_IMAGES = [
  { id:"debian-cloud/debian-12",                    name:"Debian 12 (Bookworm)",         icon:"🔴", os:"Linux",   arch:"x86_64 / ARM64" },
  { id:"debian-cloud/debian-11",                    name:"Debian 11 (Bullseye)",          icon:"🔴", os:"Linux",   arch:"x86_64 / ARM64" },
  { id:"ubuntu-os-cloud/ubuntu-2404-lts-amd64",     name:"Ubuntu 24.04 LTS (Noble)",      icon:"🟠", os:"Linux",   arch:"x86_64" },
  { id:"ubuntu-os-cloud/ubuntu-2204-lts",           name:"Ubuntu 22.04 LTS (Jammy)",      icon:"🟠", os:"Linux",   arch:"x86_64 / ARM64" },
  { id:"centos-cloud/centos-stream-9",              name:"CentOS Stream 9",               icon:"🟣", os:"Linux",   arch:"x86_64" },
  { id:"rhel-cloud/rhel-9",                         name:"RHEL 9",                        icon:"🎩", os:"Linux",   arch:"x86_64", note:"Licence included" },
  { id:"rhel-cloud/rhel-8",                         name:"RHEL 8",                        icon:"🎩", os:"Linux",   arch:"x86_64", note:"Licence included" },
  { id:"rocky-linux-cloud/rocky-linux-9",           name:"Rocky Linux 9",                 icon:"🪨", os:"Linux",   arch:"x86_64" },
  { id:"rocky-linux-cloud/rocky-linux-8",           name:"Rocky Linux 8",                 icon:"🪨", os:"Linux",   arch:"x86_64" },
  { id:"suse-cloud/sles-15",                        name:"SUSE Linux Enterprise 15",      icon:"🦎", os:"Linux",   arch:"x86_64", note:"Licence included" },
  { id:"cos-cloud/cos-stable",                      name:"Container-Optimised OS",         icon:"🐳", os:"Linux",   arch:"x86_64", note:"For containers" },
  { id:"fedora-coreos-cloud/fedora-coreos-stable",  name:"Fedora CoreOS",                 icon:"🎩", os:"Linux",   arch:"x86_64" },
  { id:"windows-cloud/windows-2022",                name:"Windows Server 2022",            icon:"🪟", os:"Windows", arch:"x86_64", note:"Licence included" },
  { id:"windows-cloud/windows-2019",                name:"Windows Server 2019",            icon:"🪟", os:"Windows", arch:"x86_64", note:"Licence included" },
  { id:"windows-sql-cloud/sql-ent-2022-win-2022",   name:"SQL Server 2022 Enterprise",    icon:"🗄️", os:"Windows", arch:"x86_64", note:"SQL + Windows licence" },
  { id:"windows-sql-cloud/sql-std-2022-win-2022",   name:"SQL Server 2022 Standard",      icon:"🗄️", os:"Windows", arch:"x86_64", note:"SQL + Windows licence" },
]

const DISK_TYPES = [
  { id:"pd-balanced",  name:"Balanced PD",   price:0.100, desc:"SSD-backed, best for most workloads (default)" },
  { id:"pd-ssd",       name:"SSD PD",         price:0.170, desc:"Highest IOPS for latency-sensitive workloads" },
  { id:"pd-standard",  name:"Standard PD",   price:0.040, desc:"HDD — large sequential reads/writes, low cost" },
  { id:"pd-extreme",   name:"Extreme PD",    price:0.270, desc:"Maximum IOPS — databases, analytics engines" },
  { id:"hyperdisk-balanced", name:"Hyperdisk Balanced", price:0.120, desc:"Next-gen block storage with configurable IOPS" },
]

const STEPS = ["Name & Region", "Machine Type", "Boot Image", "Storage & Network", "Labels & SSH", "Review"]

const GEO_GROUPS = [...new Set(GCP_REGIONS.map(r => r.geo))]

function getFamilyCategory(familyId) {
  if (["c2", "c2d"].includes(familyId)) return "Compute Optimized"
  if (["m1", "m2"].includes(familyId)) return "Memory Optimized"
  if (["a2", "g2"].includes(familyId)) return "Accelerated Computing"
  if (["t2a", "t2d"].includes(familyId)) return "Scale-Out"
  return "General Purpose"
}

const GCP_CATEGORIES = [
  {
    id:"general",  label:"General Purpose",   color:"#4285F4",
    desc:"Balanced CPU-to-memory ratio for a wide range of workloads — web serving, app servers, small databases, and development environments.",
    families:["e2","n1","n2","n2d"],
  },
  {
    id:"compute",  label:"Compute Optimised",  color:"#f59e0b",
    desc:"Highest vCPU performance-per-dollar. Ideal for HPC, gaming servers, media transcoding, scientific modelling, and batch processing.",
    families:["c2","c2d"],
  },
  {
    id:"memory",   label:"Memory Optimised",   color:"#a78bfa",
    desc:"Ultra-high memory-to-vCPU for SAP HANA, in-memory databases, Redis, and large-scale in-memory analytics — up to 12 TB RAM.",
    families:["m1","m2"],
  },
  {
    id:"gpu",      label:"GPU / ML",           color:"#f43f5e",
    desc:"NVIDIA A100 (40 / 80 GB) and L4 GPUs for AI/ML training, inference, high-performance computing, and scientific simulations.",
    families:["a2","g2"],
  },
  {
    id:"scaleout", label:"Scale-Out / ARM",    color:"#10b981",
    desc:"AMD EPYC Tau (T2D) and Ampere Altra ARM64 (T2A) optimised for cloud-native, containerised, and horizontally scaled workloads.",
    families:["t2a","t2d"],
  },
]

export default function GCPComputeLaunch() {
  const { dark } = useTheme()
  const navigate     = useNavigate()
  const { state: routerState } = useLocation()

  const [step,        setStep]        = useState(routerState?.prefill ? 1 : 0)
  const [instName,    setInstName]    = useState("")
  const [geoFilter,   setGeoFilter]   = useState("All")
  const [region,      setRegion]      = useState(GCP_REGIONS.find(r=>r.name==="us-central1"))
  const [zone,        setZone]        = useState("us-central1-a")
  const [categoryId,  setCategoryId]  = useState(() => {
    const p = routerState?.prefill
    if (!p) return "general"
    let bestFamId = "e2", bestScore = Infinity
    MACHINE_FAMILIES.forEach(fam => {
      fam.types.forEach(t => {
        const tv = typeof t.vcpu === "string" ? parseFloat(t.vcpu) : t.vcpu
        const score = Math.abs(tv / Math.max(p.vcpu, 0.1) - 1) + Math.abs(parseFloat(t.ram) / Math.max(p.ram_gb, 0.1) - 1)
        if (score < bestScore) { bestScore = score; bestFamId = fam.id }
      })
    })
    return GCP_CATEGORIES.find(c => c.families.includes(bestFamId))?.id || "general"
  })
  const [machSearch,  setMachSearch]  = useState("")
  const [machine,     setMachine]     = useState(() => {
    const p = routerState?.prefill
    if (!p) return MACHINE_FAMILIES[0].types[2]
    let best = MACHINE_FAMILIES[0].types[2], bestScore = Infinity
    MACHINE_FAMILIES.forEach(fam => {
      fam.types.forEach(t => {
        const tv = typeof t.vcpu === "string" ? parseFloat(t.vcpu) : t.vcpu
        const score = Math.abs(tv / Math.max(p.vcpu, 0.1) - 1) + Math.abs(parseFloat(t.ram) / Math.max(p.ram_gb, 0.1) - 1)
        if (score < bestScore) { bestScore = score; best = t }
      })
    })
    return best
  })
  const [osFilter,    setOsFilter]    = useState("All")
  const [image,       setImage]       = useState(BOOT_IMAGES[0])
  const [diskType,    setDiskType]    = useState(DISK_TYPES[0])
  const [diskGB,      setDiskGB]      = useState(50)
  const [publicIP,    setPublicIP]    = useState(false)
  const [allowHttp,   setAllowHttp]   = useState(false)
  const [allowHttps,  setAllowHttps]  = useState(false)
  const [preemptible, setPreemptible] = useState(false)
  const [networkName, setNetworkName] = useState("default")
  const [subnetworkName, setSubnetworkName] = useState("")
  const [networks, setNetworks] = useState([])
  const [subnetworks, setSubnetworks] = useState([])
  const [startupScript, setStartupScript] = useState("")
  const [sshMode, setSshMode] = useState("paste")
  const [sshKey,      setSshKey]      = useState("")
  const [sshUsername, setSshUsername] = useState("gcpuser")
  const [netTags,        setNetTags]        = useState("")
  const [firewallPorts,  setFirewallPorts]  = useState([])
  const [customPort,     setCustomPort]     = useState("")
  const [sourceRange,    setSourceRange]    = useState("0.0.0.0/0")
  const [labelEnv,    setLabelEnv]    = useState("dev")
  const [labelTeam,   setLabelTeam]   = useState("")
  const [labelProject,setLabelProject]= useState("")
  const [extraLabels, setExtraLabels] = useState("")
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState("")
  const [success,     setSuccess]     = useState(false)
  const [showCompare, setShowCompare] = useState(!!routerState?.prefill)


  // ── theme tokens ─────────────────────────────────────────────────────────
  const bg     = dark ? "#070c18" : "#f0f4f8"
  const surf   = dark ? "#0f172a" : "#ffffff"
  const border = dark ? "#1e293b" : "#e2e8f0"
  const txt    = dark ? "#f1f5f9" : "#0f172a"
  const muted  = dark ? "#475569" : "#64748b"
  const inp    = {
    width:"100%", boxSizing:"border-box", background:surf,
    border:`1px solid ${border}`, borderRadius:8,
    padding:"9px 12px", fontSize:13, color:txt, fontFamily:"inherit", outline:"none",
  }

  const activeCategory = GCP_CATEGORIES.find(c => c.id === categoryId) || GCP_CATEGORIES[0]

  const filteredTypes = useMemo(() => {
    const q = machSearch.trim().toLowerCase()
    const catFamilies = MACHINE_FAMILIES.filter(f => activeCategory.families.includes(f.id))
    if (!q) return catFamilies.flatMap(f =>
      f.types.map(t => ({ ...t, familyId: f.id, familyName: f.family }))
    )
    return catFamilies.flatMap(f =>
      f.types
        .filter(t =>
          t.name.toLowerCase().includes(q) ||
          f.family.toLowerCase().includes(q) ||
          f.label.toLowerCase().includes(q) ||
          getFamilyCategory(f.id).toLowerCase().includes(q)
        )
        .map(t => ({ ...t, familyId: f.id, familyName: f.family }))
    )
  }, [activeCategory, machSearch])

  const filteredImages = osFilter === "All" ? BOOT_IMAGES : BOOT_IMAGES.filter(i => i.os === osFilter)
  const filteredRegions = geoFilter === "All" ? GCP_REGIONS : GCP_REGIONS.filter(r => r.geo === geoFilter)

  const effectivePrice = preemptible ? machine.price * 0.3 : machine.price
  const diskCostMonth  = (diskType.price * diskGB).toFixed(2)
  const totalHr        = effectivePrice.toFixed(4)
  const totalMonth     = (effectivePrice * 730 + parseFloat(diskCostMonth)).toFixed(0)

  function buildLabels() {
    const base = { environment: labelEnv, managed_by: "aionos" }
    if (labelTeam)    base.team    = labelTeam
    if (labelProject) base.project = labelProject
    if (extraLabels.trim()) {
      extraLabels.split(",").forEach(pair => {
        const [k, v] = pair.split(":").map(s=>s.trim())
        if (k && v) base[k] = v
      })
    }
    return base
  }

  useEffect(() => {
    listGCPNetworks()
      .then(({ data }) => {
        const items = data.networks || []
        setNetworks(items)
        if (items.length && !items.some(n => n.name === networkName)) {
          setNetworkName(items[0].name)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    listGCPSubnetworks({ region: region.name, network: networkName })
      .then(({ data }) => {
        const items = data.subnetworks || []
        setSubnetworks(items)
        setSubnetworkName(items[0]?.self_link || "")
      })
      .catch(() => {
        setSubnetworks([])
        setSubnetworkName("")
      })
  }, [region, networkName])

  function _downloadPem(filename, content) {
    const blob = new Blob([content], { type: "text/plain" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleLaunch() {
    setSubmitting(true); setError("")
    const networkTags = [
      ...(allowHttp  ? ["http-server"]  : []),
      ...(allowHttps ? ["https-server"] : []),
      ...netTags.split(",").map(t => t.trim()).filter(Boolean),
    ]
    const name = instName || `instance-${Date.now()}`

    let sshMeta = sshMode === "paste" && sshKey.trim() ? sshKey.trim() : ""

    if (sshMode === "generate") {
      try {
        const { data } = await generateGCPSSHKey(name)
        _downloadPem(data.filename, data.private_key)
        sshMeta = data.public_key
      } catch (e) {
        setError(e.response?.data?.detail || "SSH key generation failed. Try pasting an existing public key.")
        setSubmitting(false)
        return
      }
    }

    try {
      await createRequest({
        resource_name:  name,
        resource_type:  "gcp_instance",
        cloud_provider: "gcp",
        region:         region.name,
        payload: {
          zone,
          machine_type:      machine.name,
          boot_image:        image.id,
          boot_disk_size:    diskGB,
          boot_disk_type:    diskType.id,
          assign_public_ip:  publicIP,
          network_tags:           networkTags,
          labels:                 buildLabels(),
          preemptible,
          network:                networkName || "default",
          subnetwork:             subnetworkName || "",
          startup_script:         startupScript.trim(),
          ssh_keys_metadata:      sshMeta,
          firewall_ports:         firewallPorts,
          firewall_source_range:  sourceRange || "0.0.0.0/0",
          tags:                   { environment: labelEnv },
        },
      })
      setSuccess(true)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to submit GCP instance request")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:bg }}>
      <div style={{ textAlign:"center", padding:48 }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#4285F4,#34A853)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style={{ fontSize:22, fontWeight:700, color:txt, marginBottom:8 }}>Request submitted for approval!</h2>
        <p style={{ color:muted, marginBottom:6, maxWidth:420, margin:"0 auto 6px" }}>
          <strong style={{ color:txt }}>{instName}</strong> in <strong style={{ color:txt }}>{zone}</strong> is pending admin approval.
        </p>
        <p style={{ color:muted, marginBottom:24, fontSize:13 }}>Once approved, Terraform will provision the instance automatically.</p>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <button onClick={() => navigate("/approvals")}
            style={{ padding:"10px 24px", borderRadius:10, background:"linear-gradient(135deg,#4285F4,#34A853)", border:"none", color:"#fff", fontWeight:600, fontSize:14, cursor:"pointer" }}>
            View Approvals
          </button>
          <button onClick={() => navigate("/gcp/compute")}
            style={{ padding:"10px 24px", borderRadius:10, background:"transparent", border:`1px solid ${border}`, color:txt, fontSize:14, cursor:"pointer" }}>
            View Instances
          </button>
          <button onClick={() => { setSuccess(false); setStep(0); setInstName("") }}
            style={{ padding:"10px 24px", borderRadius:10, background:"transparent", border:`1px solid ${border}`, color:txt, fontSize:14, cursor:"pointer" }}>
            Launch Another
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
    <div style={{ background:bg, minHeight:"100vh" }}>

      {/* ── Top bar ── */}
      <div style={{ background:surf, borderBottom:`1px solid ${border}`, padding:"14px 32px", display:"flex", alignItems:"center", gap:14 }}>
        <button onClick={() => navigate("/services")}
          style={{ background:"transparent", border:"none", cursor:"pointer", color:muted, display:"flex", alignItems:"center", gap:6, fontSize:13 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Services
        </button>
        <span style={{ color:muted }}>/</span>
        <span style={{ fontSize:13, fontWeight:600, color:"#4285F4" }}>Create Compute Engine Instance</span>
        <div style={{ marginLeft:"auto", fontSize:11, color:muted }}>
          Step {step+1} of {STEPS.length}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", maxWidth:1300, margin:"0 auto" }}>
        <div style={{ padding:32 }}>

          {/* ── Step bar ── */}
          <div style={{ display:"flex", gap:0, marginBottom:28, background:surf, borderRadius:12, border:`1px solid ${border}`, overflow:"hidden" }}>
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => i < step && setStep(i)} style={{
                flex:1, padding:"9px 2px", fontSize:10, fontWeight:600, textAlign:"center", border:"none",
                cursor: i < step ? "pointer" : "default",
                borderRight: i < STEPS.length-1 ? `1px solid ${border}` : "none",
                background: i===step ? "linear-gradient(135deg,#4285F4,#34A853)" : i<step ? "rgba(66,133,244,0.1)" : (dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)"),
                color: i===step ? "#fff" : i<step ? "#4285F4" : muted,
              }}>
                <div style={{ fontSize:9, opacity:0.7, marginBottom:2 }}>STEP {i+1}</div>
                {s}
              </button>
            ))}
          </div>

          {/* ────────────────────────────────────────────────────────────── */}
          {/* STEP 0 — Name & Region                                        */}
          {/* ────────────────────────────────────────────────────────────── */}
          {step===0 && (
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:txt, marginBottom:4 }}>Name & Region</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:24 }}>Give your instance a name and choose where it will run.</p>
              <div style={{ display:"grid", gap:18 }}>

                {/* Name */}
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:txt, marginBottom:6 }}>Instance Name *</label>
                  <input value={instName} onChange={e=>setInstName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}
                    placeholder="my-instance" style={inp} />
                  <div style={{ fontSize:11, color:muted, marginTop:4 }}>Lowercase letters, numbers, and hyphens only. Max 63 characters.</div>
                </div>

                {/* Region filter */}
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:txt, marginBottom:8 }}>Region</label>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                    {["All", ...GEO_GROUPS].map(g => (
                      <button key={g} onClick={() => setGeoFilter(g)} style={{
                        padding:"4px 12px", borderRadius:16, fontSize:11, fontWeight:600, cursor:"pointer",
                        background: geoFilter===g ? "#4285F4" : "transparent",
                        border: `1px solid ${geoFilter===g ? "#4285F4" : border}`,
                        color: geoFilter===g ? "#fff" : muted,
                      }}>{g}</button>
                    ))}
                  </div>
                  <select value={region.name} onChange={e => {
                    const r = GCP_REGIONS.find(x=>x.name===e.target.value)
                    setRegion(r); setZone(r.zones[0])
                  }} style={inp}>
                    {filteredRegions.map(r => (
                      <option key={r.name} value={r.name}>{r.display} — {r.name}</option>
                    ))}
                  </select>
                  <div style={{ fontSize:11, color:muted, marginTop:4 }}>{GCP_REGIONS.length} regions available globally</div>
                </div>

                {/* Zone */}
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:txt, marginBottom:6 }}>Zone</label>
                  <select value={zone} onChange={e=>setZone(e.target.value)} style={inp}>
                    {region.zones.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>

                {/* Preemptible */}
                <label style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"14px 16px", borderRadius:10, cursor:"pointer",
                  background: preemptible ? "rgba(66,133,244,0.06)" : "transparent",
                  border:`1px solid ${preemptible?"rgba(66,133,244,0.3)":border}` }}>
                  <input type="checkbox" checked={preemptible} onChange={e=>setPreemptible(e.target.checked)}
                    style={{ accentColor:"#4285F4", width:15, height:15, marginTop:2, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:txt }}>Spot / Preemptible VM</div>
                    <div style={{ fontSize:11, color:muted, marginTop:2 }}>~70% lower cost. GCP may stop the instance at any time. Not suitable for production databases or stateful workloads.</div>
                    {preemptible && <div style={{ fontSize:11, color:"#34A853", fontWeight:600, marginTop:4 }}>✓ Spot pricing active — est. ${(machine.price*0.3).toFixed(4)}/hr</div>}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* STEP 1 — Machine Type                                         */}
          {/* ────────────────────────────────────────────────────────────── */}
          {step===1 && (
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:txt, marginBottom:4 }}>Machine Type</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:16 }}>Choose a machine family and type. {MACHINE_FAMILIES.reduce((a,f)=>a+f.types.length,0)} types across {MACHINE_FAMILIES.length} families.</p>

              {/* Category tabs — styled like AWS EC2 */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                {GCP_CATEGORIES.map(cat => {
                  const catFams = MACHINE_FAMILIES.filter(f => cat.families.includes(f.id))
                  const matchCount = machSearch.trim()
                    ? catFams.flatMap(f => f.types).filter(t => {
                        const q = machSearch.toLowerCase()
                        return t.name.toLowerCase().includes(q) || t.ram.toLowerCase().includes(q)
                      }).length
                    : catFams.reduce((a, f) => a + f.types.length, 0)
                  return (
                    <button key={cat.id} onClick={() => { setCategoryId(cat.id); setMachSearch("") }} style={{
                      padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                      background: categoryId === cat.id ? cat.color : "transparent",
                      border: `1px solid ${categoryId === cat.id ? cat.color : border}`,
                      color: categoryId === cat.id ? "#fff" : muted,
                      display:"flex", alignItems:"center", gap:5, transition:"all 0.15s",
                    }}>
                      {cat.label}
                      {machSearch.trim() && (
                        <span style={{ fontSize:9, padding:"1px 5px", borderRadius:8,
                          background: categoryId === cat.id ? "rgba(255,255,255,0.25)" : border,
                          color: categoryId === cat.id ? "#fff" : muted }}>
                          {matchCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div style={{ fontSize:12, color:muted, marginBottom:12, padding:"7px 12px", borderRadius:7,
                background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                borderLeft:`3px solid ${activeCategory.color}` }}>
                {activeCategory.desc}
              </div>

              {/* Search */}
              <input value={machSearch} onChange={e=>setMachSearch(e.target.value)}
                placeholder="Search by series, category, or machine type..." style={{ ...inp, marginBottom:10 }} />

              {/* Table */}
              <div style={{ background:surf, borderRadius:12, border:`1px solid ${border}`, overflow:"hidden", maxHeight:440, overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead style={{ position:"sticky", top:0, zIndex:1 }}>
                    <tr style={{ background: dark ? "#0f172a" : "#f8fafc" }}>
                      {["","Series / Category","Type","vCPU","Memory","Price/hr",""].map((h,i) => (
                        <th key={i} style={{ padding:"8px 12px", fontSize:10, fontWeight:700, color:muted, textAlign:"left", borderBottom:`1px solid ${border}`, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTypes.map(t => (
                      <tr key={`${t.familyId}-${t.name}`} onClick={() => setMachine(t)} style={{
                        cursor:"pointer",
                        background: machine.name===t.name ? "rgba(66,133,244,0.1)" : "transparent",
                        transition:"background 0.1s",
                      }}>
                        <td style={{ padding:"8px 12px", borderBottom:`1px solid ${border}`, width:28 }}>
                          <div style={{ width:14, height:14, borderRadius:"50%", border:`2px solid ${machine.name===t.name?"#4285F4":border}`,
                            background: machine.name===t.name ? "#4285F4" : "transparent",
                            display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {machine.name===t.name && <div style={{ width:5, height:5, borderRadius:"50%", background:"#fff" }} />}
                          </div>
                        </td>
                        <td style={{ padding:"8px 12px", borderBottom:`1px solid ${border}` }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"#4285F4" }}>{t.familyName}</div>
                          <div style={{ fontSize:10, color:muted }}>{getFamilyCategory(t.familyId)}</div>
                        </td>
                        <td style={{ padding:"8px 12px", borderBottom:`1px solid ${border}` }}>
                          <div style={{ fontSize:12, fontWeight:600, color:txt, fontFamily:"monospace" }}>{t.name}</div>
                          <div style={{ display:"flex", gap:5, marginTop:2 }}>
                            {t.recommended && <span style={{ fontSize:9, fontWeight:700, color:"#4285F4", background:"rgba(66,133,244,0.1)", padding:"1px 5px", borderRadius:3 }}>RECOMMENDED</span>}
                            {t.shared && <span style={{ fontSize:9, color:muted, background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)", padding:"1px 5px", borderRadius:3 }}>SHARED</span>}
                            {t.gpu && <span style={{ fontSize:9, color:"#f43f5e", background:"rgba(244,63,94,0.1)", padding:"1px 5px", borderRadius:3 }}>{t.gpu}</span>}
                          </div>
                        </td>
                        <td style={{ padding:"8px 12px", fontSize:12, color:txt, borderBottom:`1px solid ${border}`, whiteSpace:"nowrap" }}>{t.vcpu}</td>
                        <td style={{ padding:"8px 12px", fontSize:12, color:txt, borderBottom:`1px solid ${border}`, whiteSpace:"nowrap" }}>{t.ram}</td>
                        <td style={{ padding:"8px 12px", borderBottom:`1px solid ${border}`, whiteSpace:"nowrap" }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"#4285F4" }}>${t.price.toFixed(4)}</div>
                          {preemptible && <div style={{ fontSize:10, color:"#34A853" }}>↓ ${(t.price*0.3).toFixed(4)}</div>}
                        </td>
                        <td style={{ padding:"8px 12px", borderBottom:`1px solid ${border}`, whiteSpace:"nowrap", fontSize:11, color:muted }}>
                          ~${(t.price*730).toFixed(0)}/mo
                        </td>
                      </tr>
                    ))}
                    {filteredTypes.length === 0 && (
                      <tr><td colSpan={7} style={{ padding:24, textAlign:"center", color:muted, fontSize:13 }}>No types match "{machSearch}"</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:8, fontSize:11, color:muted }}>
                Showing {filteredTypes.length} {machSearch.trim() ? `matching types in ${activeCategory.label}` : `${activeCategory.label} types`}
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* STEP 2 — Boot Image                                           */}
          {/* ────────────────────────────────────────────────────────────── */}
          {step===2 && (
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:txt, marginBottom:4 }}>Boot Disk Image</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:16 }}>Choose the operating system. {BOOT_IMAGES.length} images available.</p>

              <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                {["All","Linux","Windows"].map(f => (
                  <button key={f} onClick={() => setOsFilter(f)} style={{
                    padding:"4px 14px", borderRadius:16, fontSize:11, fontWeight:600, cursor:"pointer",
                    background: osFilter===f ? "#4285F4" : "transparent",
                    border: `1px solid ${osFilter===f ? "#4285F4" : border}`,
                    color: osFilter===f ? "#fff" : muted,
                  }}>{f}</button>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {filteredImages.map(img => (
                  <button key={img.id} onClick={() => setImage(img)} style={{
                    padding:14, borderRadius:12, cursor:"pointer", textAlign:"left", border:"none",
                    background: image.id===img.id ? "rgba(66,133,244,0.1)" : surf,
                    outline: image.id===img.id ? "2px solid #4285F4" : `1px solid ${border}`,
                    transition:"all 0.15s",
                  }}>
                    <div style={{ fontSize:20, marginBottom:6 }}>{img.icon}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:txt, marginBottom:2 }}>{img.name}</div>
                    <div style={{ fontSize:10, color:muted }}>{img.arch}</div>
                    {img.note && <div style={{ fontSize:10, color: img.os==="Windows" ? "#0078D4" : "#4285F4", marginTop:3, fontWeight:500 }}>{img.note}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* STEP 3 — Storage & Networking                                 */}
          {/* ────────────────────────────────────────────────────────────── */}
          {step===3 && (
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:txt, marginBottom:4 }}>Storage & Networking</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:20 }}>Configure boot disk and network access rules.</p>
              <div style={{ display:"grid", gap:16 }}>

                {/* Disk type */}
                <div style={{ background:surf, borderRadius:12, border:`1px solid ${border}`, padding:18 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:txt, marginBottom:12 }}>Boot Disk Type</div>
                  {DISK_TYPES.map(dt => (
                    <label key={dt.id} style={{ display:"flex", gap:12, alignItems:"center", padding:"9px 12px", borderRadius:8,
                      marginBottom:6, cursor:"pointer",
                      background: diskType.id===dt.id ? "rgba(66,133,244,0.08)" : "transparent",
                      border: diskType.id===dt.id ? "1px solid rgba(66,133,244,0.3)" : `1px solid ${border}` }}>
                      <input type="radio" checked={diskType.id===dt.id} onChange={()=>setDiskType(dt)} style={{ accentColor:"#4285F4" }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:txt }}>{dt.name}</div>
                        <div style={{ fontSize:11, color:muted }}>{dt.desc}</div>
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#4285F4", whiteSpace:"nowrap" }}>${dt.price}/GB/mo</div>
                    </label>
                  ))}
                  <div style={{ marginTop:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:txt }}>Disk Size</label>
                      <span style={{ fontSize:13, fontWeight:700, color:"#4285F4" }}>{diskGB} GB — ${diskCostMonth}/mo</span>
                    </div>
                    <input type="range" min={10} max={65536} step={10} value={diskGB}
                      onChange={e=>setDiskGB(+e.target.value)}
                      style={{ width:"100%", accentColor:"#4285F4" }} />
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:muted, marginTop:4 }}>
                      <span>10 GB</span><span>65,536 GB (64 TB max)</span>
                    </div>
                    <input type="number" min={10} max={65536} value={diskGB} onChange={e=>setDiskGB(Math.min(65536,Math.max(10,+e.target.value)))}
                      style={{ ...inp, marginTop:8, width:120 }} />
                  </div>
                </div>

                {/* Networking */}
                <div style={{ background:surf, borderRadius:12, border:`1px solid ${border}`, padding:18 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:txt, marginBottom:14 }}>Firewall & Network Access</div>

                  {/* VPC + Subnet */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                        <label style={{ fontSize:12, fontWeight:600, color:txt }}>VPC Network</label>
                        <button type="button" onClick={() => window.open("/gcp/network/create","_blank")}
                          style={{ fontSize:11, color:"#4285F4", background:"transparent", border:"none", cursor:"pointer", padding:0 }}>
                          + Create VPC
                        </button>
                      </div>
                      <select value={networkName} onChange={e=>setNetworkName(e.target.value)} style={inp}>
                        {networks.length === 0 && <option value="default">default</option>}
                        {networks.map(net => <option key={net.name} value={net.name}>{net.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display:"block", fontSize:12, fontWeight:600, color:txt, marginBottom:6 }}>Subnet</label>
                      <select value={subnetworkName} onChange={e=>setSubnetworkName(e.target.value)} style={inp}>
                        <option value="">Auto / default</option>
                        {subnetworks.map(subnet => (
                          <option key={subnet.self_link} value={subnet.self_link}>{subnet.name} ({subnet.region})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Public IP + HTTP/HTTPS toggles */}
                  {[
                    { val:publicIP,   set:setPublicIP,   label:"Assign external (public) IP",  desc:"Required for direct internet / SSH access from outside GCP" },
                    { val:allowHttp,  set:setAllowHttp,  label:"Allow HTTP — port 80",          desc:"Adds the http-server network tag (GCP default firewall rule)" },
                    { val:allowHttps, set:setAllowHttps, label:"Allow HTTPS — port 443",        desc:"Adds the https-server network tag (GCP default firewall rule)" },
                  ].map(rule => (
                    <label key={rule.label} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"9px 0",
                      borderBottom:`1px solid ${border}`, cursor:"pointer" }}>
                      <input type="checkbox" checked={rule.val} onChange={e=>rule.set(e.target.checked)}
                        style={{ accentColor:"#4285F4", width:15, height:15, marginTop:2, flexShrink:0 }} />
                      <div>
                        <div style={{ fontSize:12, fontWeight:500, color:txt }}>{rule.label}</div>
                        <div style={{ fontSize:11, color:muted }}>{rule.desc}</div>
                      </div>
                    </label>
                  ))}

                  {/* Custom firewall ports */}
                  <div style={{ marginTop:16 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:txt, marginBottom:10 }}>
                      Firewall Rules
                      <span style={{ fontSize:11, fontWeight:400, color:muted, marginLeft:6 }}>
                        — Terraform will create a firewall rule for the selected ports
                      </span>
                    </div>

                    {/* Preset port buttons */}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                      {[
                        { port:"22",    label:"SSH",        color:"#34A853" },
                        { port:"3389",  label:"RDP",        color:"#4285F4" },
                        { port:"3306",  label:"MySQL",       color:"#f59e0b" },
                        { port:"5432",  label:"PostgreSQL",  color:"#6366f1" },
                        { port:"6379",  label:"Redis",       color:"#ef4444" },
                        { port:"27017", label:"MongoDB",     color:"#34A853" },
                        { port:"8080",  label:"HTTP Alt",    color:"#00d4aa" },
                        { port:"8443",  label:"HTTPS Alt",   color:"#a78bfa" },
                        { port:"9200",  label:"Elasticsearch",color:"#f59e0b"},
                      ].map(p => {
                        const active = firewallPorts.includes(p.port)
                        return (
                          <button key={p.port} type="button"
                            onClick={() => setFirewallPorts(prev => active ? prev.filter(x=>x!==p.port) : [...prev, p.port])}
                            style={{ padding:"5px 11px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
                              border:`1px solid ${active ? p.color : border}`,
                              background: active ? `${p.color}18` : "transparent",
                              color: active ? p.color : muted }}>
                            {active ? "✓ " : ""}{p.label} :{p.port}
                          </button>
                        )
                      })}
                    </div>

                    {/* Custom port entry */}
                    <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                      <input
                        value={customPort}
                        onChange={e => setCustomPort(e.target.value.replace(/[^0-9,-]/g,""))}
                        placeholder="Custom port, e.g. 9000 or 9000-9010"
                        style={{ ...inp, flex:1, fontSize:12 }}
                        onKeyDown={e => {
                          if (e.key==="Enter" && customPort.trim()) {
                            setFirewallPorts(prev => [...new Set([...prev, customPort.trim()])])
                            setCustomPort("")
                          }
                        }}
                      />
                      <button type="button"
                        onClick={() => { if(customPort.trim()){ setFirewallPorts(prev=>[...new Set([...prev,customPort.trim()])]); setCustomPort("") }}}
                        style={{ padding:"0 14px", borderRadius:8, border:`1px solid rgba(66,133,244,0.4)`,
                          background:"rgba(66,133,244,0.1)", color:"#4285F4", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                        + Add Port
                      </button>
                    </div>

                    {/* Active ports chips */}
                    {firewallPorts.length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                        {firewallPorts.map(p => (
                          <span key={p} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px",
                            borderRadius:20, background:"rgba(66,133,244,0.12)", border:"1px solid rgba(66,133,244,0.3)",
                            fontSize:11, fontWeight:600, color:"#4285F4" }}>
                            :{p}
                            <button type="button" onClick={() => setFirewallPorts(prev=>prev.filter(x=>x!==p))}
                              style={{ background:"transparent", border:"none", color:"#4285F4", cursor:"pointer", padding:0, lineHeight:1, fontSize:13 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Source IP range */}
                    {firewallPorts.length > 0 && (
                      <div>
                        <label style={{ display:"block", fontSize:12, fontWeight:600, color:txt, marginBottom:5 }}>
                          Source IP Range
                          <span style={{ fontWeight:400, color:muted, marginLeft:4 }}>(who can access these ports)</span>
                        </label>
                        <input value={sourceRange} onChange={e=>setSourceRange(e.target.value)}
                          placeholder="0.0.0.0/0 (all) or e.g. 10.0.0.0/8"
                          style={{ ...inp, fontSize:12 }} />
                        <div style={{ fontSize:11, color:muted, marginTop:4 }}>
                          Use <code style={{ fontSize:11 }}>0.0.0.0/0</code> to allow all, or restrict to your office IP / VPN CIDR for security.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Additional network tags */}
                  <div style={{ marginTop:14 }}>
                    <label style={{ display:"block", fontSize:12, fontWeight:600, color:txt, marginBottom:6 }}>
                      Additional Network Tags <span style={{ color:muted, fontWeight:400 }}>(optional, comma-separated)</span>
                    </label>
                    <input value={netTags} onChange={e=>setNetTags(e.target.value)}
                      placeholder="allow-internal, allow-monitoring" style={inp} />
                    <div style={{ fontSize:11, color:muted, marginTop:4 }}>Apply existing GCP firewall rules via tags.</div>
                  </div>
                  <div style={{ marginTop:12 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:txt }}>
                        Startup Script <span style={{ color:muted, fontWeight:400 }}>(optional)</span>
                      </label>
                      <StartupScriptPicker dark={dark} onSelect={s => setStartupScript(s)} />
                    </div>
                    <textarea
                      value={startupScript}
                      onChange={e=>setStartupScript(e.target.value)}
                      rows={8}
                      placeholder={"#!/bin/bash\napt-get update\napt-get install -y nginx"}
                      style={{ ...inp, resize:"vertical", fontFamily:"monospace", fontSize:11, lineHeight:1.5 }}
                    />
                    <div style={{ fontSize:11, color:muted, marginTop:4 }}>Runs automatically on first boot. Use <strong>Script Templates</strong> above to pick a pre-built script.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* STEP 4 — Labels & SSH                                         */}
          {/* ────────────────────────────────────────────────────────────── */}
          {step===4 && (
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:txt, marginBottom:4 }}>Labels & SSH Key</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:20 }}>Organise resources with labels and either paste a public key or generate one for auto-download.</p>
              <div style={{ display:"grid", gap:16 }}>

                {/* Labels */}
                <div style={{ background:surf, borderRadius:12, border:`1px solid ${border}`, padding:18 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:txt, marginBottom:14 }}>Resource Labels</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={{ display:"block", fontSize:11, fontWeight:600, color:muted, marginBottom:5 }}>environment</label>
                      <select value={labelEnv} onChange={e=>setLabelEnv(e.target.value)} style={inp}>
                        {["dev","staging","prod","test","sandbox"].map(v=><option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display:"block", fontSize:11, fontWeight:600, color:muted, marginBottom:5 }}>team</label>
                      <input value={labelTeam} onChange={e=>setLabelTeam(e.target.value)} placeholder="platform, data, frontend…" style={inp} />
                    </div>
                    <div>
                      <label style={{ display:"block", fontSize:11, fontWeight:600, color:muted, marginBottom:5 }}>project</label>
                      <input value={labelProject} onChange={e=>setLabelProject(e.target.value)} placeholder="project name" style={inp} />
                    </div>
                    <div>
                      <label style={{ display:"block", fontSize:11, fontWeight:600, color:muted, marginBottom:5 }}>managed_by</label>
                      <input value="aionos" disabled style={{ ...inp, opacity:0.5, cursor:"not-allowed" }} />
                    </div>
                  </div>
                  <div style={{ marginTop:12 }}>
                    <label style={{ display:"block", fontSize:11, fontWeight:600, color:muted, marginBottom:5 }}>
                      Additional Labels <span style={{ fontWeight:400 }}>(key:value, comma-separated)</span>
                    </label>
                    <input value={extraLabels} onChange={e=>setExtraLabels(e.target.value)}
                      placeholder="cost-center:12345, app:nginx" style={inp} />
                  </div>
                </div>

                {/* SSH key */}
                <div style={{ background:surf, borderRadius:12, border:`1px solid ${border}`, padding:18 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:txt, marginBottom:10 }}>SSH Access</div>
                  <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
                    {[
                      ["paste", "Use existing public key"],
                      ["generate", "Generate new key pair"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setSshMode(value)}
                        style={{
                          padding:"7px 12px",
                          borderRadius:999,
                          cursor:"pointer",
                          border:`1px solid ${sshMode===value ? "#4285F4" : border}`,
                          background:sshMode===value ? "rgba(66,133,244,0.10)" : "transparent",
                          color:sshMode===value ? "#4285F4" : txt,
                          fontSize:12,
                          fontWeight:600,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <label style={{ display:"block", fontSize:11, fontWeight:600, color:muted, marginBottom:5 }}>SSH username</label>
                    <input value={sshUsername} onChange={e=>setSshUsername(e.target.value)} placeholder="gcpuser" style={inp} />
                  </div>
                  {sshMode === "paste" ? (
                    <>
                      <div style={{ fontSize:11, color:muted, marginBottom:10 }}>
                        Format: <code style={{ background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)", padding:"1px 5px", borderRadius:4, fontSize:11 }}>username:ssh-rsa AAAA... user@host</code>
                      </div>
                      <textarea value={sshKey} onChange={e=>setSshKey(e.target.value)}
                        rows={4} placeholder="akram:ssh-rsa AAAAB3NzaC1yc2EAAAA... akram@laptop"
                        style={{ ...inp, resize:"vertical", fontFamily:"monospace", fontSize:11, lineHeight:1.5 }} />
                      <div style={{ fontSize:11, color:muted, marginTop:6 }}>
                        Leave blank to use OS Login or project-level SSH keys.
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize:11, color:muted, lineHeight:1.6 }}>
                      A new RSA key pair will be created during launch. The private key will auto-download in your browser after the create request is accepted.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* STEP 5 — Review                                               */}
          {/* ────────────────────────────────────────────────────────────── */}
          {step===5 && (
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:txt, marginBottom:4 }}>Review & Launch</h2>
              <p style={{ fontSize:13, color:muted, marginBottom:20 }}>Verify your configuration before creating the instance.</p>

              {[
                { section:"Identity",  rows:[
                  { l:"Instance Name", v: instName || "(auto-generated)" },
                  { l:"Zone",          v: zone },
                ]},
                { section:"Machine",   rows:[
                  { l:"Family",        v: `${MACHINE_FAMILIES.find(f=>f.id===machine.familyId)?.family ?? activeCategory.label} (${activeCategory.label})` },
                  { l:"Type",          v: machine.name },
                  { l:"vCPU",          v: machine.vcpu + (machine.shared ? " (shared)" : "") },
                  { l:"Memory",        v: machine.ram },
                  { l:"Pricing",       v: preemptible ? "Spot (preemptible)" : "On-demand" },
                  ...(machine.gpu ? [{ l:"GPU", v: machine.gpu }] : []),
                ]},
                { section:"Boot Disk", rows:[
                  { l:"Image",         v: image.name },
                  { l:"Disk Type",     v: diskType.name },
                  { l:"Disk Size",     v: `${diskGB} GB` },
                ]},
                { section:"Network",   rows:[
                  { l:"VPC",           v: networkName || "default" },
                  { l:"Subnet",        v: subnetworks.find(s => s.self_link === subnetworkName)?.name || "Auto / default" },
                  { l:"External IP",   v: publicIP ? "Enabled" : "Disabled" },
                  { l:"HTTP (80)",     v: allowHttp ? "Allowed" : "Blocked" },
                  { l:"HTTPS (443)",   v: allowHttps ? "Allowed" : "Blocked" },
                  ...(netTags ? [{ l:"Network Tags", v: netTags }] : []),
                  ...(startupScript.trim() ? [{ l:"User Script", v: "Configured" }] : []),
                ]},
                { section:"Labels",    rows: Object.entries(buildLabels()).map(([k,v])=>({ l:k, v })) },
                { section:"SSH", rows:[
                  { l:"Mode", v: sshMode === "generate" ? "Generate and download key pair" : "Use existing public key" },
                  { l:"Username", v: sshUsername || "gcpuser" },
                ]},
              ].map(sec => (
                <div key={sec.section} style={{ marginBottom:16, background:surf, borderRadius:12, border:`1px solid ${border}`, overflow:"hidden" }}>
                  <div style={{ padding:"8px 16px", fontSize:11, fontWeight:700, letterSpacing:"0.06em", color:muted,
                    textTransform:"uppercase", background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)",
                    borderBottom:`1px solid ${border}` }}>
                    {sec.section}
                  </div>
                  {sec.rows.map(r => (
                    <div key={r.l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 16px", borderBottom:`1px solid ${border}` }}>
                      <span style={{ fontSize:12, color:muted }}>{r.l}</span>
                      <span style={{ fontSize:12, color:txt, fontWeight:500, textAlign:"right", maxWidth:"55%", wordBreak:"break-all" }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              ))}

              {error && (
                <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", color:"#fca5a5", fontSize:13, marginTop:4 }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:28 }}>
            <button onClick={() => step===0 ? navigate(-1) : setStep(s=>s-1)}
              style={{ padding:"10px 24px", borderRadius:10, background:"transparent", border:`1px solid ${border}`, color:txt, fontSize:14, cursor:"pointer" }}>
              {step===0 ? "Cancel" : "← Previous"}
            </button>
            {step < STEPS.length-1 ? (
              <button onClick={() => setStep(s=>s+1)} disabled={step===0 && !instName.trim()}
                style={{ padding:"10px 28px", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer",
                  border:"none", color:"#fff",
                  background:(step===0&&!instName.trim())?"rgba(66,133,244,0.35)":"linear-gradient(135deg,#4285F4,#34A853)",
                  boxShadow: (step===0&&!instName.trim()) ? "none" : "0 4px 12px rgba(66,133,244,0.35)" }}>
                Next →
              </button>
            ) : (
              <button onClick={handleLaunch} disabled={submitting}
                style={{ padding:"10px 32px", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer",
                  border:"none", color:"#fff",
                  background:"linear-gradient(135deg,#4285F4,#34A853)",
                  boxShadow:"0 4px 16px rgba(66,133,244,0.4)", opacity:submitting?0.7:1 }}>
                {submitting ? "Creating…" : "🚀 Create Instance"}
              </button>
            )}
          </div>
        </div>

        {/* ── Right panel — cost estimate ── */}
        <div style={{ background:surf, borderLeft:`1px solid ${border}`, padding:22, position:"sticky",
          top:0, height:"100vh", overflowY:"auto", boxSizing:"border-box" }}>
          <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:14 }}>Cost Estimate</div>
          <div style={{ display:"inline-block", fontSize:10, padding:"3px 10px", borderRadius:20,
            background:"rgba(66,133,244,0.1)", border:"1px solid rgba(66,133,244,0.3)",
            color:"#4285F4", fontWeight:700, marginBottom:16 }}>
            GCP — {preemptible ? "Spot" : "On-Demand"} — {region.display.split(",")[1]?.trim() || region.display.split(",")[0]}
          </div>

          {[
            { l:"Zone",     v: zone },
            { l:"Machine",  v: machine.name },
            { l:"vCPU",     v: machine.vcpu },
            { l:"Memory",   v: machine.ram },
            { l:"Image",    v: image.name.split(" ").slice(0,3).join(" ") },
            { l:"Disk",     v: `${diskGB} GB ${diskType.id}` },
          ].map(r => (
            <div key={r.l} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
              <span style={{ color:muted }}>{r.l}</span>
              <span style={{ color:txt, fontWeight:500, textAlign:"right", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.v}</span>
            </div>
          ))}

          <div style={{ height:1, background:border, margin:"14px 0" }} />

          <div style={{ display:"grid", gap:8, marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:muted }}>Compute</span>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:600, color:txt }}>${totalHr}/hr</div>
                <div style={{ fontSize:10, color:muted }}>${(effectivePrice*730).toFixed(2)}/mo</div>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:muted }}>Persistent Disk</span>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:600, color:txt }}>${diskCostMonth}/mo</div>
                <div style={{ fontSize:10, color:muted }}>{diskGB} GB × ${diskType.price}/GB</div>
              </div>
            </div>
          </div>

          <div style={{ height:1, background:border, marginBottom:14 }} />

          <div style={{ background:"rgba(66,133,244,0.06)", border:"1px solid rgba(66,133,244,0.2)", borderRadius:10, padding:16 }}>
            <div style={{ fontSize:11, color:muted, marginBottom:4 }}>Estimated total</div>
            <div style={{ fontSize:26, fontWeight:800, color:"#4285F4" }}>${totalHr}<span style={{ fontSize:13, fontWeight:400 }}>/hr</span></div>
            <div style={{ fontSize:13, fontWeight:600, color:txt, marginTop:4 }}>~${totalMonth}/month</div>
          </div>

          {preemptible && (
            <div style={{ marginTop:10, padding:"8px 12px", borderRadius:8, background:"rgba(52,168,83,0.1)", border:"1px solid rgba(52,168,83,0.25)", fontSize:11, color:"#34A853", fontWeight:600 }}>
              ✓ Spot pricing — ~70% vs on-demand
            </div>
          )}

          {machine.gpu && (
            <div style={{ marginTop:10, padding:"8px 12px", borderRadius:8, background:"rgba(244,63,94,0.08)", border:"1px solid rgba(244,63,94,0.2)", fontSize:11, color:"#f43f5e" }}>
              GPU: {machine.gpu}
            </div>
          )}

          <div style={{ fontSize:10, color:muted, marginTop:12, lineHeight:1.6 }}>
            On-demand pricing for selected region. Committed-use discounts (1yr/3yr) save up to 57%. Spot VMs may be reclaimed at any time.
          </div>

          {/* Compare across clouds */}
          <button
            onClick={() => setShowCompare(true)}
            style={{
              marginTop:14, width:"100%", padding:"10px 0", borderRadius:10, fontSize:12, fontWeight:700,
              cursor:"pointer", border:"1px solid rgba(102,126,234,0.4)",
              background:"linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1))",
              color:"#a78bfa", display:"flex", alignItems:"center", justifyContent:"center", gap:7,
              transition:"all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(102,126,234,0.2),rgba(118,75,162,0.2))"; e.currentTarget.style.borderColor = "rgba(102,126,234,0.7)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1))"; e.currentTarget.style.borderColor = "rgba(102,126,234,0.4)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            Compare Cloud Prices
          </button>
        </div>
      </div>
    </div>

    <CrossCloudPricing
      isOpen={showCompare}
      onClose={() => setShowCompare(false)}
      currentCloud="gcp"
      vcpu={parseFloat(machine.vcpu)}
      ramGb={parseFloat(machine.ram)}
      dark={dark}
    />
    </>
  )
}
