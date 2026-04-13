# -*- coding: utf-8 -*-
"""
S3 Router — List/Delete via boto3, Create via requests pipeline
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import boto3

from database import get_db
from models import User, Request
from routers.auth import get_current_user, require_operator, require_admin

router = APIRouter(prefix="/s3", tags=["s3"])


class CreateBucketRequest(BaseModel):
    name:       str
    region:     str  = "ap-south-1"
    versioning: bool = False
    encryption: str  = "AES256"
    tags:       Optional[dict] = {}


# ── LIST BUCKETS ──────────────────────────────────────────────────────────
@router.get("/buckets")
def list_buckets(user: User = Depends(get_current_user)):
    try:
        s3      = boto3.client("s3")
        buckets = s3.list_buckets().get("Buckets", [])
        result  = []
        for b in buckets:
            name = b["Name"]
            info = {
                "name":       name,
                "created":    str(b.get("CreationDate", "")),
                "region":     "unknown",
                "size_mb":    0,
                "objects":    0,
                "versioning": "Disabled",
                "encryption": "None",
            }
            try:
                loc = s3.get_bucket_location(Bucket=name)
                info["region"] = loc["LocationConstraint"] or "us-east-1"
            except Exception: pass
            try:
                ver = s3.get_bucket_versioning(Bucket=name)
                info["versioning"] = ver.get("Status", "Disabled")
            except Exception: pass
            try:
                enc   = s3.get_bucket_encryption(Bucket=name)
                rules = enc["ServerSideEncryptionConfiguration"]["Rules"]
                info["encryption"] = rules[0]["ApplyServerSideEncryptionByDefault"]["SSEAlgorithm"]
            except Exception: pass
            try:
                tag_resp = s3.get_bucket_tagging(Bucket=name)
                info["tags"] = {t["Key"]: t["Value"] for t in tag_resp.get("TagSet", [])}
            except Exception:
                info["tags"] = {}
            result.append(info)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


# ── CREATE BUCKET — goes through request/approval pipeline ────────────────
@router.post("/create")
def create_bucket(
    body: CreateBucketRequest,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_operator)
):
    """
    Submit S3 bucket creation request.
    Goes through approval workflow → Terraform creates the bucket.
    """
    import json
    tags = body.tags or {}
    tags.setdefault("project",     "AIonOS-Platform")
    tags.setdefault("owner",       user.username)
    tags.setdefault("environment", "dev")
    tags.setdefault("CreatedBy",   "AIonOS-Platform")

    req = Request(
        username      = user.username,
        resource_name = body.name,
        resource_type = "s3",
        status        = "pending",
        payload       = json.dumps({
            "name":       body.name,
            "region":     body.region,
            "versioning": body.versioning,
            "encryption": body.encryption,
            "tags":       tags,
        }),
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return {
        "message":    "S3 bucket request submitted — pending admin approval",
        "request_id": req.id,
        "status":     "pending",
        "bucket":     body.name,
    }


# ── BUCKET DETAILS ────────────────────────────────────────────────────────
@router.get("/buckets/{bucket_name}")
def get_bucket(bucket_name: str, user: User = Depends(get_current_user)):
    try:
        s3   = boto3.client("s3")
        info = {"name": bucket_name}
        try:
            loc = s3.get_bucket_location(Bucket=bucket_name)
            info["region"] = loc["LocationConstraint"] or "us-east-1"
        except Exception: pass
        try:
            ver = s3.get_bucket_versioning(Bucket=bucket_name)
            info["versioning"] = ver.get("Status", "Disabled")
        except Exception: pass
        return info
    except Exception as e:
        raise HTTPException(500, str(e))


# ── DELETE BUCKET ─────────────────────────────────────────────────────────
@router.delete("/buckets/{bucket_name}")
def delete_bucket(
    bucket_name: str,
    force: bool = False,
    user:  User = Depends(require_operator)
):
    try:
        s3 = boto3.client("s3")
        if force:
            paginator = s3.get_paginator("list_object_versions")
            for page in paginator.paginate(Bucket=bucket_name):
                objects = []
                for v in page.get("Versions", []):
                    objects.append({"Key": v["Key"], "VersionId": v["VersionId"]})
                for m in page.get("DeleteMarkers", []):
                    objects.append({"Key": m["Key"], "VersionId": m["VersionId"]})
                if objects:
                    s3.delete_objects(Bucket=bucket_name, Delete={"Objects": objects})
        s3.delete_bucket(Bucket=bucket_name)
        return {"message": f"Bucket {bucket_name} deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── LIST OBJECTS ──────────────────────────────────────────────────────────
@router.get("/buckets/{bucket_name}/objects")
def list_objects(bucket_name: str, prefix: str = "", user: User = Depends(get_current_user)):
    try:
        s3     = boto3.client("s3")
        kwargs = {"Bucket": bucket_name, "Delimiter": "/"}
        if prefix:
            kwargs["Prefix"] = prefix
        res     = s3.list_objects_v2(**kwargs)
        folders = [{"key": p["Prefix"], "type": "folder"} for p in res.get("CommonPrefixes", [])]
        files   = [
            {
                "key":      o["Key"],
                "size":     o["Size"],
                "size_kb":  round(o["Size"] / 1024, 2),
                "modified": o["LastModified"].isoformat(),
                "type":     "file",
                "ext":      o["Key"].split(".")[-1].lower() if "." in o["Key"] else "",
            }
            for o in res.get("Contents", []) if not o["Key"].endswith("/")
        ]
        return {
            "bucket":    bucket_name,
            "prefix":    prefix,
            "folders":   folders,
            "files":     files,
            "total":     res.get("KeyCount", 0),
            "truncated": res.get("IsTruncated", False),
        }
    except Exception as e:
        raise HTTPException(500, str(e))


# ── DOWNLOAD URL ──────────────────────────────────────────────────────────
@router.get("/buckets/{bucket_name}/download")
def get_download_url(bucket_name: str, key: str, user: User = Depends(get_current_user)):
    try:
        url = boto3.client("s3").generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": key},
            ExpiresIn=3600
        )
        return {"url": url, "expires_in": 3600}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── DELETE OBJECT ─────────────────────────────────────────────────────────
@router.delete("/buckets/{bucket_name}/objects")
def delete_object(bucket_name: str, key: str, user: User = Depends(require_operator)):
    try:
        boto3.client("s3").delete_object(Bucket=bucket_name, Key=key)
        return {"message": f"Deleted {key}"}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── STATS ─────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_s3_stats(user: User = Depends(get_current_user)):
    try:
        s3      = boto3.client("s3")
        buckets = s3.list_buckets().get("Buckets", [])
        return {
            "total_buckets": len(buckets),
            "total_objects": 0,
            "total_size_mb": 0,
            "total_size_gb": 0,
        }
    except Exception as e:
        raise HTTPException(500, str(e))