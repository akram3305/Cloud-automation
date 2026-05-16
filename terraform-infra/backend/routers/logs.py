# -*- coding: utf-8 -*-
"""
routers/logs.py — Unified activity log for AWS, Azure, GCP and platform events.
Also provides user-action recording and TF state / log browsing.
"""
import base64
import re
import os
from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import boto3

from database import get_db
from models import User, VM, Request
from models.cloud_credential import CloudCredential
from models.user_activity import UserActivity
from routers.auth import get_current_user
import config

router = APIRouter(prefix="/logs", tags=["logs"])

# ── Colour maps ───────────────────────────────────────────────────────────────

_ACTION_COLORS = {
    "RunInstances": "#00d4aa", "TerminateInstances": "#f43f5e",
    "StopInstances": "#f59e0b", "StartInstances": "#3b82f6",
    "RebootInstances": "#fb923c",
    "CreateBucket": "#00d4aa", "DeleteBucket": "#f43f5e",
    "PutObject": "#a78bfa", "DeleteObject": "#f43f5e",
    "PutBucketPolicy": "#f59e0b",
    "CreateUser": "#06b6d4", "DeleteUser": "#f43f5e",
    "CreateRole": "#06b6d4", "DeleteRole": "#f43f5e",
    "AttachRolePolicy": "#f59e0b", "DetachRolePolicy": "#f43f5e",
    "CreateAccessKey": "#f59e0b", "DeleteAccessKey": "#f43f5e",
    "CreateKeyPair": "#84cc16", "DeleteKeyPair": "#f43f5e",
    "ConsoleLogin": "#3b82f6",
    "CreateCluster": "#00d4aa", "DeleteCluster": "#f43f5e",
    "CreateNodegroup": "#84cc16", "DeleteNodegroup": "#f43f5e",
    "UpdateClusterVersion": "#f59e0b", "UpdateNodegroupConfig": "#f59e0b",
    "CreateDBInstance": "#00d4aa", "DeleteDBInstance": "#f43f5e",
    "StopDBInstance": "#f59e0b", "StartDBInstance": "#3b82f6",
    "CreateDBSnapshot": "#a78bfa",
    "CreateFunction20150331": "#00d4aa", "DeleteFunction20150331": "#f43f5e",
    "UpdateFunctionCode20150331": "#f59e0b", "InvokeFunction": "#3b82f6",
    "CreateVpc": "#00d4aa", "DeleteVpc": "#f43f5e",
    "CreateSubnet": "#84cc16", "DeleteSubnet": "#f43f5e",
    "CreateSecurityGroup": "#06b6d4", "DeleteSecurityGroup": "#f43f5e",
    "AuthorizeSecurityGroupIngress": "#f59e0b",
    "RevokeSecurityGroupIngress": "#f43f5e",
    "CreateLoadBalancer": "#00d4aa", "DeleteLoadBalancer": "#f43f5e",
    "CreateStack": "#00d4aa", "DeleteStack": "#f43f5e", "UpdateStack": "#f59e0b",
}

_ACTION_TYPE = {
    "Run": "EC2", "Terminate": "EC2", "Stop": "EC2", "Start": "EC2", "Reboot": "EC2",
    "CreateBucket": "S3", "DeleteBucket": "S3", "PutObject": "S3", "DeleteObject": "S3",
    "Create": "IAM", "Delete": "IAM", "Attach": "IAM", "Detach": "IAM", "Console": "IAM",
    "CreateCluster": "EKS", "DeleteCluster": "EKS", "CreateNodegroup": "EKS",
    "DeleteNodegroup": "EKS", "UpdateCluster": "EKS", "UpdateNodegroup": "EKS",
    "CreateDB": "RDS", "DeleteDB": "RDS", "StopDB": "RDS", "StartDB": "RDS",
    "CreateFunction": "Lambda", "DeleteFunction": "Lambda",
    "UpdateFunction": "Lambda", "Invoke": "Lambda",
    "CreateVpc": "VPC", "DeleteVpc": "VPC", "CreateSubnet": "VPC",
    "CreateSecurity": "VPC", "DeleteSecurity": "VPC",
    "CreateLoadBalancer": "ELB", "DeleteLoadBalancer": "ELB",
}

_STATUS_COLORS = {
    "pending": "#f59e0b", "approved": "#3b82f6", "completed": "#00d4aa",
    "failed": "#f43f5e", "rejected": "#94a3b8", "provisioning": "#a78bfa",
    "success": "#00d4aa", "error": "#f43f5e", "running": "#00d4aa",
    "stopped": "#f59e0b", "terminated": "#f43f5e",
}


def _guess_type(action_name: str) -> str:
    for prefix, svc in _ACTION_TYPE.items():
        if action_name.startswith(prefix):
            return svc
    return "AWS"


# ── Credential helper ─────────────────────────────────────────────────────────

def _db_cred(db: Session, provider: str, key: str) -> str:
    row = (db.query(CloudCredential)
           .filter(CloudCredential.provider == provider, CloudCredential.key_name == key)
           .first())
    if row and row.value_enc:
        try:
            return base64.b64decode(row.value_enc.encode()).decode()
        except Exception:
            pass
    return os.getenv(key, "")


# ── GCP activity helper ───────────────────────────────────────────────────────

def _fetch_gcp_activity(db: Session, hours: int) -> list:
    events = []
    try:
        from services import gcp_client

        creds_json = _db_cred(db, "gcp", "GCP_CREDENTIALS_JSON")
        project_id = _db_cred(db, "gcp", "GCP_PROJECT_ID") or gcp_client.GCP_PROJECT_ID
        if not project_id:
            return events

        creds = None
        if creds_json:
            try:
                creds = gcp_client.build_credentials_from_json(creds_json)
            except Exception:
                pass
        if creds is None and gcp_client.CONFIGURED:
            try:
                creds = gcp_client._get_credentials()
            except Exception:
                pass
        if creds is None:
            return events

        # List recent compute instances as activity
        try:
            instances = gcp_client.list_instances(project_id, creds=creds)
            cutoff = datetime.utcnow() - timedelta(hours=max(hours, 24 * 30))
            for inst in instances[:40]:
                status = inst.get("status", "UNKNOWN")
                color = "#00d4aa" if status == "RUNNING" else "#f59e0b" if status == "STOPPED" else "#f43f5e"
                events.append({
                    "id":            f"gcp-vm-{inst.get('id', inst.get('name', ''))}",
                    "time":          inst.get("creationTimestamp", datetime.utcnow().isoformat()),
                    "type":          "Compute",
                    "action":        f"Instance {status.capitalize()}",
                    "resource":      inst.get("name", ""),
                    "detail":        f"{inst.get('machineType','').split('/')[-1]} · {inst.get('zone','').split('/')[-1]}",
                    "status":        status.lower(),
                    "source":        "gcp",
                    "cloud":         "gcp",
                    "color":         color,
                    "user":          "gcp-service",
                })
        except Exception:
            pass

        # List recent GCP Storage buckets as activity
        try:
            from google.cloud import storage as gcs
            sc = gcs.Client(project=project_id, credentials=creds)
            for bucket in list(sc.list_buckets())[:20]:
                events.append({
                    "id":       f"gcp-bucket-{bucket.name}",
                    "time":     bucket.time_created.isoformat() if bucket.time_created else datetime.utcnow().isoformat(),
                    "type":     "Storage",
                    "action":   "Bucket Active",
                    "resource": bucket.name,
                    "detail":   f"location: {bucket.location or 'unknown'}",
                    "status":   "active",
                    "source":   "gcp",
                    "cloud":    "gcp",
                    "color":    "#34A853",
                    "user":     "gcp-service",
                })
        except Exception:
            pass

    except Exception as e:
        print(f"GCP activity error: {e}")
    return events


# ── Azure activity helper ─────────────────────────────────────────────────────

def _fetch_azure_activity(db: Session) -> list:
    events = []
    try:
        subscription_id = _db_cred(db, "azure", "AZURE_SUBSCRIPTION_ID")
        client_id       = _db_cred(db, "azure", "AZURE_CLIENT_ID")
        client_secret   = _db_cred(db, "azure", "AZURE_CLIENT_SECRET")
        tenant_id       = _db_cred(db, "azure", "AZURE_TENANT_ID")

        if not all([subscription_id, client_id, client_secret, tenant_id]):
            return events

        from azure.identity import ClientSecretCredential
        from azure.mgmt.compute import ComputeManagementClient

        cred    = ClientSecretCredential(tenant_id, client_id, client_secret)
        compute = ComputeManagementClient(cred, subscription_id)

        for vm in list(compute.virtual_machines.list_all())[:30]:
            status = "unknown"
            color  = "#0078D4"
            try:
                iv = compute.virtual_machines.instance_view(
                    vm.id.split("/")[4], vm.name
                )
                statuses = iv.statuses or []
                for s in statuses:
                    if s.code and s.code.startswith("PowerState/"):
                        status = s.code.split("/")[1]
                        color  = "#00d4aa" if status == "running" else "#f59e0b"
            except Exception:
                pass

            events.append({
                "id":       f"azure-vm-{vm.name}",
                "time":     datetime.utcnow().isoformat(),
                "type":     "VM",
                "action":   f"VM {status.capitalize()}",
                "resource": vm.name,
                "detail":   f"{vm.location} · {(vm.hardware_profile.vm_size if vm.hardware_profile else '')}",
                "status":   status,
                "source":   "azure",
                "cloud":    "azure",
                "color":    color,
                "user":     "azure-service",
            })
    except Exception as e:
        print(f"Azure activity error: {e}")
    return events


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/activity")
def get_activity(
    limit:  int = 100,
    hours:  int = 72,
    cloud:  str = "all",   # all | aws | azure | gcp | platform
    db:     Session = Depends(get_db),
    user:   User    = Depends(get_current_user),
):
    logs = []

    # ── Platform DB: UserActivity ─────────────────────────────────────────────
    if cloud in ("all", "platform"):
        try:
            acts = (db.query(UserActivity)
                    .order_by(UserActivity.created_at.desc())
                    .limit(60).all())
            for a in acts:
                logs.append({
                    "id":       f"ua-{a.id}",
                    "time":     a.created_at.isoformat(),
                    "type":     a.resource_type or "Action",
                    "action":   a.action,
                    "resource": a.resource,
                    "detail":   a.detail,
                    "status":   a.status,
                    "source":   "platform",
                    "cloud":    a.cloud,
                    "color":    _STATUS_COLORS.get(a.status, "#64748b"),
                    "user":     a.username,
                })
        except Exception as e:
            print(f"UserActivity log error: {e}")

    # ── Platform DB: VMs ─────────────────────────────────────────────────────
    if cloud in ("all", "platform", "aws"):
        try:
            vms = db.query(VM).order_by(VM.created_at.desc()).limit(30).all()
            for vm in vms:
                vm_cloud = getattr(vm, "cloud", "aws") or "aws"
                if cloud != "all" and vm_cloud != cloud and cloud != "platform":
                    continue
                logs.append({
                    "id":       f"vm-{vm.id}",
                    "time":     vm.created_at.isoformat(),
                    "type":     "EC2" if vm_cloud == "aws" else "VM",
                    "action":   "Instance Launched",
                    "resource": vm.name,
                    "detail":   f"{vm.instance_type} in {vm.region}",
                    "status":   vm.state,
                    "source":   "platform",
                    "cloud":    vm_cloud,
                    "color":    "#00d4aa",
                    "user":     getattr(vm, "created_by", "system") or "system",
                })
        except Exception as e:
            print(f"VM log error: {e}")

    # ── Platform DB: Requests ─────────────────────────────────────────────────
    if cloud in ("all", "platform"):
        try:
            reqs = db.query(Request).order_by(Request.created_at.desc()).limit(40).all()
            for r in reqs:
                logs.append({
                    "id":       f"req-{r.id}",
                    "time":     r.created_at.isoformat(),
                    "type":     r.resource_type.upper() if r.resource_type else "Request",
                    "action":   r.status.capitalize(),
                    "resource": r.resource_name,
                    "detail":   f"Requested by {r.username}",
                    "status":   r.status,
                    "source":   "platform",
                    "cloud":    "platform",
                    "color":    _STATUS_COLORS.get(r.status, "#64748b"),
                    "user":     r.username,
                })
        except Exception as e:
            print(f"Request log error: {e}")

    # ── AWS CloudTrail ────────────────────────────────────────────────────────
    if cloud in ("all", "aws"):
        try:
            ct    = boto3.client("cloudtrail", region_name=config.AWS_REGION)
            end   = datetime.utcnow()
            start = end - timedelta(hours=min(hours, 90 * 24))
            ct_events = []
            kwargs = {"StartTime": start, "EndTime": end, "MaxResults": 50}
            for _ in range(6):
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
                    "detail":   f"via CloudTrail · {event.get('EventSource','').replace('.amazonaws.com','')}",
                    "status":   "success",
                    "source":   "aws",
                    "cloud":    "aws",
                    "color":    _ACTION_COLORS.get(name, "#FF9900"),
                    "user":     username,
                })
        except Exception as e:
            print(f"CloudTrail error: {e}")

    # ── GCP activity ─────────────────────────────────────────────────────────
    if cloud in ("all", "gcp"):
        logs.extend(_fetch_gcp_activity(db, hours))

    # ── Azure activity ────────────────────────────────────────────────────────
    if cloud in ("all", "azure"):
        logs.extend(_fetch_azure_activity(db))

    # ── Sort & deduplicate ────────────────────────────────────────────────────
    seen = set()
    unique = []
    for l in logs:
        if l["id"] not in seen:
            seen.add(l["id"])
            unique.append(l)

    unique.sort(key=lambda x: x.get("time", ""), reverse=True)
    return unique[:limit]


# ── Record user action ────────────────────────────────────────────────────────

class ActionIn(BaseModel):
    cloud:         str = "platform"
    action:        str
    resource_type: str = ""
    resource:      str = ""
    detail:        str = ""
    status:        str = "success"


@router.post("/user-action")
def record_user_action(
    body:    ActionIn,
    request: FastAPIRequest,
    db:      Session = Depends(get_db),
    user:    User    = Depends(get_current_user),
):
    ip = request.client.host if request.client else ""
    act = UserActivity(
        username      = user.username,
        cloud         = body.cloud,
        action        = body.action,
        resource_type = body.resource_type,
        resource      = body.resource,
        detail        = body.detail,
        status        = body.status,
        ip_address    = ip,
    )
    db.add(act)
    db.commit()
    return {"ok": True}


@router.get("/users/summary")
def users_activity_summary(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Per-user action count summary for the admin view."""
    try:
        rows = (db.query(
                    UserActivity.username,
                    UserActivity.cloud,
                )
                .order_by(UserActivity.created_at.desc())
                .limit(500).all())
        from collections import Counter
        by_user: dict = {}
        for uname, cloud in rows:
            if uname not in by_user:
                by_user[uname] = {"username": uname, "total": 0, "clouds": Counter()}
            by_user[uname]["total"] += 1
            by_user[uname]["clouds"][cloud] += 1
        result = []
        for v in by_user.values():
            result.append({
                "username": v["username"],
                "total":    v["total"],
                "clouds":   dict(v["clouds"]),
            })
        result.sort(key=lambda x: -x["total"])
        return result
    except Exception as e:
        return []


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
    if env not in _VALID_ENVS:
        raise HTTPException(status_code=400, detail="Invalid environment")
    try:
        s3 = _s3_client()
        files = []
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=config.TF_STATE_BUCKET, Prefix=f"aionos/state/{env}/"):
            for obj in page.get("Contents", []):
                if obj["Key"].endswith(".tfstate"):
                    files.append({"key": obj["Key"], "size": obj["Size"], "last_modified": obj["LastModified"].isoformat()})
        files.sort(key=lambda x: x["last_modified"], reverse=True)
        return files
    except Exception as e:
        return []


@router.get("/state/{env}/logs")
def list_env_logs(env: str, user: User = Depends(get_current_user)):
    if env not in _VALID_ENVS:
        raise HTTPException(status_code=400, detail="Invalid environment")
    try:
        s3 = _s3_client()
        prefix = f"aionos/logs/{env}/"
        req_map = {}
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=config.TF_STATE_BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                parts = obj["Key"][len(prefix):].split("/")
                if len(parts) == 3 and parts[1] and parts[2]:
                    cloud, req_id, filename = parts
                    if not re.match(r"^req_\d+$", req_id):
                        continue
                elif len(parts) == 2 and parts[0] and parts[1]:
                    req_id, filename = parts
                    cloud = "aws"
                    if not re.match(r"^req_\d+$", req_id):
                        continue
                else:
                    continue
                ts  = obj["LastModified"].isoformat()
                key = f"{cloud}/{req_id}"
                if key not in req_map:
                    req_map[key] = {"req_id": req_id, "cloud": cloud, "files": [], "timestamp": ts}
                req_map[key]["files"].append(filename)
                if ts > req_map[key]["timestamp"]:
                    req_map[key]["timestamp"] = ts
        result = list(req_map.values())
        result.sort(key=lambda x: int(x["req_id"].replace("req_", "")) if x["req_id"].replace("req_", "").isdigit() else 0, reverse=True)
        return result
    except Exception as e:
        return []


@router.get("/cloud/{cloud}/index")
def get_cloud_index_endpoint(cloud: str, user: User = Depends(get_current_user)):
    if cloud not in {"aws", "azure", "gcp"}:
        raise HTTPException(status_code=400, detail="Invalid cloud")
    from services.terraform_service import get_cloud_index
    return get_cloud_index(cloud)


@router.get("/cloud/{cloud}/{env}/log")
def get_cloud_log_endpoint(cloud: str, env: str, user: User = Depends(get_current_user)):
    if cloud not in {"aws", "azure", "gcp"}:
        raise HTTPException(status_code=400, detail="Invalid cloud")
    if env not in _VALID_ENVS:
        raise HTTPException(status_code=400, detail="Invalid environment")
    from services.terraform_service import get_cloud_log
    return {"content": get_cloud_log(cloud, env)}


@router.get("/state/{env}/logs/{cloud}/{req_id}/{filename}")
def get_log_file(env: str, cloud: str, req_id: str, filename: str, user: User = Depends(get_current_user)):
    _VALID_CLOUDS = {"aws", "azure", "gcp"}
    if env not in _VALID_ENVS:
        raise HTTPException(status_code=400, detail="Invalid environment")
    if cloud not in _VALID_CLOUDS:
        raise HTTPException(status_code=400, detail="Invalid cloud")
    if not re.match(r"^req_\d+$", req_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    if filename not in _VALID_FILES:
        raise HTTPException(status_code=400, detail="Invalid filename")
    try:
        s3  = _s3_client()
        key = f"aionos/logs/{env}/{cloud}/{req_id}/{filename}"
        obj = s3.get_object(Bucket=config.TF_STATE_BUCKET, Key=key)
        return {"content": obj["Body"].read().decode("utf-8")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
