# -*- coding: utf-8 -*-
"""
routers/eks.py — EKS cluster management
List/Create/Delete clusters and node groups via boto3
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import boto3
import json
from botocore.exceptions import ClientError

from models import User
from routers.auth import get_current_user, require_operator

router = APIRouter(prefix="/eks", tags=["eks"])  # ← was "/terraform", now "/eks"

REGIONS = ["ap-south-1", "us-east-1", "us-east-2", "eu-west-1"]


class CreateClusterPayload(BaseModel):
    name:               str
    region:             str  = "ap-south-1"
    kubernetes_version: str  = "1.32"
    node_instance_type: str  = "t3.medium"
    node_count:         int  = 2
    min_nodes:          int  = 1
    max_nodes:          int  = 5
    role_arn:           str  = ""
    subnet_ids:         list = []
    security_group_ids: list = []


# ─── LIST CLUSTERS ─────────────────────────────────────────────────────────
@router.get("/clusters")
def list_clusters(user: User = Depends(get_current_user)):
    clusters = []
    for region in REGIONS:
        try:
            eks   = boto3.client("eks", region_name=region)
            names = eks.list_clusters().get("clusters", [])
            for name in names:
                try:
                    detail   = eks.describe_cluster(name=name)["cluster"]
                    ng_resp  = eks.list_nodegroups(clusterName=name)
                    node_groups = []
                    for ng_name in ng_resp.get("nodegroups", []):
                        try:
                            ng = eks.describe_nodegroup(
                                clusterName=name, nodegroupName=ng_name
                            )["nodegroup"]
                            node_groups.append({
                                "name":          ng["nodegroupName"],
                                "status":        ng["status"],
                                "instance_type": ng.get("instanceTypes", ["unknown"])[0],
                                "desired":       ng.get("scalingConfig", {}).get("desiredSize", 0),
                                "min":           ng.get("scalingConfig", {}).get("minSize", 0),
                                "max":           ng.get("scalingConfig", {}).get("maxSize", 0),
                                "capacity_type": ng.get("capacityType", "ON_DEMAND"),
                            })
                        except Exception:
                            pass
                    clusters.append({
                        "name":        detail["name"],
                        "status":      detail["status"],
                        "version":     detail["version"],
                        "region":      region,
                        "endpoint":    detail.get("endpoint", ""),
                        "created":     detail["createdAt"].isoformat() if detail.get("createdAt") else "",
                        "node_groups": node_groups,
                        "total_nodes": sum(ng["desired"] for ng in node_groups),
                        "role_arn":    detail.get("roleArn", ""),
                        "vpc_config": {
                            "vpc_id":          detail.get("resourcesVpcConfig", {}).get("vpcId", ""),
                            "subnet_ids":      detail.get("resourcesVpcConfig", {}).get("subnetIds", []),
                            "security_groups": detail.get("resourcesVpcConfig", {}).get("securityGroupIds", []),
                            "public_access":   detail.get("resourcesVpcConfig", {}).get("endpointPublicAccess", True),
                        },
                        "tags": detail.get("tags", {}),
                    })
                except Exception as e:
                    print(f"EKS detail error {name}: {e}")
        except Exception as e:
            print(f"EKS list error {region}: {e}")
    return clusters


# ─── GET SINGLE CLUSTER ────────────────────────────────────────────────────
@router.get("/clusters/{cluster_name}")
def get_cluster(
    cluster_name: str,
    region: str = "ap-south-1",
    user: User = Depends(get_current_user)
):
    try:
        eks     = boto3.client("eks", region_name=region)
        detail  = eks.describe_cluster(name=cluster_name)["cluster"]
        ng_resp = eks.list_nodegroups(clusterName=cluster_name)
        node_groups = []
        for ng_name in ng_resp.get("nodegroups", []):
            ng = eks.describe_nodegroup(
                clusterName=cluster_name, nodegroupName=ng_name
            )["nodegroup"]
            node_groups.append({
                "name":          ng["nodegroupName"],
                "status":        ng["status"],
                "instance_type": ng.get("instanceTypes", ["unknown"])[0],
                "desired":       ng.get("scalingConfig", {}).get("desiredSize", 0),
                "min":           ng.get("scalingConfig", {}).get("minSize", 0),
                "max":           ng.get("scalingConfig", {}).get("maxSize", 0),
            })
        return {
            "name":        detail["name"],
            "status":      detail["status"],
            "version":     detail["version"],
            "region":      region,
            "endpoint":    detail.get("endpoint", ""),
            "node_groups": node_groups,
        }
    except ClientError as e:
        raise HTTPException(400, e.response["Error"]["Message"])
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── SUPPORTED VERSIONS ────────────────────────────────────────────────────
@router.get("/versions")
def get_supported_versions(user: User = Depends(get_current_user)):
    return {
        "versions": [
            {"version": "1.35", "label": "1.35 (latest)", "support": "standard"},
            {"version": "1.34", "label": "1.34",          "support": "standard"},
            {"version": "1.33", "label": "1.33",          "support": "standard"},
            {"version": "1.32", "label": "1.32",          "support": "standard"},
        ],
        "default": "1.32",
    }


# ─── NODE INSTANCE TYPES ───────────────────────────────────────────────────
@router.get("/instance-types")
def get_node_instance_types(user: User = Depends(get_current_user)):
    return {
        "types": [
            {"type": "t3.medium",  "vcpu": 2, "ram": "4 GiB",  "desc": "Dev/test clusters"},
            {"type": "t3.large",   "vcpu": 2, "ram": "8 GiB",  "desc": "Small workloads"},
            {"type": "t3.xlarge",  "vcpu": 4, "ram": "16 GiB", "desc": "Medium workloads"},
            {"type": "t3.2xlarge", "vcpu": 8, "ram": "32 GiB", "desc": "Large workloads"},
            {"type": "m5.large",   "vcpu": 2, "ram": "8 GiB",  "desc": "General purpose"},
            {"type": "m5.xlarge",  "vcpu": 4, "ram": "16 GiB", "desc": "General purpose"},
            {"type": "m5.2xlarge", "vcpu": 8, "ram": "32 GiB", "desc": "General purpose"},
            {"type": "c5.large",   "vcpu": 2, "ram": "4 GiB",  "desc": "Compute optimized"},
            {"type": "c5.xlarge",  "vcpu": 4, "ram": "8 GiB",  "desc": "Compute optimized"},
            {"type": "r5.large",   "vcpu": 2, "ram": "16 GiB", "desc": "Memory optimized"},
            {"type": "g4dn.xlarge","vcpu": 4, "ram": "16 GiB", "desc": "GPU workloads"},
        ]
    }


# ─── PREREQUISITES CHECK ───────────────────────────────────────────────────
@router.get("/prerequisites")
def check_prerequisites(
    region: str = "ap-south-1",
    user: User = Depends(get_current_user)
):
    result = {"cluster_roles": [], "node_roles": [], "vpcs": [], "subnets": [], "ready": False}
    try:
        iam = boto3.client("iam")
        paginator = iam.get_paginator("list_roles")
        for page in paginator.paginate():
            for role in page["Roles"]:
                # Service-linked roles (path /aws-service-role/) cannot be passed as roleArn
                if role["Path"].startswith("/aws-service-role/"):
                    continue
                try:
                    policies = {
                        p["PolicyName"]
                        for p in iam.list_attached_role_policies(RoleName=role["RoleName"])
                                      .get("AttachedPolicies", [])
                    }
                    entry = {"name": role["RoleName"], "arn": role["Arn"]}
                    if "AmazonEKSClusterPolicy" in policies:
                        result["cluster_roles"].append(entry)
                    if "AmazonEKSWorkerNodePolicy" in policies:
                        result["node_roles"].append(entry)
                except Exception:
                    pass
    except Exception as e:
        print(f"IAM check error: {e}")

    try:
        ec2     = boto3.client("ec2", region_name=region)
        vpcs    = ec2.describe_vpcs()["Vpcs"]
        subnets = ec2.describe_subnets()["Subnets"]
        for vpc in vpcs:
            name = next(
                (t["Value"] for t in vpc.get("Tags", []) if t["Key"] == "Name"),
                vpc["VpcId"]
            )
            result["vpcs"].append({
                "id": vpc["VpcId"], "name": name, "cidr": vpc["CidrBlock"]
            })
        for s in subnets:
            sname = next(
                (t["Value"] for t in s.get("Tags", []) if t["Key"] == "Name"),
                s["SubnetId"]
            )
            result["subnets"].append({
                "id":     s["SubnetId"],
                "name":   sname,
                "vpc_id": s["VpcId"],
                "az":     s["AvailabilityZone"],
                "cidr":   s["CidrBlock"],
            })
    except Exception as e:
        print(f"VPC check error: {e}")

    result["ready"] = (
        len(result["cluster_roles"]) > 0
        and len(result["node_roles"]) > 0
        and len(result["subnets"]) >= 2
    )
    return result


# ─── SETUP EKS IAM ROLES ───────────────────────────────────────────────────
@router.post("/setup-roles")
def setup_eks_roles(user: User = Depends(require_operator)):
    """
    Create standard EKS cluster + node IAM roles if they don't already exist.
    Safe to call multiple times — skips roles that already exist.
    """
    ROLES = [
        {
            "name":        "aionos-eks-cluster-role",
            "description": "EKS cluster control-plane role — AIonOS Platform",
            "trust":       "eks.amazonaws.com",
            "policies": [
                "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
                "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController",
            ],
        },
        {
            "name":        "aionos-eks-node-role",
            "description": "EKS node group role — AIonOS Platform",
            "trust":       "ec2.amazonaws.com",
            "policies": [
                "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
                "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
                "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
            ],
        },
    ]

    iam     = boto3.client("iam")
    results = []

    for rc in ROLES:
        try:
            existing = iam.get_role(RoleName=rc["name"])
            results.append({
                "name":   rc["name"],
                "arn":    existing["Role"]["Arn"],
                "status": "already_exists",
            })
            continue
        except iam.exceptions.NoSuchEntityException:
            pass
        except ClientError as e:
            results.append({"name": rc["name"], "arn": "", "status": f"error: {e}"})
            continue

        try:
            trust = {
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect":    "Allow",
                    "Principal": {"Service": rc["trust"]},
                    "Action":    "sts:AssumeRole",
                }],
            }
            role = iam.create_role(
                RoleName=rc["name"],
                AssumeRolePolicyDocument=json.dumps(trust),
                Description=rc["description"],
                Tags=[{"Key": "ManagedBy", "Value": "AIonOS-Platform"}],
            )
            for policy_arn in rc["policies"]:
                iam.attach_role_policy(RoleName=rc["name"], PolicyArn=policy_arn)
            results.append({
                "name":   rc["name"],
                "arn":    role["Role"]["Arn"],
                "status": "created",
            })
        except ClientError as e:
            results.append({"name": rc["name"], "arn": "", "status": f"error: {e}"})

    return {"roles": results}


# ─── CREATE CLUSTER ────────────────────────────────────────────────────────
@router.post("/clusters")
def create_cluster(
    body: CreateClusterPayload,
    user: User = Depends(require_operator)
):
    if not body.role_arn:
        raise HTTPException(400, "IAM role ARN is required.")
    if len(body.subnet_ids) < 2:
        raise HTTPException(400, "At least 2 subnets required in different AZs.")
    try:
        eks     = boto3.client("eks", region_name=body.region)
        cluster = eks.create_cluster(
            name    = body.name,
            version = body.kubernetes_version,
            roleArn = body.role_arn,
            resourcesVpcConfig = {
                "subnetIds":             body.subnet_ids,
                "securityGroupIds":      body.security_group_ids,
                "endpointPublicAccess":  True,
                "endpointPrivateAccess": False,
            },
            tags = {"CreatedBy": "AIonOS-Platform", "Owner": user.username}
        )
        return {
            "message": f"Cluster {body.name} creation started",
            "name":    cluster["cluster"]["name"],
            "status":  cluster["cluster"]["status"],
            "region":  body.region,
            "note":    "Cluster creation takes 10-15 minutes.",
        }
    except ClientError as e:
        raise HTTPException(400, e.response["Error"]["Message"])
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── DELETE CLUSTER ────────────────────────────────────────────────────────
@router.delete("/clusters/{cluster_name}")
def delete_cluster(
    cluster_name: str,
    region: str = "ap-south-1",
    user: User = Depends(require_operator)
):
    try:
        boto3.client("eks", region_name=region).delete_cluster(name=cluster_name)
        return {"message": f"Cluster {cluster_name} deletion started"}
    except ClientError as e:
        raise HTTPException(400, e.response["Error"]["Message"])
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── ADD NODE GROUP ────────────────────────────────────────────────────────
@router.post("/clusters/{cluster_name}/nodegroups")
def add_nodegroup(
    cluster_name: str,
    body: CreateClusterPayload,
    region: str = "ap-south-1",
    user: User = Depends(require_operator)
):
    try:
        eks = boto3.client("eks", region_name=region)
        ng  = eks.create_nodegroup(
            clusterName   = cluster_name,
            nodegroupName = f"{cluster_name}-ng-{body.node_instance_type.replace('.', '-')}",
            scalingConfig = {
                "minSize":     body.min_nodes,
                "maxSize":     body.max_nodes,
                "desiredSize": body.node_count,
            },
            instanceTypes = [body.node_instance_type],
            subnets       = body.subnet_ids,
            nodeRole      = body.role_arn,
            capacityType  = "ON_DEMAND",
            tags          = {"CreatedBy": "AIonOS-Platform"},
        )
        return {
            "message": "Node group creation started",
            "name":    ng["nodegroup"]["nodegroupName"],
        }
    except ClientError as e:
        raise HTTPException(400, e.response["Error"]["Message"])
    except Exception as e:
        raise HTTPException(500, str(e))