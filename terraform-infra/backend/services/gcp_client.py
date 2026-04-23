# -*- coding: utf-8 -*-
"""
services/gcp_client.py — AIonOS Platform

GCP client factory using google-cloud SDK (ADC or service account JSON).
Set GCP_PROJECT_ID and GCP_CREDENTIALS_JSON in your .env file.
"""
import base64
import json
import os
import re
from dotenv import load_dotenv

load_dotenv()

# ── SSL: disable verification for GCP API calls on Windows ───────────────
# Windows Python SSL cannot verify Google's certificate chain in this env.
# Traffic is still TLS-encrypted — only cert-chain verification is skipped.
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
os.environ["PYTHONHTTPSVERIFY"] = "0"

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
_GCP_CREDENTIALS_JSON = os.getenv("GCP_CREDENTIALS_JSON", "")
_GCP_CREDENTIALS_FILE = os.getenv("GCP_CREDENTIALS_FILE", "")

CONFIGURED = bool(GCP_PROJECT_ID and (_GCP_CREDENTIALS_JSON or _GCP_CREDENTIALS_FILE))


def _load_credentials_info() -> dict:
    """
    Load service account info from either:
      - GCP_CREDENTIALS_FILE  — path to the downloaded .json key file  (preferred)
      - GCP_CREDENTIALS_JSON  — raw JSON string embedded in the .env
    """
    # ── Option 1: file path (avoids dotenv escape-sequence issues) ─────────
    if _GCP_CREDENTIALS_FILE:
        path = _GCP_CREDENTIALS_FILE.strip()
        if not os.path.isfile(path):
            raise RuntimeError(f"GCP_CREDENTIALS_FILE not found: {path}")
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)

    # ── Option 2: inline JSON string ──────────────────────────────────────
    if not _GCP_CREDENTIALS_JSON:
        raise RuntimeError(
            "GCP not configured. Set GCP_CREDENTIALS_FILE (path to key JSON) "
            "or GCP_CREDENTIALS_JSON in your .env file."
        )
    raw = _GCP_CREDENTIALS_JSON
    # dotenv may have converted \\n → real newlines inside the private_key value;
    # re-escape them so json.loads can parse correctly.
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        fixed = raw.replace('\n', '\\n')
        try:
            return json.loads(fixed)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"GCP_CREDENTIALS_JSON is not valid JSON: {exc}") from exc


def _get_credentials():
    """Return google.oauth2 service account credentials."""
    from google.oauth2 import service_account  # lazy import

    info = _load_credentials_info()
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    return service_account.Credentials.from_service_account_info(info, scopes=scopes)


# ── Client factories ───────────────────────────────────────────────────────

def _no_verify_http(creds):
    """httplib2 Http with SSL verification disabled for Windows environments."""
    import httplib2
    import google_auth_httplib2
    http = httplib2.Http(disable_ssl_certificate_validation=True)
    return google_auth_httplib2.AuthorizedHttp(creds, http=http)


def get_compute_client():
    """Return a googleapiclient.discovery resource for Compute Engine."""
    from googleapiclient import discovery
    creds = _get_credentials()
    return discovery.build("compute", "v1", http=_no_verify_http(creds), cache_discovery=False)


def get_storage_client():
    """Return a google.cloud.storage.Client."""
    from google.cloud import storage
    creds = _get_credentials()
    return storage.Client(project=GCP_PROJECT_ID, credentials=creds)


def get_container_client():
    """Return a googleapiclient.discovery resource for GKE (container v1)."""
    from googleapiclient import discovery
    creds = _get_credentials()
    return discovery.build("container", "v1", http=_no_verify_http(creds), cache_discovery=False)


def _compute_regions_client():
    client = get_compute_client()
    return client.networks(), client.subnetworks()


# ── Instance helpers ───────────────────────────────────────────────────────

def list_instances(project: str = "", zone: str = "-") -> list[dict]:
    """
    List all Compute Engine instances.

    zone='-' uses an aggregated list across all zones.
    Returns a flat list of serialized instance dicts.
    """
    project = project or GCP_PROJECT_ID
    client = get_compute_client()

    results = []
    if zone == "-":
        req = client.instances().aggregatedList(project=project)
        while req:
            resp = req.execute()
            for zone_name, data in resp.get("items", {}).items():
                for inst in data.get("instances", []):
                    results.append(_serialize_instance(inst, zone_name.replace("zones/", "")))
            req = client.instances().aggregatedList_next(req, resp)
    else:
        req = client.instances().list(project=project, zone=zone)
        while req:
            resp = req.execute()
            for inst in resp.get("items", []):
                results.append(_serialize_instance(inst, zone))
            req = client.instances().list_next(req, resp)

    return results


def _serialize_instance(inst: dict, zone: str) -> dict:
    status_map = {
        "RUNNING": "RUNNING",
        "TERMINATED": "TERMINATED",
        "STOPPED": "STOPPED",
        "STAGING": "STAGING",
        "STOPPING": "STOPPING",
        "SUSPENDED": "SUSPENDED",
        "SUSPENDING": "SUSPENDING",
        "PROVISIONING": "PROVISIONING",
    }
    machine_type = inst.get("machineType", "").split("/")[-1]
    labels = inst.get("labels", {}) or {}
    if labels.get("auto_start"):
        labels["auto_start"] = str(labels["auto_start"]).replace("-", ":")
    if labels.get("auto_stop"):
        labels["auto_stop"] = str(labels["auto_stop"]).replace("-", ":")
    return {
        "name":         inst.get("name", ""),
        "status":       status_map.get(inst.get("status", ""), inst.get("status", "UNKNOWN")),
        "machine_type": machine_type,
        "zone":         zone,
        "project":      GCP_PROJECT_ID,
        "self_link":    inst.get("selfLink", ""),
        "creation_timestamp": inst.get("creationTimestamp", ""),
        "labels":       labels,
        "tags":         inst.get("tags", {}).get("items", []),
        "network_interfaces": [
            {
                "network": ni.get("network", "").split("/")[-1],
                "subnetwork": ni.get("subnetwork", "").split("/")[-1],
                "internal_ip": ni.get("networkIP", ""),
                "external_ip": (
                    ni.get("accessConfigs", [{}])[0].get("natIP", "")
                    if ni.get("accessConfigs") else ""
                ),
            }
            for ni in inst.get("networkInterfaces", [])
        ],
    }


def start_instance(name: str, zone: str, project: str = "") -> dict:
    project = project or GCP_PROJECT_ID
    client = get_compute_client()
    op = client.instances().start(project=project, zone=zone, instance=name).execute()
    return {"operation": op.get("name"), "status": op.get("status")}


def stop_instance(name: str, zone: str, project: str = "") -> dict:
    project = project or GCP_PROJECT_ID
    client = get_compute_client()
    op = client.instances().stop(project=project, zone=zone, instance=name).execute()
    return {"operation": op.get("name"), "status": op.get("status")}


def delete_instance(name: str, zone: str, project: str = "") -> dict:
    project = project or GCP_PROJECT_ID
    client = get_compute_client()
    op = client.instances().delete(project=project, zone=zone, instance=name).execute()
    return {"operation": op.get("name"), "status": op.get("status")}


def get_instance(name: str, zone: str, project: str = "") -> dict:
    project = project or GCP_PROJECT_ID
    client = get_compute_client()
    return client.instances().get(project=project, zone=zone, instance=name).execute()


def get_instance_firewall_ports(instance_name: str, zone: str, project: str = "") -> dict:
    """Return TCP ports currently opened for this instance via its auto-managed firewall rule."""
    project = project or GCP_PROJECT_ID
    client = get_compute_client()
    rule_name = f"{instance_name}-allow"
    try:
        rule = client.firewalls().get(project=project, firewall=rule_name).execute()
        ports: list[str] = []
        for allow in rule.get("allowed", []):
            if allow.get("IPProtocol") in ("tcp", "all"):
                ports.extend(allow.get("ports", []))
        source_ranges = rule.get("sourceRanges", ["0.0.0.0/0"])
        return {
            "ports": ports,
            "source_range": source_ranges[0] if source_ranges else "0.0.0.0/0",
            "rule_exists": True,
            "rule_name": rule_name,
        }
    except Exception:
        return {"ports": [], "source_range": "0.0.0.0/0", "rule_exists": False, "rule_name": rule_name}


def upsert_instance_firewall_rule(
    instance_name: str,
    zone: str,
    network: str,
    ports: list[str],
    source_range: str = "0.0.0.0/0",
    project: str = "",
) -> dict:
    """Create or update the firewall rule for an instance and ensure the instance carries the fw tag."""
    project = project or GCP_PROJECT_ID
    client = get_compute_client()
    rule_name = f"{instance_name}-allow"
    fw_tag = f"{instance_name}-fw"
    net_url = (
        network if network.startswith("projects/")
        else f"projects/{project}/global/networks/{network}"
    )

    # Ensure the instance has the target tag so the rule applies to it
    inst = get_instance(name=instance_name, zone=zone, project=project)
    tag_data = inst.get("tags", {})
    current_tags = list(tag_data.get("items", []))
    if fw_tag not in current_tags:
        client.instances().setTags(
            project=project, zone=zone, instance=instance_name,
            body={"items": current_tags + [fw_tag], "fingerprint": tag_data.get("fingerprint", "")},
        ).execute()

    body = {
        "name": rule_name,
        "network": net_url,
        "allowed": [{"IPProtocol": "tcp", "ports": ports}],
        "sourceRanges": [source_range],
        "targetTags": [fw_tag],
        "description": f"Managed by AIonOS for instance {instance_name}",
    }

    try:
        client.firewalls().get(project=project, firewall=rule_name).execute()
        op = client.firewalls().patch(project=project, firewall=rule_name, body=body).execute()
        return {"operation": op.get("name"), "action": "updated"}
    except Exception:
        op = client.firewalls().insert(project=project, body=body).execute()
        return {"operation": op.get("name"), "action": "created"}


def set_instance_labels(name: str, zone: str, labels: dict, label_fingerprint: str, project: str = "") -> dict:
    project = project or GCP_PROJECT_ID
    client = get_compute_client()
    op = client.instances().setLabels(
        project=project,
        zone=zone,
        instance=name,
        body={"labels": labels, "labelFingerprint": label_fingerprint},
    ).execute()
    return {"operation": op.get("name"), "status": op.get("status")}


# image_id from the frontend is a "project/family" shorthand like "debian-cloud/debian-12"
# Map these to full GCP image family URIs.
_IMAGE_FAMILY_MAP = {
    "debian-cloud/debian-12":           "projects/debian-cloud/global/images/family/debian-12",
    "debian-cloud/debian-11":           "projects/debian-cloud/global/images/family/debian-11",
    "ubuntu-os-cloud/ubuntu-2404-lts":  "projects/ubuntu-os-cloud/global/images/family/ubuntu-2404-lts-amd64",
    "ubuntu-os-cloud/ubuntu-2204-lts":  "projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts",
    "ubuntu-os-cloud/ubuntu-2004-lts":  "projects/ubuntu-os-cloud/global/images/family/ubuntu-2004-lts",
    "centos-cloud/centos-stream-9":     "projects/centos-cloud/global/images/family/centos-stream-9",
    "centos-cloud/centos-stream-8":     "projects/centos-cloud/global/images/family/centos-stream-8",
    "rhel-cloud/rhel-9":                "projects/rhel-cloud/global/images/family/rhel-9",
    "rhel-cloud/rhel-8":                "projects/rhel-cloud/global/images/family/rhel-8",
    "rocky-linux-cloud/rocky-linux-9":  "projects/rocky-linux-cloud/global/images/family/rocky-linux-9-optimized-gcp",
    "rocky-linux-cloud/rocky-linux-8":  "projects/rocky-linux-cloud/global/images/family/rocky-linux-8-optimized-gcp",
    "suse-cloud/sles-15":               "projects/suse-cloud/global/images/family/sles-15",
    "cos-cloud/cos-stable":             "projects/cos-cloud/global/images/family/cos-stable",
    "fedora-coreos-cloud/fedora-coreos-stable": "projects/fedora-coreos-cloud/global/images/family/fedora-coreos-stable",
    "windows-cloud/windows-2022":       "projects/windows-cloud/global/images/family/windows-2022",
    "windows-cloud/windows-2019":       "projects/windows-cloud/global/images/family/windows-2019",
    "windows-cloud/windows-2016":       "projects/windows-cloud/global/images/family/windows-2016",
    "windows-sql-cloud/sql-ent-2022-win-2022": "projects/windows-sql-cloud/global/images/family/sql-ent-2022-win-2022",
    "windows-sql-cloud/sql-std-2022-win-2022": "projects/windows-sql-cloud/global/images/family/sql-std-2022-win-2022",
}


def _sanitize_gcp_identifier(value: str, fallback: str = "default", require_leading_letter: bool = True) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9_-]+", "-", value)
    if require_leading_letter:
        value = re.sub(r"^[^a-z]+", "", value)
    else:
        value = re.sub(r"^[^a-z0-9]+", "", value)
    value = re.sub(r"-{2,}", "-", value).strip("-_")
    return (value[:63] or fallback)


def _sanitize_labels(labels: dict | None) -> dict:
    if not labels:
        return {}
    clean = {}
    for key, value in labels.items():
        clean_key = _sanitize_gcp_identifier(str(key), fallback="", require_leading_letter=True)
        clean_value = _sanitize_gcp_identifier(str(value), fallback="", require_leading_letter=False)
        if clean_key and clean_value:
            clean[clean_key] = clean_value
    return clean


def _resolve_source_image(boot_image: str) -> str:
    source_image = _IMAGE_FAMILY_MAP.get(boot_image, boot_image)
    if source_image.startswith("projects/") and "/global/images/" in source_image:
        return source_image

    parts = [p for p in boot_image.split("/") if p]
    if len(parts) >= 2:
        project = parts[0]
        family = parts[-1]
        return f"projects/{project}/global/images/family/{family}"

    raise RuntimeError(f"Unsupported boot image '{boot_image}'. Use 'project/family' or a full GCP image URI.")


def _public_key_from_private_key(private_key_pem: str) -> str:
    from cryptography.hazmat.primitives import serialization

    private_key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
    pub_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.OpenSSH,
        format=serialization.PublicFormat.OpenSSH,
    )
    return pub_bytes.decode("utf-8").strip()


def _gcp_ssh_key_entry(username: str, public_key_openssh: str) -> str:
    """
    Build the GCP metadata ssh-keys entry in the required format:
      username:key-type key-data username
    The trailing username (key comment) is required by the GCP guest agent
    so it can associate the key with the correct OS user. Without it some
    guest-agent versions silently skip the key and authorized_keys is never
    written, causing "Permission denied (publickey)".
    """
    parts = public_key_openssh.strip().split()
    if len(parts) >= 3:
        # already has a comment — replace with username to be safe
        key_body = " ".join(parts[:2])
    else:
        key_body = public_key_openssh.strip()
    return f"{username}:{key_body} {username}"


def set_instance_ssh_key(name: str, zone: str, username: str, public_key_openssh: str, project: str = "") -> dict:
    """Replace / add the ssh-keys metadata entry for `username` on an existing instance."""
    project = project or GCP_PROJECT_ID
    client = get_compute_client()
    inst = client.instances().get(project=project, zone=zone, instance=name).execute()
    meta = inst.get("metadata", {}) or {}
    items = list(meta.get("items", []))

    ssh_entry = _gcp_ssh_key_entry(username, public_key_openssh)

    existing = next((i for i in items if i.get("key") == "ssh-keys"), None)
    if existing:
        lines = [l for l in existing["value"].splitlines() if not l.strip().startswith(f"{username}:")]
        lines.append(ssh_entry)
        existing["value"] = "\n".join(lines)
    else:
        items.append({"key": "ssh-keys", "value": ssh_entry})

    op = client.instances().setMetadata(
        project=project, zone=zone, instance=name,
        body={"fingerprint": meta.get("fingerprint", ""), "items": items},
    ).execute()
    return {"operation": op.get("name"), "status": op.get("status")}


def generate_ssh_keypair(instance_name: str, username: str = "gcpuser") -> dict:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=4096)
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_key_openssh = _public_key_from_private_key(private_key_pem)
    return {
        "username": username,
        "private_key": private_key_pem,
        "public_key": _gcp_ssh_key_entry(username, public_key_openssh),
        "filename": f"{instance_name or 'gcp-instance'}-{username}.pem",
    }


def list_networks(project: str = "") -> list[dict]:
    project = project or GCP_PROJECT_ID
    networks_client, _ = _compute_regions_client()
    req = networks_client.list(project=project)
    networks = []
    while req:
        resp = req.execute()
        for network in resp.get("items", []):
            networks.append({
                "name": network.get("name", ""),
                "self_link": network.get("selfLink", ""),
                "auto_create_subnetworks": network.get("autoCreateSubnetworks", False),
            })
        req = networks_client.list_next(req, resp)
    return sorted(networks, key=lambda item: item["name"])


def list_subnetworks(project: str = "", region: str = "", network: str = "") -> list[dict]:
    project = project or GCP_PROJECT_ID
    _, subnetworks_client = _compute_regions_client()

    if region:
        req = subnetworks_client.list(project=project, region=region)
        subnetworks = []
        while req:
            resp = req.execute()
            subnetworks.extend(resp.get("items", []))
            req = subnetworks_client.list_next(req, resp)
    else:
        req = subnetworks_client.aggregatedList(project=project)
        subnetworks = []
        while req:
            resp = req.execute()
            for scoped in resp.get("items", {}).values():
                subnetworks.extend(scoped.get("subnetworks", []))
            req = subnetworks_client.aggregatedList_next(req, resp)

    if network:
        subnetworks = [s for s in subnetworks if s.get("network", "").split("/")[-1] == network]

    results = []
    for subnet in subnetworks:
        results.append({
            "name": subnet.get("name", ""),
            "region": subnet.get("region", "").split("/")[-1],
            "network": subnet.get("network", "").split("/")[-1],
            "self_link": subnet.get("selfLink", ""),
            "ip_cidr_range": subnet.get("ipCidrRange", ""),
        })
    return sorted(results, key=lambda item: (item["region"], item["name"]))


def list_buckets(project: str = "") -> list[dict]:
    """
    List GCP Cloud Storage buckets.
    Tries www.googleapis.com first (often not blocked by corporate proxies),
    then falls back to storage.googleapis.com — both using httplib2 SSL bypass.
    """
    import requests as _req
    import urllib3
    from google.auth.transport.requests import Request as _GoogleRequest

    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    project = project or GCP_PROJECT_ID

    # Refresh token via a no-verify session
    creds = _get_credentials()
    token_session = _req.Session()
    token_session.verify = False
    try:
        creds.refresh(_GoogleRequest(session=token_session))
    except Exception as exc:
        raise RuntimeError(f"Failed to obtain GCP access token: {exc}") from exc

    endpoints = [
        "https://www.googleapis.com/storage/v1/b",
        "https://storage.googleapis.com/storage/v1/b",
    ]

    last_err = None
    for base_url in endpoints:
        try:
            session = _req.Session()
            session.verify = False
            results = []
            page_token = None
            while True:
                params = {"project": project, "maxResults": 100}
                if page_token:
                    params["pageToken"] = page_token
                resp = session.get(
                    base_url,
                    params=params,
                    headers={"Authorization": f"Bearer {creds.token}"},
                    timeout=15,
                )
                if resp.status_code == 403:
                    ct = resp.headers.get("Content-Type", "")
                    body = resp.text[:200]
                    if "text/html" in ct or body.strip().startswith("<"):
                        raise RuntimeError(
                            f"Proxy/firewall blocked {base_url} (HTML 403). "
                            f"Preview: {body[:80]}"
                        )
                    raise RuntimeError(
                        f"Permission denied listing buckets in '{project}'. "
                        "Grant 'Storage Admin' to the service account at the project level in GCP IAM."
                    )
                resp.raise_for_status()
                data = resp.json()
                for b in data.get("items", []):
                    results.append({
                        "name":             b.get("name", ""),
                        "location":         b.get("location", ""),
                        "locationType":     b.get("locationType", ""),
                        "storage_class":    b.get("storageClass", "STANDARD"),
                        "timeCreated":      b.get("timeCreated", ""),
                        "updated":          b.get("updated", ""),
                        "iamConfiguration": b.get("iamConfiguration", {}),
                        "versioning":       b.get("versioning", {}),
                        "labels":           b.get("labels", {}),
                        "selfLink":         b.get("selfLink", ""),
                    })
                page_token = data.get("nextPageToken")
                if not page_token:
                    break
            return sorted(results, key=lambda x: x["name"])
        except RuntimeError as exc:
            # Permission denied is definitive — don't try next endpoint
            if "permission denied" in str(exc).lower():
                raise
            last_err = exc
            continue
        except Exception as exc:
            last_err = RuntimeError(f"Failed to list buckets via {base_url}: {exc}")
            continue

    raise last_err or RuntimeError("Failed to list buckets: all endpoints unreachable")


def create_instance(
    name: str,
    machine_type: str,
    zone: str,
    boot_image: str,
    boot_disk_size: int = 50,
    boot_disk_type: str = "pd-balanced",
    assign_public_ip: bool = False,
    tags: list = None,
    labels: dict = None,
    preemptible: bool = False,
    metadata: dict = None,
    network: str = "default",
    subnetwork: str = "",
    startup_script: str = "",
    project: str = "",
) -> dict:
    """
    Create a new Compute Engine instance.
    boot_image may be a shorthand "project/family" key or a full image URI.
    """
    project = project or GCP_PROJECT_ID
    client = get_compute_client()

    source_image = _resolve_source_image(boot_image)

    disk_config = {
        "boot": True,
        "autoDelete": True,
        "initializeParams": {
            "sourceImage": source_image,
            "diskSizeGb": str(boot_disk_size),
            "diskType": f"zones/{zone}/diskTypes/{boot_disk_type}",
        },
    }

    nic: dict = {"network": f"global/networks/{network or 'default'}"}
    if subnetwork:
        nic["subnetwork"] = (
            subnetwork
            if subnetwork.startswith("projects/") or subnetwork.startswith("https://")
            else f"regions/{zone.rsplit('-', 1)[0]}/subnetworks/{subnetwork}"
        )
    if assign_public_ip:
        nic["accessConfigs"] = [{"type": "ONE_TO_ONE_NAT", "name": "External NAT"}]

    body: dict = {
        "name": name,
        "machineType": f"zones/{zone}/machineTypes/{machine_type}",
        "disks": [disk_config],
        "networkInterfaces": [nic],
    }

    if tags:
        body["tags"] = {"items": tags}
    clean_labels = _sanitize_labels(labels)
    if clean_labels:
        body["labels"] = clean_labels
    if preemptible:
        body["scheduling"] = {"preemptible": True, "onHostMaintenance": "TERMINATE", "automaticRestart": False}
    metadata_items = list((metadata or {}).get("items", []))
    if startup_script.strip():
        script_key = "windows-startup-script-ps1" if "windows" in boot_image else "startup-script"
        metadata_items.append({"key": script_key, "value": startup_script})
    if metadata_items:
        body["metadata"] = {"items": metadata_items}

    op = client.instances().insert(project=project, zone=zone, body=body).execute()
    return {"operation": op.get("name"), "status": op.get("status"), "zone": zone, "name": name}


# ── Health check ──────────────────────────────────────────────────────────

def check_gcp_connectivity() -> dict:
    """Quick connectivity test — returns status dict."""
    if not CONFIGURED:
        return {"status": "not_configured", "project": GCP_PROJECT_ID or "not set"}
    try:
        client = get_compute_client()
        client.zones().list(project=GCP_PROJECT_ID, maxResults=1).execute()
        return {"status": "connected", "project": GCP_PROJECT_ID}
    except Exception as exc:
        return {"status": "error", "project": GCP_PROJECT_ID, "message": str(exc)}
