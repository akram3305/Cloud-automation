# -*- coding: utf-8 -*-
"""
routers/credentials.py — Organization-level cloud credential management.
Admin can store/update credentials for AWS, Azure, and GCP.
Values are base64-encoded at rest; secrets are masked on read.
"""
import base64
import os
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from models.cloud_credential import CloudCredential
from routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/credentials", tags=["credentials"])

# ── Key definitions ────────────────────────────────────────────────────────────

AWS_KEYS = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_DEFAULT_REGION"]

AZURE_KEYS = [
    "AZURE_TENANT_ID",
    "AZURE_PROD_SUBSCRIPTION_ID",       "AZURE_PROD_CLIENT_ID",       "AZURE_PROD_CLIENT_SECRET",
    "AZURE_NONPROD_SUBSCRIPTION_ID",    "AZURE_NONPROD_CLIENT_ID",    "AZURE_NONPROD_CLIENT_SECRET",
    "AZURE_CONNECTIVITY_SUBSCRIPTION_ID","AZURE_CONNECTIVITY_CLIENT_ID","AZURE_CONNECTIVITY_CLIENT_SECRET",
]

GCP_KEYS = ["GCP_PROJECT_ID", "GCP_ORG_ID", "GCP_CREDENTIALS_JSON"]

PROVIDER_KEYS: Dict[str, list] = {"aws": AWS_KEYS, "azure": AZURE_KEYS, "gcp": GCP_KEYS}

SECRET_FIELDS = {
    "AWS_SECRET_ACCESS_KEY",
    "AZURE_PROD_CLIENT_SECRET", "AZURE_NONPROD_CLIENT_SECRET", "AZURE_CONNECTIVITY_CLIENT_SECRET",
    "GCP_CREDENTIALS_JSON",
}

MASK = "••••••••"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _encode(val: str) -> str:
    return base64.b64encode(val.encode()).decode()


def _decode(enc: str) -> str:
    try:
        return base64.b64decode(enc.encode()).decode()
    except Exception:
        return enc


def _mask(val: str) -> str:
    if not val:
        return ""
    return val[:4] + "••••" if len(val) > 4 else MASK


def _get_cred(db: Session, provider: str, key_name: str) -> str:
    row = (
        db.query(CloudCredential)
        .filter(CloudCredential.provider == provider, CloudCredential.key_name == key_name)
        .first()
    )
    if row and row.value_enc:
        return _decode(row.value_enc)
    return os.getenv(key_name, "")


def _set_cred(db: Session, provider: str, key_name: str, value: str, label: str = "") -> None:
    row = (
        db.query(CloudCredential)
        .filter(CloudCredential.provider == provider, CloudCredential.key_name == key_name)
        .first()
    )
    if row:
        row.value_enc = _encode(value)
    else:
        db.add(CloudCredential(
            provider=provider,
            key_name=key_name,
            value_enc=_encode(value),
            label=label or key_name,
        ))


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("")
def get_credentials(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Return all org credentials; secret fields are masked."""
    result: Dict[str, Dict[str, str]] = {}
    for provider, keys in PROVIDER_KEYS.items():
        result[provider] = {}
        for key in keys:
            val = _get_cred(db, provider, key)
            result[provider][key] = _mask(val) if key in SECRET_FIELDS else (val or "")
    return result


class CredentialUpdate(BaseModel):
    aws:   Optional[Dict[str, str]] = None
    azure: Optional[Dict[str, str]] = None
    gcp:   Optional[Dict[str, str]] = None


@router.put("")
def update_credentials(
    body: CredentialUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """Update credentials for one or more providers (admin only)."""
    updates = {}
    if body.aws:   updates["aws"]   = body.aws
    if body.azure: updates["azure"] = body.azure
    if body.gcp:   updates["gcp"]   = body.gcp

    for provider, fields in updates.items():
        allowed = PROVIDER_KEYS.get(provider, [])
        for key, value in fields.items():
            if key not in allowed:
                continue
            if not value or "••••" in value:
                continue
            _set_cred(db, provider, key, value.strip())

    db.commit()
    return {"ok": True}


@router.post("/{provider}/test")
def test_credentials(
    provider: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Test connectivity using stored credentials for the given provider."""
    if provider == "aws":
        return _test_aws(db)
    if provider == "azure":
        return _test_azure(db)
    if provider == "gcp":
        return _test_gcp(db)
    raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")


# ── Provider test helpers ──────────────────────────────────────────────────────

def _test_aws(db: Session):
    access_key = _get_cred(db, "aws", "AWS_ACCESS_KEY_ID")
    secret_key = _get_cred(db, "aws", "AWS_SECRET_ACCESS_KEY")
    region     = _get_cred(db, "aws", "AWS_DEFAULT_REGION") or "ap-south-1"

    if not access_key or not secret_key:
        return {"ok": False, "message": "AWS credentials not configured"}

    try:
        import boto3
        sts = boto3.client(
            "sts",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )
        identity   = sts.get_caller_identity()
        account_id = identity["Account"]

        try:
            org = boto3.client(
                "organizations",
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name="us-east-1",
            )
            accounts = org.list_accounts().get("Accounts", [])
            return {"ok": True, "message": f"Account {account_id} · {len(accounts)} org accounts found"}
        except Exception:
            return {"ok": True, "message": f"Connected as account {account_id} (no Organizations access)"}

    except Exception as exc:
        return {"ok": False, "message": str(exc)}


def _test_azure(db: Session):
    tenant_id = _get_cred(db, "azure", "AZURE_TENANT_ID")
    results   = []

    for sub_key, prefix in [("prod", "PROD"), ("nonprod", "NONPROD"), ("connectivity", "CONNECTIVITY")]:
        sub_id        = _get_cred(db, "azure", f"AZURE_{prefix}_SUBSCRIPTION_ID")
        client_id     = _get_cred(db, "azure", f"AZURE_{prefix}_CLIENT_ID")
        client_secret = _get_cred(db, "azure", f"AZURE_{prefix}_CLIENT_SECRET")

        if not (tenant_id and sub_id and client_id and client_secret):
            continue
        try:
            from azure.identity import ClientSecretCredential
            from azure.mgmt.resource import ResourceManagementClient
            cred = ClientSecretCredential(
                tenant_id=tenant_id, client_id=client_id, client_secret=client_secret
            )
            rmc  = ResourceManagementClient(cred, sub_id)
            rgs  = list(rmc.resource_groups.list())
            results.append(f"{sub_key}: OK ({len(rgs)} RGs)")
        except Exception as exc:
            results.append(f"{sub_key}: FAILED — {str(exc)[:80]}")

    if not results:
        return {"ok": False, "message": "No Azure credentials configured"}
    all_ok = all("FAILED" not in r for r in results)
    return {"ok": all_ok, "message": " | ".join(results)}


def _test_gcp(db: Session):
    project_id = _get_cred(db, "gcp", "GCP_PROJECT_ID")
    creds_json = _get_cred(db, "gcp", "GCP_CREDENTIALS_JSON")

    if not creds_json:
        return {"ok": False, "message": "GCP credentials JSON not configured"}

    try:
        import json
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        info  = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        svc      = build("cloudresourcemanager", "v1", credentials=creds)
        projects = svc.projects().list().execute().get("projects", [])
        return {"ok": True, "message": f"Connected · project '{project_id}' · {len(projects)} accessible projects"}
    except Exception as exc:
        return {"ok": False, "message": str(exc)}
