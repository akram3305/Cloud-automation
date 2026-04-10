content = """from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import json
from datetime import datetime

from database import get_db
from models import User
from models.approval import ApprovalRequest
from routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/approvals", tags=["approvals"])

class ApprovalPayload(BaseModel):
    action:        str
    resource:      str
    resource_id:   Optional[str] = None
    resource_name: Optional[str] = None
    payload:       Optional[dict] = None

class ReviewPayload(BaseModel):
    status:      str
    review_note: Optional[str] = None

@router.post("/request")
def create_approval_request(body: ApprovalPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    req = ApprovalRequest(
        requested_by  = user.username,
        action        = body.action,
        resource      = body.resource,
        resource_id   = body.resource_id,
        resource_name = body.resource_name,
        payload       = json.dumps(body.payload) if body.payload else None,
        status        = "pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"id": req.id, "status": "pending", "message": f"Approval request submitted for {body.action} {body.resource}"}

@router.get("")
def list_approvals(status: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(ApprovalRequest)
    if status:
        q = q.filter(ApprovalRequest.status == status)
    if user.role not in ["admin", "operator"]:
        q = q.filter(ApprovalRequest.requested_by == user.username)
    return q.order_by(ApprovalRequest.created_at.desc()).all()

@router.patch("/{req_id}/review")
def review_approval(req_id: int, body: ReviewPayload, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    req = db.query(ApprovalRequest).filter(ApprovalRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")
    req.status      = body.status
    req.reviewed_by = user.username
    req.review_note = body.review_note
    req.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(req)

    if body.status == "approved":
        try:
            execute_approved_action(req, db)
        except Exception as e:
            req.status      = "failed"
            req.review_note = str(e)
            db.commit()
            raise HTTPException(status_code=500, detail=f"Approved but execution failed: {e}")
    return req

def execute_approved_action(req: ApprovalRequest, db: Session):
    import boto3
    payload = json.loads(req.payload) if req.payload else {}

    if req.resource == "s3" and req.action == "delete":
        s3 = boto3.client("s3")
        try:
            s3r = boto3.resource("s3")
            s3r.Bucket(req.resource_name).objects.all().delete()
        except Exception:
            pass
        s3.delete_bucket(Bucket=req.resource_name)

    elif req.resource == "ec2" and req.action == "stop":
        from models.vm import VM
        vm = db.query(VM).filter(VM.id == int(req.resource_id)).first()
        if vm:
            boto3.client("ec2", region_name=vm.region).stop_instances(InstanceIds=[vm.instance_id])
            vm.state = "stopping"
            db.commit()

    elif req.resource == "ec2" and req.action == "delete":
        from models.vm import VM
        vm = db.query(VM).filter(VM.id == int(req.resource_id)).first()
        if vm:
            boto3.client("ec2", region_name=vm.region).terminate_instances(InstanceIds=[vm.instance_id])
            db.delete(vm)
            db.commit()

    elif req.resource == "eks" and req.action == "delete":
        region = payload.get("region", "ap-south-1")
        boto3.client("eks", region_name=region).delete_cluster(name=req.resource_name)

@router.get("/pending/count")
def get_pending_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    count = db.query(ApprovalRequest).filter(ApprovalRequest.status == "pending").count()
    return {"count": count}
"""
with open("routers/approvals.py", "w", newline="\\n", encoding="utf-8") as f:
    f.write(content)
print("Done")
