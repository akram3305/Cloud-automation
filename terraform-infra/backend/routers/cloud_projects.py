# -*- coding: utf-8 -*-
"""
routers/cloud_projects.py — Discover all cloud accounts / subscriptions / GCP projects
and return their month-to-date cost.

Falls back gracefully if APIs are unavailable or credentials are missing.
"""
import base64
import os
from datetime import datetime
from typing import List, Dict, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User
from models.cloud_credential import CloudCredential
from routers.auth import get_current_user

router = APIRouter(prefix="/cloud-projects", tags=["cloud-projects"])


# ── Credential helper ──────────────────────────────────────────────────────────

def _cred(db: Session, provider: str, key: str) -> str:
    row = (
        db.query(CloudCredential)
        .filter(CloudCredential.provider == provider, CloudCredential.key_name == key)
        .first()
    )
    if row and row.value_enc:
        try:
            return base64.b64decode(row.value_enc.encode()).decode()
        except Exception:
            pass
    return os.getenv(key, "")


# ── AWS ────────────────────────────────────────────────────────────────────────

def _aws_projects(db: Session) -> List[Dict[str, Any]]:
    access_key = _cred(db, "aws", "AWS_ACCESS_KEY_ID")
    secret_key = _cred(db, "aws", "AWS_SECRET_ACCESS_KEY")
    region     = _cred(db, "aws", "AWS_DEFAULT_REGION") or "ap-south-1"

    if not (access_key and secret_key):
        return []

    try:
        import boto3

        sts            = boto3.client("sts", aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name=region)
        current_account = sts.get_caller_identity()["Account"]

        # Try AWS Organizations
        accounts: List[Dict] = []
        try:
            org = boto3.client("organizations", aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name="us-east-1")
            paginator = org.get_paginator("list_accounts")
            for page in paginator.paginate():
                accounts.extend(page.get("Accounts", []))
        except Exception:
            accounts = [{"Id": current_account, "Name": f"Account {current_account}", "Status": "ACTIVE", "Email": ""}]

        # Cost Explorer — grouped by linked account
        today       = datetime.utcnow()
        start       = today.replace(day=1).strftime("%Y-%m-%d")
        end         = today.strftime("%Y-%m-%d")
        if start == end:
            end = today.strftime("%Y-%m-%d")

        cost_by_acct: Dict[str, float] = {}
        try:
            ce = boto3.client("ce", aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name="us-east-1")
            resp = ce.get_cost_and_usage(
                TimePeriod={"Start": start, "End": end},
                Granularity="MONTHLY",
                Metrics=["UnblendedCost"],
                GroupBy=[{"Type": "DIMENSION", "Key": "LINKED_ACCOUNT"}],
            )
            for result in resp.get("ResultsByTime", []):
                for group in result.get("Groups", []):
                    acct_id = group["Keys"][0]
                    cost_by_acct[acct_id] = round(float(group["Metrics"]["UnblendedCost"]["Amount"]), 2)
        except Exception:
            # Fallback: total cost for current account
            try:
                ce = boto3.client("ce", aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name="us-east-1")
                resp = ce.get_cost_and_usage(
                    TimePeriod={"Start": start, "End": end},
                    Granularity="MONTHLY",
                    Metrics=["UnblendedCost"],
                )
                total = float(resp["ResultsByTime"][0]["Total"]["UnblendedCost"]["Amount"])
                cost_by_acct[current_account] = round(total, 2)
            except Exception:
                pass

        return [
            {
                "id":         acct["Id"],
                "name":       acct.get("Name", acct["Id"]),
                "cloud":      "aws",
                "status":     acct.get("Status", "ACTIVE"),
                "email":      acct.get("Email", ""),
                "cost_mtd":   cost_by_acct.get(acct["Id"], 0.0),
                "currency":   "USD",
                "is_current": acct["Id"] == current_account,
            }
            for acct in accounts
        ]

    except Exception as exc:
        return [{
            "id": "aws-error", "name": "AWS (connection error)",
            "cloud": "aws", "status": "ERROR",
            "email": "", "cost_mtd": 0.0, "currency": "USD",
            "error": str(exc), "is_current": True,
        }]


# ── Azure ──────────────────────────────────────────────────────────────────────

def _azure_sub_cost(tenant_id: str, sub_id: str, client_id: str, client_secret: str) -> float:
    """Estimate monthly cost for an Azure subscription by summing running VM prices."""
    try:
        from azure.identity import ClientSecretCredential
        from azure.mgmt.compute import ComputeManagementClient

        _VM_PRICES: Dict[str, float] = {
            "Standard_B1s": 0.0114, "Standard_B1ms": 0.0214, "Standard_B2s": 0.0466,
            "Standard_B2ms": 0.0933, "Standard_B4ms": 0.1866, "Standard_B8ms": 0.3733,
            "Standard_D2s_v3": 0.1100, "Standard_D4s_v3": 0.2200, "Standard_D8s_v3": 0.4400,
            "Standard_D2s_v5": 0.0960, "Standard_D4s_v5": 0.1920, "Standard_D8s_v5": 0.3840,
            "Standard_F2s_v2": 0.0872, "Standard_F4s_v2": 0.1744, "Standard_F8s_v2": 0.3488,
            "Standard_E2s_v3": 0.1306, "Standard_E4s_v3": 0.2612, "Standard_E8s_v3": 0.5224,
        }

        def _price(size: str) -> float:
            if not size:
                return 0.05
            # Normalize: Standard_D2s_v3 → exact match
            hit = _VM_PRICES.get(size)
            if hit:
                return hit
            # Fuzzy: case-insensitive prefix
            s = size.lower()
            for k, v in _VM_PRICES.items():
                if s.startswith(k.lower()[:8]):
                    return v
            return 0.05

        cred    = ClientSecretCredential(tenant_id=tenant_id, client_id=client_id, client_secret=client_secret)
        compute = ComputeManagementClient(cred, sub_id)
        total   = 0.0
        for vm in compute.virtual_machines.list_all():
            try:
                rg    = vm.id.split("/resourceGroups/")[1].split("/")[0]
                iv    = compute.virtual_machines.get(rg, vm.name, expand="instanceView")
                state = "unknown"
                for s in (iv.instance_view.statuses or []):
                    if s.code and s.code.startswith("PowerState/"):
                        state = s.code.split("/")[1]
                        break
                if state == "running":
                    size = vm.hardware_profile.vm_size if vm.hardware_profile else ""
                    total += _price(size) * 730
            except Exception:
                pass
        return round(total, 2)
    except Exception:
        return 0.0


def _azure_projects(db: Session) -> List[Dict[str, Any]]:
    tenant_id = _cred(db, "azure", "AZURE_TENANT_ID")
    projects  = []

    for sub_key, prefix, label in [
        ("prod",         "PROD",         "Production"),
        ("nonprod",      "NONPROD",      "Non-Production"),
        ("connectivity", "CONNECTIVITY", "Connectivity"),
    ]:
        sub_id        = _cred(db, "azure", f"AZURE_{prefix}_SUBSCRIPTION_ID")
        client_id     = _cred(db, "azure", f"AZURE_{prefix}_CLIENT_ID")
        client_secret = _cred(db, "azure", f"AZURE_{prefix}_CLIENT_SECRET")

        if not (tenant_id and sub_id and client_id and client_secret):
            continue

        cost_mtd = _azure_sub_cost(tenant_id, sub_id, client_id, client_secret)

        projects.append({
            "id":         sub_id,
            "name":       label,
            "cloud":      "azure",
            "status":     "ACTIVE",
            "sub_key":    sub_key,
            "cost_mtd":   cost_mtd,
            "currency":   "USD",
            "is_current": True,
        })

    return projects


# ── GCP ────────────────────────────────────────────────────────────────────────

_GCP_MACHINE_PRICES: Dict[str, float] = {
    "e2-micro": 0.0084, "e2-small": 0.0168, "e2-medium": 0.0335,
    "e2-standard-2": 0.0670, "e2-standard-4": 0.1340, "e2-standard-8": 0.2684,
    "n2-standard-2": 0.0971, "n2-standard-4": 0.1942, "n2-standard-8": 0.3885,
    "n1-standard-1": 0.0475, "n1-standard-2": 0.0950, "n1-standard-4": 0.1900,
    "n1-standard-8": 0.3800, "c2-standard-4": 0.2088, "c2-standard-8": 0.4176,
}


def _gcp_vm_price(machine_type: str) -> float:
    if not machine_type:
        return 0.05
    t = machine_type.split("/")[-1].lower()
    if t in _GCP_MACHINE_PRICES:
        return _GCP_MACHINE_PRICES[t]
    for k, v in _GCP_MACHINE_PRICES.items():
        if t.startswith(k[:6]):
            return v
    return 0.05


def _gcp_project_cost(creds, project_id: str) -> float:
    """Estimate GCP project cost from running Compute instances."""
    try:
        from googleapiclient.discovery import build
        svc   = build("compute", "v1", credentials=creds)
        total = 0.0
        req   = svc.instances().aggregatedList(project=project_id, filter="status=RUNNING")
        while req:
            resp = req.execute()
            for zone_data in resp.get("items", {}).values():
                for inst in zone_data.get("instances", []):
                    mt = inst.get("machineType", "").split("/")[-1]
                    total += _gcp_vm_price(mt) * 730
            req = svc.instances().aggregatedList_next(req, resp)
        return round(total, 2)
    except Exception:
        return 0.0


def _gcp_projects(db: Session) -> List[Dict[str, Any]]:
    default_project = _cred(db, "gcp", "GCP_PROJECT_ID")
    creds_json      = _cred(db, "gcp", "GCP_CREDENTIALS_JSON")

    if not creds_json:
        return []

    try:
        import json
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        info  = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )

        # Discover all accessible projects
        raw_projects: List[Dict] = []
        try:
            rm  = build("cloudresourcemanager", "v1", credentials=creds)
            req = rm.projects().list()
            while req:
                resp = req.execute()
                raw_projects.extend(resp.get("projects", []))
                req  = rm.projects().list_next(req, resp)
        except Exception:
            if default_project:
                raw_projects = [{"projectId": default_project, "name": default_project, "lifecycleState": "ACTIVE"}]

        results = []
        for proj in raw_projects:
            proj_id    = proj.get("projectId", "")
            cost_mtd   = _gcp_project_cost(creds, proj_id)
            results.append({
                "id":         proj_id,
                "name":       proj.get("name", proj_id),
                "cloud":      "gcp",
                "status":     "ACTIVE" if proj.get("lifecycleState") == "ACTIVE" else proj.get("lifecycleState", "UNKNOWN"),
                "cost_mtd":   cost_mtd,
                "currency":   "USD",
                "is_current": proj_id == default_project,
            })
        return results

    except Exception as exc:
        if default_project:
            return [{
                "id": default_project, "name": default_project,
                "cloud": "gcp", "status": "ACTIVE",
                "cost_mtd": 0.0, "currency": "USD",
                "is_current": True, "error": str(exc),
            }]
        return []


# ── Main endpoint ──────────────────────────────────────────────────────────────

@router.get("")
def list_cloud_projects(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Return all AWS accounts, Azure subscriptions, and GCP projects
    that are accessible with the configured org-level credentials,
    along with their month-to-date cost estimate.
    """
    projects: List[Dict[str, Any]] = []
    projects.extend(_aws_projects(db))
    projects.extend(_azure_projects(db))
    projects.extend(_gcp_projects(db))

    total_cost = round(sum(p.get("cost_mtd", 0) for p in projects), 2)

    return {
        "projects":   projects,
        "total_cost": total_cost,
        "currency":   "USD",
        "as_of":      datetime.utcnow().isoformat() + "Z",
    }
