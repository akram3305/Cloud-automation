import { useState } from "react"
import { createPortal } from "react-dom"

// ── Guide data ────────────────────────────────────────────────────────────────
const GUIDES = {
  "aws/ec2": {
    title: "How to Create an EC2 Instance",
    subtitle: "AWS Compute — 6 steps, takes about 2 minutes",
    badge: "EC2",
    badgeBg: "linear-gradient(135deg,#FF9900,#FFB347)",
    accent: "#FF9900",
    prereqs: {
      items: [
        { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"AWS credentials configured", desc:"AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY set in backend .env file" },
        { icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label:"VPC and Security Group", desc:"Default VPC is fine for dev. For prod, configure a custom VPC with proper security groups." },
        { icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label:"IAM instance profile (optional)", desc:"Required if your EC2 instance needs to access S3, DynamoDB, or other AWS services." },
        { icon:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", label:"Admin or Operator role", desc:"Only admins and operators can submit VM requests. Viewers can only observe." },
      ],
      note: { color:"#FF9900", label:"Minimum IAM permission:", text:"ec2:RunInstances · ec2:DescribeInstances · ec2:TerminateInstances" }
    },
    steps: [
      { num:1, title:"Choose AMI", color:"#FF9900", icon:"M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
        fields:[
          { name:"Amazon Machine Image (AMI)", desc:"Ubuntu 22.04 LTS recommended for general use. Amazon Linux 2023 for AWS-native workloads. Windows Server 2022 for .NET applications." },
          { name:"Architecture", desc:"x86_64 (amd64) for most workloads. arm64 (Graviton) for 20% cost savings on compatible apps." },
        ]},
      { num:2, title:"Instance Type", color:"#f59e0b", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
        fields:[
          { name:"vCPU / RAM combination", desc:"t3.medium (2 vCPU, 4 GiB) for dev/test. t3.large (2 vCPU, 8 GiB) for small services. m5.xlarge (4 vCPU, 16 GiB) for production." },
          { name:"Instance family", desc:"t3/t4g = burstable dev workloads. m5/m6i = general purpose production. c5/c6i = compute-intensive. r5/r6i = memory-intensive databases." },
        ]},
      { num:3, title:"Network", color:"#3b82f6", icon:"M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
        fields:[
          { name:"VPC", desc:"Select the VPC where this instance will live. Default VPC is fine for testing. Use a custom VPC for production workloads." },
          { name:"Subnet", desc:"Public subnet for internet-facing services. Private subnet (with NAT) for backend services." },
          { name:"Security Group", desc:"Controls inbound and outbound traffic. Ensure port 22 (SSH) or 3389 (RDP) is open from your IP." },
          { name:"Public IP", desc:"Enable for instances that need direct internet access. Disable for private backend services." },
        ]},
      { num:4, title:"Storage", color:"#a78bfa", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
        fields:[
          { name:"EBS Volume Type", desc:"gp3 recommended (best cost/performance ratio). io2 for high-IOPS databases. st1 for sequential big-data workloads." },
          { name:"Volume Size", desc:"Minimum 8 GB for most AMIs. Recommended 20+ GB for OS + application data. Scale up as needed." },
          { name:"Encryption", desc:"Enable at-rest encryption for compliance. Uses AWS KMS. Mandatory for production workloads." },
        ]},
      { num:5, title:"Tags", color:"#34A853", icon:"M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z",
        fields:[
          { name:"Environment", desc:"dev / staging / prod — used for cost allocation and resource filtering." },
          { name:"Project", desc:"Project or team name. Used in cost reports to track spend by team." },
          { name:"Owner", desc:"Your name or email. Helps identify who requested the resource." },
        ]},
      { num:6, title:"Review & Submit", color:"#22c55e", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        fields:[
          { name:"Review all settings", desc:"Check AMI, instance type, network, and storage before submitting." },
          { name:"Submit for Approval", desc:"Request is saved as 'pending'. Nothing is provisioned yet." },
          { name:"Admin approves", desc:"An admin reviews the request in the Approvals page and approves it." },
          { name:"Terraform provisions", desc:"Backend generates workspace → terraform init → plan → apply on AWS." },
          { name:"Instance is live", desc:"Status changes to 'running'. Instance ID appears in the Compute page." },
        ]},
    ],
    scheduling: true,
    management: [
      { name:"Start / Stop", desc:"Use the Start and Stop buttons on the Compute page. Stopped instances don't accrue compute charges but EBS storage still costs." },
      { name:"Terminate", desc:"Permanently deletes the instance and destroys the Terraform workspace. Use only when done — this is irreversible." },
      { name:"Auto-scheduling", desc:"Click the Schedule button on any instance to set auto_start and auto_stop times. The platform scheduler checks every 60 seconds." },
    ]
  },

  "aws/eks": {
    title: "How to Create an EKS Cluster",
    subtitle: "AWS Kubernetes — 5 steps, takes about 2 minutes to submit",
    badge: "EKS",
    badgeBg: "linear-gradient(135deg,#FF9900,#FFB347)",
    accent: "#FF9900",
    prereqs: {
      items: [
        { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"AWS credentials with EKS permissions", desc:"eks:CreateCluster, eks:DescribeCluster, iam:PassRole, ec2:DescribeSubnets" },
        { icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label:"VPC with at least 2 subnets in different AZs", desc:"EKS requires multi-AZ subnets for high availability. Private subnets recommended for nodes." },
        { icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label:"EKS IAM roles", desc:"Cluster role (AmazonEKSClusterPolicy) and Node role (AmazonEKSWorkerNodePolicy). Use Setup Roles button if missing." },
        { icon:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", label:"Admin or Operator role", desc:"Only admins and operators can submit EKS cluster requests." },
      ],
      note: { color:"#FF9900", label:"Cluster takes:", text:"10–15 minutes to create after Terraform apply. Node groups add another 3–5 minutes." }
    },
    steps: [
      { num:1, title:"Cluster Name & Region", color:"#FF9900", icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
        fields:[
          { name:"Cluster Name", desc:"Lowercase letters, numbers, hyphens only (e.g. my-cluster). Used as the EKS cluster name in AWS Console." },
          { name:"Region", desc:"Choose the AWS region closest to your workloads. ap-south-1 for India. us-east-1 for US East. eu-west-1 for Europe." },
        ]},
      { num:2, title:"Kubernetes Version", color:"#f59e0b", icon:"M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
        fields:[
          { name:"Kubernetes version", desc:"Use the latest stable version (1.35 as of 2026) unless you need a specific version for compatibility with existing workloads." },
          { name:"Version support", desc:"AWS supports each minor K8s version for ~14 months. After end-of-life, clusters must be upgraded." },
        ]},
      { num:3, title:"IAM Roles", color:"#3b82f6", icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
        fields:[
          { name:"Cluster IAM Role", desc:"Allows EKS control plane to make AWS API calls. Must have AmazonEKSClusterPolicy attached." },
          { name:"Node IAM Role", desc:"Allows worker nodes to join the cluster and pull ECR images. Must have AmazonEKSWorkerNodePolicy and AmazonEKS_CNI_Policy." },
          { name:"Setup Roles button", desc:"If no eligible roles are found, click Setup Roles to auto-create both roles with correct policies." },
        ]},
      { num:4, title:"VPC & Subnets", color:"#a78bfa", icon:"M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
        fields:[
          { name:"Subnets", desc:"Select at least 2 subnets in different Availability Zones for high availability. EKS will spread nodes across these AZs." },
          { name:"Public vs Private", desc:"Public subnets for internet-facing load balancers. Private subnets for worker nodes (recommended). Both if using mixed topology." },
        ]},
      { num:5, title:"Node Group", color:"#34A853", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
        fields:[
          { name:"Instance type", desc:"t3.medium (2 vCPU, 4 GiB) for dev. m5.xlarge (4 vCPU, 16 GiB) for production. c5.xlarge for compute-heavy workloads." },
          { name:"Desired / Min / Max nodes", desc:"min=1, desired=2, max=5 is a good starting point. Cluster Autoscaler will scale within this range based on demand." },
          { name:"Capacity type", desc:"On-Demand for stable workloads. Spot for 60–70% cost savings on fault-tolerant batch/CI workloads." },
        ]},
    ],
    scheduling: false,
    management: [
      { name:"kubectl access", desc:"After cluster is created: aws eks update-kubeconfig --name CLUSTER_NAME --region REGION" },
      { name:"Scale nodes", desc:"Edit the node group desired count from the EKS page. The cluster autoscaler handles automatic scaling." },
      { name:"Delete cluster", desc:"Submit a delete request via admin. Terraform will destroy the cluster, node groups, and all associated resources." },
    ]
  },

  "aws/s3": {
    title: "How to Create an S3 Bucket",
    subtitle: "AWS Storage — 4 steps, takes about 1 minute",
    badge: "S3",
    badgeBg: "linear-gradient(135deg,#569A31,#3F7D1E)",
    accent: "#569A31",
    prereqs: {
      items: [
        { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"AWS credentials configured", desc:"AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY with s3:CreateBucket, s3:PutBucketPolicy permissions." },
        { icon:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", label:"Unique bucket name planned", desc:"S3 bucket names must be globally unique across all AWS accounts. Use your org prefix (e.g. aionos-myproject-data)." },
      ],
      note: { color:"#569A31", label:"Note:", text:"Bucket names are global and permanent — they cannot be renamed after creation." }
    },
    steps: [
      { num:1, title:"Bucket Name & Region", color:"#569A31", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
        fields:[
          { name:"Bucket Name", desc:"Globally unique, lowercase, no underscores. Use hyphens. e.g. aionos-prod-data, myteam-logs-2026. 3–63 characters." },
          { name:"Region", desc:"Choose region close to your compute for low latency. Same region as your EC2/Lambda avoids data transfer costs." },
        ]},
      { num:2, title:"Access Control", color:"#f59e0b", icon:"M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
        fields:[
          { name:"Block Public Access", desc:"Leave ON (default) for private data. Turn OFF only for static website hosting or public CDN assets." },
          { name:"ACLs", desc:"Disabled (recommended). Use IAM policies and bucket policies instead for fine-grained access control." },
        ]},
      { num:3, title:"Features", color:"#3b82f6", icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
        fields:[
          { name:"Versioning", desc:"Keep all versions of objects. Required for compliance. Protects against accidental deletes. Increases storage cost." },
          { name:"Encryption", desc:"SSE-S3 (free, AWS-managed) or SSE-KMS (for compliance requirements). Both encrypt at rest." },
          { name:"Lifecycle Rules", desc:"Auto-transition objects to cheaper tiers (Glacier, IA) after N days. Auto-delete old versions." },
        ]},
      { num:4, title:"Review & Create", color:"#22c55e", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        fields:[
          { name:"Review settings", desc:"Check bucket name, region, and access settings before creating." },
          { name:"Create bucket", desc:"S3 bucket creation is immediate — no approval workflow needed for buckets." },
          { name:"Upload objects", desc:"Use the S3 page to browse buckets and upload/download files." },
        ]},
    ],
    scheduling: false,
    management: [
      { name:"Upload / Download", desc:"Use the Storage page to browse your buckets and manage objects through the UI." },
      { name:"Delete bucket", desc:"Bucket must be empty before deletion. Use 'Force Delete' to empty and delete in one step." },
      { name:"IAM access", desc:"Grant access to specific IAM roles/users via bucket policies. Never share AWS credentials directly." },
    ]
  },

  "aws/vpc": {
    title: "How to Create a VPC",
    subtitle: "AWS Networking — 4 steps, takes about 1 minute",
    badge: "VPC",
    badgeBg: "linear-gradient(135deg,#8C4FFF,#6B2FD9)",
    accent: "#8C4FFF",
    prereqs: {
      items: [
        { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"AWS credentials with EC2/VPC permissions", desc:"ec2:CreateVpc, ec2:CreateSubnet, ec2:CreateInternetGateway, ec2:CreateRouteTable" },
        { icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label:"CIDR block plan", desc:"Non-overlapping CIDR block for your VPC. Common: 10.0.0.0/16, 172.16.0.0/16. Plan subnets within this range." },
      ],
      note: { color:"#8C4FFF", label:"Best practice:", text:"Use /16 for VPCs and /24 for subnets — leaves room for growth without IP exhaustion." }
    },
    steps: [
      { num:1, title:"VPC Basics", color:"#8C4FFF", icon:"M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
        fields:[
          { name:"VPC Name", desc:"Descriptive name like prod-vpc, dev-network, or myapp-vpc. Used for identification in the console." },
          { name:"CIDR Block", desc:"IPv4 range for the VPC. e.g. 10.0.0.0/16 gives 65,536 IP addresses. Must not overlap with other VPCs you plan to peer." },
          { name:"Region", desc:"VPCs are regional. Choose the region where your workloads will run." },
        ]},
      { num:2, title:"Subnets", color:"#f59e0b", icon:"M4 6h16M4 12h8m-8 6h16",
        fields:[
          { name:"Public Subnet", desc:"For resources that need internet access (load balancers, bastion hosts). Attach to Internet Gateway route." },
          { name:"Private Subnet", desc:"For backend resources (app servers, databases). Access internet via NAT Gateway." },
          { name:"Availability Zones", desc:"Create subnets in multiple AZs for high availability. e.g. ap-south-1a and ap-south-1b." },
        ]},
      { num:3, title:"Internet Access", color:"#3b82f6", icon:"M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3",
        fields:[
          { name:"Internet Gateway", desc:"Enables public subnets to communicate with the internet. Attach to VPC and add route 0.0.0.0/0 → IGW in public subnet route table." },
          { name:"NAT Gateway", desc:"Allows private subnet instances to reach the internet (for updates/downloads) without being reachable from the internet. Costs ~$0.045/hr." },
        ]},
      { num:4, title:"Security Groups", color:"#22c55e", icon:"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
        fields:[
          { name:"Security Group", desc:"Stateful firewall for your instances. Define inbound (SSH:22, HTTP:80, HTTPS:443) and outbound rules." },
          { name:"NACL", desc:"Stateless subnet-level firewall. Use for broad subnet-level rules. Security Groups are preferred for instance-level control." },
        ]},
    ],
    scheduling: false,
    management: [
      { name:"Add subnets", desc:"VPCs can have up to 200 subnets. Add new subnets from the Network page as you grow." },
      { name:"VPC Peering", desc:"Connect two VPCs using VPC Peering for private communication between different accounts or regions." },
      { name:"Delete VPC", desc:"All resources (subnets, IGW, route tables, security groups) must be deleted before the VPC can be removed." },
    ]
  },

  "azure/vm": {
    title: "How to Create an Azure VM",
    subtitle: "Azure Compute — 6 steps, takes about 2 minutes",
    badge: "VM",
    badgeBg: "linear-gradient(135deg,#0078D4,#50e6ff)",
    accent: "#0078D4",
    prereqs: {
      items: [
        { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"Azure credentials configured", desc:"AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID set in backend .env file" },
        { icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label:"VNet in Connectivity subscription", desc:"Hub-and-Spoke network topology. VMs use the shared VNet in the Connectivity subscription." },
        { icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label:"Resource Group in Non-Prod subscription", desc:"VM resources are created in the Non-Prod (spoke) subscription. Prod VMs go in the Prod subscription." },
        { icon:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", label:"Admin or Operator role", desc:"Only admins and operators can submit Azure VM requests." },
      ],
      note: { color:"#0078D4", label:"Subscription layout:", text:"Prod (spoke) · Non-Prod (spoke) · Connectivity (hub/networking) — Hub-and-Spoke Landing Zone" }
    },
    steps: [
      { num:1, title:"Name & Region", color:"#0078D4", icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
        fields:[
          { name:"VM Name", desc:"Lowercase, max 15 characters for Windows (Linux allows 64). No underscores. e.g. prod-web-01, dev-app-server." },
          { name:"Region", desc:"Choose the Azure region nearest to your users. eastus/westus for US. northeurope/westeurope for EU. southindia for India." },
          { name:"Resource Group", desc:"Logical container for Azure resources. Use existing RG or create new one with environment prefix." },
        ]},
      { num:2, title:"Image (OS)", color:"#50e6ff", icon:"M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
        fields:[
          { name:"Linux", desc:"Ubuntu Server 22.04 LTS for modern Linux. Ubuntu 20.04 LTS for broader compatibility. RHEL/CentOS for enterprise environments." },
          { name:"Windows", desc:"Windows Server 2022 Datacenter for modern Windows. 2019 for compatibility. Note: Windows VMs cost more (OS license included)." },
        ]},
      { num:3, title:"VM Size", color:"#f59e0b", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
        fields:[
          { name:"General purpose", desc:"Standard_D2s_v3 (2 vCPU, 8 GiB) for small services. Standard_D4s_v3 (4 vCPU, 16 GiB) for medium. Standard_D8s_v3 for large." },
          { name:"Compute optimized", desc:"Standard_F4s_v2 (4 vCPU, 8 GiB) for CPU-intensive tasks. Good for web servers and batch processing." },
          { name:"Memory optimized", desc:"Standard_E4s_v3 (4 vCPU, 32 GiB) for databases and in-memory caches." },
        ]},
      { num:4, title:"Network", color:"#a78bfa", icon:"M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
        fields:[
          { name:"VNet", desc:"Select from the Connectivity subscription (hub). All spoke VMs connect through the hub VNet." },
          { name:"Subnet", desc:"Choose the appropriate subnet for your workload tier (web, app, data)." },
          { name:"NSG Rules", desc:"Network Security Group controls traffic. Port 22 for SSH (Linux), 3389 for RDP (Windows)." },
        ]},
      { num:5, title:"Credentials", color:"#34A853", icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
        fields:[
          { name:"SSH Key (Linux)", desc:"Generate or upload an SSH public key. Recommended over password authentication for security." },
          { name:"Username/Password (Windows)", desc:"Set a strong admin password for Windows VMs. Store securely in your password manager." },
          { name:"Admin username", desc:"Cannot use reserved names: admin, administrator, root, guest, etc. Use your org convention (e.g. azureadmin)." },
        ]},
      { num:6, title:"Review & Submit", color:"#22c55e", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        fields:[
          { name:"Review all settings", desc:"Check name, region, size, image, and network before submitting." },
          { name:"Submit for Approval", desc:"Request is saved as 'pending'. Nothing is provisioned yet." },
          { name:"Admin approves", desc:"Admin reviews the request in the Approvals page and approves it." },
          { name:"Terraform provisions", desc:"Backend generates workspace → terraform init → plan → apply on Azure." },
          { name:"VM is live", desc:"Status changes to 'running'. VM appears in Azure Portal and the Azure Compute page." },
        ]},
    ],
    scheduling: true,
    management: [
      { name:"Start / Stop", desc:"Use the Start and Stop buttons on the Azure Compute page. Stopped (deallocated) VMs don't accrue compute charges." },
      { name:"Connect", desc:"Use the Connect button to get SSH/RDP connection details. Azure Bastion available for private VMs." },
      { name:"Auto-scheduling", desc:"Click Schedule on any VM to set auto_start and auto_stop tags. Azure scheduler checks every 60 seconds." },
    ]
  },

  "azure/storage": {
    title: "How to Create Azure Blob Storage",
    subtitle: "Azure Storage — 3 steps, takes about 1 minute",
    badge: "BLOB",
    badgeBg: "linear-gradient(135deg,#0078D4,#50e6ff)",
    accent: "#0078D4",
    prereqs: {
      items: [
        { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"Azure credentials configured", desc:"AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID with Storage Account Contributor role." },
        { icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label:"Resource Group in Non-Prod subscription", desc:"Storage Accounts are created in the Non-Prod subscription resource group." },
      ],
      note: { color:"#0078D4", label:"Note:", text:"Storage Account names must be 3–24 characters, lowercase letters and numbers only, globally unique." }
    },
    steps: [
      { num:1, title:"Storage Account", color:"#0078D4", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
        fields:[
          { name:"Account Name", desc:"Globally unique, 3–24 characters, lowercase letters and numbers only. e.g. aionosproddata2026." },
          { name:"Region", desc:"Choose region close to your compute resources to avoid cross-region data transfer costs." },
          { name:"Performance", desc:"Standard (HDD-backed, low cost) for general storage. Premium (SSD) for low-latency file shares and block blobs." },
          { name:"Replication", desc:"LRS (local) cheapest. ZRS (zone-redundant) for HA. GRS (geo-redundant) for disaster recovery." },
        ]},
      { num:2, title:"Containers", color:"#f59e0b", icon:"M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
        fields:[
          { name:"Container Name", desc:"Logical partition within the Storage Account. Like a folder. e.g. raw-data, processed, backups, uploads." },
          { name:"Access Level", desc:"Private (default, recommended). Blob (anonymous read for blobs only). Container (anonymous read for all blobs)." },
        ]},
      { num:3, title:"Review & Create", color:"#22c55e", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        fields:[
          { name:"Review settings", desc:"Check account name, region, performance tier, and replication type." },
          { name:"Create account", desc:"Storage Account creation is near-immediate in Azure." },
          { name:"Upload data", desc:"Use the Azure Storage page to manage containers and upload/download blobs." },
        ]},
    ],
    scheduling: false,
    management: [
      { name:"Browse containers", desc:"Use the Azure Storage page to view storage accounts, create containers, and manage blobs." },
      { name:"SAS tokens", desc:"Generate Shared Access Signatures for time-limited, scoped access to specific containers or blobs." },
      { name:"Delete account", desc:"All containers and blobs will be permanently deleted. This cannot be undone." },
    ]
  },

  "azure/network": {
    title: "How to Create an Azure VNet",
    subtitle: "Azure Networking — 3 steps, takes about 1 minute",
    badge: "VNET",
    badgeBg: "linear-gradient(135deg,#0078D4,#50e6ff)",
    accent: "#0078D4",
    prereqs: {
      items: [
        { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"Azure credentials with Network Contributor role", desc:"Microsoft.Network/virtualNetworks/write, Microsoft.Network/subnets/write permissions." },
        { icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label:"CIDR block planned", desc:"Non-overlapping address space. Common: 10.0.0.0/16. Plan subnets within this range." },
      ],
      note: { color:"#0078D4", label:"Architecture:", text:"Hub VNet in Connectivity subscription. Spoke VNets in Prod and Non-Prod subscriptions, peered to hub." }
    },
    steps: [
      { num:1, title:"VNet Basics", color:"#0078D4", icon:"M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3",
        fields:[
          { name:"VNet Name", desc:"Descriptive name like prod-vnet, dev-network. Use your org naming convention." },
          { name:"Address Space", desc:"e.g. 10.0.0.0/16. Must not overlap with hub VNet or other spoke VNets for peering to work." },
          { name:"Region", desc:"VNets are regional. Must be in the same region as the resources connecting to it." },
        ]},
      { num:2, title:"Subnets", color:"#f59e0b", icon:"M4 6h16M4 12h8m-8 6h16",
        fields:[
          { name:"Subnet Name", desc:"Descriptive: web-subnet, app-subnet, data-subnet, AzureFirewallSubnet (must be exact for Azure Firewall)." },
          { name:"Subnet CIDR", desc:"e.g. 10.0.1.0/24 gives 256 IPs (251 usable — Azure reserves 5). Use /26 or /27 for smaller subnets." },
          { name:"Service Endpoints", desc:"Enable for services like Azure Storage or SQL to allow VNet-private access." },
        ]},
      { num:3, title:"Peering & DNS", color:"#22c55e", icon:"M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
        fields:[
          { name:"VNet Peering", desc:"Connect this spoke VNet to the hub VNet (Connectivity subscription) for centralized routing through the firewall." },
          { name:"DNS Servers", desc:"Default (Azure DNS) works for most cases. Custom DNS for on-premises hybrid connectivity." },
        ]},
    ],
    scheduling: false,
    management: [
      { name:"Add subnets", desc:"Subnets can be added to a VNet at any time from the Azure Network page." },
      { name:"NSG assignment", desc:"Attach Network Security Groups to subnets for subnet-level traffic filtering." },
      { name:"Peering", desc:"VNet peering is non-transitive — spoke VNets must peer with the hub individually." },
    ]
  },

  "gcp/compute": {
    title: "How to Create a GCP VM Instance",
    subtitle: "GCP Compute Engine — 6 steps, takes about 2 minutes",
    badge: "GCE",
    badgeBg: "linear-gradient(135deg,#4285F4,#34A853)",
    accent: "#4285F4",
    prereqs: {
      items: [
        { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"GCP Service Account key", desc:"Download from GCP IAM → Service Accounts. Set GCP_CREDENTIALS_FILE in backend .env." },
        { icon:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z", label:"GCP_PROJECT_ID in .env", desc:"Set GCP_PROJECT_ID=your-gcp-project-id in the backend .env file." },
        { icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label:"Service account IAM roles", desc:"roles/compute.admin · roles/iam.serviceAccountUser" },
      ],
      note: { color:"#4285F4", label:"Instance takes:", text:"2–5 minutes to provision after Terraform apply. GCP instances start faster than AWS or Azure." }
    },
    steps: [
      { num:1, title:"Name & Zone", color:"#4285F4", icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
        fields:[
          { name:"Instance Name", desc:"Lowercase letters, numbers, hyphens. e.g. web-server-01, dev-instance. Max 63 characters." },
          { name:"Zone", desc:"GCP zone within a region. e.g. asia-south1-a for Mumbai. asia-south1-b for a different zone in Mumbai." },
          { name:"Region", desc:"Choose region closest to your users. asia-south1 for India. us-central1 for US. europe-west1 for Europe." },
        ]},
      { num:2, title:"Machine Type", color:"#34A853", icon:"M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2",
        fields:[
          { name:"E2 (Economy)", desc:"e2-micro (0.25 vCPU, 1 GiB) for very small tasks. e2-standard-2 (2 vCPU, 8 GiB) for dev. e2-standard-4 for medium workloads." },
          { name:"N2 (General)", desc:"n2-standard-4 (4 vCPU, 16 GiB) for production. Better sustained performance than E2 machines." },
          { name:"C2 (Compute)", desc:"c2-standard-4 for compute-intensive workloads like scientific computing, game servers." },
        ]},
      { num:3, title:"Boot Disk", color:"#FBBC04", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
        fields:[
          { name:"OS Image", desc:"Container-Optimized OS for containers. Ubuntu 22.04 LTS for general Linux. Debian 11 for lightweight Linux. Windows Server 2022 for Windows." },
          { name:"Disk Size", desc:"Minimum varies by OS (10 GB for Linux). Recommended 50+ GB for applications. Use SSD persistent disk for better IOPS." },
          { name:"Disk Type", desc:"pd-ssd (SSD) for databases and I/O-intensive apps. pd-balanced for most workloads. pd-standard (HDD) for archival/batch." },
        ]},
      { num:4, title:"Network", color:"#EA4335", icon:"M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
        fields:[
          { name:"VPC Network", desc:"Select existing VPC. 'default' works for dev. Use custom VPC for production network isolation." },
          { name:"External IP", desc:"Ephemeral (new IP on restart) or Static (fixed IP, costs ~$0.01/hr when running). No IP for private instances." },
          { name:"Firewall Tags", desc:"Assign network tags and create matching firewall rules. e.g. tag 'http-server' + firewall rule allowing port 80." },
        ]},
      { num:5, title:"Startup Script", color:"#a78bfa", icon:"M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
        fields:[
          { name:"Startup Script", desc:"Optional bash script that runs on first boot. Use to install packages: apt-get install -y nginx. Configure services. Set up app." },
          { name:"SSH Keys", desc:"Add your SSH public key for remote access. Or use IAM-based OS Login (recommended for organizations)." },
        ]},
      { num:6, title:"Review & Submit", color:"#22c55e", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        fields:[
          { name:"Review all settings", desc:"Check name, zone, machine type, boot disk, and network before submitting." },
          { name:"Submit for Approval", desc:"Request is saved as 'pending'. Nothing is provisioned yet." },
          { name:"Admin approves", desc:"Admin reviews the request in the Approvals page and approves it." },
          { name:"Terraform provisions", desc:"Backend generates workspace → terraform init → plan → apply on GCP." },
          { name:"Instance is live", desc:"Status changes to 'running'. Instance appears in GCP Console and the GCP Compute page." },
        ]},
    ],
    scheduling: true,
    management: [
      { name:"Start / Stop", desc:"Use the Start and Stop buttons on the GCP Compute page. Stopped instances don't accrue compute charges but disk storage still costs." },
      { name:"SSH connect", desc:"Use the Connect button to get SSH connection details. Or use GCP Cloud Shell for browser-based access." },
      { name:"Auto-scheduling", desc:"Click Schedule on any instance to set auto_start and auto_stop labels. GCP uses hyphens in time format (HH-MM). Scheduler checks every 60 seconds." },
    ]
  },

  "gcp/storage": {
    title: "How to Create a GCP Cloud Storage Bucket",
    subtitle: "GCP Storage — 3 steps, takes about 1 minute",
    badge: "GCS",
    badgeBg: "linear-gradient(135deg,#4285F4,#34A853)",
    accent: "#4285F4",
    prereqs: {
      items: [
        { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"GCP credentials with Storage Admin role", desc:"roles/storage.admin or roles/storage.objectAdmin for the project." },
        { icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label:"Globally unique bucket name", desc:"GCS bucket names are globally unique across all Google Cloud projects." },
      ],
      note: { color:"#4285F4", label:"Note:", text:"Bucket names cannot be changed after creation. Choose carefully." }
    },
    steps: [
      { num:1, title:"Bucket Name & Location", color:"#4285F4", icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
        fields:[
          { name:"Bucket Name", desc:"Globally unique, 3–63 characters, lowercase. Can use hyphens. e.g. aionos-prod-backups, myproject-data-2026." },
          { name:"Location Type", desc:"Region (single region, cheapest). Dual-region (2 regions, high availability). Multi-region (US/EU/Asia, highest availability)." },
          { name:"Location", desc:"ASIA (multi), asia-south1 (Mumbai), us-central1 (Iowa). Choose close to your compute." },
        ]},
      { num:2, title:"Storage Class & Access", color:"#34A853", icon:"M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
        fields:[
          { name:"Storage Class", desc:"Standard (hot data, frequent access). Nearline (monthly access). Coldline (quarterly). Archive (yearly, lowest cost)." },
          { name:"Access Control", desc:"Uniform (recommended) — all objects inherit bucket-level IAM. Fine-grained — per-object ACLs." },
          { name:"Public Access", desc:"Leave 'Enforce public access prevention' ON unless you need public website hosting." },
        ]},
      { num:3, title:"Review & Create", color:"#22c55e", icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        fields:[
          { name:"Review settings", desc:"Check bucket name, location, storage class, and access control." },
          { name:"Create bucket", desc:"GCS bucket creation is immediate." },
          { name:"Upload objects", desc:"Use the GCP Storage page to manage buckets and upload/download files." },
        ]},
    ],
    scheduling: false,
    management: [
      { name:"Browse objects", desc:"Use the GCP Storage page to view buckets, create folders, and manage objects." },
      { name:"Lifecycle policies", desc:"Set lifecycle rules to auto-transition to cheaper storage classes or auto-delete old objects." },
      { name:"Delete bucket", desc:"All objects must be deleted before the bucket can be removed." },
    ]
  },

  "gcp/network": {
    title: "How to Create a GCP VPC Network",
    subtitle: "GCP Networking — 3 steps, takes about 1 minute",
    badge: "VPC",
    badgeBg: "linear-gradient(135deg,#4285F4,#34A853)",
    accent: "#4285F4",
    prereqs: {
      items: [
        { icon:"M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label:"GCP credentials with Network Admin role", desc:"roles/compute.networkAdmin for VPC and subnet creation." },
        { icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label:"CIDR block plan", desc:"Non-overlapping subnet CIDRs within your VPC. GCP VPCs are global by default." },
      ],
      note: { color:"#4285F4", label:"GCP VPCs are global:", text:"A single GCP VPC spans all regions. You create regional subnets within the VPC." }
    },
    steps: [
      { num:1, title:"VPC Name", color:"#4285F4", icon:"M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3",
        fields:[
          { name:"Network Name", desc:"Lowercase, hyphens allowed. e.g. prod-network, dev-vpc. Must be unique within your project." },
          { name:"Subnet Mode", desc:"Custom (recommended) — manually create subnets in specific regions. Automatic — creates subnets in all regions automatically." },
          { name:"BGP Routing Mode", desc:"Regional — only routes within same region. Global — routes visible across all regions. Global recommended for multi-region." },
        ]},
      { num:2, title:"Subnets", color:"#34A853", icon:"M4 6h16M4 12h8m-8 6h16",
        fields:[
          { name:"Subnet Name", desc:"Descriptive: web-subnet-mumbai, app-subnet-us. Include region in name for clarity." },
          { name:"Region", desc:"Choose region for this subnet. e.g. asia-south1 for Mumbai. GCP subnets are regional within a global VPC." },
          { name:"IP Range", desc:"e.g. 10.0.1.0/24. Must not overlap with other subnets in the same VPC." },
          { name:"Private Google Access", desc:"Enable to allow VMs without external IPs to reach Google APIs (Storage, BigQuery, etc.)." },
        ]},
      { num:3, title:"Firewall Rules", color:"#22c55e", icon:"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
        fields:[
          { name:"Firewall Rules", desc:"Allow SSH (tcp:22), HTTP (tcp:80), HTTPS (tcp:443) for web servers. Apply using network tags on instances." },
          { name:"Cloud NAT", desc:"Create a Cloud NAT gateway for instances without external IPs to access the internet." },
        ]},
    ],
    scheduling: false,
    management: [
      { name:"Add subnets", desc:"Add subnets in new regions as your workloads expand globally." },
      { name:"VPC Peering", desc:"Peer VPCs within the same or different GCP projects for private communication." },
      { name:"Shared VPC", desc:"Host VPC in one project, share with service projects. Centralizes network management." },
    ]
  },

  "scheduling": {
    title: "VM Scheduling Guide",
    subtitle: "Auto-start and auto-stop across AWS, Azure, and GCP",
    badge: "SCH",
    badgeBg: "linear-gradient(135deg,#a78bfa,#7c3aed)",
    accent: "#a78bfa",
    prereqs: {
      items: [
        { icon:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", label:"Platform scheduler runs every 60 seconds", desc:"The backend scheduler checks all VMs/instances for auto_start and auto_stop tags/labels every minute." },
        { icon:"M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label:"Schedules use UTC time", desc:"All schedules run on UTC. Convert your local time to UTC. IST = UTC+5:30. EST = UTC-5. PST = UTC-8." },
      ],
      note: { color:"#a78bfa", label:"Savings:", text:"Stopping dev VMs at night (18:00–09:00) saves ~58% of compute costs. Weekends = additional savings." }
    },
    steps: [
      { num:1, title:"AWS Scheduling", color:"#FF9900", icon:"M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z",
        fields:[
          { name:"Tag: auto_start", desc:'Value format: HH:MM (24-hour UTC). e.g. "09:00" to start at 9am UTC. The EC2 scheduler reads this tag every 60 seconds.' },
          { name:"Tag: auto_stop", desc:'Value format: HH:MM (24-hour UTC). e.g. "18:00" to stop at 6pm UTC.' },
          { name:"How to set", desc:"Click the Schedule button on any EC2 instance in the Compute page. Or add tags manually in AWS Console." },
          { name:"Verification", desc:"Tags are visible in EC2 Console → Instance → Tags. Scheduler logs appear in Activity Log." },
        ]},
      { num:2, title:"Azure Scheduling", color:"#0078D4", icon:"M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z",
        fields:[
          { name:"Tag: auto_start", desc:'Value format: HH:MM (24-hour UTC). e.g. "09:00". Set on the VM resource in Azure.' },
          { name:"Tag: auto_stop", desc:'Value format: HH:MM (24-hour UTC). e.g. "18:00". Set on the VM resource in Azure.' },
          { name:"How to set", desc:"Click the Schedule button on any Azure VM in the Azure Compute page. Tags are applied via Azure REST API." },
          { name:"Deallocate vs Stop", desc:"The scheduler uses Deallocate (not just Stop) so the VM doesn't accrue compute charges while stopped." },
        ]},
      { num:3, title:"GCP Scheduling", color:"#4285F4", icon:"M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z",
        fields:[
          { name:"Label: auto_start", desc:'Value format: HH-MM (hyphens, not colons — GCP label values cannot contain colons). e.g. "09-00" for 9am UTC.' },
          { name:"Label: auto_stop", desc:'Value format: HH-MM. e.g. "18-00" for 6pm UTC. Note hyphens instead of colons.' },
          { name:"How to set", desc:"Click the Schedule button on any GCP instance. The platform converts HH:MM to HH-MM format automatically." },
          { name:"Verification", desc:"Labels visible in GCP Console → Compute Engine → VM → Labels. Scheduler uses GCP Labels API." },
        ]},
      { num:4, title:"Common Presets", color:"#34A853", icon:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
        fields:[
          { name:"Office Hours", desc:"Start: 09:00 UTC | Stop: 18:00 UTC. 9 hours running per day. Saves ~62% vs always-on." },
          { name:"Engineering Day", desc:"Start: 10:00 UTC | Stop: 20:00 UTC. 10 hours running per day. Good for dev teams." },
          { name:"Night Batch", desc:"Start: 21:00 UTC | Stop: 06:00 UTC. 9 hours running overnight for batch jobs and builds." },
          { name:"No schedule", desc:"Leave auto_start and auto_stop empty to disable scheduling. VM stays in its current state." },
        ]},
    ],
    scheduling: false,
    management: [
      { name:"Remove schedule", desc:"Clear both auto_start and auto_stop tags/labels to disable scheduling entirely." },
      { name:"Schedule conflicts", desc:"If auto_start and auto_stop are the same time, the scheduler ignores both. Always use different times." },
      { name:"Timezone conversion", desc:"IST 09:00 = UTC 03:30. EST 09:00 = UTC 14:00. PST 09:00 = UTC 17:00. Use worldtimeserver.com to convert." },
    ]
  },
}

// ── Reusable icon ─────────────────────────────────────────────────────────────
function Icon({ d, size=14, color="currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

// ── Modal component ───────────────────────────────────────────────────────────
function GuideModal({ guide, dark, onClose, initialActive = -1 }) {
  const [active, setActive] = useState(initialActive)   // -1 = prereqs, 0..N-1 = steps, 98 = scheduling, 99 = management

  const surface = dark ? "#0f172a" : "#ffffff"
  const border  = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const txt     = dark ? "#e2e8f0" : "#1e293b"
  const muted   = dark ? "#64748b" : "#94a3b8"
  const subtle  = dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"

  const totalSteps = guide.steps.length

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:99999,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:840, maxHeight:"92vh", display:"flex", flexDirection:"column",
        background:surface, border:`1px solid ${border}`, borderRadius:18,
        boxShadow:"0 32px 80px rgba(0,0,0,0.5)", overflow:"hidden", fontFamily:"system-ui,sans-serif" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background: dark ? `${guide.accent}0d` : `${guide.accent}08` }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
              background:guide.badgeBg,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:8, fontWeight:800, color:"#fff", letterSpacing:"-0.3px" }}>{guide.badge}</span>
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:txt }}>{guide.title}</div>
              <div style={{ fontSize:12, color:muted }}>{guide.subtitle}</div>
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"transparent", border:"none", color:muted, fontSize:24, cursor:"pointer", lineHeight:1, padding:"4px 8px" }}>
            ×
          </button>
        </div>

        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* Left nav */}
          <div style={{ width:198, flexShrink:0, borderRight:`1px solid ${border}`,
            padding:"14px 10px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>

            <button onClick={() => setActive(-1)}
              style={{ textAlign:"left", padding:"9px 12px", borderRadius:8, cursor:"pointer",
                background: active === -1 ? "rgba(251,188,4,0.12)" : "transparent",
                border: active === -1 ? "1px solid rgba(251,188,4,0.3)" : "1px solid transparent",
                color: active === -1 ? "#FBBC04" : muted, fontSize:12, fontWeight:600 }}>
              Prerequisites
            </button>

            <div style={{ fontSize:9.5, color:muted, textTransform:"uppercase",
              letterSpacing:"0.08em", padding:"10px 12px 3px", fontWeight:700 }}>Steps</div>

            {guide.steps.map((s, i) => (
              <button key={i} onClick={() => setActive(i)}
                style={{ textAlign:"left", padding:"8px 12px", borderRadius:8, cursor:"pointer",
                  background: active === i ? `${s.color}14` : "transparent",
                  border: active === i ? `1px solid ${s.color}40` : "1px solid transparent",
                  color: active === i ? s.color : muted, fontSize:12, fontWeight:600,
                  display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:20, height:20, borderRadius:"50%", flexShrink:0,
                  background: active === i ? s.color : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
                  color: active === i ? "#fff" : muted,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:9, fontWeight:800 }}>{s.num}</span>
                {s.title}
              </button>
            ))}

            {guide.scheduling && (
              <>
                <div style={{ fontSize:9.5, color:muted, textTransform:"uppercase",
                  letterSpacing:"0.08em", padding:"10px 12px 3px", fontWeight:700 }}>Scheduling</div>
                <button onClick={() => setActive(98)}
                  style={{ textAlign:"left", padding:"9px 12px", borderRadius:8, cursor:"pointer",
                    background: active === 98 ? "rgba(167,139,250,0.12)" : "transparent",
                    border: active === 98 ? "1px solid rgba(167,139,250,0.3)" : "1px solid transparent",
                    color: active === 98 ? "#a78bfa" : muted, fontSize:12, fontWeight:600 }}>
                  Auto Start/Stop
                </button>
              </>
            )}

            <div style={{ fontSize:9.5, color:muted, textTransform:"uppercase",
              letterSpacing:"0.08em", padding:"10px 12px 3px", fontWeight:700 }}>After Create</div>
            <button onClick={() => setActive(99)}
              style={{ textAlign:"left", padding:"9px 12px", borderRadius:8, cursor:"pointer",
                background: active === 99 ? "rgba(34,197,94,0.12)" : "transparent",
                border: active === 99 ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent",
                color: active === 99 ? "#22c55e" : muted, fontSize:12, fontWeight:600 }}>
              Management
            </button>
          </div>

          {/* Right content */}
          <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

            {/* Prerequisites */}
            {active === -1 && (
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:txt, marginBottom:6 }}>Prerequisites</div>
                <div style={{ fontSize:12, color:muted, marginBottom:20 }}>
                  Make sure these are configured before creating this resource.
                </div>
                <div style={{ display:"grid", gap:10 }}>
                  {guide.prereqs.items.map((item, i) => (
                    <div key={i} style={{ display:"flex", gap:14, padding:"14px 16px", borderRadius:12,
                      border:`1px solid ${border}`, background:subtle, alignItems:"flex-start" }}>
                      <div style={{ width:32, height:32, borderRadius:8, flexShrink:0,
                        background:"rgba(251,188,4,0.12)", border:"1px solid rgba(251,188,4,0.25)",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Icon d={item.icon} size={15} color="#FBBC04" />
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:3 }}>{item.label}</div>
                        <div style={{ fontSize:11, color:muted, lineHeight:1.6 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {guide.prereqs.note && (
                  <div style={{ marginTop:16, padding:"12px 16px", borderRadius:10,
                    background:`${guide.prereqs.note.color}0d`, border:`1px solid ${guide.prereqs.note.color}30`,
                    fontSize:12, color:muted, lineHeight:1.7 }}>
                    <strong style={{ color:guide.prereqs.note.color }}>{guide.prereqs.note.label}</strong>{" "}
                    <code style={{ fontSize:11 }}>{guide.prereqs.note.text}</code>
                  </div>
                )}
                <div style={{ marginTop:20, display:"flex", gap:8 }}>
                  <button onClick={() => setActive(0)}
                    style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${guide.accent}50`,
                      background:`${guide.accent}12`, color:guide.accent, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    Start Guide →
                  </button>
                </div>
              </div>
            )}

            {/* Steps */}
            {active >= 0 && active < totalSteps && (() => {
              const s = guide.steps[active]
              const isLast = active === totalSteps - 1
              return (
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                    <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
                      background:`${s.color}18`, border:`1px solid ${s.color}40`,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Icon d={s.icon} size={18} color={s.color} />
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:txt }}>Step {s.num} — {s.title}</div>
                      <div style={{ fontSize:12, color:muted }}>Fill in these fields in the form</div>
                    </div>
                  </div>
                  <div style={{ display:"grid", gap:8 }}>
                    {s.fields.map((f, i) => (
                      <div key={i} style={{ display:"flex", gap:14, padding:"13px 16px", borderRadius:11,
                        border:`1px solid ${border}`, background:subtle, alignItems:"flex-start" }}>
                        <div style={{ width:24, height:24, borderRadius:6, flexShrink:0,
                          background:`${s.color}18`, border:`1px solid ${s.color}30`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:10, fontWeight:800, color:s.color }}>
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:2 }}>{f.name}</div>
                          <div style={{ fontSize:12, color:muted, lineHeight:1.6 }}>{f.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:20, display:"flex", gap:8 }}>
                    {active > 0 && (
                      <button onClick={() => setActive(active - 1)}
                        style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${border}`,
                          background:"transparent", color:muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        ← Previous
                      </button>
                    )}
                    {!isLast && (
                      <button onClick={() => setActive(active + 1)}
                        style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${s.color}50`,
                          background:`${s.color}12`, color:s.color, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        Next Step →
                      </button>
                    )}
                    {isLast && guide.scheduling && (
                      <button onClick={() => setActive(98)}
                        style={{ padding:"8px 18px", borderRadius:8, border:"1px solid rgba(167,139,250,0.4)",
                          background:"rgba(167,139,250,0.12)", color:"#a78bfa", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        Scheduling →
                      </button>
                    )}
                    {isLast && !guide.scheduling && (
                      <button onClick={() => setActive(99)}
                        style={{ padding:"8px 18px", borderRadius:8, border:"1px solid rgba(34,197,94,0.4)",
                          background:"rgba(34,197,94,0.12)", color:"#22c55e", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        Management →
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Scheduling section */}
            {active === 98 && guide.scheduling && (() => {
              const cloudKey = guide.badge === "EC2" ? "aws" : guide.badge === "VM" ? "azure" : "gcp"
              const schGuide = GUIDES["scheduling"]
              const stepIdx = cloudKey === "aws" ? 0 : cloudKey === "azure" ? 1 : 2
              const s = schGuide.steps[stepIdx]
              const presets = schGuide.steps[3]
              return (
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                    <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
                      background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" size={18} color="#a78bfa" />
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:txt }}>Auto Start/Stop Scheduling</div>
                      <div style={{ fontSize:12, color:muted }}>Platform scheduler checks every 60 seconds (UTC time)</div>
                    </div>
                  </div>
                  <div style={{ display:"grid", gap:8, marginBottom:16 }}>
                    {s.fields.map((f, i) => (
                      <div key={i} style={{ display:"flex", gap:14, padding:"13px 16px", borderRadius:11,
                        border:`1px solid ${border}`, background:subtle, alignItems:"flex-start" }}>
                        <div style={{ width:24, height:24, borderRadius:6, flexShrink:0,
                          background:`${s.color}18`, border:`1px solid ${s.color}30`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:10, fontWeight:800, color:s.color }}>
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:2 }}>{f.name}</div>
                          <div style={{ fontSize:12, color:muted, lineHeight:1.6 }}>{f.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:10 }}>Common Presets</div>
                  <div style={{ display:"grid", gap:8 }}>
                    {presets.fields.map((f, i) => (
                      <div key={i} style={{ display:"flex", gap:14, padding:"11px 14px", borderRadius:10,
                        border:`1px solid ${border}`, background:subtle, alignItems:"flex-start" }}>
                        <div style={{ width:22, height:22, borderRadius:6, flexShrink:0,
                          background:"rgba(52,168,83,0.14)", border:"1px solid rgba(52,168,83,0.28)",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:9, fontWeight:800, color:"#34A853" }}>
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:txt, marginBottom:2 }}>{f.name}</div>
                          <div style={{ fontSize:11, color:muted, lineHeight:1.6 }}>{f.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:20, display:"flex", gap:8 }}>
                    <button onClick={() => setActive(totalSteps - 1)}
                      style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${border}`,
                        background:"transparent", color:muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      ← Back to Steps
                    </button>
                    <button onClick={() => setActive(99)}
                      style={{ padding:"8px 18px", borderRadius:8, border:"1px solid rgba(34,197,94,0.4)",
                        background:"rgba(34,197,94,0.12)", color:"#22c55e", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                      Management →
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Management */}
            {active === 99 && (
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:txt, marginBottom:6 }}>Management</div>
                <div style={{ fontSize:12, color:muted, marginBottom:20 }}>
                  Tips for managing this resource after it is created.
                </div>
                <div style={{ display:"grid", gap:8 }}>
                  {guide.management.map((item, i) => (
                    <div key={i} style={{ display:"flex", gap:14, padding:"14px 16px", borderRadius:12,
                      border:`1px solid ${border}`, background:subtle, alignItems:"flex-start" }}>
                      <div style={{ width:24, height:24, borderRadius:6, flexShrink:0,
                        background:`${guide.accent}18`, border:`1px solid ${guide.accent}30`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:10, fontWeight:800, color:guide.accent }}>
                        {i + 1}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:txt, marginBottom:2 }}>{item.name}</div>
                        <div style={{ fontSize:12, color:muted, lineHeight:1.6 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:20, display:"flex", gap:8 }}>
                  <button onClick={() => setActive(guide.scheduling ? 98 : totalSteps - 1)}
                    style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${border}`,
                      background:"transparent", color:muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    ← Back
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Exported component ────────────────────────────────────────────────────────
export default function ResourceGuide({ cloud, resource, dark }) {
  const [open, setOpen] = useState(false)

  const key = resource === "scheduling" ? "scheduling" : `${cloud}/${resource}`
  const guide = GUIDES[key]
  if (!guide) return null

  const card = dark ? "rgba(255,255,255,0.03)" : "#ffffff"

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ padding:"8px 14px", borderRadius:9, background:card,
          border:"1px solid rgba(66,133,244,0.35)", color:"#4285F4",
          fontSize:12, fontWeight:700, cursor:"pointer",
          display:"flex", alignItems:"center", gap:6, fontFamily:"system-ui,sans-serif" }}>
        <Icon d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13} color="#4285F4" />
        How to Create
      </button>
      {open && <GuideModal guide={guide} dark={dark} onClose={() => setOpen(false)} />}
    </>
  )
}

export function ScheduleGuide({ cloud, dark }) {
  const [open, setOpen] = useState(false)
  const guide = GUIDES["scheduling"]
  const initialStep = cloud === "aws" ? 0 : cloud === "azure" ? 1 : cloud === "gcp" ? 2 : -1
  const card = dark ? "rgba(255,255,255,0.03)" : "#ffffff"

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ padding:"8px 14px", borderRadius:9, background:card,
          border:"1px solid rgba(167,139,250,0.35)", color:"#a78bfa",
          fontSize:12, fontWeight:700, cursor:"pointer",
          display:"flex", alignItems:"center", gap:6, fontFamily:"system-ui,sans-serif" }}>
        <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" size={13} color="#a78bfa" />
        How to Schedule
      </button>
      {open && <GuideModal guide={guide} dark={dark} onClose={() => setOpen(false)} initialActive={initialStep} />}
    </>
  )
}
