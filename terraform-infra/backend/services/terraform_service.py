# -*- coding: utf-8 -*-
"""
services/terraform_service.py

Architecture:
  - Static templates in backend/terraform/templates/
  - Dynamic tfvars generated per request
  - Workspace created -> apply -> archived to S3 -> deleted
  - State always in S3 (never local)
"""
import os
import re
import stat
import time
import json
import shutil
import subprocess
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# --- Config from .env -------------------------------------------------------
TERRAFORM_BIN        = os.getenv("TERRAFORM_BIN",            "terraform")
AWS_ACCESS_KEY       = os.getenv("AWS_ACCESS_KEY_ID",        "")
AWS_SECRET_KEY       = os.getenv("AWS_SECRET_ACCESS_KEY",    "")
STATE_BUCKET         = os.getenv("TF_STATE_BUCKET",          "aionos-terraform-state-3305")
STATE_REGION         = os.getenv("TF_STATE_REGION",          "ap-south-1")
DYNAMO_TABLE         = os.getenv("TF_DYNAMO_TABLE",          "terraform-lock")
TF_PROJECT           = Path(os.getenv("TF_PROJECT_ROOT",     ""))
KEY_SAVE_PATH        = os.getenv("KEY_SAVE_PATH",            "./keys")
GCP_PROJECT_ID        = os.getenv("GCP_PROJECT_ID",          "")
GCP_CREDENTIALS_JSON  = os.getenv("GCP_CREDENTIALS_JSON",    "")
GCP_CREDENTIALS_FILE  = os.getenv("GCP_CREDENTIALS_FILE",    "")

# --- Paths ------------------------------------------------------------------
TEMPLATES_DIR = Path(__file__).parent.parent / "terraform" / "templates"

TF_ENVS = {
    "dev":     TF_PROJECT / "environments" / "dev",
    "staging": TF_PROJECT / "environments" / "staging",
    "prod":    TF_PROJECT / "environments" / "prod",
}

# --- Cache ------------------------------------------------------------------
_DEFAULT_SG_CACHE = {}


# ----------------------------------------------------------------------------
# HELPERS
# ----------------------------------------------------------------------------

def _safe_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_]", "_", name).lower()


def _gcp_creds_json() -> str:
    """Return GCP credentials JSON string.
    Tries GCP_CREDENTIALS_JSON first, then reads GCP_CREDENTIALS_FILE.
    Raises RuntimeError if neither is configured or produces valid JSON.
    """
    raw = GCP_CREDENTIALS_JSON.strip() if GCP_CREDENTIALS_JSON else ""
    if not raw and GCP_CREDENTIALS_FILE:
        path = GCP_CREDENTIALS_FILE.strip()
        if not os.path.isfile(path):
            raise RuntimeError(f"GCP_CREDENTIALS_FILE not found: {path}")
        with open(path, "r", encoding="utf-8") as fh:
            raw = fh.read().strip()
    if not raw:
        raise RuntimeError(
            "GCP credentials not configured. "
            "Set GCP_CREDENTIALS_JSON or GCP_CREDENTIALS_FILE in your .env file."
        )
    # Quick sanity check — must be valid JSON with a 'type' field
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"GCP credentials are not valid JSON: {exc}") from exc
    if "type" not in parsed:
        raise RuntimeError(
            "GCP credentials JSON is missing the 'type' field. "
            "Download a service-account key from GCP IAM and paste the full JSON."
        )
    return raw


def _get_env(payload: dict) -> str:
    env = payload.get("tags", {}).get("environment", "dev").lower()
    return env if env in ("dev", "staging", "prod") else "dev"


def _get_default_sg(region: str):
    if region in _DEFAULT_SG_CACHE:
        return _DEFAULT_SG_CACHE[region]
    try:
        import boto3
        ec2  = boto3.client("ec2", region_name=region,
                            aws_access_key_id=AWS_ACCESS_KEY,
                            aws_secret_access_key=AWS_SECRET_KEY)
        vpcs = ec2.describe_vpcs(
            Filters=[{"Name": "isDefault", "Values": ["true"]}]
        )["Vpcs"]
        if vpcs:
            sgs = ec2.describe_security_groups(Filters=[
                {"Name": "vpc-id",     "Values": [vpcs[0]["VpcId"]]},
                {"Name": "group-name", "Values": ["default"]},
            ])["SecurityGroups"]
            if sgs:
                _DEFAULT_SG_CACHE[region] = sgs[0]["GroupId"]
                return sgs[0]["GroupId"]
    except Exception as e:
        print(f"SG lookup failed: {e}")
    return None


def _tf_env() -> dict:
    env = os.environ.copy()
    env["AWS_ACCESS_KEY_ID"]     = AWS_ACCESS_KEY
    env["AWS_SECRET_ACCESS_KEY"] = AWS_SECRET_KEY
    env["AWS_DEFAULT_REGION"]    = STATE_REGION
    env["AWS_REGION"]            = STATE_REGION
    env["CHECKPOINT_DISABLE"]    = "1"
    env["TF_IN_AUTOMATION"]      = "1"
    env["TF_LOG"]                = ""
    env.pop("AWS_PROFILE", None)
    env.pop("AWS_SESSION_TOKEN", None)
    return env


# ----------------------------------------------------------------------------
# WORKSPACE MANAGEMENT
# ----------------------------------------------------------------------------

def get_workspace(request_id: int, environment: str = "dev") -> Path:
    ws = TF_ENVS.get(environment, TF_ENVS["dev"]) / "aionos" / f"req_{request_id}"
    ws.mkdir(parents=True, exist_ok=True)
    return ws


def _rmtree_safe(path: Path) -> None:
    """Windows-safe rmtree: retries after making files writable to handle locked provider binaries."""
    def _on_error(func, path_str, exc_info):
        try:
            os.chmod(path_str, stat.S_IWRITE)
            func(path_str)
        except Exception:
            pass

    for attempt in range(4):
        try:
            shutil.rmtree(str(path), onerror=_on_error)
            return
        except Exception as e:
            if attempt < 3:
                time.sleep(3)
            else:
                print(f"[cleanup] Failed to delete {path} after 4 attempts: {e}")


def cleanup_workspace(request_id: int, environment: str = "dev") -> bool:
    ws = TF_ENVS.get(environment, TF_ENVS["dev"]) / "aionos" / f"req_{request_id}"
    if ws.exists():
        _rmtree_safe(ws)
        print(f"[req_{request_id}] Workspace cleaned up: {ws}")
        return True
    return False


# ----------------------------------------------------------------------------
# S3 ARCHIVING  — unified structure per cloud
#
#  aionos/{cloud}/{env}/req_{id}.tfstate   ← flat state file (no subdirectory)
#  aionos/{cloud}/{env}/deploy.log         ← ALL deploys for this cloud+env appended
#  aionos/{cloud}/index.json               ← manifest of every deployment for this cloud
# ----------------------------------------------------------------------------

def _s3_client():
    import boto3
    return boto3.client("s3",
                        region_name=STATE_REGION,
                        aws_access_key_id=AWS_ACCESS_KEY,
                        aws_secret_access_key=AWS_SECRET_KEY)


def archive_to_s3(
    request_id:    int,
    environment:   str,
    log_output:    str  = "",
    cloud:         str  = "aws",
    resource_name: str  = "",
    resource_type: str  = "",
    username:      str  = "",
    status:        str  = "completed",
) -> bool:
    """
    Archive a finished deployment:
      1. Store the generated main.tf and tfvars as flat files (for audit/preview).
      2. Append this deploy's log to the shared  deploy.log  for cloud+env.
      3. Upsert this deployment into the cloud-level  index.json  manifest.
    """
    from datetime import datetime as _dt
    try:
        s3 = _s3_client()
        ws = get_workspace(request_id, environment)

        # ── 1. Flat config files (small, useful for TF preview) ─────────────
        base = f"aionos/{cloud}/{environment}"
        for fname, s3key in [("main.tf", f"{base}/req_{request_id}.tf"),
                              ("terraform.tfvars", f"{base}/req_{request_id}.tfvars")]:
            local = ws / fname
            if local.exists():
                s3.put_object(Bucket=STATE_BUCKET, Key=s3key,
                              Body=local.read_bytes(), ContentType="text/plain")

        # ── 2. Append to combined deploy.log for this cloud+env ─────────────
        log_key = f"{base}/deploy.log"
        ts      = _dt.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        sep     = "=" * 80
        header  = (
            f"\n{sep}\n"
            f"[{ts}] REQ #{request_id} | {resource_name} ({resource_type}) "
            f"| env: {environment} | user: {username} | {status.upper()}\n"
            f"{sep}\n"
        )
        footer  = f"\n{sep}\nEND REQ #{request_id}\n{sep}\n"
        new_section = (header + (log_output or "(no output)") + footer).encode("utf-8")

        try:
            existing = s3.get_object(Bucket=STATE_BUCKET, Key=log_key)["Body"].read()
        except Exception:
            existing = b""
        s3.put_object(Bucket=STATE_BUCKET, Key=log_key,
                      Body=existing + new_section, ContentType="text/plain")

        # ── 3. Upsert deployment into cloud-level index.json ─────────────────
        index_key = f"aionos/{cloud}/index.json"
        try:
            raw   = s3.get_object(Bucket=STATE_BUCKET, Key=index_key)["Body"].read()
            index = json.loads(raw)
        except Exception:
            index = {"cloud": cloud, "deployments": []}

        # Remove old entry for this request_id if re-archiving
        index["deployments"] = [d for d in index["deployments"] if d.get("req_id") != request_id]
        index["deployments"].append({
            "req_id":        request_id,
            "resource_name": resource_name,
            "resource_type": resource_type,
            "environment":   environment,
            "status":        status,
            "deployed_at":   ts,
            "state_key":     f"aionos/{cloud}/{environment}/req_{request_id}.tfstate",
            "username":      username,
        })
        index["total"]        = len(index["deployments"])
        index["last_updated"] = ts
        s3.put_object(Bucket=STATE_BUCKET, Key=index_key,
                      Body=json.dumps(index, indent=2).encode("utf-8"),
                      ContentType="application/json")

        print(f"[req_{request_id}] Archived → s3://{STATE_BUCKET}/{base}/ | index updated")
        return True
    except Exception as e:
        print(f"[req_{request_id}] S3 archive failed: {e}")
        return False


def get_archived_files(request_id: int, environment: str, cloud: str = "aws") -> dict:
    """Retrieve the flat config files stored for a specific request."""
    try:
        s3     = _s3_client()
        base   = f"aionos/{cloud}/{environment}"
        result = {}
        for local_name, s3_suffix in [("main.tf", "tf"), ("terraform.tfvars", "tfvars")]:
            try:
                obj = s3.get_object(Bucket=STATE_BUCKET,
                                    Key=f"{base}/req_{request_id}.{s3_suffix}")
                result[local_name] = obj["Body"].read().decode("utf-8")
            except Exception:
                pass
        return result
    except Exception as e:
        print(f"[req_{request_id}] S3 retrieve failed: {e}")
        return {}


def get_cloud_index(cloud: str) -> dict:
    """Return the deployment manifest for a given cloud."""
    try:
        s3  = _s3_client()
        obj = s3.get_object(Bucket=STATE_BUCKET, Key=f"aionos/{cloud}/index.json")
        return json.loads(obj["Body"].read())
    except Exception:
        return {"cloud": cloud, "deployments": [], "total": 0}


def get_cloud_log(cloud: str, environment: str) -> str:
    """Return the combined deploy log for a cloud+env."""
    try:
        s3  = _s3_client()
        obj = s3.get_object(Bucket=STATE_BUCKET,
                            Key=f"aionos/{cloud}/{environment}/deploy.log")
        return obj["Body"].read().decode("utf-8", errors="replace")
    except Exception:
        return "(no logs yet)"


def restore_workspace(request_id: int, environment: str, cloud: str = "aws") -> bool:
    try:
        files = get_archived_files(request_id, environment, cloud=cloud)
        if not files:
            return False
        ws = get_workspace(request_id, environment)
        for filename, content in files.items():
            (ws / filename).write_text(content, encoding="utf-8")
        print(f"[req_{request_id}] Workspace restored from S3")
        return True
    except Exception as e:
        print(f"[req_{request_id}] Restore failed: {e}")
        return False


# ----------------------------------------------------------------------------
# TERRAFORM RUNNER
# ----------------------------------------------------------------------------

def run_terraform(action: str, environment: str = "dev",
                  request_id: int = None, extra_args: list = None,
                  cloud: str = "aws") -> dict:
    ws  = get_workspace(request_id, environment) if request_id else TF_ENVS.get(environment, TF_ENVS["dev"])
    env = _tf_env()

    # Flat state key: aionos/{cloud}/{env}/req_{id}.tfstate
    state_key = f"aionos/{cloud}/{environment}/req_{request_id}.tfstate"

    cmd_map = {
        "init":     [TERRAFORM_BIN, "init",    "-no-color", "-input=false",
                     f"-backend-config=key={state_key}",
                     f"-backend-config=bucket={STATE_BUCKET}",
                     f"-backend-config=region={STATE_REGION}",
                     f"-backend-config=dynamodb_table={DYNAMO_TABLE}",
                     "-reconfigure"],
        "plan":     [TERRAFORM_BIN, "plan",    "-no-color", "-input=false", "-parallelism=20"],
        "apply":    [TERRAFORM_BIN, "apply",   "-no-color", "-auto-approve",
                     "-input=false", "-parallelism=20", "-compact-warnings"],
        "destroy":  [TERRAFORM_BIN, "destroy", "-no-color", "-auto-approve",
                     "-input=false", "-parallelism=20"],
        "output":   [TERRAFORM_BIN, "output",  "-json"],
        "validate": [TERRAFORM_BIN, "validate", "-no-color"],
    }

    cmd = cmd_map.get(action)
    if not cmd:
        return {"success": False, "output": "", "error": f"Unknown action: {action}"}
    if extra_args:
        cmd = cmd + extra_args

    # GKE/EKS cluster operations can take 15–30 min; give them room
    _TIMEOUTS = {"init": 300, "plan": 300, "apply": 1800, "destroy": 1800, "output": 60, "validate": 60}
    timeout = _TIMEOUTS.get(action, 900)

    try:
        r = subprocess.run(cmd, cwd=str(ws), env=env,
                           capture_output=True, text=True, timeout=timeout)
        return {
            "success": r.returncode == 0,
            "output":  r.stdout,
            "error":   r.stderr if r.returncode != 0 else "",
        }
    except FileNotFoundError:
        return {"success": False, "output": "", "error": "Terraform binary not found"}
    except subprocess.TimeoutExpired:
        return {"success": False, "output": "", "error": f"Terraform timed out ({timeout}s)"}
    except Exception as e:
        return {"success": False, "output": "", "error": str(e)}


# ----------------------------------------------------------------------------
# OUTPUTS
# ----------------------------------------------------------------------------

def get_outputs(environment: str = "dev", request_id: int = None) -> dict:
    r = run_terraform("output", environment, request_id=request_id)
    if r["success"]:
        try:
            d = json.loads(r["output"])
            return {k: v["value"] for k, v in d.items()}
        except Exception:
            pass
    return {}


def get_resource_output(resource_name: str, environment: str = "dev",
                        request_id: int = None) -> dict:
    all_out = get_outputs(environment, request_id=request_id)
    prefix  = _safe_name(resource_name)
    return {k: v for k, v in all_out.items() if prefix in k}


# ----------------------------------------------------------------------------
# TFVARS WRITERS
# ----------------------------------------------------------------------------

def _write_tfvars(ws: Path, data: dict) -> None:
    lines = []
    for key, value in data.items():
        if isinstance(value, bool):
            lines.append(f'{key} = {str(value).lower()}')
        elif isinstance(value, (int, float)):
            lines.append(f'{key} = {value}')
        elif isinstance(value, list):
            items = ", ".join(f'"{v}"' for v in value)
            lines.append(f'{key} = [{items}]')
        elif isinstance(value, dict):
            pairs = "\n  ".join(f'"{k}" = "{v}"' for k, v in value.items())
            lines.append(f'{key} = {{\n  {pairs}\n}}')
        elif isinstance(value, str):
            # Decode any pre-escaped \n back to real newlines
            decoded = value.replace("\\n", "\n").replace("\\t", "\t")
            if "\n" in decoded or '"' in decoded or "'" in decoded or "\\" in decoded:
                # Use heredoc — marker is long enough that no script content can match it
                marker = "AIONOS_TFVARS_EOF"
                lines.append(f'{key} = <<-{marker}\n{decoded}\n{marker}')
            else:
                lines.append(f'{key} = "{decoded}"')
        else:
            lines.append(f'{key} = "{value}"')
    (ws / "terraform.tfvars").write_text("\n".join(lines), encoding="utf-8")
    print(f"Written tfvars: {ws / 'terraform.tfvars'}")


def _copy_template(ws: Path, resource_type: str) -> None:
    # Remove stale .terraform dir so init always starts clean on re-runs
    tf_dir  = ws / ".terraform"
    tf_lock = ws / ".terraform.lock.hcl"
    if tf_dir.exists():
        shutil.rmtree(tf_dir)
        print(f"Cleaned stale .terraform dir in {ws}")
    if tf_lock.exists():
        tf_lock.unlink()

    template = TEMPLATES_DIR / f"{resource_type}.tf"
    if not template.exists():
        raise FileNotFoundError(f"Template not found: {template}")
    shutil.copy(template, ws / "main.tf")
    print(f"Copied template: {template} -> {ws / 'main.tf'}")


# ----------------------------------------------------------------------------
# RESOURCE WRITERS
# ----------------------------------------------------------------------------

def write_ec2_tf(request_id: int, config: dict) -> str:
    env    = _get_env(config)
    region = config.get("region", "ap-south-1")
    name   = config.get("resource_name", f"ec2-{request_id}")
    tags   = config.get("tags", {})
    user   = config.get("username", "aionos")

    sgs = config.get("security_group_ids", [])
    if not sgs:
        sg_id = _get_default_sg(region)
        if sg_id:
            sgs = [sg_id]

    ws = get_workspace(request_id, env)
    _copy_template(ws, "ec2")
    _write_tfvars(ws, {
        "region":                            region,
        "environment":                       env,
        "resource_name":                     name,
        "ami":                               config.get("ami_id", "ami-0f58b397bc5c1f2e8"),
        "instance_type":                     config.get("instance_type", "t3.medium"),
        "subnet_id":                         config.get("subnet_id", ""),
        "key_name":                          config.get("key_name", ""),
        "security_group_ids":                sgs,
        "associate_public_ip":               config.get("associate_public_ip", True),
        "monitoring":                        config.get("monitoring", False),
        "disable_api_termination":           config.get("disable_api_termination", False),
        "root_volume_type":                  config.get("root_volume_type", "gp3"),
        "root_volume_size":                  config.get("root_volume_size", 20),
        "root_volume_delete_on_termination": config.get("root_volume_delete_on_termination", True),
        "root_volume_encrypted":             config.get("root_volume_encrypted", False),
        "tags": {
            "Project":     tags.get("project", "AIonOS-Platform"),
            "Owner":       tags.get("owner", user),
            "Environment": env,
            "CreatedBy":   "AIonOS-Platform",
            "ManagedBy":   user,
            "RequestID":   str(request_id),
        },
    })
    return str(ws / "main.tf")


def write_s3_tf(request_id: int, config: dict) -> str:
    env  = _get_env(config)
    name = config.get("name", config.get("resource_name", f"bucket-{request_id}"))
    tags = config.get("tags", {})
    user = config.get("username", "aionos")

    ws = get_workspace(request_id, env)
    _copy_template(ws, "s3")
    _write_tfvars(ws, {
        "region":             config.get("region", "ap-south-1"),
        "environment":        env,
        "resource_name":      name,
        "versioning_enabled": config.get("versioning", False),
        "encryption_type":    config.get("encryption", "AES256"),
        "tags": {
            "Project":     tags.get("project", "AIonOS-Platform"),
            "Owner":       tags.get("owner", user),
            "Environment": env,
            "CreatedBy":   "AIonOS-Platform",
            "ManagedBy":   user,
            "RequestID":   str(request_id),
        },
    })
    return str(ws / "main.tf")


def write_vpc_tf(request_id: int, config: dict) -> str:
    env    = _get_env(config)
    name   = config.get("name", f"vpc-{request_id}")
    region = config.get("region", "ap-south-1")
    subs   = config.get("subnets", [])
    tags   = config.get("tags", {})
    user   = config.get("username", "aionos")

    pub  = [s["cidr"] for s in subs if s.get("public", True)]      or ["10.0.1.0/24"]
    priv = [s["cidr"] for s in subs if not s.get("public", True)]  or ["10.0.11.0/24"]
    azs  = list({s.get("az", f"{region}a") for s in subs})         or [f"{region}a", f"{region}b"]

    ws = get_workspace(request_id, env)
    _copy_template(ws, "vpc")
    _write_tfvars(ws, {
        "region":             region,
        "environment":        env,
        "resource_name":      name,
        "vpc_cidr":           config.get("cidr", "10.0.0.0/16"),
        "availability_zones": azs,
        "public_subnets":     pub,
        "private_subnets":    priv,
        "enable_nat_gateway": config.get("create_nat", False),
        "tags": {
            "Project":     tags.get("project", "AIonOS-Platform"),
            "Owner":       tags.get("owner", user),
            "Environment": env,
            "CreatedBy":   "AIonOS-Platform",
            "ManagedBy":   user,
            "RequestID":   str(request_id),
        },
    })
    return str(ws / "main.tf")


def write_keypair_tf(request_id: int, config: dict) -> str:
    env  = _get_env(config)
    name = config.get("name", config.get("resource_name", f"keypair-{request_id}"))
    tags = config.get("tags", {})
    user = config.get("username", "aionos")

    ws = get_workspace(request_id, env)
    _copy_template(ws, "keypair")
    _write_tfvars(ws, {
        "region":        config.get("region", "ap-south-1"),
        "environment":   env,
        "resource_name": name,
        "key_save_path": KEY_SAVE_PATH,
        "tags": {
            "Project":     tags.get("project", "AIonOS-Platform"),
            "Owner":       tags.get("owner", user),
            "Environment": env,
            "CreatedBy":   "AIonOS-Platform",
            "ManagedBy":   user,
            "RequestID":   str(request_id),
        },
    })
    return str(ws / "main.tf")


def write_eks_tf(request_id: int, config: dict) -> str:
    env    = _get_env(config)
    name   = config.get("name", config.get("resource_name", f"eks-{request_id}"))
    region = config.get("region", "ap-south-1")
    tags   = config.get("tags", {})
    user   = config.get("username", "aionos")

    ws = get_workspace(request_id, env)
    _copy_template(ws, "eks")
    _write_tfvars(ws, {
        "region":             region,
        "environment":        env,
        "cluster_name":       name,
        "kubernetes_version": config.get("kubernetes_version", "1.29"),
        "node_instance_type": config.get("node_instance_type", "t3.medium"),
        "node_count":         config.get("node_count", 2),
        "min_nodes":          config.get("min_nodes", 1),
        "max_nodes":          config.get("max_nodes", 5),
        "subnet_ids":         config.get("subnet_ids", []),
        "cluster_role_arn":   config.get("cluster_role_arn", config.get("role_arn", "")),
        "node_role_arn":      config.get("node_role_arn", config.get("role_arn", "")),
        "tags": {
            "Project":     tags.get("project", "AIonOS-Platform"),
            "Owner":       tags.get("owner", user),
            "Environment": env,
            "CreatedBy":   "AIonOS-Platform",
            "ManagedBy":   user,
            "RequestID":   str(request_id),
        },
    })
    return str(ws / "main.tf")


# ----------------------------------------------------------------------------
# AZURE WRITER
# ----------------------------------------------------------------------------

# Azure credentials loaded from .env per subscription
_AZURE_CREDS = {
    "prod": {
        "subscription_id": os.getenv("AZURE_PROD_SUBSCRIPTION_ID", ""),
        "client_id":       os.getenv("AZURE_PROD_CLIENT_ID", ""),
        "client_secret":   os.getenv("AZURE_PROD_CLIENT_SECRET", ""),
        "tenant_id":       os.getenv("AZURE_TENANT_ID", ""),
    },
    "nonprod": {
        "subscription_id": os.getenv("AZURE_NONPROD_SUBSCRIPTION_ID", ""),
        "client_id":       os.getenv("AZURE_NONPROD_CLIENT_ID", ""),
        "client_secret":   os.getenv("AZURE_NONPROD_CLIENT_SECRET", ""),
        "tenant_id":       os.getenv("AZURE_TENANT_ID", ""),
    },
    "connectivity": {
        "subscription_id": os.getenv("AZURE_CONNECTIVITY_SUBSCRIPTION_ID", ""),
        "client_id":       os.getenv("AZURE_CONNECTIVITY_CLIENT_ID", ""),
        "client_secret":   os.getenv("AZURE_CONNECTIVITY_CLIENT_SECRET", ""),
        "tenant_id":       os.getenv("AZURE_TENANT_ID", ""),
    },
}


def write_azure_vm_tf(request_id: int, config: dict) -> str:
    """
    Generate Azure VM Terraform workspace.
    Subscription routing:
      - network resources  → connectivity subscription
      - VMs and storage   → prod or nonprod subscription
    Mandatory tags enforced: Application Name, Application Owner,
      Business Criticality, Email ID, Environment, start-date
    """
    env          = _get_env(config)
    name         = config.get("resource_name", f"vm-{request_id}")
    subscription = config.get("subscription", "nonprod")  # prod | nonprod
    tags         = config.get("tags", {})
    user         = config.get("username", "aionos")

    if subscription not in ("prod", "nonprod"):
        subscription = "nonprod"

    creds = _AZURE_CREDS[subscription]

    def _tag(key_snake, key_display, default=""):
        return (tags.get(key_snake) or tags.get(key_display)
                or config.get(key_snake) or config.get(key_display) or default)

    mandatory = {
        "tag_application_name":     _tag("application_name",     "Application Name"),
        "tag_application_owner":    _tag("application_owner",    "Application Owner"),
        "tag_business_criticality": _tag("business_criticality", "Business Criticality", "Medium"),
        "tag_email_id":             _tag("email_id",             "Email ID"),
        "tag_start_date":           _tag("start_date",           "Start Date"),
    }

    ws = get_workspace(request_id, env)
    _copy_template(ws, "azure_vm")
    _write_tfvars(ws, {
        # Auth
        "subscription_id": creds["subscription_id"],
        "client_id":       creds["client_id"],
        "client_secret":   creds["client_secret"],
        "tenant_id":       creds["tenant_id"],
        "subscription":    subscription,
        # Resource Group
        "resource_group_name":   config.get("resource_group_name", f"rg-{name}"),
        "create_resource_group": config.get("create_resource_group", True),
        "location":              config.get("location", "eastus"),
        # VM Core
        "resource_name": name,
        "environment":   env,
        "vm_size":       config.get("vm_size", "Standard_B2s"),
        "os_type":       config.get("os_type", "Linux"),
        # Image
        "image_publisher": config.get("image_publisher", "Canonical"),
        "image_offer":     config.get("image_offer", "0001-com-ubuntu-server-jammy"),
        "image_sku":       config.get("image_sku", "22_04-lts-gen2"),
        "image_version":   config.get("image_version", "latest"),
        # Auth
        "admin_username":                   config.get("admin_username", "azureuser"),
        "admin_password":                   config.get("admin_password", ""),
        "ssh_public_key":                   config.get("ssh_public_key", ""),
        "disable_password_authentication":  config.get("disable_password_authentication", True),
        # Network (subnet from Connectivity subscription)
        "subnet_id":         config.get("subnet_id", ""),
        "enable_public_ip":  config.get("enable_public_ip", False),
        "allowed_ports":     config.get("allowed_ports", [22, 80, 443]),
        # Storage
        "os_disk_type":    config.get("os_disk_type", "Premium_LRS"),
        "os_disk_size_gb": config.get("os_disk_size_gb", 128),
        "os_disk_caching": config.get("os_disk_caching", "ReadWrite"),
        # Mandatory tags
        **mandatory,
        "tags": {
            "CreatedBy": "AIonOS-Platform",
            "ManagedBy": user,
            "RequestID": str(request_id),
        },
    })
    return str(ws / "main.tf")


# ----------------------------------------------------------------------------
# GCP WRITER
# ----------------------------------------------------------------------------

def _gcp_instance_name(name: str) -> str:
    """Sanitize name to match GCP instance naming rules: [a-z]([-a-z0-9]*[a-z0-9])? max 63 chars."""
    n = re.sub(r"[^a-z0-9-]", "-", name.lower())
    n = re.sub(r"-+", "-", n).strip("-")
    if not n or n[0].isdigit():
        n = "vm-" + n
    return n[:63]


def _gcp_label_value(v: str) -> str:
    """Sanitize a value to be a valid GCP label value: lowercase, letters/digits/hyphens/underscores, max 63."""
    return re.sub(r"[^a-z0-9_-]", "-", str(v).lower())[:63]


def write_gcp_instance_tf(request_id: int, config: dict) -> str:
    """
    Generate GCP Compute Engine Terraform workspace.
    Credentials JSON is written to a file inside the workspace so the
    Google provider can authenticate without leaking secrets in tfvars.
    State stored in the same S3 bucket as AWS/Azure resources.
    """
    env        = _get_env(config)
    name       = _gcp_instance_name(config.get("resource_name", f"gcp-vm-{request_id}"))
    region     = config.get("region", "us-central1")
    zone       = config.get("zone", f"{region}-a")
    user       = config.get("username", "aionos")
    labels     = config.get("labels", {})
    tags       = config.get("tags", {})
    project_id = GCP_PROJECT_ID or config.get("project_id", "")
    if not project_id:
        raise ValueError(
            "GCP Project ID is not configured. "
            "Set GCP_PROJECT_ID in your .env file or provide it in the request."
        )

    ws = get_workspace(request_id, env)
    _copy_template(ws, "gcp_instance")

    # Write credentials JSON to a file inside the workspace; reference by path
    creds_file = ws / "credentials.json"
    creds_file.write_text(_gcp_creds_json(), encoding="utf-8")

    # Patch deprecated / wrong image family names before they reach Terraform
    _IMAGE_ALIASES = {
        "ubuntu-os-cloud/ubuntu-2004-lts":  "ubuntu-os-cloud/ubuntu-2204-lts",   # EOL Apr 2025
        "ubuntu-os-cloud/ubuntu-2404-lts":  "ubuntu-os-cloud/ubuntu-2404-lts-amd64",
        "centos-cloud/centos-stream-8":      "centos-cloud/centos-stream-9",       # EOL
        "windows-cloud/windows-2016":        "windows-cloud/windows-2019",         # EOL
    }
    boot_image = config.get("boot_image", "debian-cloud/debian-12")
    boot_image = _IMAGE_ALIASES.get(boot_image, boot_image)

    startup_script = config.get("startup_script", "").replace("\r", "")

    _write_tfvars(ws, {
        "credentials_file": creds_file.as_posix(),
        "project_id":       project_id,
        "region":           region,
        "zone":             zone,
        "resource_name":    name,
        "environment":      env,
        "machine_type":     config.get("machine_type", "e2-medium"),
        "boot_image":       boot_image,
        "boot_disk_size":   config.get("boot_disk_size", 50),
        "boot_disk_type":   config.get("boot_disk_type", "pd-balanced"),
        "network":          config.get("network", "default"),
        "subnetwork":       config.get("subnetwork", ""),
        "assign_public_ip": config.get("assign_public_ip", False),
        "preemptible":      config.get("preemptible", False),
        "startup_script":    startup_script,
        "ssh_keys_metadata": config.get("ssh_keys_metadata", ""),
        "network_tags":           config.get("network_tags", []),
        "firewall_ports":         config.get("firewall_ports", []),
        "firewall_source_range":  config.get("firewall_source_range", "0.0.0.0/0"),
        "labels": {
            "project":    _gcp_label_value(tags.get("project", "aionos-platform")),
            "owner":      _gcp_label_value(user),
            "request-id": str(request_id),
            "created-by": "aionos-platform",
        },
    })
    return str(ws / "main.tf")


# ----------------------------------------------------------------------------
# WRITER REGISTRY
# ----------------------------------------------------------------------------

def write_gcp_network_tf(request_id: int, config: dict) -> str:
    """Generate GCP VPC Network Terraform workspace."""
    env        = _get_env(config)
    name       = _gcp_instance_name(config.get("network_name", f"vpc-{request_id}"))
    region     = config.get("region", "us-central1")
    project_id = GCP_PROJECT_ID or config.get("project_id", "")
    if not project_id:
        raise ValueError(
            "GCP Project ID is not configured. "
            "Set GCP_PROJECT_ID in your .env file or provide it in the request."
        )

    ws = get_workspace(request_id, env)
    _copy_template(ws, "gcp_network")

    creds_file = ws / "credentials.json"
    creds_file.write_text(_gcp_creds_json(), encoding="utf-8")

    _write_tfvars(ws, {
        "credentials_file":       creds_file.as_posix(),
        "project_id":             project_id,
        "region":                 region,
        "network_name":           name,
        "description":            config.get("description", ""),
        "auto_create_subnetworks": config.get("auto_create_subnetworks", False),
        "routing_mode":           config.get("routing_mode", "REGIONAL"),
        "mtu":                    config.get("mtu", 1460),
        "environment":            env,
        "create_subnet":          config.get("create_subnet", False),
        "subnet_name":            _gcp_instance_name(config.get("subnet_name", f"{name}-subnet")),
        "subnet_cidr":            config.get("subnet_cidr", "10.0.0.0/24"),
        "subnet_region":          config.get("subnet_region", region),
        "private_google_access":  config.get("private_google_access", True),
        "allow_ssh":              config.get("allow_ssh", False),
        "allow_http":             config.get("allow_http", False),
        "allow_https":            config.get("allow_https", False),
        "allow_internal":         config.get("allow_internal", True),
    })
    return str(ws / "main.tf")


def write_gcp_storage_tf(request_id: int, config: dict) -> str:
    """Generate GCP Cloud Storage Bucket Terraform workspace."""
    env        = _get_env(config)
    name       = _gcp_instance_name(config.get("bucket_name", f"bucket-{request_id}"))
    project_id = GCP_PROJECT_ID or config.get("project_id", "")
    if not project_id:
        raise ValueError(
            "GCP Project ID is not configured. "
            "Set GCP_PROJECT_ID in your .env file or provide it in the request."
        )

    ws = get_workspace(request_id, env)
    _copy_template(ws, "gcp_storage")

    creds_file = ws / "credentials.json"
    creds_file.write_text(_gcp_creds_json(), encoding="utf-8")

    labels = config.get("labels", {})
    if isinstance(labels, list):
        labels = {item["key"]: item["value"] for item in labels if item.get("key")}

    _write_tfvars(ws, {
        "credentials_file":          creds_file.as_posix(),
        "project_id":                project_id,
        "bucket_name":               name,
        "region":                    config.get("region", "US"),
        "environment":               env,
        "location_type":             config.get("location_type", "REGION"),
        "storage_class":             config.get("storage_class", "STANDARD"),
        "uniform_bucket_access":     config.get("uniform_bucket_access", True),
        "public_access_prevention":  config.get("public_access_prevention", "enforced"),
        "versioning_enabled":        config.get("versioning_enabled", False),
        "lifecycle_age_days":        config.get("lifecycle_age_days", 0),
        "lifecycle_to_nearline_days": config.get("lifecycle_to_nearline_days", 0),
        "lifecycle_to_coldline_days": config.get("lifecycle_to_coldline_days", 0),
        "enable_cors":               config.get("enable_cors", False),
        "cors_origins":              config.get("cors_origins", ["*"]),
        "labels":                    labels,
        "force_destroy":             config.get("force_destroy", False),
    })
    return str(ws / "main.tf")


def write_gke_tf(request_id: int, config: dict) -> str:
    """Generate GKE cluster Terraform workspace."""
    raw_env    = config.get("environment", config.get("tags", {}).get("environment", "dev")).lower()
    env        = raw_env if raw_env in ("dev", "staging", "prod") else "dev"
    name       = _gcp_instance_name(config.get("resource_name", f"gke-{request_id}"))
    region     = config.get("region", "us-central1")
    project_id = GCP_PROJECT_ID or config.get("project_id", "")
    user       = config.get("username", "aionos")

    if not project_id:
        raise ValueError("GCP Project ID is not configured. Set GCP_PROJECT_ID in your .env file.")

    ws = get_workspace(request_id, env)
    _copy_template(ws, "gke")

    creds_file = ws / "credentials.json"
    creds_file.write_text(_gcp_creds_json(), encoding="utf-8")

    labels = {
        "project":    _gcp_label_value(config.get("tags", {}).get("project", "aionos-platform")),
        "owner":      _gcp_label_value(user),
        "request-id": str(request_id),
        "created-by": "aionos-platform",
        "team":       _gcp_label_value(config.get("tags", {}).get("team", "")),
    }
    # Remove empty label values
    labels = {k: v for k, v in labels.items() if v}

    _write_tfvars(ws, {
        "credentials_file":                creds_file.as_posix(),
        "project_id":                      project_id,
        "cluster_name":                    name,
        "region":                          region,
        "environment":                     env,
        "release_channel":                 config.get("release_channel", "REGULAR"),
        "regional_cluster":                config.get("regional_cluster", True),
        "network":                         config.get("network", "default"),
        "subnetwork":                      config.get("subnetwork", "default"),
        "private_cluster":                 config.get("private_cluster", False),
        "enable_private_endpoint":         config.get("enable_private_endpoint", False),
        "master_ipv4_cidr_block":          config.get("master_ipv4_cidr_block", "172.16.0.32/28"),
        "node_pool_name":                  _gcp_instance_name(config.get("node_pool_name", "default")),
        "machine_type":                    config.get("machine_type", "e2-standard-2"),
        "disk_size_gb":                    config.get("disk_size_gb", 100),
        "disk_type":                       config.get("disk_type", "pd-ssd"),
        "image_type":                      config.get("image_type", "COS_CONTAINERD"),
        "initial_node_count":              config.get("initial_node_count", 3),
        "min_node_count":                  config.get("min_node_count", 1),
        "max_node_count":                  config.get("max_node_count", 5),
        "spot":                            config.get("spot", False),
        "enable_http_load_balancing":      config.get("enable_http_load_balancing", True),
        "enable_horizontal_pod_autoscaling": config.get("enable_horizontal_pod_autoscaling", True),
        "enable_network_policy":           config.get("enable_network_policy", True),
        "enable_workload_identity":        config.get("enable_workload_identity", True),
        "enable_logging":                  config.get("enable_logging", True),
        "enable_monitoring":               config.get("enable_monitoring", True),
        "labels":                          labels,
    })
    return str(ws / "main.tf")


WRITERS = {
    "ec2":          write_ec2_tf,
    "vm":           write_ec2_tf,
    "s3":           write_s3_tf,
    "vpc":          write_vpc_tf,
    "keypair":      write_keypair_tf,
    "eks":          write_eks_tf,
    "azure_vm":     write_azure_vm_tf,
    "gcp_instance": write_gcp_instance_tf,
    "gcp_network":  write_gcp_network_tf,
    "gcp_storage":  write_gcp_storage_tf,
    "gke_cluster":  write_gke_tf,
}


def write_resource(request_id: int, resource_type: str, config: dict) -> str:
    writer = WRITERS.get(resource_type.lower())
    if not writer:
        raise ValueError(f"No writer for resource type: {resource_type}")
    return writer(request_id, config)


def remove_resource(request_id: int, environment: str = "dev") -> bool:
    return cleanup_workspace(request_id, environment)