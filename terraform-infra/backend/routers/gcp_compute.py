# -*- coding: utf-8 -*-
"""
routers/gcp_compute.py — AIonOS Platform
GCP Compute Engine management.
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from routers.auth import get_current_user, require_operator
from services import gcp_client
from database import get_db
from models.gcp_ssh_key import GcpSshKey
from sqlalchemy.orm import Session

router = APIRouter(prefix="/gcp", tags=["gcp"])


def _encode_schedule_label(value: str) -> str:
    value = (value or "").strip()
    return value.replace(":", "-") if value else ""


def _decode_schedule_label(value: str) -> str:
    value = (value or "").strip()
    if len(value) == 5 and value[2] == "-":
        return value.replace("-", ":")
    if len(value) == 4 and value.isdigit():
        return f"{value[:2]}:{value[2:]}"
    return value


# ── Schemas ───────────────────────────────────────────────────────────────

class GCPInstanceCreate(BaseModel):
    name:             str
    machine_type:     str = "e2-medium"
    zone:             str = "us-central1-a"
    boot_image:       str = "debian-cloud/debian-12"
    boot_disk_size:   int = 50
    boot_disk_type:   str = "pd-balanced"
    assign_public_ip: bool = False
    tags:             List[str] = []
    labels:           dict = {}
    preemptible:      bool = False
    metadata:         Optional[Dict[str, Any]] = None
    network:          str = "default"
    subnetwork:       Optional[str] = None
    startup_script:   Optional[str] = None
    generate_ssh_key: bool = False
    ssh_username:     str = "gcpuser"
    project:          Optional[str] = None


# ── GCP machine-type price table (us-central1, on-demand, $/hr) ───────────
_GCP_PRICE: dict = {
    # e2 shared/standard
    "e2-micro":        0.0084,
    "e2-small":        0.0168,
    "e2-medium":       0.0336,
    "e2-standard-2":   0.0671,
    "e2-standard-4":   0.1342,
    "e2-standard-8":   0.2684,
    "e2-standard-16":  0.5368,
    "e2-standard-32":  1.0736,
    "e2-highmem-2":    0.0900,
    "e2-highmem-4":    0.1800,
    "e2-highmem-8":    0.3601,
    "e2-highmem-16":   0.7201,
    # n1 standard
    "n1-standard-1":   0.0475,
    "n1-standard-2":   0.0950,
    "n1-standard-4":   0.1900,
    "n1-standard-8":   0.3800,
    "n1-standard-16":  0.7600,
    "n1-standard-32":  1.5200,
    "n1-standard-64":  3.0400,
    # n2 standard
    "n2-standard-2":   0.0971,
    "n2-standard-4":   0.1942,
    "n2-standard-8":   0.3885,
    "n2-standard-16":  0.7769,
    "n2-standard-32":  1.5539,
    # n2d
    "n2d-standard-2":  0.0872,
    "n2d-standard-4":  0.1743,
    "n2d-standard-8":  0.3487,
    # c2 compute-optimised
    "c2-standard-4":   0.2088,
    "c2-standard-8":   0.4176,
    "c2-standard-16":  0.8352,
    "c2-standard-30":  1.5660,
    "c2-standard-60":  3.1321,
    # t2d (Tau)
    "t2d-standard-1":  0.0422,
    "t2d-standard-2":  0.0845,
    "t2d-standard-4":  0.1689,
    "t2d-standard-8":  0.3379,
    # f1/g1 shared
    "f1-micro":        0.0076,
    "g1-small":        0.0257,
}

def _gcp_price(machine_type: str) -> float:
    """Estimate hourly price; fallback: $0.05 per vCPU."""
    p = _GCP_PRICE.get(machine_type)
    if p:
        return p
    # heuristic: extract vcpu count from name e.g. e2-standard-4 → 4
    parts = machine_type.split("-")
    try:
        vcpus = int(parts[-1])
    except (ValueError, IndexError):
        vcpus = 2
    return round(vcpus * 0.05, 4)


# ── Generate SSH key pair (for Terraform instances) ──────────────────────

def _save_ssh_key(db: Session, instance_name: str, username: str, private_key: str, filename: str) -> None:
    """Upsert — one stored key per (instance_name, username)."""
    row = db.query(GcpSshKey).filter(
        GcpSshKey.instance_name == instance_name,
        GcpSshKey.username == username,
    ).first()
    if row:
        row.private_key = private_key
        row.filename    = filename
    else:
        db.add(GcpSshKey(
            instance_name=instance_name,
            username=username,
            private_key=private_key,
            filename=filename,
        ))
    db.commit()


@router.post("/generate-ssh-key")
def generate_ssh_key(
    instance_name: str = "gcp-instance",
    username: str = "gcpuser",
    current_user=Depends(require_operator),
    db: Session = Depends(get_db),
):
    """Generate an RSA SSH key pair, persist the private key, return public_key + private_key."""
    try:
        result = gcp_client.generate_ssh_keypair(instance_name=instance_name, username=username)
        _save_ssh_key(db, instance_name, username, result["private_key"], result["filename"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Key generation failed: {e}")


# ── Health ────────────────────────────────────────────────────────────────

@router.get("/health")
def gcp_health():
    """GCP connectivity check."""
    return gcp_client.check_gcp_connectivity()


# ── Instances ─────────────────────────────────────────────────────────────

@router.post("/instances")
def create_gcp_instance(
    payload: GCPInstanceCreate,
    current_user=Depends(require_operator),
):
    """Launch a new Compute Engine instance."""
    if not gcp_client.CONFIGURED:
        raise HTTPException(
            status_code=503,
            detail="GCP not configured. Add GCP_PROJECT_ID and GCP_CREDENTIALS_JSON to your .env file.",
        )
    try:
        generated_key = None
        metadata = payload.metadata or {}
        if payload.generate_ssh_key:
            generated_key = gcp_client.generate_ssh_keypair(
                instance_name=payload.name,
                username=payload.ssh_username or "gcpuser",
            )
            items = list(metadata.get("items", []))
            items.append({"key": "ssh-keys", "value": generated_key["public_key"]})
            metadata = {**metadata, "items": items}

        result = gcp_client.create_instance(
            name=payload.name,
            machine_type=payload.machine_type,
            zone=payload.zone,
            boot_image=payload.boot_image,
            boot_disk_size=payload.boot_disk_size,
            boot_disk_type=payload.boot_disk_type,
            assign_public_ip=payload.assign_public_ip,
            tags=payload.tags,
            labels=payload.labels,
            preemptible=payload.preemptible,
            metadata=metadata,
            network=payload.network,
            subnetwork=payload.subnetwork or "",
            startup_script=payload.startup_script or "",
            project=payload.project or "",
        )
        response = {"message": f"Instance '{payload.name}' creation initiated", **result}
        if generated_key:
            response["generated_ssh_key"] = {
                "username": generated_key["username"],
                "private_key": generated_key["private_key"],
                "filename": generated_key["filename"],
            }
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/instances")
def list_gcp_instances(
    project: str = "",
    zone: str = "-",
    current_user=Depends(get_current_user),
):
    """
    List all Compute Engine instances.
    Use zone='-' (default) to aggregate across all zones.
    """
    if not gcp_client.CONFIGURED:
        raise HTTPException(
            status_code=503,
            detail=(
                "GCP not configured. "
                "Add GCP_PROJECT_ID and GCP_CREDENTIALS_JSON to your .env file."
            ),
        )
    try:
        instances = gcp_client.list_instances(project=project, zone=zone)
        return {"instances": instances, "count": len(instances)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/instances/{zone}/{name}/connect")
def get_gcp_instance_connect_info(
    name: str,
    zone: str,
    project: str = "",
    current_user=Depends(get_current_user),
):
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        inst = gcp_client.get_instance(name=name, zone=zone, project=project)
        nic = (inst.get("networkInterfaces") or [{}])[0]
        access_config = (nic.get("accessConfigs") or [{}])[0]
        metadata_items = {item.get("key"): item.get("value", "") for item in (inst.get("metadata", {}) or {}).get("items", [])}
        ssh_entry = metadata_items.get("ssh-keys", "").splitlines()[0].strip() if metadata_items.get("ssh-keys") else ""
        ssh_username = ssh_entry.split(":", 1)[0] if ":" in ssh_entry else "gcpuser"

        os_type = "Linux"
        source_image = ""
        if inst.get("disks"):
            licenses = inst["disks"][0].get("licenses", [])
            source_image = inst["disks"][0].get("sourceImage", "")
            if any("windows" in license_.lower() for license_ in licenses) or "windows" in source_image.lower():
                os_type = "Windows"

        public_ip = access_config.get("natIP", "")
        private_ip = nic.get("networkIP", "")
        is_linux = os_type.lower() != "windows"
        host = public_ip or private_ip or ""
        key_filename = f"{name}-{ssh_username}.pem"
        ssh_cmd_with_key = f"ssh -i {key_filename} {ssh_username}@{host}" if is_linux and host else None
        return {
            "name": name,
            "zone": zone,
            "os_type": os_type,
            "status": inst.get("status", "UNKNOWN"),
            "ssh_username": ssh_username,
            "public_ip": public_ip,
            "private_ip": private_ip,
            "network": nic.get("network", "").split("/")[-1],
            "subnetwork": nic.get("subnetwork", "").split("/")[-1],
            "port": 22 if is_linux else 3389,
            "key_filename": key_filename,
            "ssh_command": ssh_cmd_with_key,
            "rdp_host": host if (not is_linux and host) else None,
            "has_public_ip": bool(public_ip),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/instances/{zone}/{name}/ssh-key")
def get_gcp_instance_ssh_key(
    name: str,
    zone: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the stored private key for this instance as a downloadable .pem file."""
    row = db.query(GcpSshKey).filter(GcpSshKey.instance_name == name).order_by(GcpSshKey.id.desc()).first()
    if not row:
        raise HTTPException(status_code=404, detail="No stored SSH key found for this instance.")
    return {
        "filename": row.filename,
        "username": row.username,
        "private_key": row.private_key,
        "has_key": True,
    }


@router.post("/instances/{zone}/{name}/fix-ssh-key")
def fix_gcp_instance_ssh_key(
    name: str,
    zone: str,
    project: str = "",
    current_user=Depends(require_operator),
    db: Session = Depends(get_db),
):
    """
    Push the stored private key's public key (correctly formatted) back to the
    instance metadata and disable OS Login — without generating a new key.
    Call this when the original key exists but SSH still fails.
    """
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    row = db.query(GcpSshKey).filter(GcpSshKey.instance_name == name).order_by(GcpSshKey.id.desc()).first()
    if not row:
        raise HTTPException(status_code=404, detail="No stored key found. Use 'Replace SSH Key' to generate a new one.")
    try:
        public_key_openssh = gcp_client._public_key_from_private_key(row.private_key)
        gcp_client.set_instance_ssh_key(
            name=name, zone=zone,
            username=row.username,
            public_key_openssh=public_key_openssh,
            project=project,
        )
        return {"status": "ok", "message": f"SSH key re-applied for user {row.username}. Try connecting now."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/instances/{zone}/{name}/regenerate-ssh-key")
def regenerate_gcp_ssh_key(
    name: str,
    zone: str,
    username: str = "gcpuser",
    project: str = "",
    current_user=Depends(require_operator),
    db: Session = Depends(get_db),
):
    """Generate a new RSA key pair, push the public key to instance metadata, persist and return it."""
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        keypair = gcp_client.generate_ssh_keypair(instance_name=name, username=username)
        raw_pubkey = keypair["public_key"].split(":", 1)[1].strip() if ":" in keypair["public_key"] else keypair["public_key"]
        gcp_client.set_instance_ssh_key(
            name=name, zone=zone,
            username=keypair["username"],
            public_key_openssh=raw_pubkey,
            project=project,
        )
        _save_ssh_key(db, name, keypair["username"], keypair["private_key"], keypair["filename"])
        return {
            "username": keypair["username"],
            "private_key": keypair["private_key"],
            "filename": keypair["filename"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/instances/{zone}/{name}/firewall")
def get_gcp_instance_firewall(
    name: str,
    zone: str,
    project: str = "",
    current_user=Depends(get_current_user),
):
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        return gcp_client.get_instance_firewall_ports(instance_name=name, zone=zone, project=project)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class FirewallUpdateRequest(BaseModel):
    ports: list[str] = []
    source_range: str = "0.0.0.0/0"
    network: str = "default"
    project: str = ""


@router.put("/instances/{zone}/{name}/firewall")
def update_gcp_instance_firewall(
    name: str,
    zone: str,
    payload: FirewallUpdateRequest,
    current_user=Depends(require_operator),
):
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        result = gcp_client.upsert_instance_firewall_rule(
            instance_name=name,
            zone=zone,
            network=payload.network or "default",
            ports=payload.ports,
            source_range=payload.source_range or "0.0.0.0/0",
            project=payload.project,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/instances/{zone}/{name}/schedule")
def get_gcp_instance_schedule(
    name: str,
    zone: str,
    project: str = "",
    current_user=Depends(get_current_user),
):
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        inst = gcp_client.get_instance(name=name, zone=zone, project=project)
        labels = inst.get("labels", {}) or {}
        return {
            "auto_start": _decode_schedule_label(labels.get("auto_start", "")),
            "auto_stop": _decode_schedule_label(labels.get("auto_stop", "")),
        }
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/instances/{zone}/{name}/schedule")
def set_gcp_instance_schedule(
    name: str,
    zone: str,
    payload: dict,
    project: str = "",
    current_user=Depends(require_operator),
):
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        inst = gcp_client.get_instance(name=name, zone=zone, project=project)
        labels = dict(inst.get("labels", {}) or {})
        auto_start = (payload.get("auto_start") or "").strip() if payload.get("auto_start") is not None else None
        auto_stop = (payload.get("auto_stop") or "").strip() if payload.get("auto_stop") is not None else None

        if auto_start is not None:
            if auto_start:
                labels["auto_start"] = _encode_schedule_label(auto_start)
            else:
                labels.pop("auto_start", None)
        if auto_stop is not None:
            if auto_stop:
                labels["auto_stop"] = _encode_schedule_label(auto_stop)
            else:
                labels.pop("auto_stop", None)

        clean_labels = gcp_client._sanitize_labels(labels)
        result = gcp_client.set_instance_labels(
            name=name,
            zone=zone,
            labels=clean_labels,
            label_fingerprint=inst.get("labelFingerprint", ""),
            project=project,
        )
        return {
            "message": f"Schedule updated for '{name}'",
            "auto_start": _decode_schedule_label(clean_labels.get("auto_start", "")),
            "auto_stop": _decode_schedule_label(clean_labels.get("auto_stop", "")),
            **result,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/networks")
def get_gcp_networks(
    project: str = "",
    current_user=Depends(get_current_user),
):
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        networks = gcp_client.list_networks(project=project)
        return {"networks": networks, "count": len(networks)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/subnetworks")
def get_gcp_subnetworks(
    project: str = "",
    region: str = "",
    network: str = "",
    current_user=Depends(get_current_user),
):
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        subnetworks = gcp_client.list_subnetworks(project=project, region=region, network=network)
        return {"subnetworks": subnetworks, "count": len(subnetworks)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/instances/{zone}/{name}/start")
def start_gcp_instance(
    name: str,
    zone: str,
    background_tasks: BackgroundTasks,
    project: str = "",
    current_user=Depends(require_operator),
):
    """Start a stopped GCP instance."""
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        result = gcp_client.start_instance(name=name, zone=zone, project=project)
        background_tasks.add_task(_notify_gcp_action, "start", name, zone, current_user.username)
        return {"message": f"Start operation initiated for '{name}'", **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/instances/{zone}/{name}/stop")
def stop_gcp_instance(
    name: str,
    zone: str,
    background_tasks: BackgroundTasks,
    project: str = "",
    current_user=Depends(require_operator),
):
    """Stop a running GCP instance."""
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        result = gcp_client.stop_instance(name=name, zone=zone, project=project)
        background_tasks.add_task(_notify_gcp_action, "stop", name, zone, current_user.username)
        return {"message": f"Stop operation initiated for '{name}'", **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/cost")
def get_gcp_cost(
    project: str = "",
    current_user=Depends(get_current_user),
):
    """
    Estimate GCP Compute Engine cost grouped by zone.
    Only RUNNING instances are counted toward compute spend.
    Prices are PAYG on-demand (us-central1 list price × 730 hrs/month).
    """
    if not gcp_client.CONFIGURED:
        raise HTTPException(
            status_code=503,
            detail="GCP not configured. Add GCP_PROJECT_ID and GCP_CREDENTIALS_JSON to your .env file.",
        )
    try:
        instances = gcp_client.list_instances(project=project, zone="-")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Group by zone
    zones: dict = {}
    for inst in instances:
        zone = inst.get("zone", "unknown")
        if zone not in zones:
            zones[zone] = {"zone": zone, "vms": [], "total_monthly": 0.0,
                           "running_count": 0, "total_count": 0}
        hourly = _gcp_price(inst.get("machine_type", ""))
        is_running = inst.get("status") == "RUNNING"
        monthly = round(hourly * 730, 2) if is_running else 0.0
        list_monthly = round(hourly * 730, 2)   # on-demand rate regardless of state
        zones[zone]["vms"].append({
            "name":              inst.get("name"),
            "machine_type":      inst.get("machine_type"),
            "status":            inst.get("status"),
            "zone":              zone,
            "project":           inst.get("project"),
            "hourly_rate":       round(hourly, 6),
            "hourly_cost":       hourly if is_running else 0.0,
            "monthly_cost":      monthly,
            "list_price_monthly": list_monthly,
        })
        zones[zone]["total_monthly"] = round(zones[zone]["total_monthly"] + monthly, 2)
        zones[zone]["total_count"]  += 1
        if inst.get("status") == "RUNNING":
            zones[zone]["running_count"] += 1

    zone_list = sorted(zones.values(), key=lambda z: -z["total_monthly"])
    grand_total = round(sum(z["total_monthly"] for z in zone_list), 2)

    return {
        "project":     project or gcp_client.GCP_PROJECT_ID,
        "zones":       zone_list,
        "grand_total": grand_total,
        "total_vms":   len(instances),
        "running_vms": sum(1 for i in instances if i.get("status") == "RUNNING"),
    }


@router.get("/storage/buckets")
def list_gcp_buckets(
    project: str = "",
    current_user=Depends(get_current_user),
):
    """List GCP Cloud Storage buckets in the project."""
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        buckets = gcp_client.list_buckets(project=project)
        return {"buckets": buckets, "count": len(buckets)}
    except RuntimeError as exc:
        msg = str(exc)
        lmsg = msg.lower()
        # Proxy/firewall HTML 403 — network issue, not IAM
        if "proxy" in lmsg or "html" in lmsg or "firewall" in lmsg or "ssl" in lmsg or "certificate" in lmsg:
            return {"buckets": [], "count": 0, "warning": msg, "warning_type": "network"}
        # Real GCP IAM 403
        if "permission denied" in lmsg:
            return {"buckets": [], "count": 0, "warning": msg, "warning_type": "permission"}
        raise HTTPException(status_code=500, detail=msg)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/instances/{zone}/{name}")
def delete_gcp_instance(
    name: str,
    zone: str,
    background_tasks: BackgroundTasks,
    project: str = "",
    current_user=Depends(require_operator),
):
    """Permanently delete a GCP instance."""
    if not gcp_client.CONFIGURED:
        raise HTTPException(status_code=503, detail="GCP not configured.")
    try:
        result = gcp_client.delete_instance(name=name, zone=zone, project=project)
        background_tasks.add_task(_notify_gcp_action, "delete", name, zone, current_user.username)
        return {"message": f"Delete operation initiated for '{name}'", **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Notification helper ───────────────────────────────────────────────────────

def _notify_gcp_action(action: str, vm_name: str, zone: str, actor: str):
    try:
        from services.notification_service import notify_vm_action
        from database import SessionLocal
        _db = SessionLocal()
        notify_vm_action(_db, action=action, cloud="gcp", vm_name=vm_name,
                         region=zone, actor_username=actor)
        _db.close()
    except Exception as e:
        print(f"[Notify] gcp vm action error: {e}")
