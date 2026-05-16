from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models.vm import VM
from models.request import Request
from routers.auth import get_current_user

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def global_search(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(10, le=20),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    pat = f"%{q}%"
    results = []

    # AWS EC2 instances (from local DB)
    vms = (
        db.query(VM)
        .filter(or_(VM.name.ilike(pat), VM.instance_id.ilike(pat), VM.public_ip.ilike(pat)))
        .limit(limit)
        .all()
    )
    for vm in vms:
        results.append({
            "id":     f"aws-ec2-{vm.id}",
            "name":   vm.name,
            "type":   "EC2 Instance",
            "cloud":  "aws",
            "status": vm.state or "unknown",
            "link":   "/compute",
            "meta":   f"{vm.instance_type} · {vm.region}",
        })

    # Requests / approvals
    reqs = (
        db.query(Request)
        .filter(or_(Request.resource_name.ilike(pat), Request.resource_type.ilike(pat)))
        .limit(limit)
        .all()
    )
    for req in reqs:
        results.append({
            "id":     f"req-{req.id}",
            "name":   req.resource_name,
            "type":   f"Request · {req.resource_type}",
            "cloud":  getattr(req, "cloud_provider", None) or "aws",
            "status": req.status or "pending",
            "link":   "/approvals",
            "meta":   f"by {req.username}",
        })

    return {"results": results[:limit], "query": q}
