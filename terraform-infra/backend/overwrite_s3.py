content = """from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import boto3
from botocore.exceptions import ClientError
from models import User
from routers.auth import get_current_user, require_operator

router = APIRouter(prefix="/s3", tags=["s3"])

class CreateBucketPayload(BaseModel):
    name: str
    region: str = "ap-south-1"
    versioning: bool = False
    public: bool = False
    encryption: str = "AES256"

@router.get("/buckets")
def list_buckets(user: User = Depends(get_current_user)):
    try:
        s3 = boto3.client("s3")
        res = s3.list_buckets()
        return [
            {
                "name": b["Name"],
                "region": "ap-south-1",
                "created": b["CreationDate"].isoformat(),
                "size_mb": 0,
                "objects": 0,
                "versioning": False,
                "encryption": "unknown",
            }
            for b in res.get("Buckets", [])
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
def get_s3_stats(user: User = Depends(get_current_user)):
    try:
        s3 = boto3.client("s3")
        res = s3.list_buckets()
        return {"total_buckets": len(res.get("Buckets", [])), "total_objects": 0, "total_size_mb": 0, "total_size_gb": 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/buckets")
def create_bucket(body: CreateBucketPayload, user: User = Depends(require_operator)):
    try:
        s3 = boto3.client("s3", region_name=body.region)
        if body.region == "us-east-1":
            s3.create_bucket(Bucket=body.name)
        else:
            s3.create_bucket(Bucket=body.name, CreateBucketConfiguration={"LocationConstraint": body.region})
        if body.versioning:
            s3.put_bucket_versioning(Bucket=body.name, VersioningConfiguration={"Status": "Enabled"})
        if body.encryption and body.encryption != "none":
            s3.put_bucket_encryption(Bucket=body.name, ServerSideEncryptionConfiguration={"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": body.encryption}}]})
        return {"message": f"Bucket {body.name} created", "name": body.name, "region": body.region}
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/buckets/{bucket_name}")
def delete_bucket(bucket_name: str, force: bool = False, user: User = Depends(require_operator)):
    try:
        s3 = boto3.client("s3")
        if force:
            try:
                loc = s3.get_bucket_location(Bucket=bucket_name)
                region = loc.get("LocationConstraint") or "us-east-1"
                boto3.resource("s3", region_name=region).Bucket(bucket_name).objects.all().delete()
            except Exception:
                pass
        s3.delete_bucket(Bucket=bucket_name)
        return {"message": f"Bucket {bucket_name} deleted"}
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/buckets/{bucket_name}/objects")
def list_objects(bucket_name: str, prefix: str = "", user: User = Depends(get_current_user)):
    try:
        s3 = boto3.client("s3")
        kwargs = {"Bucket": bucket_name, "Delimiter": "/"}
        if prefix:
            kwargs["Prefix"] = prefix
        res = s3.list_objects_v2(**kwargs)
        folders = [{"key": p["Prefix"], "type": "folder"} for p in res.get("CommonPrefixes", [])]
        files = [{"key": o["Key"], "size": o["Size"], "size_kb": round(o["Size"]/1024, 2), "modified": o["LastModified"].isoformat(), "type": "file", "ext": o["Key"].split(".")[-1].lower() if "." in o["Key"] else ""} for o in res.get("Contents", []) if not o["Key"].endswith("/")]
        return {"bucket": bucket_name, "prefix": prefix, "folders": folders, "files": files}
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/buckets/{bucket_name}/objects")
def delete_object(bucket_name: str, key: str, user: User = Depends(require_operator)):
    try:
        boto3.client("s3").delete_object(Bucket=bucket_name, Key=key)
        return {"message": f"Deleted {key}"}
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])

@router.get("/buckets/{bucket_name}/download")
def get_download_url(bucket_name: str, key: str, user: User = Depends(get_current_user)):
    try:
        url = boto3.client("s3").generate_presigned_url("get_object", Params={"Bucket": bucket_name, "Key": key}, ExpiresIn=3600)
        return {"url": url, "expires_in": 3600}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"""
with open("routers/s3.py", "w", newline="\n", encoding="utf-8") as f:
    f.write(content)
print("Done")
