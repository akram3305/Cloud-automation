# -*- coding: utf-8 -*-
"""
routers/requests.py — AIonOS Platform
Full provisioning pipeline with:
  - Duplicate prevention
  - Pattern A isolated workspaces
  - S3 archiving before cleanup
  - Folder cleanup after successful apply
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import json
import traceback
from datetime import datetime

from database import get_db
from models.request import Request
from models.vm import VM
from models.user import User
from routers.auth import get_current_user, require_operator

router = APIRouter(prefix="/requests", tags=["requests"])


# ──────────────────────────────────────────────────────────────────────────
# SCHEMAS
# ──────────────────────────────────────────────────────────────────────────

class CreateRequest(BaseModel):
    resource_name:  str
    resource_type:  str  = "ec2"
    cloud_provider: str  = "aws"
    region:         str  = "ap-south-1"
    payload:        dict = {}


class ApprovePayload(BaseModel):
    note: Optional[str] = ""


class RejectPayload(BaseModel):
    note: Optional[str] = "Rejected by admin"


# ──────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────

def _get_env(req: Request) -> str:
    """Extract environment from request payload tags."""
    try:
        payload = json.loads(req.payload or "{}")
        env = payload.get("tags", {}).get("environment", "dev").lower()
        return env if env in ("dev", "staging", "prod") else "dev"
    except Exception:
        return "dev"


def _serialize(r: Request) -> dict:
    """Serialize a Request model to a dict."""
    return {
        "id":            r.id,
        "username":      r.username,
        "resource_name": r.resource_name,
        "resource_type": r.resource_type,
        "status":        r.status,
        "cloud_provider": r.cloud_provider or "aws",
        "region":        r.region,
        "instance_id":   r.instance_id,
        "approved_by":   r.approved_by,
        "reject_reason": r.reject_reason,
        "payload":       json.loads(r.payload or "{}"),
        "created_at":    str(r.created_at),
        "updated_at":    str(r.updated_at),
    }


# ──────────────────────────────────────────────────────────────────────────
# LIST / GET
# ──────────────────────────────────────────────────────────────────────────

@router.get("")
def list_requests(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user)
):
    """List all requests. Admins see all, others see only their own."""
    q = db.query(Request)
    if user.role not in ("admin", "operator"):
        q = q.filter(Request.username == user.username)
    return [_serialize(r) for r in q.order_by(Request.id.desc()).all()]


@router.get("/{request_id}")
def get_request(
    request_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user)
):
    r = db.query(Request).filter(Request.id == request_id).first()
    if not r:
        raise HTTPException(404, "Request not found")
    if user.role not in ("admin", "operator") and r.username != user.username:
        raise HTTPException(403, "Access denied")
    return _serialize(r)


# ──────────────────────────────────────────────────────────────────────────
# CREATE — with duplicate prevention
# ──────────────────────────────────────────────────────────────────────────

@router.post("")
def create_request(
    body: CreateRequest,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_operator)
):
    """
    Create a new infrastructure request.
    Blocks duplicate requests — same user + same name + same type + active status.
    """
    # ── Duplicate check ───────────────────────────────────────────────────
    active_statuses = ["pending", "generating", "planning", "provisioning", "completed"]
    existing = db.query(Request).filter(
        Request.username      == user.username,
        Request.resource_name == body.resource_name,
        Request.resource_type == body.resource_type.lower(),
        Request.status.in_(active_statuses)
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Resource '{body.resource_name}' ({body.resource_type}) already exists "
                f"or is in progress. Current status: '{existing.status}'. "
                f"Request ID: {existing.id}"
            )
        )

    # ── Build payload ─────────────────────────────────────────────────────
    payload = body.payload.copy()
    payload["resource_name"] = body.resource_name
    payload["username"]      = user.username
    payload["region"]        = body.region

    # Ensure default tags
    tags = payload.setdefault("tags", {})
    tags.setdefault("project",     "AIonOS-Platform")
    tags.setdefault("owner",       user.username)
    tags.setdefault("environment", "dev")
    tags.setdefault("CreatedBy",   "AIonOS-Platform")
    tags.setdefault("ManagedBy",   user.username)

    # ── Create request ────────────────────────────────────────────────────
    req = Request(
        username      = user.username,
        resource_name = body.resource_name,
        resource_type = body.resource_type.lower(),
        cloud_provider= body.cloud_provider,
        region        = body.region,
        status        = "pending",
        payload       = json.dumps(payload),
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    print(f"[req_{req.id}] Created: {body.resource_name} ({body.resource_type}) by {user.username}")
    return _serialize(req)


# ──────────────────────────────────────────────────────────────────────────
# APPROVE — triggers full pipeline
# ──────────────────────────────────────────────────────────────────────────

@router.patch("/{request_id}/approve")
def approve_request(
    request_id:       int,
    body:             ApprovePayload    = ApprovePayload(),
    background_tasks: BackgroundTasks  = BackgroundTasks(),
    db:               Session          = Depends(get_db),
    user:             User             = Depends(get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, "Only admin can approve requests")

    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    if req.status not in ("pending", "failed", "plan_failed"):
        raise HTTPException(400, f"Cannot approve request in status: '{req.status}'")

    req.approved_by   = user.username
    req.status        = "generating"
    req.reject_reason = None
    db.commit()

    background_tasks.add_task(_run_pipeline, request_id)
    return {
        "message":    f"Pipeline started for '{req.resource_name}'",
        "request_id": request_id,
        "status":     "generating"
    }


# ──────────────────────────────────────────────────────────────────────────
# REJECT — cleanup workspace + mark rejected
# ──────────────────────────────────────────────────────────────────────────

@router.patch("/{request_id}/reject")
def reject_request(
    request_id: int,
    body:       RejectPayload = RejectPayload(),
    db:         Session       = Depends(get_db),
    user:       User          = Depends(get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, "Only admin can reject requests")

    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")

    # Clean up workspace if it was generated
    try:
        from services.terraform_service import remove_resource
        env = _get_env(req)
        remove_resource(request_id, env)
    except Exception as e:
        print(f"[req_{request_id}] Workspace cleanup warning: {e}")

    req.status        = "rejected"
    req.reject_reason = body.note or "Rejected by admin"
    req.approved_by   = user.username
    db.commit()

    print(f"[req_{request_id}] Rejected by {user.username}")
    return {"message": "Request rejected", "request_id": request_id}


# ──────────────────────────────────────────────────────────────────────────
# DELETE request record
# ──────────────────────────────────────────────────────────────────────────

@router.delete("/{request_id}")
def delete_request(
    request_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")

    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")

    if req.status in ("generating", "planning", "provisioning"):
        raise HTTPException(400, "Cannot delete a request that is currently running")

    # Clean up workspace if exists
    try:
        from services.terraform_service import remove_resource
        env = _get_env(req)
        remove_resource(request_id, env)
    except Exception:
        pass

    db.delete(req)
    db.commit()
    return {"message": f"Request {request_id} deleted"}


# ──────────────────────────────────────────────────────────────────────────
# PIPELINE (background task)
# ──────────────────────────────────────────────────────────────────────────

def _run_pipeline(request_id: int):
    """
    Full Terraform pipeline — runs in background:
    1. Write template + tfvars  →  req_N/
    2. terraform init
    3. terraform plan
    4. terraform apply
    5. Save outputs to DB
    6. Archive workspace to S3
    7. Delete local req_N/ folder
    """
    from database import SessionLocal
    from services.terraform_service import (
        write_resource,
        run_terraform,
        get_outputs,
        get_resource_output,
        archive_to_s3,
        cleanup_workspace,
    )
    import pipeline_tracker as pt

    db = SessionLocal()

    def _update(status: str, error: str = None):
        r = db.query(Request).filter(Request.id == request_id).first()
        if r:
            r.status     = status
            r.updated_at = datetime.utcnow()
            if error:
                r.reject_reason = error[:500]
            db.commit()

    def _log(msg: str):
        print(f"[req_{request_id}] {msg}", flush=True)
        pt.append_log(request_id, msg)

    apply_output = ""

    # ── Initialise tracker ────────────────────────────────────────────────
    pt.init_pipeline(request_id)

    try:
        req = db.query(Request).filter(Request.id == request_id).first()
        if not req:
            _log("Request not found — aborting pipeline")
            pt.fail_pipeline(request_id)
            return

        payload       = json.loads(req.payload or "{}")
        resource_type = req.resource_type
        env           = _get_env(req)
        payload["resource_name"] = req.resource_name
        payload["username"]      = req.username

        _log("=" * 55)
        _log(f"Pipeline: {req.resource_name} ({resource_type}) → {env}")
        _log("=" * 55)

        # ── STEP 1: Write template + tfvars ───────────────────────────────
        pt.set_stage(request_id, "generating", "running")
        _update("generating")
        _log("STEP 1/4: Writing template + tfvars...")
        try:
            tf_file = write_resource(request_id, resource_type, payload)
            _log(f"Written: {tf_file}")
            pt.set_stage(request_id, "generating", "done")
        except Exception as e:
            pt.set_stage(request_id, "generating", "failed")
            pt.fail_pipeline(request_id)
            _update("failed", f"Failed to write resource: {e}")
            _log(f"WRITE FAILED: {e}")
            return

        # ── STEP 2: terraform init ────────────────────────────────────────
        pt.set_stage(request_id, "init", "running")
        _log("STEP 2/4: terraform init...")
        init = run_terraform("init", env, request_id=request_id)
        if not init["success"]:
            err = (init.get("error") or init.get("output") or "init failed")[:400]
            pt.set_stage(request_id, "init", "failed")
            pt.fail_pipeline(request_id)
            _update("failed", f"terraform init failed: {err}")
            _log(f"INIT FAILED: {err}")
            cleanup_workspace(request_id, env)
            return
        pt.set_stage(request_id, "init", "done")
        _log("init OK")

        # ── STEP 3: terraform plan ────────────────────────────────────────
        pt.set_stage(request_id, "plan", "running")
        _update("planning")
        _log("STEP 3/4: terraform plan...")
        plan = run_terraform("plan", env, request_id=request_id)

        if not plan["success"]:
            err = (plan.get("error") or plan.get("output") or "plan failed")[:400]
            pt.set_stage(request_id, "plan", "failed")
            pt.fail_pipeline(request_id)
            _update("plan_failed", f"terraform plan failed: {err}")
            _log(f"PLAN FAILED: {err}")
            cleanup_workspace(request_id, env)
            return

        # Log plan summary
        for line in plan.get("output", "").splitlines():
            if any(x in line for x in ["to add", "to change", "to destroy", "Plan:"]):
                _log(f"  {line.strip()}")
        pt.set_stage(request_id, "plan", "done")
        _log("plan OK")

        # ── STEP 4: terraform apply ───────────────────────────────────────
        pt.set_stage(request_id, "apply", "running")
        _update("provisioning")
        _log("STEP 4/4: terraform apply...")
        apply = run_terraform("apply", env, request_id=request_id)
        apply_output = apply.get("output", "") + apply.get("error", "")

        if not apply["success"]:
            err = (apply.get("error") or apply.get("output") or "apply failed")[:400]
            pt.set_stage(request_id, "apply", "failed")
            pt.fail_pipeline(request_id)
            _update("failed", f"terraform apply failed: {err}")
            _log(f"APPLY FAILED: {err}")
            # Archive logs even on failure for debugging
            archive_to_s3(request_id, env, apply_output)
            cleanup_workspace(request_id, env)
            return

        pt.set_stage(request_id, "apply", "done")
        _log("apply OK")

        # ── Get outputs ───────────────────────────────────────────────────
        outputs = get_outputs(env, request_id=request_id)
        _log(f"Outputs: {outputs}")

        # ── Save to DB ────────────────────────────────────────────────────
        req2 = db.query(Request).filter(Request.id == request_id).first()
        if req2:
            req2.status = "completed"

            instance_id = outputs.get("instance_id", "")
            public_ip   = outputs.get("public_ip", "")
            private_ip  = outputs.get("private_ip", "")
            bucket_name = outputs.get("bucket_name", "")
            vpc_id      = outputs.get("vpc_id", "")
            key_name    = outputs.get("key_name", "")

            # Store the primary resource identifier
            req2.instance_id = (
                instance_id or bucket_name or vpc_id or key_name or ""
            )
            db.commit()

            # ── Create VM record for EC2 ──────────────────────────────────
            if resource_type in ("ec2", "vm") and instance_id:
                existing_vm = db.query(VM).filter(
                    VM.instance_id == instance_id
                ).first()
                if not existing_vm:
                    vm = VM(
                        name           = req.resource_name,
                        instance_id    = instance_id,
                        instance_type  = payload.get("instance_type", "t3.medium"),
                        ami_id         = payload.get("ami_id", ""),
                        region         = payload.get("region", "ap-south-1"),
                        state          = "running",
                        public_ip      = public_ip,
                        private_ip     = private_ip,
                        owner_id       = 1,
                        owner_username = req.username,
                        start_time     = datetime.utcnow(),
                    )
                    db.add(vm)
                    db.commit()
                    _log(f"VM record created: {req.resource_name} ({instance_id})")

        # ── Archive to S3 then cleanup local folder ───────────────────────
        _log("Archiving workspace to S3...")
        archive_to_s3(request_id, env, apply_output)

        _log("Cleaning up local workspace...")
        cleanup_workspace(request_id, env)

        pt.complete_pipeline(request_id)
        _log("=" * 55)
        _log("PIPELINE COMPLETE ✓")
        _log("=" * 55)

    except Exception as e:
        tb = traceback.format_exc()
        _log(f"PIPELINE EXCEPTION: {e}\n{tb}")
        _update("failed", f"Pipeline exception: {str(e)[:400]}")
        pt.fail_pipeline(request_id)
        # Try to archive and cleanup even on exception
        try:
            archive_to_s3(request_id, _get_env(
                db.query(Request).filter(Request.id == request_id).first()
            ), apply_output)
            cleanup_workspace(request_id, _get_env(
                db.query(Request).filter(Request.id == request_id).first()
            ))
        except Exception:
            pass
    finally:
        db.close()


# ──────────────────────────────────────────────────────────────────────────
# PIPELINE STATE — live stage data for frontend visualization
# ──────────────────────────────────────────────────────────────────────────

@router.get("/{request_id}/pipeline")
def get_pipeline_state(
    request_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    r = db.query(Request).filter(Request.id == request_id).first()
    if not r:
        raise HTTPException(404, "Request not found")
    if user.role not in ("admin", "operator") and r.username != user.username:
        raise HTTPException(403, "Access denied")

    import pipeline_tracker as pt
    state = pt.get_state(request_id)

    return {
        "request_id":    request_id,
        "resource_name": r.resource_name,
        "resource_type": r.resource_type,
        "status":        r.status,
        "approved_by":   r.approved_by,
        "reject_reason": r.reject_reason,
        "region":        r.region,
        "created_at":    str(r.created_at),
        "pipeline":      state,
    }