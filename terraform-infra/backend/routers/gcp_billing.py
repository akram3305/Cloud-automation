# -*- coding: utf-8 -*-
"""
routers/gcp_billing.py — GCP multi-project billing dashboard.

Provides:
  - Cost breakdown by project (current month estimate)
  - Daily/monthly trend data (from DB snapshots, built up over time)
  - Cost breakdown by resource type (Compute / Storage / Network)
  - Top spending resources (instances ranked by monthly cost)

Since the Cloud Billing API requires BigQuery export, costs are estimated
from running Compute instances and bucket counts. Daily snapshots accumulate
in the DB to power trend charts.
"""
import base64
import json
import os
from concurrent.futures import ThreadPoolExecutor, wait as futures_wait, ALL_COMPLETED
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from database import get_db
from models import User
from models.cloud_credential import CloudCredential
from models.gcp_cost_snapshot import GcpCostSnapshot
from routers.auth import get_current_user
from services import gcp_client

router = APIRouter(prefix="/gcp/billing", tags=["gcp-billing"])

STORAGE_PRICE_PER_GB = 0.020   # Standard Storage $/GB/month
NETWORK_COST_PER_VM  = 0.50    # Rough egress estimate per running VM/month


# ── Credential helper (same pattern as gcp_projects.py) ───────────────────────

def _resolve_creds(db: Session):
    def _db(key):
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

    project_id = _db("GCP_PROJECT_ID") or gcp_client.GCP_PROJECT_ID
    org_id     = _db("GCP_ORG_ID")     or gcp_client.GCP_ORG_ID
    creds_json = _db("GCP_CREDENTIALS_JSON")

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


# ── Cost estimation helpers ────────────────────────────────────────────────────

def _estimate_storage_cost(project_id: str, creds=None) -> float:
    """Rough storage cost: bucket count × $2/bucket/month (minimal estimate)."""
    cache_key = f"storage_cost:{project_id}"
    cached = gcp_client._cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        from google.cloud import storage as gcs
        c = creds or gcp_client._get_credentials()
        sc = gcs.Client(project=project_id, credentials=c)
        buckets = list(sc.list_buckets())
        result = round(len(buckets) * 2.0, 2)
        gcp_client._cache_set(cache_key, result, ttl=300)
        return result
    except Exception:
        return 0.0


def _snapshot_today(db: Session, project_id: str, compute: float, storage: float) -> None:
    """Upsert today's cost snapshot for trend charts."""
    today_str = date.today().isoformat()
    row = (
        db.query(GcpCostSnapshot)
        .filter(GcpCostSnapshot.project_id == project_id, GcpCostSnapshot.snapshot_date == today_str)
        .first()
    )
    network = round(compute * 0.05, 2)  # 5% of compute as rough network estimate
    total   = round(compute + storage + network, 2)

    if row:
        row.compute_cost = compute
        row.storage_cost = storage
        row.network_cost = network
        row.total_cost   = total
    else:
        db.add(GcpCostSnapshot(
            project_id    = project_id,
            snapshot_date = today_str,
            compute_cost  = compute,
            storage_cost  = storage,
            network_cost  = network,
            total_cost    = total,
        ))


def _get_all_project_ids(db: Session, project_id: Optional[str], creds, org_id: str) -> List[str]:
    """Return list of project IDs to query."""
    if project_id:
        return [project_id]
    projects = gcp_client.list_all_projects(org_id=org_id, creds=creds)
    if projects:
        return [p["id"] for p in projects]
    default = (
        db.query(CloudCredential)
        .filter(CloudCredential.provider == "gcp", CloudCredential.key_name == "GCP_PROJECT_ID")
        .first()
    )
    if default and default.value_enc:
        try:
            return [base64.b64decode(default.value_enc.encode()).decode()]
        except Exception:
            pass
    return [gcp_client.GCP_PROJECT_ID] if gcp_client.GCP_PROJECT_ID else []


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/overview")
def billing_overview(
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Current estimated monthly spend by project.
    Breakdown: Compute + Storage + Network.
    Also saves a snapshot for trend charts.
    """
    creds, default_project, org_id = _resolve_creds(db)
    if not creds and not gcp_client.CONFIGURED:
        return {"projects": [], "total": 0.0}

    project_ids = _get_all_project_ids(db, project_id, creds, org_id)

    def _bill_project(pid):
        try:
            compute_data = gcp_client.estimate_project_compute_cost(pid, creds=creds)
            compute_cost = compute_data["total_monthly"]
        except Exception:
            compute_cost = 0.0
            compute_data = {"instances": []}
        storage_cost = _estimate_storage_cost(pid, creds=creds)
        network_cost = round(compute_cost * 0.05, 2)
        total_cost   = round(compute_cost + storage_cost + network_cost, 2)
        return {
            "project_id":     pid,
            "compute_cost":   compute_cost,
            "storage_cost":   storage_cost,
            "network_cost":   network_cost,
            "total_cost":     total_cost,
            "instance_count": len(compute_data.get("instances", [])),
            "running_count":  sum(1 for i in compute_data.get("instances", []) if i.get("status") == "RUNNING"),
        }

    rows = []
    workers = min(len(project_ids), 6)
    with ThreadPoolExecutor(max_workers=max(workers, 1)) as ex:
        future_map = {ex.submit(_bill_project, pid): pid for pid in project_ids}
        done, pending = futures_wait(future_map.keys(), timeout=10, return_when=ALL_COMPLETED)
        for f in done:
            try:
                row = f.result()
                rows.append(row)
                try:
                    _snapshot_today(db, row["project_id"], row["compute_cost"], row["storage_cost"])
                    db.commit()
                except Exception:
                    db.rollback()
            except Exception:
                pid = future_map[f]
                rows.append({"project_id": pid, "compute_cost": 0.0, "storage_cost": 0.0,
                             "network_cost": 0.0, "total_cost": 0.0,
                             "instance_count": 0, "running_count": 0})
        for f in pending:
            f.cancel()
            pid = future_map[f]
            rows.append({"project_id": pid, "compute_cost": 0.0, "storage_cost": 0.0,
                         "network_cost": 0.0, "total_cost": 0.0,
                         "instance_count": 0, "running_count": 0})

    rows.sort(key=lambda r: -r["total_cost"])
    total = round(sum(r["total_cost"] for r in rows), 2)

    return {"projects": rows, "total": total, "currency": "USD"}


@router.get("/monthly")
def billing_monthly(
    project_id: Optional[str] = Query(None),
    months: int = Query(3, ge=1, le=12),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Monthly cost totals for the last N months, grouped by project.
    Uses stored DB snapshots (mean of daily snapshots in that month).
    """
    creds, default_project, org_id = _resolve_creds(db)
    project_ids = _get_all_project_ids(db, project_id, creds, org_id)

    today       = date.today()
    month_data  = []

    for m in range(months - 1, -1, -1):
        # First day of the month m months ago
        first_of_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        for _ in range(m):
            first_of_month = (first_of_month - timedelta(days=1)).replace(day=1)

        last_of_month = (first_of_month.replace(month=first_of_month.month % 12 + 1, day=1)
                         - timedelta(days=1)) if first_of_month.month < 12 else \
                        first_of_month.replace(month=12, day=31)

        month_label = first_of_month.strftime("%b %Y")
        start_str   = first_of_month.isoformat()
        end_str     = last_of_month.isoformat()

        by_project: Dict[str, float] = {}

        for pid in project_ids:
            snaps = (
                db.query(GcpCostSnapshot)
                .filter(
                    GcpCostSnapshot.project_id    == pid,
                    GcpCostSnapshot.snapshot_date >= start_str,
                    GcpCostSnapshot.snapshot_date <= end_str,
                )
                .all()
            )
            if snaps:
                # Average daily cost × days in month as monthly estimate
                avg_daily = sum(s.total_cost for s in snaps) / len(snaps)
                import calendar
                days_in_month = calendar.monthrange(first_of_month.year, first_of_month.month)[1]
                by_project[pid] = round(avg_daily * days_in_month / 30, 2)
            else:
                by_project[pid] = 0.0

        month_data.append({
            "month":      month_label,
            "period":     f"{start_str}/{end_str}",
            "by_project": by_project,
            "total":      round(sum(by_project.values()), 2),
        })

    return {"months": month_data, "project_ids": project_ids}


@router.get("/daily")
def billing_daily(
    project_id: Optional[str] = Query(None),
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Daily cost totals for the last N days.
    Returns one entry per day; missing days show 0 (no snapshot taken yet).
    """
    creds, default_project, org_id = _resolve_creds(db)
    project_ids = _get_all_project_ids(db, project_id, creds, org_id)

    today      = date.today()
    start_date = today - timedelta(days=days - 1)
    start_str  = start_date.isoformat()
    end_str    = today.isoformat()

    # Fetch all snapshots in range
    snaps = (
        db.query(GcpCostSnapshot)
        .filter(
            GcpCostSnapshot.project_id.in_(project_ids),
            GcpCostSnapshot.snapshot_date >= start_str,
            GcpCostSnapshot.snapshot_date <= end_str,
        )
        .all()
    )

    # Build day → total map
    day_map: Dict[str, float] = {}
    day_project_map: Dict[str, Dict[str, float]] = {}

    for snap in snaps:
        d = snap.snapshot_date
        if d not in day_map:
            day_map[d] = 0.0
            day_project_map[d] = {}
        day_map[d] = round(day_map.get(d, 0.0) + snap.total_cost, 2)
        day_project_map[d][snap.project_id] = round(snap.total_cost, 2)

    # Fill in all days in range
    result = []
    cursor = start_date
    while cursor <= today:
        d = cursor.isoformat()
        result.append({
            "date":       d,
            "label":      cursor.strftime("%b %d"),
            "total":      day_map.get(d, 0.0),
            "by_project": day_project_map.get(d, {}),
        })
        cursor += timedelta(days=1)

    return {"days": result, "project_ids": project_ids}


@router.get("/by-service")
def billing_by_service(
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Cost breakdown by service type: Compute, Storage, Network."""
    creds, default_project, org_id = _resolve_creds(db)
    project_ids = _get_all_project_ids(db, project_id, creds, org_id)

    def _svc_project(pid):
        ct = 0.0
        st = 0.0
        try:
            ct = gcp_client.estimate_project_compute_cost(pid, creds=creds)["total_monthly"]
        except Exception:
            pass
        try:
            st = _estimate_storage_cost(pid, creds=creds)
        except Exception:
            pass
        return ct, st

    compute_total = 0.0
    storage_total = 0.0

    workers = min(len(project_ids), 6)
    with ThreadPoolExecutor(max_workers=max(workers, 1)) as ex:
        future_map = {ex.submit(_svc_project, pid): pid for pid in project_ids}
        done, _ = futures_wait(future_map.keys(), timeout=10, return_when=ALL_COMPLETED)
        for f in done:
            try:
                ct, st = f.result()
                compute_total += ct
                storage_total += st
            except Exception:
                pass

    network_total = round(compute_total * 0.05, 2)
    compute_total = round(compute_total, 2)
    storage_total = round(storage_total, 2)
    network_total = round(network_total, 2)
    total         = round(compute_total + storage_total + network_total, 2)

    def pct(v):
        return round(v / total * 100, 1) if total > 0 else 0.0

    return {
        "services": [
            {"name": "Compute Engine", "cost": compute_total, "pct": pct(compute_total), "color": "#4285F4"},
            {"name": "Cloud Storage",  "cost": storage_total, "pct": pct(storage_total), "color": "#34A853"},
            {"name": "Networking",     "cost": network_total, "pct": pct(network_total), "color": "#FBBC04"},
        ],
        "total": total,
    }


@router.get("/top-resources")
def billing_top_resources(
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Top 15 most expensive resources (Compute instances) across all projects.
    Sorted by estimated monthly cost descending.
    """
    creds, default_project, org_id = _resolve_creds(db)
    project_ids = _get_all_project_ids(db, project_id, creds, org_id)

    def _top_project(pid):
        cost_data = gcp_client.estimate_project_compute_cost(pid, creds=creds)
        return [{"project_id": pid, **inst} for inst in cost_data.get("instances", [])]

    all_instances = []
    workers = min(len(project_ids), 6)
    with ThreadPoolExecutor(max_workers=max(workers, 1)) as ex:
        future_map = {ex.submit(_top_project, pid): pid for pid in project_ids}
        done, _ = futures_wait(future_map.keys(), timeout=10, return_when=ALL_COMPLETED)
        for f in done:
            try:
                all_instances.extend(f.result())
            except Exception:
                pass

    all_instances.sort(key=lambda i: -(i.get("monthly_cost") or 0))
    return {"resources": all_instances[:15]}
