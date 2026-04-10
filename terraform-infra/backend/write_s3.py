content = """from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import boto3
from botocore.exceptions import ClientError
from datetime import datetime

from database import get_db
from models import User
from routers.auth import get_current_user, require_operator
import config

router = APIRouter(prefix="/s3", tags=["s3"])

def get_s3(region=None):
    return boto3.client("s3", region_name=region or config.AWS_REGION)

def get_s3_resource(region=None):
    return boto3.resource("s3", region_name=region or config.AWS_REGION)

class CreateBucketPayload(BaseModel):
    name:       str
    region:     str = "ap-south-1"
    versioning: bool = False
    public:     bool = False

class BucketPolicyPayload(BaseModel):
    versioning: Optional[bool] = None
    public:     Optional[bool] = None

@router.get("/buckets")
def list_buckets(user: User = Depends(get_current_user)):
    try:
        s3  = get_s3()
        res = s3.list_buckets()
        buckets = []
        for b in res.get("Buckets", []):
            name    = b["Name"]
            created = b["CreationDate"].isoformat()
            try:
                loc = s3.get_bucket_location(Bucket=name)
                region = loc.get("LocationConstraint") or "us-east-1"
            except:
                region = "unknown"
            try:
                s3r    = get_s3_resource(region)
                bucket = s3r.Bucket(name)
                size   = 0
                count  = 0
                for obj in bucket.objects.all():
                    size  += obj.size
                    count += 1
                size_mb = round(size / (1024*1024), 2)
            except:
                size_mb = 0
                count   = 0
            try:
                v = s3.get_bucket_versioning(Bucket=name)
                versioning = v.get("Status","") == "Enabled"
            except:
                versioning = False
            buckets.append({
                "name":       name,
                "region":     region,
                "created":    created,
                "size_mb":    size_mb,
                "objects":    count,
                "versioning": versioning,
            })
        return buckets
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/buckets")
def create_bucket(body: CreateBucketPayload, user: User = Depends(require_operator)):
    try:
        s3 = get_s3(body.region)
        if body.region == "us-east-1":
            s3.create_bucket(Bucket=body.name)
        else:
            s3.create_bucket(
                Bucket=body.name,
                CreateBucketConfiguration={"LocationConstraint": body.region}
            )
        if body.versioning:
            s3.put_bucket_versioning(
                Bucket=body.name,
                VersioningConfiguration={"Status":"Enabled"}
            )
        if body.public:
            s3.delete_public_access_block(Bucket=body.name)
        return {"message": f"Bucket {body.name} created", "name": body.name, "region": body.region}
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/buckets/{bucket_name}")
def delete_bucket(bucket_name: str, force: bool = False, user: User = Depends(require_operator)):
    try:
        s3 = get_s3()
        if force:
            s3r = get_s3_resource()
            bucket = s3r.Bucket(bucket_name)
            bucket.objects.all().delete()
            bucket.object_versions.all().delete()
        s3.delete_bucket(Bucket=bucket_name)
        return {"message": f"Bucket {bucket_name} deleted"}
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/buckets/{bucket_name}/objects")
def list_objects(bucket_name: str, prefix: str = "", user: User = Depends(get_current_user)):
    try:
        s3   = get_s3()
        kwargs = {"Bucket": bucket_name, "Delimiter": "/"}
        if prefix:
            kwargs["Prefix"] = prefix
        res = s3.list_objects_v2(**kwargs)
        folders = [{"key": p["Prefix"], "type": "folder"} for p in res.get("CommonPrefixes", [])]
        files   = [
            {
                "key":      o["Key"],
                "size":     o["Size"],
                "size_kb":  round(o["Size"]/1024, 2),
                "modified": o["LastModified"].isoformat(),
                "type":     "file",
                "ext":      o["Key"].split(".")[-1].lower() if "." in o["Key"] else "",
            }
            for o in res.get("Contents", []) if not o["Key"].endswith("/")
        ]
        return {
            "bucket":  bucket_name,
            "prefix":  prefix,
            "folders": folders,
            "files":   files,
            "total":   res.get("KeyCount", 0),
            "truncated": res.get("IsTruncated", False),
        }
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/buckets/{bucket_name}/objects")
def delete_object(bucket_name: str, key: str, user: User = Depends(require_operator)):
    try:
        s3 = get_s3()
        s3.delete_object(Bucket=bucket_name, Key=key)
        return {"message": f"Deleted {key}"}
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])

@router.get("/buckets/{bucket_name}/download")
def get_download_url(bucket_name: str, key: str, user: User = Depends(get_current_user)):
    try:
        s3  = get_s3()
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": key},
            ExpiresIn=3600
        )
        return {"url": url, "expires_in": 3600}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
def get_s3_stats(user: User = Depends(get_current_user)):
    try:
        s3  = get_s3()
        res = s3.list_buckets()
        total_buckets = len(res.get("Buckets", []))
        total_size    = 0
        total_objects = 0
        for b in res.get("Buckets", []):
            try:
                loc    = s3.get_bucket_location(Bucket=b["Name"])
                region = loc.get("LocationConstraint") or "us-east-1"
                s3r    = get_s3_resource(region)
                bucket = s3r.Bucket(b["Name"])
                for obj in bucket.objects.all():
                    total_size    += obj.size
                    total_objects += 1
            except:
                pass
        return {
            "total_buckets": total_buckets,
            "total_objects": total_objects,
            "total_size_mb": round(total_size / (1024*1024), 2),
            "total_size_gb": round(total_size / (1024*1024*1024), 3),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"""
with open("routers/s3.py", "w", newline="\n", encoding="utf-8") as f:
    f.write(content)
print("Done")
