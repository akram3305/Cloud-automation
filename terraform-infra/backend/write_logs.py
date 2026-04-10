content = """from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import boto3

from database import get_db
from models import User, VM, Request
from routers.auth import get_current_user
import config

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("/activity")
def get_activity(limit: int = 50, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = []

    # Platform DB events - VMs
    try:
        vms = db.query(VM).order_by(VM.created_at.desc()).limit(20).all()
        for vm in vms:
            logs.append({
                "id":      f"vm-{vm.id}",
                "time":    vm.created_at.isoformat(),
                "type":    "EC2",
                "action":  "Launched",
                "resource":vm.name,
                "detail":  f"{vm.instance_type} in {vm.region}",
                "status":  vm.state,
                "source":  "platform",
                "color":   "#00d4aa",
            })
    except Exception as e:
        print(f"VM log error: {e}")

    # Platform DB events - Requests
    try:
        reqs = db.query(Request).order_by(Request.created_at.desc()).limit(20).all()
        for r in reqs:
            color = {"pending":"#f59e0b","approved":"#3b82f6","completed":"#00d4aa","failed":"#f43f5e","rejected":"#94a3b8","provisioning":"#a78bfa"}.get(r.status,"#64748b")
            logs.append({
                "id":      f"req-{r.id}",
                "time":    r.created_at.isoformat(),
                "type":    "Request",
                "action":  r.status.capitalize(),
                "resource":r.resource_name,
                "detail":  f"by {r.username} - {r.resource_type}",
                "status":  r.status,
                "source":  "platform",
                "color":   color,
            })
    except Exception as e:
        print(f"Request log error: {e}")

    # AWS CloudTrail recent events
    try:
        ct = boto3.client("cloudtrail", region_name=config.AWS_REGION)
        end   = datetime.utcnow()
        start = end - timedelta(hours=24)
        resp  = ct.lookup_events(
            StartTime=start,
            EndTime=end,
            MaxResults=30,
        )
        ACTION_COLORS = {
            "RunInstances":     "#00d4aa",
            "TerminateInstances":"#f43f5e",
            "StopInstances":    "#f59e0b",
            "StartInstances":   "#3b82f6",
            "CreateBucket":     "#00d4aa",
            "DeleteBucket":     "#f43f5e",
            "PutObject":        "#a78bfa",
            "DeleteObject":     "#f43f5e",
            "CreateUser":       "#06b6d4",
            "DeleteUser":       "#f43f5e",
            "AttachRolePolicy": "#f59e0b",
            "ConsoleLogin":     "#3b82f6",
            "CreateKeyPair":    "#84cc16",
        }
        for event in resp.get("Events", []):
            name     = event.get("EventName","")
            username = event.get("Username","aws-service")
            resource = ""
            resources = event.get("Resources",[])
            if resources:
                resource = resources[0].get("ResourceName","")
            logs.append({
                "id":      event.get("EventId",""),
                "time":    event.get("EventTime").isoformat() if event.get("EventTime") else "",
                "type":    "CloudTrail",
                "action":  name,
                "resource":resource or event.get("EventSource","").replace(".amazonaws.com",""),
                "detail":  f"by {username}",
                "status":  "success",
                "source":  "aws",
                "color":   ACTION_COLORS.get(name,"#64748b"),
            })
    except Exception as e:
        print(f"CloudTrail error: {e}")

    # AWS S3 recent operations
    try:
        s3 = boto3.client("s3", region_name=config.AWS_REGION)
        buckets = s3.list_buckets().get("Buckets",[])
        for b in buckets[:5]:
            logs.append({
                "id":      f"s3-{b['Name']}",
                "time":    b["CreationDate"].isoformat(),
                "type":    "S3",
                "action":  "Created",
                "resource":b["Name"],
                "detail":  "S3 Bucket",
                "status":  "active",
                "source":  "aws",
                "color":   "#00d4aa",
            })
    except Exception as e:
        print(f"S3 log error: {e}")

    # Sort all by time descending
    logs.sort(key=lambda x: x["time"], reverse=True)
    return logs[:limit]
"""
with open("routers/logs.py", "w", newline="\n", encoding="utf-8") as f:
    f.write(content)
print("Done")
