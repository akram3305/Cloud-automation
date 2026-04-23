# -*- coding: utf-8 -*-
"""
IAM Router - List uses boto3, Create uses Terraform
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import boto3
from botocore.exceptions import ClientError
import json

from database import get_db
from models import User, Request
from models.aws_ssh_key import AwsSshKey
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


# ─── CREATE KEYPAIR via boto3 (direct, no approval required) ──
@router.post("/keypairs/create")
def create_keypair(
    user:   User    = Depends(require_operator),
    name:   str     = "",
    region: str     = "ap-south-1",
    body:   CreateKeypairRequest = None,
    db:     Session = Depends(get_db),
):
    """Create key pair directly via boto3 — returns private key for download.
    Stores the private key in DB so users can re-download without regenerating.
    """
    if body:
        if not name:   name   = body.name
        if region == "ap-south-1" and body.region: region = body.region
    if not name:
        raise HTTPException(400, "name is required")

    try:
        ec2    = boto3.client("ec2", region_name=region)
        result = ec2.create_key_pair(KeyName=name, KeyType="rsa", KeyFormat="pem")
        private_key = result["KeyMaterial"]
        filename    = f"{name}.pem"

        # Upsert into DB so key can be re-downloaded later
        row = db.query(AwsSshKey).filter(AwsSshKey.key_name == name).first()
        if row:
            row.private_key = private_key
            row.region      = region
            row.filename    = filename
        else:
            db.add(AwsSshKey(key_name=name, region=region, private_key=private_key, filename=filename))
        db.commit()

        return {
            "key_name":    name,
            "private_key": private_key,
            "key_pair_id": result.get("KeyPairId", ""),
            "region":      region,
            "filename":    filename,
        }
    except ClientError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Failed to create key pair: {e}")


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


# --- DOWNLOAD KEYPAIR (get stored private key content) ---
@router.get("/keypairs/{key_name}/download")
def download_keypair(
    key_name: str,
    user: User    = Depends(get_current_user),
    db:   Session = Depends(get_db),
):
    """Return stored private key for re-download — no new key is generated."""
    row = db.query(AwsSshKey).filter(AwsSshKey.key_name == key_name).first()
    if not row:
        raise HTTPException(404, f"No stored key for '{key_name}'. Re-create the key pair to save it.")
    return {
        "key_name":    row.key_name,
        "private_key": row.private_key,
        "filename":    row.filename,
        "region":      row.region,
    }
