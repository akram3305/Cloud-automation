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
import json
import shutil
import subprocess
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# --- Config from .env -------------------------------------------------------
TERRAFORM_BIN  = os.getenv("TERRAFORM_BIN",    "terraform")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
STATE_BUCKET   = os.getenv("TF_STATE_BUCKET",  "aionos-terraform-state-3305")
STATE_REGION   = os.getenv("TF_STATE_REGION",  "ap-south-1")
DYNAMO_TABLE   = os.getenv("TF_DYNAMO_TABLE",  "terraform-lock")
TF_PROJECT     = Path(os.getenv("TF_PROJECT_ROOT", ""))
KEY_SAVE_PATH  = os.getenv("KEY_SAVE_PATH",    "./keys")

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


def cleanup_workspace(request_id: int, environment: str = "dev") -> bool:
    ws = TF_ENVS.get(environment, TF_ENVS["dev"]) / "aionos" / f"req_{request_id}"
    if ws.exists():
        shutil.rmtree(ws)
        print(f"[req_{request_id}] Workspace cleaned up: {ws}")
        return True
    return False


# ----------------------------------------------------------------------------
# S3 ARCHIVING
# ----------------------------------------------------------------------------

def archive_to_s3(request_id: int, environment: str, log_output: str = "") -> bool:
    try:
        import boto3
        s3  = boto3.client("s3",
                           region_name=STATE_REGION,
                           aws_access_key_id=AWS_ACCESS_KEY,
                           aws_secret_access_key=AWS_SECRET_KEY)
        ws  = get_workspace(request_id, environment)
        pfx = f"aionos/logs/{environment}/req_{request_id}"

        main_tf = ws / "main.tf"
        if main_tf.exists():
            s3.put_object(Bucket=STATE_BUCKET, Key=f"{pfx}/main.tf",
                          Body=main_tf.read_bytes(), ContentType="text/plain")

        tfvars = ws / "terraform.tfvars"
        if tfvars.exists():
            s3.put_object(Bucket=STATE_BUCKET, Key=f"{pfx}/terraform.tfvars",
                          Body=tfvars.read_bytes(), ContentType="text/plain")

        if log_output:
            s3.put_object(Bucket=STATE_BUCKET, Key=f"{pfx}/apply.log",
                          Body=log_output.encode("utf-8"), ContentType="text/plain")

        print(f"[req_{request_id}] Archived to s3://{STATE_BUCKET}/{pfx}/")
        return True
    except Exception as e:
        print(f"[req_{request_id}] S3 archive failed: {e}")
        return False


def get_archived_files(request_id: int, environment: str) -> dict:
    try:
        import boto3
        s3  = boto3.client("s3",
                           region_name=STATE_REGION,
                           aws_access_key_id=AWS_ACCESS_KEY,
                           aws_secret_access_key=AWS_SECRET_KEY)
        pfx = f"aionos/logs/{environment}/req_{request_id}"
        result = {}
        for key in ["main.tf", "terraform.tfvars", "apply.log"]:
            try:
                obj = s3.get_object(Bucket=STATE_BUCKET, Key=f"{pfx}/{key}")
                result[key] = obj["Body"].read().decode("utf-8")
            except Exception:
                pass
        return result
    except Exception as e:
        print(f"[req_{request_id}] S3 retrieve failed: {e}")
        return {}


def restore_workspace(request_id: int, environment: str) -> bool:
    try:
        files = get_archived_files(request_id, environment)
        if not files:
            return False
        ws = get_workspace(request_id, environment)
        for filename, content in files.items():
            if filename != "apply.log":
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
                  request_id: int = None, extra_args: list = None) -> dict:
    ws  = get_workspace(request_id, environment) if request_id else TF_ENVS.get(environment, TF_ENVS["dev"])
    env = _tf_env()

    cmd_map = {
        "init":     [TERRAFORM_BIN, "init",    "-no-color", "-input=false",
                     f"-backend-config=key=aionos/state/{environment}/req_{request_id}/terraform.tfstate",
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

    try:
        r = subprocess.run(cmd, cwd=str(ws), env=env,
                           capture_output=True, text=True, timeout=600)
        return {
            "success": r.returncode == 0,
            "output":  r.stdout,
            "error":   r.stderr if r.returncode != 0 else "",
        }
    except FileNotFoundError:
        return {"success": False, "output": "", "error": "Terraform binary not found"}
    except subprocess.TimeoutExpired:
        return {"success": False, "output": "", "error": "Terraform timed out (600s)"}
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
        else:
            lines.append(f'{key} = "{value}"')
    (ws / "terraform.tfvars").write_text("\n".join(lines), encoding="utf-8")
    print(f"Written tfvars: {ws / 'terraform.tfvars'}")


def _copy_template(ws: Path, resource_type: str) -> None:
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
# WRITER REGISTRY
# ----------------------------------------------------------------------------

WRITERS = {
    "ec2":     write_ec2_tf,
    "vm":      write_ec2_tf,
    "s3":      write_s3_tf,
    "vpc":     write_vpc_tf,
    "keypair": write_keypair_tf,
    "eks":     write_eks_tf,
}


def write_resource(request_id: int, resource_type: str, config: dict) -> str:
    writer = WRITERS.get(resource_type.lower())
    if not writer:
        raise ValueError(f"No writer for resource type: {resource_type}")
    return writer(request_id, config)


def remove_resource(request_id: int, environment: str = "dev") -> bool:
    return cleanup_workspace(request_id, environment)