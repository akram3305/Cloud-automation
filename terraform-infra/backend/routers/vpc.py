# -*- coding: utf-8 -*-
"""
VPC Router
- List/Read  → boto3 (fast, read-only)
- Create VPC → Terraform pipeline (approval workflow)
- Create SG  → boto3 direct (lightweight, no approval needed)
- Create Subnet → boto3 direct (lightweight, no approval needed)
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

router = APIRouter(prefix="/vpc", tags=["vpc"])


# ── Schemas ───────────────────────────────────────────────────────────────

class SubnetConfig(BaseModel):
    name:   str
    cidr:   str
    az:     str
    public: bool = True


class CreateVPCRequest(BaseModel):
    name:       str
    region:     str  = "ap-south-1"
    cidr:       str  = "10.0.0.0/16"
    subnets:    List[SubnetConfig] = []
    create_igw: bool = True
    create_nat: bool = False
    tags:       Optional[dict] = {}


class CreateSubnetRequest(BaseModel):
    name:   str
    cidr:   str
    az:     str
    public: bool  = False
    vpc_id: str
    region: str   = "ap-south-1"


class CreateSGRequest(BaseModel):
    name:        str
    description: str  = "Managed by AIonOS"
    vpc_id:      str
    region:      str  = "ap-south-1"
    rules_in:    Optional[List[dict]] = []


class UpdateSGRulesRequest(BaseModel):
    region:   str        = "ap-south-1"
    rules_in: List[dict] = []


# ── LIST VPCs ─────────────────────────────────────────────────────────────

@router.get("/list")
def list_vpcs(region: str = "ap-south-1", user: User = Depends(get_current_user)):
    try:
        ec2   = boto3.client("ec2", region_name=region)
        vpcs  = ec2.describe_vpcs()["Vpcs"]
        subs  = ec2.describe_subnets()["Subnets"]
        sgs   = ec2.describe_security_groups()["SecurityGroups"]
        result = []
        for v in vpcs:
            name     = next((t["Value"] for t in v.get("Tags", []) if t["Key"] == "Name"), v["VpcId"])
            vpc_subs = [s for s in subs if s["VpcId"] == v["VpcId"]]
            vpc_sgs  = [g for g in sgs  if g["VpcId"] == v["VpcId"]]
            result.append({
                "id":           v["VpcId"],
                "name":         name,
                "cidr":         v["CidrBlock"],
                "default":      v.get("IsDefault", False),
                "state":        v["State"],
                "region":       region,
                "subnet_count": len(vpc_subs),
                "sg_count":     len(vpc_sgs),
                "subnets": [{
                    "id":            s["SubnetId"],
                    "name":          next((t["Value"] for t in s.get("Tags", []) if t["Key"] == "Name"), s["SubnetId"]),
                    "cidr":          s["CidrBlock"],
                    "az":            s["AvailabilityZone"],
                    "public":        s.get("MapPublicIpOnLaunch", False),
                    "available_ips": s["AvailableIpAddressCount"],
                } for s in vpc_subs],
                "security_groups": [{
                    "id":    g["GroupId"],
                    "name":  g["GroupName"],
                    "desc":  g["Description"],
                    "rules_in": [
                        {
                            "protocol":  p.get("IpProtocol", "tcp"),
                            "from_port": p.get("FromPort", 0),
                            "to_port":   p.get("ToPort",   0),
                            "cidr":      (p.get("IpRanges") or [{}])[0].get("CidrIp", "0.0.0.0/0"),
                            "desc":      (p.get("IpRanges") or [{}])[0].get("Description", ""),
                        }
                        for p in g.get("IpPermissions", [])
                        if (p.get("IpRanges") or [{"CidrIp": ""}])
                    ],
                    "rules_out": [
                        {
                            "protocol":  p.get("IpProtocol", "-1"),
                            "from_port": p.get("FromPort", 0),
                            "to_port":   p.get("ToPort",   0),
                            "cidr":      (p.get("IpRanges") or [{}])[0].get("CidrIp", "0.0.0.0/0"),
                        }
                        for p in g.get("IpPermissionsEgress", [])
                    ],
                } for g in vpc_sgs],
            })
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


# ── CREATE VPC — via Terraform pipeline ───────────────────────────────────

@router.post("/create")
def create_vpc(
    body: CreateVPCRequest,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_operator)
):
    """Submit VPC creation request — goes through approval workflow."""
    tags = body.tags or {}
    tags.setdefault("project",     "AIonOS-Platform")
    tags.setdefault("owner",       user.username)
    tags.setdefault("environment", "dev")
    tags.setdefault("CreatedBy",   "AIonOS-Platform")

    payload = json.dumps({
        "name":       body.name,
        "region":     body.region,
        "cidr":       body.cidr,
        "subnets":    [s.dict() for s in body.subnets],
        "create_igw": body.create_igw,
        "create_nat": body.create_nat,
        "tags":       tags,
    })

    req = Request(
        username      = user.username,
        resource_name = body.name,
        resource_type = "vpc",
        status        = "pending",
        payload       = payload,
        region        = body.region,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return {
        "message":    "VPC request submitted — pending admin approval",
        "request_id": req.id,
        "status":     "pending",
    }


# ── CREATE SUBNET — boto3 direct (no approval needed) ────────────────────

@router.post("/subnet/create")
def create_subnet(
    body: CreateSubnetRequest,
    user: User = Depends(require_operator)
):
    """Create a subnet directly via boto3."""
    try:
        ec2 = boto3.client("ec2", region_name=body.region)

        resp = ec2.create_subnet(
            VpcId            = body.vpc_id,
            CidrBlock        = body.cidr,
            AvailabilityZone = body.az,
        )
        subnet = resp["Subnet"]
        subnet_id = subnet["SubnetId"]

        # Tag it
        ec2.create_tags(
            Resources=[subnet_id],
            Tags=[
                {"Key": "Name",      "Value": body.name},
                {"Key": "ManagedBy", "Value": "AIonOS-Platform"},
            ]
        )

        # Enable public IP if public subnet
        if body.public:
            ec2.modify_subnet_attribute(
                SubnetId            = subnet_id,
                MapPublicIpOnLaunch = {"Value": True}
            )

        return {
            "message":   f"Subnet {body.name} created successfully",
            "subnet_id": subnet_id,
            "cidr":      body.cidr,
            "az":        body.az,
            "public":    body.public,
        }

    except Exception as e:
        raise HTTPException(500, str(e))


# ── CREATE SECURITY GROUP — boto3 direct ──────────────────────────────────

@router.post("/security-groups/create")
def create_sg(
    body: CreateSGRequest,
    user: User = Depends(require_operator)
):
    """Create a security group directly via boto3."""
    try:
        ec2 = boto3.client("ec2", region_name=body.region)

        resp = ec2.create_security_group(
            GroupName   = body.name,
            Description = body.description,
            VpcId       = body.vpc_id,
        )
        sg_id = resp["GroupId"]

        # Tag it
        ec2.create_tags(
            Resources=[sg_id],
            Tags=[
                {"Key": "Name",      "Value": body.name},
                {"Key": "ManagedBy", "Value": "AIonOS-Platform"},
            ]
        )

        # Add inbound rules
        if body.rules_in:
            ip_permissions = []
            for rule in body.rules_in:
                perm = {
                    "IpProtocol": rule.get("protocol", "tcp"),
                    "FromPort":   int(rule.get("from_port", 80)),
                    "ToPort":     int(rule.get("to_port", rule.get("from_port", 80))),
                    "IpRanges":   [{"CidrIp": rule.get("cidr", "0.0.0.0/0"),
                                    "Description": rule.get("desc", "")}],
                }
                ip_permissions.append(perm)

            if ip_permissions:
                ec2.authorize_security_group_ingress(
                    GroupId        = sg_id,
                    IpPermissions  = ip_permissions,
                )

        return {
            "message": f"Security group {body.name} created successfully",
            "sg_id":   sg_id,
        }

    except Exception as e:
        raise HTTPException(500, str(e))


# ── LIST SUBNETS ──────────────────────────────────────────────────────────

@router.get("/subnets")
def list_subnets(vpc_id: str, region: str = "ap-south-1", user: User = Depends(get_current_user)):
    try:
        ec2  = boto3.client("ec2", region_name=region)
        subs = ec2.describe_subnets(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])["Subnets"]
        return [{
            "id":            s["SubnetId"],
            "name":          next((t["Value"] for t in s.get("Tags", []) if t["Key"] == "Name"), s["SubnetId"]),
            "cidr":          s["CidrBlock"],
            "az":            s["AvailabilityZone"],
            "public":        s.get("MapPublicIpOnLaunch", False),
            "available_ips": s["AvailableIpAddressCount"],
        } for s in subs]
    except Exception as e:
        raise HTTPException(500, str(e))


# ── LIST SECURITY GROUPS ──────────────────────────────────────────────────

@router.get("/security-groups")
def list_sgs(vpc_id: str = None, region: str = "ap-south-1", user: User = Depends(get_current_user)):
    try:
        ec2    = boto3.client("ec2", region_name=region)
        kwargs = {}
        if vpc_id:
            kwargs["Filters"] = [{"Name": "vpc-id", "Values": [vpc_id]}]
        sgs = ec2.describe_security_groups(**kwargs)["SecurityGroups"]
        return [{
            "id":   g["GroupId"],
            "name": g["GroupName"],
            "desc": g["Description"],
            "vpc":  g["VpcId"],
        } for g in sgs]
    except Exception as e:
        raise HTTPException(500, str(e))


# ── DELETE VPC ────────────────────────────────────────────────────────────

@router.delete("/{vpc_id}")
def delete_vpc(vpc_id: str, region: str = "ap-south-1", user: User = Depends(require_admin)):
    try:
        boto3.client("ec2", region_name=region).delete_vpc(VpcId=vpc_id)
        return {"message": f"VPC {vpc_id} deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── DELETE SECURITY GROUP ─────────────────────────────────────────────────

@router.delete("/security-groups/{sg_id}")
def delete_sg(sg_id: str, region: str = "ap-south-1", user: User = Depends(require_operator)):
    try:
        boto3.client("ec2", region_name=region).delete_security_group(GroupId=sg_id)
        return {"message": f"Security group {sg_id} deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── UPDATE SG INBOUND RULES ───────────────────────────────────────────────

@router.patch("/security-groups/{sg_id}/rules")
def update_sg_rules(sg_id: str, body: UpdateSGRulesRequest, user: User = Depends(require_operator)):
    """
    Replace all inbound rules for a security group.
    1. Revoke all existing inbound rules
    2. Authorize the new rules supplied in body.rules_in
    """
    try:
        ec2 = boto3.client("ec2", region_name=body.region)

        # Fetch current rules to revoke them
        sgs = ec2.describe_security_groups(GroupIds=[sg_id])["SecurityGroups"]
        if not sgs:
            raise HTTPException(404, f"Security group {sg_id} not found")
        existing = sgs[0].get("IpPermissions", [])

        # Revoke existing inbound rules (ignore errors if already gone)
        if existing:
            try:
                ec2.revoke_security_group_ingress(GroupId=sg_id, IpPermissions=existing)
            except Exception:
                pass

        # Build new permissions
        new_perms = []
        for r in body.rules_in:
            protocol = r.get("protocol", "tcp")
            perm: dict = {"IpProtocol": protocol}
            if protocol != "-1":
                perm["FromPort"] = int(r.get("from_port", 0))
                perm["ToPort"]   = int(r.get("to_port",   r.get("from_port", 0)))
            perm["IpRanges"] = [{
                "CidrIp":      r.get("cidr", "0.0.0.0/0"),
                "Description": r.get("desc", ""),
            }]
            new_perms.append(perm)

        if new_perms:
            ec2.authorize_security_group_ingress(GroupId=sg_id, IpPermissions=new_perms)

        return {"message": f"Security group {sg_id} rules updated", "rules_count": len(new_perms)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))