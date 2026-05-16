# -*- coding: utf-8 -*-
"""
routers/gcp_projects.py — GCP Organization-level project discovery.
Lists all GCP projects accessible to the configured service account,
with optional org filtering when GCP_ORG_ID is configured.
"""
import base64
import os
from concurrent.futures import ThreadPoolExecutor, wait as futures_wait, ALL_COMPLETED
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from models.cloud_credential import CloudCredential
from routers.auth import get_current_user
from services import gcp_client

router = APIRouter(prefix="/gcp/projects", tags=["gcp-projects"])


class CreateProjectBody(BaseModel):
    project_id: str
    name: str = ""
    org_id: str = ""


# ── Credential resolution ─────────────────────────────────────────────────────

def _resolve_creds(db: Session):
    """
    Get GCP credentials: DB-stored first, then fall back to gcp_client defaults.
    Returns (credentials_object, project_id, org_id).
    """
    def _db_cred(key):
        row = (
            db.query(CloudCredential)
            .filter(CloudCredential.provider == "gcp", CloudCredential.key_name == key)
            .first()
        )
        if row and row.value_enc:
            try:
                return base64.b64decode(row.value_enc.encode()).decode()
            except Exception:
                pass
        return os.getenv(key, "")

    project_id = _db_cred("GCP_PROJECT_ID") or gcp_client.GCP_PROJECT_ID
    org_id     = _db_cred("GCP_ORG_ID")     or gcp_client.GCP_ORG_ID
    creds_json = _db_cred("GCP_CREDENTIALS_JSON")

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

    return creds, project_id, org_id


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_projects(
    quick: bool = Query(False, description="Return basic list without cost enrichment (fast path)"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Return all GCP projects accessible to the service account.
    quick=true returns immediately (no enrichment). Default enriches with cost + resource counts.
    """
    creds, default_project, org_id = _resolve_creds(db)

    if not creds:
        raise HTTPException(
            status_code=503,
            detail="GCP credentials not configured. Add GCP_CREDENTIALS_JSON in Settings.",
        )

    projects = gcp_client.list_all_projects(org_id=org_id, creds=creds)

    if not projects and default_project:
        projects = [{
            "id":     default_project,
            "name":   default_project,
            "number": "",
            "status": "ACTIVE",
            "labels": {},
            "parent": {},
        }]

    if not projects:
        return {"projects": [], "total_cost": 0.0, "org_id": org_id,
                "default_project": default_project, "quick": quick}

    def _fallback(proj):
        return {**proj, "compute_mtd": 0.0, "total_mtd": 0.0,
                "instance_count": 0, "running_count": 0,
                "bucket_count": 0, "network_count": 0,
                "is_default": proj["id"] == default_project}

    # ── Quick mode: return basic list immediately (no API enrichment) ────────
    if quick:
        basic = [_fallback(p) for p in projects]
        return {"projects": basic, "total_cost": 0.0, "org_id": org_id,
                "default_project": default_project, "quick": True}

    # ── Full mode: enrich with cost + resource counts in parallel (8s cap) ───
    def _enrich(proj):
        proj_id = proj["id"]
        try:
            cost = gcp_client.estimate_project_compute_cost(proj_id, creds=creds)
            compute_mtd = cost["total_monthly"]
            inst_count  = len(cost.get("instances", []))
            run_count   = sum(1 for i in cost.get("instances", []) if i.get("status") == "RUNNING")
        except Exception:
            compute_mtd = 0.0
            inst_count  = 0
            run_count   = 0

        bucket_count  = 0
        network_count = 0
        try:
            summary = gcp_client.get_project_resource_summary(proj_id, creds=creds)
            bucket_count  = summary.get("bucket_count", 0)
            network_count = summary.get("network_count", 0)
        except Exception:
            pass

        return {
            **proj,
            "compute_mtd":    compute_mtd,
            "total_mtd":      compute_mtd,
            "instance_count": inst_count,
            "running_count":  run_count,
            "bucket_count":   bucket_count,
            "network_count":  network_count,
            "is_default":     proj_id == default_project,
        }

    enriched = []
    workers = min(len(projects), 6)
    with ThreadPoolExecutor(max_workers=workers) as ex:
        future_map = {ex.submit(_enrich, p): p for p in projects}
        done, pending = futures_wait(future_map.keys(), timeout=8, return_when=ALL_COMPLETED)
        for f in done:
            try:
                enriched.append(f.result())
            except Exception:
                enriched.append(_fallback(future_map[f]))
        for f in pending:
            f.cancel()
            enriched.append(_fallback(future_map[f]))

    enriched.sort(key=lambda p: -p["total_mtd"])
    total_cost = round(sum(p["total_mtd"] for p in enriched), 2)

    return {
        "projects":        enriched,
        "total_cost":      total_cost,
        "org_id":          org_id,
        "default_project": default_project,
        "quick":           False,
    }


@router.post("/create")
def create_project(
    body: CreateProjectBody,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Create a new GCP project. Returns operation status; project takes ~30s to become active."""
    creds, _, org_id = _resolve_creds(db)
    if not creds:
        raise HTTPException(status_code=503, detail="GCP credentials not configured.")

    pid = body.project_id.strip()
    if not pid:
        raise HTTPException(status_code=400, detail="project_id is required.")

    try:
        result = gcp_client.create_gcp_project(
            project_id=pid,
            name=body.name or pid,
            org_id=body.org_id or org_id,
            creds=creds,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{project_id}/summary")
def project_summary(
    project_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Detailed resource summary for a single GCP project."""
    creds, _, _ = _resolve_creds(db)
    if not creds and not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured")

    try:
        instances = gcp_client.list_instances(project=project_id, zone="-")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    cost = gcp_client.estimate_project_compute_cost(project_id, creds=creds)

    # Zone breakdown
    zones: Dict[str, Any] = {}
    for inst in instances:
        z = inst.get("zone", "unknown")
        if z not in zones:
            zones[z] = {"zone": z, "count": 0, "running": 0}
        zones[z]["count"] += 1
        if inst.get("status") == "RUNNING":
            zones[z]["running"] += 1

    return {
        "project_id":     project_id,
        "instances":      instances,
        "instance_count": len(instances),
        "running_count":  sum(1 for i in instances if i.get("status") == "RUNNING"),
        "zones":          list(zones.values()),
        "compute_mtd":    cost["total_monthly"],
        "total_mtd":      cost["total_monthly"],
        "cost_detail":    cost["instances"],
    }
