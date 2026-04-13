from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import re
import boto3

from database import get_db
from models import User, VM, Request
from routers.auth import get_current_user
import config

router = APIRouter(prefix="/logs", tags=["logs"])

_ACTION_COLORS = {
    # EC2
    "RunInstances":             "#00d4aa",
    "TerminateInstances":       "#f43f5e",
    "StopInstances":            "#f59e0b",
    "StartInstances":           "#3b82f6",
    "RebootInstances":          "#fb923c",
    # S3
    "CreateBucket":             "#00d4aa",
    "DeleteBucket":             "#f43f5e",
    "PutObject":                "#a78bfa",
    "DeleteObject":             "#f43f5e",
    "PutBucketPolicy":          "#f59e0b",
    # IAM
    "CreateUser":               "#06b6d4",
    "DeleteUser":               "#f43f5e",
    "CreateRole":               "#06b6d4",
    "DeleteRole":               "#f43f5e",
    "AttachRolePolicy":         "#f59e0b",
    "DetachRolePolicy":         "#f43f5e",
    "CreateAccessKey":          "#f59e0b",
    "DeleteAccessKey":          "#f43f5e",
    "CreateKeyPair":            "#84cc16",
    "DeleteKeyPair":            "#f43f5e",
    "ConsoleLogin":             "#3b82f6",
    # EKS
    "CreateCluster":            "#00d4aa",
    "DeleteCluster":            "#f43f5e",
    "CreateNodegroup":          "#84cc16",
    "DeleteNodegroup":          "#f43f5e",
    "UpdateClusterVersion":     "#f59e0b",
    "UpdateNodegroupConfig":    "#f59e0b",
    # RDS
    "CreateDBInstance":         "#00d4aa",
    "DeleteDBInstance":         "#f43f5e",
    "StopDBInstance":           "#f59e0b",
    "StartDBInstance":          "#3b82f6",
    "CreateDBSnapshot":         "#a78bfa",
    # Lambda
    "CreateFunction20150331":   "#00d4aa",
    "DeleteFunction20150331":   "#f43f5e",
    "UpdateFunctionCode20150331":"#f59e0b",
    "InvokeFunction":           "#3b82f6",
    # VPC/Networking
    "CreateVpc":                "#00d4aa",
    "DeleteVpc":                "#f43f5e",
    "CreateSubnet":             "#84cc16",
    "DeleteSubnet":             "#f43f5e",
    "CreateSecurityGroup":      "#06b6d4",
    "DeleteSecurityGroup":      "#f43f5e",
    "AuthorizeSecurityGroupIngress": "#f59e0b",
    "RevokeSecurityGroupIngress":    "#f43f5e",
    # Load Balancers
    "CreateLoadBalancer":       "#00d4aa",
    "DeleteLoadBalancer":       "#f43f5e",
    # CloudFormation
    "CreateStack":              "#00d4aa",
    "DeleteStack":              "#f43f5e",
    "UpdateStack":              "#f59e0b",
}

_ACTION_TYPE = {
    "Run": "EC2", "Terminate": "EC2", "Stop": "EC2", "Start": "EC2", "Reboot": "EC2",
    "CreateBucket": "S3", "DeleteBucket": "S3", "PutObject": "S3", "DeleteObject": "S3",
    "Create": "IAM", "Delete": "IAM", "Attach": "IAM", "Detach": "IAM",
    "Console": "IAM",
    "CreateCluster": "EKS", "DeleteCluster": "EKS", "CreateNodegroup": "EKS",
    "DeleteNodegroup": "EKS", "UpdateCluster": "EKS", "UpdateNodegroup": "EKS",
    "CreateDB": "RDS", "DeleteDB": "RDS", "StopDB": "RDS", "StartDB": "RDS",
    "CreateFunction": "Lambda", "DeleteFunction": "Lambda",
    "UpdateFunction": "Lambda", "Invoke": "Lambda",
    "CreateVpc": "VPC", "DeleteVpc": "VPC", "CreateSubnet": "VPC",
    "CreateSecurity": "VPC", "DeleteSecurity": "VPC",
    "CreateLoadBalancer": "ELB", "DeleteLoadBalancer": "ELB",
}

def _guess_type(action_name: str) -> str:
    """Best-effort service type from the CloudTrail event name."""
    for prefix, svc in _ACTION_TYPE.items():
        if action_name.startswith(prefix):
            return svc
    return "AWS"


@router.get("/activity")
def get_activity(
    limit: int = 50,
    hours: int = 72,           # default: last 3 days
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = []

    # ── Platform DB: VMs ──────────────────────────────────────────────────────
    try:
        vms = db.query(VM).order_by(VM.created_at.desc()).limit(30).all()
        for vm in vms:
            logs.append({
                "id":       f"vm-{vm.id}",
                "time":     vm.created_at.isoformat(),
                "type":     "EC2",
                "action":   "Launched",
                "resource": vm.name,
                "detail":   f"{vm.instance_type} in {vm.region}",
                "status":   vm.state,
                "source":   "platform",
                "color":    "#00d4aa",
            })
    except Exception as e:
        print(f"VM log error: {e}")

    # ── Platform DB: Requests ─────────────────────────────────────────────────
    try:
        reqs = db.query(Request).order_by(Request.created_at.desc()).limit(30).all()
        for r in reqs:
            color = {
                "pending":"#f59e0b", "approved":"#3b82f6", "completed":"#00d4aa",
                "failed":"#f43f5e",  "rejected":"#94a3b8", "provisioning":"#a78bfa",
            }.get(r.status, "#64748b")
            logs.append({
                "id":       f"req-{r.id}",
                "time":     r.created_at.isoformat(),
                "type":     r.resource_type.upper() if r.resource_type else "Request",
                "action":   r.status.capitalize(),
                "resource": r.resource_name,
                "detail":   f"by {r.username}",
                "status":   r.status,
                "source":   "platform",
                "color":    color,
            })
    except Exception as e:
        print(f"Request log error: {e}")

    # ── AWS CloudTrail ────────────────────────────────────────────────────────
    try:
        ct    = boto3.client("cloudtrail", region_name=config.AWS_REGION)
        end   = datetime.utcnow()
        start = end - timedelta(hours=min(hours, 90 * 24))  # cap at 90 days

        # Paginate up to 3 pages (300 events max) to cover the window
        ct_events = []
        kwargs = {
            "StartTime":  start,
            "EndTime":    end,
            "MaxResults": 50,
        }
        for _ in range(6):   # up to 6 pages × 50 = 300 events
            resp = ct.lookup_events(**kwargs)
            ct_events.extend(resp.get("Events", []))
            next_token = resp.get("NextToken")
            if not next_token:
                break
            kwargs["NextToken"] = next_token

        for event in ct_events:
            name      = event.get("EventName", "")
            username  = event.get("Username", "aws-service")
            resources = event.get("Resources", [])
            resource  = resources[0].get("ResourceName", "") if resources else ""
            logs.append({
                "id":       event.get("EventId", ""),
                "time":     event["EventTime"].isoformat() if event.get("EventTime") else "",
                "type":     _guess_type(name),
                "action":   name,
                "resource": resource or event.get("EventSource", "").replace(".amazonaws.com", ""),
                "detail":   f"by {username}",
                "status":   "success",
                "source":   "aws",
                "color":    _ACTION_COLORS.get(name, "#64748b"),
            })
    except Exception as e:
        print(f"CloudTrail error: {e}")

    # ── AWS: Live EKS clusters (bonus enrichment) ─────────────────────────────
    try:
        eks_regions = [config.AWS_REGION, "us-east-1"]
        for rgn in eks_regions:
            eks = boto3.client("eks", region_name=rgn)
            for cname in eks.list_clusters().get("clusters", []):
                try:
                    detail = eks.describe_cluster(name=cname)["cluster"]
                    logs.append({
                        "id":       f"eks-{cname}",
                        "time":     detail["createdAt"].isoformat() if detail.get("createdAt") else "",
                        "type":     "EKS",
                        "action":   "ClusterActive",
                        "resource": cname,
                        "detail":   f"v{detail.get('version','')} · {rgn} · {detail.get('status','')}",
                        "status":   detail.get("status", "").lower(),
                        "source":   "aws",
                        "color":    "#00d4aa" if detail.get("status") == "ACTIVE" else "#3b82f6",
                    })
                except Exception:
                    pass
    except Exception as e:
        print(f"EKS enrich error: {e}")

    # ── Sort & return ─────────────────────────────────────────────────────────
    logs.sort(key=lambda x: x.get("time", ""), reverse=True)
    return logs[:limit]


# ── Terraform State & Log Browsing ────────────────────────────────────────────

_VALID_ENVS  = {"dev", "staging", "prod"}
_VALID_FILES = {"main.tf", "terraform.tfvars", "apply.log"}


def _s3_client():
    return boto3.client(
        "s3",
        region_name=config.TF_STATE_REGION,
        aws_access_key_id=config.AWS_ACCESS_KEY,
        aws_secret_access_key=config.AWS_SECRET_KEY,
    )


@router.get("/state/{env}/tfstate")
def list_env_tfstate(env: str, user: User = Depends(get_current_user)):
    """List all .tfstate files in S3 for the given environment."""
    if env not in _VALID_ENVS:
        raise HTTPException(status_code=400, detail="Invalid environment")
    try:
        s3 = _s3_client()
        files = []
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=config.TF_STATE_BUCKET, Prefix=f"aionos/state/{env}/"):
            for obj in page.get("Contents", []):
                if obj["Key"].endswith(".tfstate"):
                    files.append({
                        "key":           obj["Key"],
                        "size":          obj["Size"],
                        "last_modified": obj["LastModified"].isoformat(),
                    })
        files.sort(key=lambda x: x["last_modified"], reverse=True)
        return files
    except Exception as e:
        print(f"list_env_tfstate error: {e}")
        return []


@router.get("/state/{env}/logs")
def list_env_logs(env: str, user: User = Depends(get_current_user)):
    """List deployment log folders grouped by request for the given environment."""
    if env not in _VALID_ENVS:
        raise HTTPException(status_code=400, detail="Invalid environment")
    try:
        s3 = _s3_client()
        prefix = f"aionos/logs/{env}/"
        req_map = {}
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=config.TF_STATE_BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                # e.g. logs/prod/req_42/apply.log  →  parts = ["req_42", "apply.log"]
                parts = obj["Key"][len(prefix):].split("/")
                if len(parts) == 2 and parts[0] and parts[1]:
                    req_id, filename = parts
                    if not re.match(r"^req_\d+$", req_id):
                        continue
                    ts = obj["LastModified"].isoformat()
                    if req_id not in req_map:
                        req_map[req_id] = {"req_id": req_id, "files": [], "timestamp": ts}
                    req_map[req_id]["files"].append(filename)
                    if ts > req_map[req_id]["timestamp"]:
                        req_map[req_id]["timestamp"] = ts
        result = list(req_map.values())
        result.sort(
            key=lambda x: int(x["req_id"].replace("req_", "")) if x["req_id"].replace("req_", "").isdigit() else 0,
            reverse=True,
        )
        return result
    except Exception as e:
        print(f"list_env_logs error: {e}")
        return []


@router.get("/state/{env}/logs/{req_id}/{filename}")
def get_log_file(env: str, req_id: str, filename: str, user: User = Depends(get_current_user)):
    """Retrieve the text content of a specific log file."""
    if env not in _VALID_ENVS:
        raise HTTPException(status_code=400, detail="Invalid environment")
    if not re.match(r"^req_\d+$", req_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    if filename not in _VALID_FILES:
        raise HTTPException(status_code=400, detail="Invalid filename")
    try:
        s3  = _s3_client()
        key = f"aionos/logs/{env}/{req_id}/{filename}"
        obj = s3.get_object(Bucket=config.TF_STATE_BUCKET, Key=key)
        return {"content": obj["Body"].read().decode("utf-8")}
    except s3.exceptions.NoSuchKey:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
