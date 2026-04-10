# -*- coding: utf-8 -*-
"""
IAM Router - List uses boto3, Create uses Terraform
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import boto3
import json

from database import get_db
from models import User, Request
from routers.auth import get_current_user, require_operator, require_admin

router = APIRouter(prefix="/iam", tags=["iam"])

AWS_MANAGED_POLICIES = [
    {"arn":"arn:aws:iam::aws:policy/AmazonEKSClusterPolicy","name":"AmazonEKSClusterPolicy","cat":"EKS"},
    {"arn":"arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy","name":"AmazonEKSWorkerNodePolicy","cat":"EKS"},
    {"arn":"arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy","name":"AmazonEKS_CNI_Policy","cat":"EKS"},
    {"arn":"arn:aws:iam::aws:policy/AmazonEKSVPCResourceController","name":"AmazonEKSVPCResourceController","cat":"EKS"},
    {"arn":"arn:aws:iam::aws:policy/AmazonEC2FullAccess","name":"AmazonEC2FullAccess","cat":"EC2"},
    {"arn":"arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess","name":"AmazonEC2ReadOnlyAccess","cat":"EC2"},
    {"arn":"arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly","name":"AmazonEC2ContainerRegistryReadOnly","cat":"ECR"},
    {"arn":"arn:aws:iam::aws:policy/AmazonS3FullAccess","name":"AmazonS3FullAccess","cat":"S3"},
    {"arn":"arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess","name":"AmazonS3ReadOnlyAccess","cat":"S3"},
    {"arn":"arn:aws:iam::aws:policy/AmazonRDSFullAccess","name":"AmazonRDSFullAccess","cat":"RDS"},
    {"arn":"arn:aws:iam::aws:policy/AWSLambdaFullAccess","name":"AWSLambdaFullAccess","cat":"Lambda"},
    {"arn":"arn:aws:iam::aws:policy/AWSLambdaBasicExecutionRole","name":"AWSLambdaBasicExecutionRole","cat":"Lambda"},
    {"arn":"arn:aws:iam::aws:policy/CloudWatchFullAccess","name":"CloudWatchFullAccess","cat":"CloudWatch"},
    {"arn":"arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore","name":"AmazonSSMManagedInstanceCore","cat":"SSM"},
    {"arn":"arn:aws:iam::aws:policy/SecretsManagerReadWrite","name":"SecretsManagerReadWrite","cat":"Secrets"},
    {"arn":"arn:aws:iam::aws:policy/IAMFullAccess","name":"IAMFullAccess","cat":"IAM"},
    {"arn":"arn:aws:iam::aws:policy/IAMReadOnlyAccess","name":"IAMReadOnlyAccess","cat":"IAM"},
    {"arn":"arn:aws:iam::aws:policy/AmazonVPCFullAccess","name":"AmazonVPCFullAccess","cat":"VPC"},
]

ROLE_PRESETS = {
    "ec2":      {"type":"ec2",     "label":"EC2 Instance Role"},
    "eks":      {"type":"eks",     "label":"EKS Cluster Role"},
    "eks_node": {"type":"eks_node","label":"EKS Node Group Role"},
    "lambda":   {"type":"lambda",  "label":"Lambda Execution Role"},
    "ecs":      {"type":"ecs",     "label":"ECS Task Execution Role"},
}


class CreateRoleRequest(BaseModel):
    name:            str
    role_type:       str = "ec2"
    description:     str = "Created by AIonOS Platform"
    extra_policies:  Optional[List[str]] = []
    tags:            Optional[dict] = {}


class CreateKeypairRequest(BaseModel):
    name:   str
    region: str = "ap-south-1"
    tags:   Optional[dict] = {}


# ─── LIST ROLES (boto3 — read only) ───────────────────────────
@router.get("/roles")
def list_roles(user: User = Depends(get_current_user)):
    try:
        iam   = boto3.client("iam")
        roles = iam.list_roles(MaxItems=100)["Roles"]
        return [{
            "name":        r["RoleName"],
            "arn":         r["Arn"],
            "description": r.get("Description", ""),
            "created":     str(r.get("CreateDate", "")),
        } for r in roles]
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── LIST KEYPAIRS (boto3 — read only) ────────────────────────
@router.get("/keypairs")
def list_keypairs(region: str = "ap-south-1", user: User = Depends(get_current_user)):
    try:
        # Handle "all" region - default to ap-south-1
        actual_region = "ap-south-1" if region == "all" else region
        ec2  = boto3.client("ec2", region_name=actual_region)
        keys = ec2.describe_key_pairs()["KeyPairs"]
        return [{
            "name":        k["KeyName"],
            "fingerprint": k.get("KeyFingerprint", ""),
            "region":      actual_region,
            "id":          k.get("KeyPairId", ""),
        } for k in keys]
    except Exception as e:
        print(f"Keypairs error (region={region}): {e}")
        return []


# ─── LIST POLICIES (static list) ──────────────────────────────
@router.get("/policies")
def list_policies(user: User = Depends(get_current_user)):
    return AWS_MANAGED_POLICIES


# ─── LIST ROLE PRESETS ────────────────────────────────────────
@router.get("/role-presets")
def list_presets(user: User = Depends(get_current_user)):
    return ROLE_PRESETS


# ─── CREATE IAM ROLE via Terraform ────────────────────────────
@router.post("/roles/create")
def create_role(
    body:             CreateRoleRequest,
    background_tasks: BackgroundTasks,
    db:               Session = Depends(get_db),
    user:             User    = Depends(require_operator)
):
    """Create IAM role via Terraform — goes through approval workflow"""
    tags = body.tags or {}
    if not tags.get("project") or not tags.get("owner") or not tags.get("environment"):
        raise HTTPException(400, "Tags required: project, owner, environment")

    if body.role_type not in ROLE_PRESETS:
        raise HTTPException(400, f"Invalid role_type. Options: {list(ROLE_PRESETS.keys())}")

    payload = json.dumps({
        "role_name":       body.name,
        "role_type":       body.role_type,
        "description":     body.description,
        "extra_policies":  body.extra_policies or [],
        "tags":            tags,
    })

    req = Request(
        username      = user.username,
        resource_name = name,
        resource_type = "iam_role",
        status        = "pending",
        payload       = payload,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return {
        "message":    "IAM role request submitted — pending admin approval",
        "request_id": req.id,
        "status":     "pending"
    }


# ─── CREATE KEYPAIR via Terraform ─────────────────────────────
@router.post("/keypairs/create")
def create_keypair(
    background_tasks: BackgroundTasks,
    db:               Session = Depends(get_db),
    user:             User    = Depends(require_operator),
    # Accept BOTH query params (frontend) and body
    name:   str = "",
    region: str = "ap-south-1",
    body:   CreateKeypairRequest = None,
):
    # Merge query params and body - query params take priority (frontend sends them)
    if body:
        if not name: name = body.name
        if region == "ap-south-1" and body.region: region = body.region
    if not name:
        from fastapi import HTTPException
        raise HTTPException(400, "name is required")
    """Create key pair via Terraform — auto-downloads .pem file"""
    tags = (body.tags if body else {}) or {}
    tags.setdefault("environment", "dev")
    tags.setdefault("project",     "AIonOS-Platform")
    tags.setdefault("owner",       user.username)

    payload = json.dumps({
        "name":   name,
        "region": region,
        "tags":   tags,
    })

    req = Request(
        username      = user.username,
        resource_name = name,
        resource_type = "keypair",
        status        = "pending",
        payload       = payload,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Auto-generate and apply (keypairs don't need approval)
    def do_keypair():
        from database import SessionLocal
        from services.terraform_service import generate_keypair_tf, run_terraform, get_outputs
        db2  = SessionLocal()
        req2 = db2.query(Request).filter(Request.id == req.id).first()
        try:
            config = json.loads(payload)
            config["resource_name"] = name
            config["username"]      = user.username
            environment = config.get("tags", {}).get("environment", "dev").lower()

            generate_keypair_tf(req.id, config)
            init = run_terraform(req.id, "init", environment)
            if not init["success"]:
                req2.status = "failed"
                db2.commit()
                return

            run_terraform(req.id, "plan", environment)
            apply = run_terraform(req.id, "apply", environment)

            if apply["success"]:
                outputs          = get_outputs(req.id, environment)
                req2.status      = "completed"
                req2.instance_id = outputs.get("key_name", body.name)
                req2.approved_by = "auto"
            else:
                req2.status = "failed"
                req2.reject_reason = apply["error"][:300]

            db2.commit()
        except Exception as e:
            req2.status = "failed"
            db2.commit()
            print(f"Keypair error: {e}")
        finally:
            db2.close()

    background_tasks.add_task(do_keypair)
    return {
        "message":    "Key pair creation started",
        "request_id": req.id,
        "key_name":   name,
        "note":       f"Private key will be saved to Downloads/{body.name}.pem"
    }


# --- DELETE IAM ROLE ---
@router.delete("/roles/{role_name}")
def delete_iam_role(role_name: str, user: User = Depends(require_admin)):
    try:
        iam_client = boto3.client("iam")
        # Detach all managed policies first
        try:
            attached = iam_client.list_attached_role_policies(RoleName=role_name)
            for p in attached.get("AttachedPolicies", []):
                iam_client.detach_role_policy(RoleName=role_name, PolicyArn=p["PolicyArn"])
        except: pass
        iam_client.delete_role(RoleName=role_name)
        return {"message": f"Role {role_name} deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))


# --- DELETE KEYPAIR ---
@router.delete("/keypairs/{key_name}")
def delete_keypair(key_name: str, region: str = "ap-south-1", user: User = Depends(require_operator)):
    try:
        ec2 = boto3.client("ec2", region_name=region)
        ec2.delete_key_pair(KeyName=key_name)
        return {"message": f"Key pair {key_name} deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))


# --- DOWNLOAD KEYPAIR (get private key content) ---
@router.get("/keypairs/{key_name}/download")
def download_keypair(key_name: str, user: User = Depends(get_current_user)):
    """Return private key file content for download"""
    import os
    # Check common save locations
    possible_paths = [
        f"C:/Users/Akram.Khan/Downloads/{key_name}.pem",
        f"D:/AWS_Terraform_automation/terraform-infra/terraform_workspaces/{key_name}.pem",
        f"D:/AWS_Terraform_automation/terraform-infra/keys/{key_name}.pem",
    ]
    
    from database import SessionLocal
    from models.request import Request
    db = SessionLocal()
    req = db.query(Request).filter(
        Request.resource_name == key_name,
        Request.resource_type == "keypair"
    ).order_by(Request.id.desc()).first()
    db.close()
    
    if req and req.status == "completed":
        return {
            "key_name": key_name,
            "status": "completed",
            "message": f"Key saved to Downloads/{key_name}.pem",
            "request_id": req.id
        }
    elif req:
        return {
            "key_name": key_name, 
            "status": req.status,
            "message": "Key pair creation in progress"
        }
    
    return {"key_name": key_name, "status": "not_found"}


# --- KEYPAIR STATUS ---
@router.get("/keypairs/{key_name}/status")  
def keypair_status(key_name: str, user: User = Depends(get_current_user)):
    from database import SessionLocal
    from models.request import Request
    db = SessionLocal()
    req = db.query(Request).filter(
        Request.resource_name == key_name,
        Request.resource_type == "keypair"
    ).order_by(Request.id.desc()).first()
    db.close()
    if not req:
        return {"status": "not_found"}
    return {
        "status": req.status,
        "key_name": key_name,
        "request_id": req.id,
        "reject_reason": req.reject_reason
    }
