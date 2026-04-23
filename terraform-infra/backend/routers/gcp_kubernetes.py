# -*- coding: utf-8 -*-
"""
routers/gcp_kubernetes.py — AIonOS Platform
GKE cluster management — submit/list via approval workflow.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict
import json

from routers.auth import get_current_user, require_operator
from database import get_db
from models import Request, User
from sqlalchemy.orm import Session

router = APIRouter(prefix="/gcp/kubernetes", tags=["gcp-kubernetes"])


class GKEClusterCreate(BaseModel):
    resource_name:                    str
    region:                           str  = "us-central1"
    environment:                      str  = "dev"
    release_channel:                  str  = "REGULAR"
    regional_cluster:                 bool = True
    # Node pool
    machine_type:                     str  = "e2-standard-2"
    node_pool_name:                   str  = "default"
    initial_node_count:               int  = 3
    min_node_count:                   int  = 1
    max_node_count:                   int  = 5
    disk_type:                        str  = "pd-ssd"
    disk_size_gb:                     int  = 100
    image_type:                       str  = "COS_CONTAINERD"
    spot:                             bool = False
    # Networking
    network:                          str  = "default"
    subnetwork:                       str  = "default"
    private_cluster:                  bool = False
    master_ipv4_cidr_block:           str  = "172.16.0.32/28"
    # Add-ons
    enable_http_load_balancing:       bool = True
    enable_horizontal_pod_autoscaling:bool = True
    enable_network_policy:            bool = True
    enable_workload_identity:         bool = True
    enable_logging:                   bool = True
    enable_monitoring:                bool = True
    # Metadata
    labels:                           Dict[str, str] = {}
    tags:                             Dict[str, str] = {}


@router.post("")
def create_gke_cluster(
    body: GKEClusterCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_operator),
):
    """Submit a GKE cluster creation request for admin approval."""
    name = body.resource_name.strip()
    if not name:
        raise HTTPException(400, "cluster name is required")

    existing = db.query(Request).filter(
        Request.resource_name == name,
        Request.resource_type == "gke_cluster",
        Request.status.in_(["pending", "approved", "running"]),
    ).first()
    if existing:
        raise HTTPException(400, f"Cluster '{name}' already has a pending/active request (id={existing.id})")

    config = body.dict()
    config["username"] = user.username

    req = Request(
        resource_name=name,
        resource_type="gke_cluster",
        status="pending",
        username=user.username,
        cloud_provider="gcp",
        payload=json.dumps(config),
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {
        "id":            req.id,
        "resource_name": name,
        "resource_type": "gke_cluster",
        "status":        "pending",
        "message":       f"GKE cluster '{name}' submitted — awaiting admin approval",
    }


@router.get("/clusters")
def list_gke_clusters(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """List all GKE cluster requests and their statuses."""
    reqs = (
        db.query(Request)
        .filter(Request.resource_type == "gke_cluster")
        .order_by(Request.id.desc())
        .all()
    )
    result = []
    for r in reqs:
        try:
            cfg = json.loads(r.payload or "{}")
        except Exception:
            cfg = {}
        result.append({
            "id":           r.id,
            "resource_name":r.resource_name,
            "status":       r.status,
            "created_at":   r.created_at.isoformat() if getattr(r, "created_at", None) else None,
            "config":       cfg,
        })
    return result
