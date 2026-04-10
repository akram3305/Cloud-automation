# -*- coding: utf-8 -*-
"""
Terraform Router — status and output endpoints
Actual provisioning happens via requests.py pipeline
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, Request
from routers.auth import require_admin, require_operator, get_current_user
from services.terraform_service import get_outputs
import json

router = APIRouter(prefix="/terraform", tags=["terraform"])


# ── PREVIEW ───────────────────────────────────────────────────────────────
@router.get("/{request_id}/preview")
def preview_tf(
    request_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user)
):
    """Show the terraform configuration for a request from S3 archive."""
    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")

    # Try to get archived files from S3
    try:
        from services.terraform_service import get_archived_files
        env   = json.loads(req.payload or "{}").get("tags", {}).get("environment", "dev")
        files = get_archived_files(request_id, env)
        if files.get("main.tf"):
            return {
                "request_id": request_id,
                "content":    files["main.tf"],
                "tfvars":     files.get("terraform.tfvars", ""),
                "source":     "s3_archive",
            }
    except Exception as e:
        print(f"Archive fetch error: {e}")

    return {
        "request_id": request_id,
        "content":    f"# Request {request_id}: {req.resource_name} ({req.resource_type})\n# Status: {req.status}\n# Archive not available yet",
        "source":     "not_available",
    }


# ── STATUS ─────────────────────────────────────────────────────────────────
@router.get("/{request_id}/status")
def get_status(
    request_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user)
):
    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(404, "Not found")

    payload = {}
    try:
        payload = json.loads(req.payload or "{}")
    except Exception:
        pass

    env     = payload.get("tags", {}).get("environment", "dev")
    outputs = {}

    if req.status == "completed":
        try:
            outputs = get_outputs(env, request_id=request_id)
        except Exception:
            pass

    return {
        "status":      req.status,
        "instance_id": req.instance_id,
        "outputs":     outputs,
        "reject_reason": req.reject_reason,
    }


# ── LOGS ──────────────────────────────────────────────────────────────────
@router.get("/{request_id}/logs")
def get_logs(
    request_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user)
):
    """Retrieve apply logs from S3 archive."""
    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")

    try:
        from services.terraform_service import get_archived_files
        env   = json.loads(req.payload or "{}").get("tags", {}).get("environment", "dev")
        files = get_archived_files(request_id, env)
        return {
            "request_id": request_id,
            "log":        files.get("apply.log", "No logs available"),
            "status":     req.status,
        }
    except Exception as e:
        return {
            "request_id": request_id,
            "log":        f"Could not retrieve logs: {e}",
            "status":     req.status,
        }