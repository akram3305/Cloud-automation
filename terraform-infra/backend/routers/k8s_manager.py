# -*- coding: utf-8 -*-
"""
routers/k8s_manager.py — Kubernetes Pod Manager
Direct K8s REST API calls for EKS and GKE clusters.
No kubernetes Python client needed — uses httpx + botocore (EKS) / google-auth (GKE).
"""
import base64
import httpx
from fastapi import APIRouter, HTTPException, Query, Depends

from routers.auth import get_current_user

router = APIRouter(prefix="/k8s", tags=["k8s-manager"])


# ─── EKS helpers ──────────────────────────────────────────────────────────────

def _eks_cluster_info(cluster_name: str, region: str) -> dict:
    import boto3
    eks = boto3.client("eks", region_name=region)
    detail = eks.describe_cluster(name=cluster_name)["cluster"]
    return {
        "endpoint": detail.get("endpoint", "").rstrip("/"),
        "ca":       detail.get("certificateAuthority", {}).get("data", ""),
    }


def _eks_bearer_token(cluster_name: str, region: str) -> str:
    """Generate a Kubernetes bearer token for EKS via STS presigned URL."""
    import boto3
    from botocore.auth import SigV4QueryAuth
    from botocore.awsrequest import AWSRequest

    session = boto3.session.Session()
    creds = session.get_credentials().get_frozen_credentials()
    url = (
        f"https://sts.{region}.amazonaws.com/"
        "?Action=GetCallerIdentity&Version=2011-06-15"
    )
    req = AWSRequest(method="GET", url=url, headers={"x-k8s-aws-id": cluster_name})
    SigV4QueryAuth(creds, "sts", region, expires=60).add_auth(req)
    return (
        "k8s-aws-v1."
        + base64.urlsafe_b64encode(req.url.encode("utf-8")).decode("utf-8").rstrip("=")
    )


# ─── GKE helpers ──────────────────────────────────────────────────────────────

def _gke_bearer_token() -> str:
    import google.auth.transport.requests
    from services.gcp_client import _get_credentials
    creds = _get_credentials()
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


def _gke_cluster_info(cluster_name: str, location: str) -> dict:
    from services.gcp_client import get_container_client, GCP_PROJECT_ID
    container = get_container_client()
    name = f"projects/{GCP_PROJECT_ID}/locations/{location}/clusters/{cluster_name}"
    cluster = container.projects().locations().clusters().get(name=name).execute()
    return {
        "endpoint": f"https://{cluster['endpoint']}",
        "ca":       cluster.get("masterAuth", {}).get("clusterCaCertificate", ""),
    }


# ─── Shared K8s REST call ─────────────────────────────────────────────────────

def _k8s_get(endpoint: str, token: str, path: str) -> dict:
    url = endpoint.rstrip("/") + path
    with httpx.Client(verify=False, timeout=30) as client:
        r = client.get(url, headers={"Authorization": f"Bearer {token}"})
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"K8s API: {r.text[:300]}")
    return r.json()


def _k8s_get_text(endpoint: str, token: str, path: str) -> str:
    url = endpoint.rstrip("/") + path
    with httpx.Client(verify=False, timeout=30) as client:
        r = client.get(url, headers={"Authorization": f"Bearer {token}"})
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"K8s logs: {r.text[:300]}")
    return r.text


# ─── Pod parser ───────────────────────────────────────────────────────────────

def _parse_pods(items: list) -> list:
    pods = []
    for p in items:
        meta   = p.get("metadata", {})
        spec   = p.get("spec", {})
        status = p.get("status", {})
        cs     = status.get("containerStatuses", [])
        restarts     = sum(c.get("restartCount", 0) for c in cs)
        ready_count  = sum(1 for c in cs if c.get("ready", False))
        total_count  = len(cs) or len(spec.get("containers", []))
        containers   = [c["name"] for c in spec.get("containers", [])]
        pods.append({
            "name":       meta.get("name", ""),
            "namespace":  meta.get("namespace", ""),
            "status":     status.get("phase", "Unknown"),
            "ready":      f"{ready_count}/{total_count}",
            "restarts":   restarts,
            "node":       spec.get("nodeName", ""),
            "start_time": status.get("startTime", ""),
            "containers": containers,
        })
    return pods


# ─── EKS — namespaces ─────────────────────────────────────────────────────────

@router.get("/eks/{cluster_name}/namespaces")
def eks_namespaces(
    cluster_name: str,
    region: str = Query("ap-south-1"),
    _user=Depends(get_current_user),
):
    try:
        info  = _eks_cluster_info(cluster_name, region)
        token = _eks_bearer_token(cluster_name, region)
        data  = _k8s_get(info["endpoint"], token, "/api/v1/namespaces")
        return [ns["metadata"]["name"] for ns in data.get("items", [])]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── EKS — pods ───────────────────────────────────────────────────────────────

@router.get("/eks/{cluster_name}/pods")
def eks_pods(
    cluster_name: str,
    region:    str = Query("ap-south-1"),
    namespace: str = Query("default"),
    _user=Depends(get_current_user),
):
    try:
        info  = _eks_cluster_info(cluster_name, region)
        token = _eks_bearer_token(cluster_name, region)
        path  = "/api/v1/pods" if namespace == "all" else f"/api/v1/namespaces/{namespace}/pods"
        data  = _k8s_get(info["endpoint"], token, path)
        return _parse_pods(data.get("items", []))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── EKS — pod logs ───────────────────────────────────────────────────────────

@router.get("/eks/{cluster_name}/pods/{namespace}/{pod_name}/logs")
def eks_pod_logs(
    cluster_name: str,
    namespace:    str,
    pod_name:     str,
    region:       str = Query("ap-south-1"),
    tail:         int = Query(200),
    container:    str = Query(None),
    _user=Depends(get_current_user),
):
    try:
        info  = _eks_cluster_info(cluster_name, region)
        token = _eks_bearer_token(cluster_name, region)
        qs    = f"?tailLines={tail}" + (f"&container={container}" if container else "")
        path  = f"/api/v1/namespaces/{namespace}/pods/{pod_name}/log{qs}"
        logs  = _k8s_get_text(info["endpoint"], token, path)
        return {"logs": logs}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── GKE — namespaces ─────────────────────────────────────────────────────────

@router.get("/gke/{cluster_name}/namespaces")
def gke_namespaces(
    cluster_name: str,
    location: str = Query(...),
    _user=Depends(get_current_user),
):
    try:
        info  = _gke_cluster_info(cluster_name, location)
        token = _gke_bearer_token()
        data  = _k8s_get(info["endpoint"], token, "/api/v1/namespaces")
        return [ns["metadata"]["name"] for ns in data.get("items", [])]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── GKE — pods ───────────────────────────────────────────────────────────────

@router.get("/gke/{cluster_name}/pods")
def gke_pods(
    cluster_name: str,
    location:  str = Query(...),
    namespace: str = Query("default"),
    _user=Depends(get_current_user),
):
    try:
        info  = _gke_cluster_info(cluster_name, location)
        token = _gke_bearer_token()
        path  = "/api/v1/pods" if namespace == "all" else f"/api/v1/namespaces/{namespace}/pods"
        data  = _k8s_get(info["endpoint"], token, path)
        return _parse_pods(data.get("items", []))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── GKE — pod logs ───────────────────────────────────────────────────────────

@router.get("/gke/{cluster_name}/pods/{namespace}/{pod_name}/logs")
def gke_pod_logs(
    cluster_name: str,
    namespace:    str,
    pod_name:     str,
    location:     str = Query(...),
    tail:         int = Query(200),
    container:    str = Query(None),
    _user=Depends(get_current_user),
):
    try:
        info  = _gke_cluster_info(cluster_name, location)
        token = _gke_bearer_token()
        qs    = f"?tailLines={tail}" + (f"&container={container}" if container else "")
        path  = f"/api/v1/namespaces/{namespace}/pods/{pod_name}/log{qs}"
        logs  = _k8s_get_text(info["endpoint"], token, path)
        return {"logs": logs}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
