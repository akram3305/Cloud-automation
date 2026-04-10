from fastapi import APIRouter, Depends, HTTPException
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


# 🔹 Request payload
class ApprovalPayload(BaseModel):
    action: str
    resource: str
    resource_id: Optional[str] = None
    resource_name: Optional[str] = None
    payload: Optional[dict] = None


# 🔹 Review payload
class ReviewPayload(BaseModel):
    status: str   # approve / reject
    review_note: Optional[str] = None


# 🔥 Create approval request
@router.post("/request")
def create_approval_request(
    body: ApprovalPayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = ApprovalRequest(
        requested_by=user.username,
        action=body.action,
        resource=body.resource,
        resource_id=body.resource_id,
        resource_name=body.resource_name,
        payload=json.dumps(body.payload) if body.payload else None,
        status="pending",
    )

    db.add(req)
    db.commit()
    db.refresh(req)

    return {
        "id": req.id,
        "status": req.status,
        "message": f"Approval request submitted for {body.action} {body.resource}",
    }


# 🔥 List approvals
@router.get("/")
def list_approvals(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ApprovalRequest)

    if status:
        q = q.filter(ApprovalRequest.status == status)

    if user.role not in ["admin", "operator"]:
        q = q.filter(ApprovalRequest.requested_by == user.username)

    results = q.order_by(ApprovalRequest.created_at.desc()).all()

    # Convert payload back to JSON
    response = []
    for r in results:
        response.append({
            "id": r.id,
            "action": r.action,
            "resource": r.resource,
            "resource_name": r.resource_name,
            "status": r.status,
            "requested_by": r.requested_by,
            "payload": json.loads(r.payload) if r.payload else None,
            "created_at": r.created_at,
        })

    return response


# 🔥 Review approval (Admin only)
@router.patch("/{req_id}/review")
def review_approval(
    req_id: int,
    body: ReviewPayload,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    if body.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    req = db.query(ApprovalRequest).filter(ApprovalRequest.id == req_id).first()

    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Already reviewed")

    req.status = body.status
    req.reviewed_by = user.username
    req.review_note = body.review_note
    req.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(req)

    return {
        "id": req.id,
        "status": req.status,
        "reviewed_by": req.reviewed_by,
    }


# 🔥 Pending count
@router.get("/pending/count")
def get_pending_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    count = db.query(ApprovalRequest).filter(ApprovalRequest.status == "pending").count()
    return {"count": count}