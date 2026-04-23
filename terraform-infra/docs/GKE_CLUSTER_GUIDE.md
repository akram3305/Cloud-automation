# GKE Cluster Creation Guide — AIonOS Platform

## What Happens Behind the Scenes

When you create a GKE cluster on this platform:

1. You fill the 4-step wizard → request saved as **pending**
2. An admin approves it in the **Approvals** page
3. The backend generates a Terraform workspace from the `gke.tf` template
4. `terraform init → plan → apply` runs on GCP
5. Cluster is live; state is archived to S3
6. Request status updates to **completed** (or **failed** if something went wrong)

---

## Step-by-Step: Create a GKE Cluster

### Prerequisites
Make sure your `.env` file has GCP credentials configured:
```
GCP_PROJECT_ID=your-gcp-project-id
GCP_CREDENTIALS_FILE=/path/to/service-account-key.json
# OR
GCP_CREDENTIALS_JSON={"type":"service_account",...}
```
The service account needs these IAM roles:
- `roles/container.admin`
- `roles/compute.networkViewer`
- `roles/iam.serviceAccountUser`

---

### Step 1 — Basics

| Field | What to enter |
|---|---|
| **Cluster Name** | Lowercase letters, numbers, hyphens only. Min 3 chars. e.g. `my-cluster` |
| **Region** | Select the GCP region closest to your workload |
| **Release Channel** | `REGULAR` recommended for production. `RAPID` for testing new features. `STABLE` for maximum reliability |
| **Cluster Type** | `Regional` = 3 control-plane replicas across zones (recommended). `Zonal` = single zone, cheaper |
| **Environment** | `dev` / `staging` / `prod` — used for labeling and workspace isolation |

> Cluster name is sanitized automatically: spaces/underscores → hyphens, uppercase → lowercase.

---

### Step 2 — Node Pool

| Field | What to enter |
|---|---|
| **Machine Type** | Choose based on your workload. `e2-standard-4` is a good general-purpose default |
| **Initial Nodes** | Number of nodes when cluster first starts (must be between min and max) |
| **Min Nodes** | Auto-scaler will never go below this count |
| **Max Nodes** | Auto-scaler will never exceed this count |
| **Disk Type** | `SSD (pd-ssd)` recommended for production. `Balanced` for cost savings |
| **Disk Size** | Minimum 10 GB. Recommended: 100 GB |
| **Node Image** | `Container-Optimized OS` is hardened and recommended. `Ubuntu` if you need custom OS packages |
| **Spot VMs** | ~70% cheaper but nodes can be preempted. Use only for fault-tolerant batch workloads |

---

### Step 3 — Networking & Features

#### Networking

| Field | What to enter |
|---|---|
| **Network** | Leave `default` unless you have a custom VPC |
| **Subnetwork** | Leave `default` unless you have a custom subnet |
| **Private Cluster** | Nodes get internal IPs only — no direct internet. Recommended for production |
| **Master CIDR Block** | Only shown when Private Cluster is ON. Must be a `/28` block not used by anything else in your VPC. e.g. `172.16.0.32/28`. You can choose any unused /28 range. |

> **Why /28?** GCP reserves exactly 16 IP addresses for control-plane master nodes. This is a GCP requirement — not a platform restriction.

#### Add-ons

| Toggle | Default | Description |
|---|---|---|
| HTTP Load Balancing | ✅ On | Enables GCP Cloud Load Balancer for `LoadBalancer` services |
| Horizontal Pod Autoscaling | ✅ On | Allows HPA objects to scale deployments automatically |
| Network Policy | ✅ On | Enables Calico for pod-to-pod network isolation (`NetworkPolicy` objects) |
| Workload Identity | ✅ On | Allows pods to authenticate to GCP APIs without service account keys |
| Cloud Logging | ✅ On | Sends pod logs to Google Cloud Logging |
| Cloud Monitoring | ✅ On | Sends metrics to Google Cloud Monitoring |

> Turning off Logging or Monitoring reduces cost but removes observability.

---

### Step 4 — Review & Submit

Review all your settings. Click **Submit for Approval**.

---

## After Submitting

1. Go to **GCP → Kubernetes Engine** page to see your request with status `pending`
2. Log in as `admin` and go to **Approvals**
3. Find your cluster request and click **Approve**
4. Watch the status change: `pending → generating → provisioning → completed`
5. Click **Details** on the cluster to see all configuration

---

## Option Reference

### Supported Regions
```
us-central1 (Iowa)        us-east1 (S. Carolina)    us-east4 (N. Virginia)
us-west1 (Oregon)         us-west2 (Los Angeles)
europe-west1 (Belgium)    europe-west2 (London)      europe-west3 (Frankfurt)
europe-west4 (Netherlands) europe-west6 (Zurich)
asia-south1 (Mumbai)      asia-south2 (Delhi)        asia-east1 (Taiwan)
asia-northeast1 (Tokyo)   asia-northeast3 (Seoul)    asia-southeast1 (Singapore)
australia-southeast1 (Sydney)
```

### Supported Machine Types

| Group | Machine | vCPU | RAM | Est. Cost |
|---|---|---|---|---|
| General Purpose | e2-standard-2 | 2 | 8 GiB | $0.067/hr |
| General Purpose | e2-standard-4 | 4 | 16 GiB | $0.134/hr |
| General Purpose | e2-standard-8 | 8 | 32 GiB | $0.268/hr |
| General Purpose | n2-standard-4 | 4 | 16 GiB | $0.194/hr |
| Compute Optimized | c2-standard-4 | 4 | 16 GiB | $0.209/hr |
| Compute Optimized | c2-standard-8 | 8 | 32 GiB | $0.418/hr |
| Memory Optimized | n2-highmem-4 | 4 | 32 GiB | $0.262/hr |
| Memory Optimized | n2-highmem-8 | 8 | 64 GiB | $0.524/hr |
| ARM (Tau T2A) | t2a-standard-2 | 2 | 8 GiB | $0.070/hr |
| ARM (Tau T2A) | t2a-standard-4 | 4 | 16 GiB | $0.141/hr |

---

## Configuration Validation Checklist

All these options are validated before Terraform runs:

| Check | Rule |
|---|---|
| Cluster name | ≥ 3 chars, auto-sanitized to GCP naming rules |
| Node count order | min ≤ initial ≤ max |
| Disk size | ≥ 10 GB |
| Master CIDR | Must be /28 if Private Cluster is enabled |
| GCP credentials | Must be set in `.env` before approval |
| GCP Project ID | Must be set in `.env` before approval |

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `GCP credentials not configured` | `.env` missing `GCP_CREDENTIALS_JSON` or `GCP_CREDENTIALS_FILE` | Add credentials to `.env` and restart backend |
| `master_ipv4_cidr_block must be /28` | Entered wrong CIDR prefix | Use a /28, e.g. `10.0.0.0/28` |
| `cluster already has pending request` | Same name submitted twice | Go to Approvals and approve or reject the first one |
| `node pool name invalid` | GCP naming rule violation | Use lowercase letters, numbers, hyphens only |
| `permission denied` | Service account missing IAM roles | Add `roles/container.admin` to the service account |

---

## Connect to Your Cluster After Provisioning

Once the cluster is `completed`, run:
```bash
# Authenticate
gcloud auth activate-service-account --key-file=/path/to/service-account-key.json

# Get credentials
gcloud container clusters get-credentials CLUSTER_NAME \
  --region REGION \
  --project YOUR_PROJECT_ID

# Verify
kubectl get nodes
```

For private clusters, you need to be inside the VPC or use Cloud Shell:
```bash
gcloud cloud-shell ssh
# then run the gcloud container clusters get-credentials command above
```
