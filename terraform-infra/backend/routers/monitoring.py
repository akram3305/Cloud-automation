# -*- coding: utf-8 -*-
"""
routers/monitoring.py — AIonOS Platform
VM utilization dashboard + budget management endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy     import func
from pydantic import BaseModel
from typing import Optional, List

from database import get_db
from models import User
from models.budget        import BudgetConfig, BudgetAlertLog
from models.vm_utilization import VMUtilization
from models.vm_budget      import VMBudget, VMBudgetAlertLog
from routers.auth import get_current_user, require_operator, require_admin

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class BudgetRequest(BaseModel):
    name:          str
    cloud:         str   = "all"        # aws / azure / gcp / all
    monthly_limit: float
    alert_50:      bool  = True
    alert_70:      bool  = True
    alert_90:      bool  = True
    action_100:    str   = "notify"     # notify | stop
    notify_emails: Optional[str] = ""  # comma-separated


# ── VM Utilization ────────────────────────────────────────────────────────────

@router.get("/utilization")
def get_utilization(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Return the most recent utilization snapshot for every VM."""
    subq = (
        db.query(VMUtilization.vm_id, func.max(VMUtilization.checked_at).label("latest"))
        .group_by(VMUtilization.vm_id)
        .subquery()
    )
    rows = (
        db.query(VMUtilization)
        .join(subq, (VMUtilization.vm_id == subq.c.vm_id) & (VMUtilization.checked_at == subq.c.latest))
        .all()
    )
    return [
        {
            "id":            r.id,
            "cloud":         r.cloud,
            "vm_id":         r.vm_id,
            "vm_name":       r.vm_name,
            "region":        r.region,
            "instance_type": r.instance_type,
            "owner_email":   r.owner_email,
            "avg_cpu_24h":   r.avg_cpu_24h,
            "max_cpu_24h":   r.max_cpu_24h,
            "status":        r.status,
            "state":         r.state,
            "alert_sent":    r.alert_sent,
            "checked_at":    r.checked_at.isoformat() if r.checked_at else None,
        }
        for r in rows
    ]


@router.post("/utilization/refresh")
def refresh_utilization(
    background_tasks: BackgroundTasks,
    user: User = Depends(require_operator),
):
    """Trigger an immediate utilization scan (runs in background)."""
    from services.monitoring_loop import run_utilization_check
    background_tasks.add_task(run_utilization_check)
    return {"message": "Utilization scan started"}


# ── Budgets ───────────────────────────────────────────────────────────────────

@router.get("/budgets")
def list_budgets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(BudgetConfig).filter(BudgetConfig.is_active == True).all()
    return [_budget_dict(r) for r in rows]


@router.post("/budgets")
def create_budget(
    body: BudgetRequest,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_operator),
):
    row = BudgetConfig(
        name          = body.name,
        cloud         = body.cloud,
        monthly_limit = body.monthly_limit,
        alert_50      = body.alert_50,
        alert_70      = body.alert_70,
        alert_90      = body.alert_90,
        action_100    = body.action_100,
        notify_emails = body.notify_emails or "",
        created_by    = user.username,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _budget_dict(row)


@router.put("/budgets/{budget_id}")
def update_budget(
    budget_id: int,
    body: BudgetRequest,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_operator),
):
    row = db.query(BudgetConfig).filter(BudgetConfig.id == budget_id, BudgetConfig.is_active == True).first()
    if not row:
        raise HTTPException(404, "Budget not found")
    row.name          = body.name
    row.cloud         = body.cloud
    row.monthly_limit = body.monthly_limit
    row.alert_50      = body.alert_50
    row.alert_70      = body.alert_70
    row.alert_90      = body.alert_90
    row.action_100    = body.action_100
    row.notify_emails = body.notify_emails or ""
    db.commit()
    db.refresh(row)
    return _budget_dict(row)


@router.delete("/budgets/{budget_id}")
def delete_budget(
    budget_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_operator),
):
    row = db.query(BudgetConfig).filter(BudgetConfig.id == budget_id).first()
    if not row:
        raise HTTPException(404, "Budget not found")
    row.is_active = False
    db.commit()
    return {"message": "Budget deleted"}


# ── Budget alert history ──────────────────────────────────────────────────────

@router.get("/budget-alerts")
def get_budget_alerts(
    limit: int = 100,
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    rows = (
        db.query(BudgetAlertLog)
        .order_by(BudgetAlertLog.sent_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id":            r.id,
            "budget_id":     r.budget_id,
            "budget_name":   r.budget_name,
            "cloud":         r.cloud,
            "threshold":     r.threshold,
            "current_spend": r.current_spend,
            "monthly_limit": r.monthly_limit,
            "action_taken":  r.action_taken,
            "sent_at":       r.sent_at.isoformat() if r.sent_at else None,
        }
        for r in rows
    ]


@router.post("/budget-check")
def trigger_budget_check(
    background_tasks: BackgroundTasks,
    user: User = Depends(require_admin),
):
    """Manually trigger a budget check (admin only)."""
    from services.monitoring_loop import run_budget_check
    background_tasks.add_task(run_budget_check)
    return {"message": "Budget check started"}


# ── VM-level Budgets ──────────────────────────────────────────────────────────

class VMBudgetRequest(BaseModel):
    vm_id:          str
    vm_name:        str
    cloud:          str
    region:         Optional[str] = ""
    instance_type:  Optional[str] = ""
    monthly_budget: float
    alert_50:       bool = True
    alert_70:       bool = True
    alert_90:       bool = True
    action_100:     str  = "notify"   # notify | stop
    owner_email:    Optional[str] = ""
    notify_emails:  Optional[str] = ""


@router.get("/vm-budgets")
def list_vm_budgets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(VMBudget).filter(VMBudget.is_active == True).all()
    return [_vm_budget_dict(r) for r in rows]


@router.get("/vm-budgets/resource/{vm_id}")
def get_vm_budget_by_resource(vm_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(VMBudget).filter(VMBudget.vm_id == vm_id, VMBudget.is_active == True).first()
    if not row:
        raise HTTPException(404, "No budget set for this resource")
    return _vm_budget_dict(row)


@router.post("/vm-budgets")
def create_vm_budget(body: VMBudgetRequest, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    existing = db.query(VMBudget).filter(VMBudget.vm_id == body.vm_id, VMBudget.is_active == True).first()
    if existing:
        raise HTTPException(409, "Budget already exists for this resource. Use PUT to update.")
    row = VMBudget(
        vm_id          = body.vm_id,
        vm_name        = body.vm_name,
        cloud          = body.cloud,
        region         = body.region or "",
        instance_type  = body.instance_type or "",
        monthly_budget = body.monthly_budget,
        alert_50       = body.alert_50,
        alert_70       = body.alert_70,
        alert_90       = body.alert_90,
        action_100     = body.action_100,
        owner_email    = body.owner_email or "",
        notify_emails  = body.notify_emails or "",
        created_by     = user.username,
        is_active      = True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _vm_budget_dict(row)


@router.put("/vm-budgets/{budget_id}")
def update_vm_budget(budget_id: int, body: VMBudgetRequest, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    row = db.query(VMBudget).filter(VMBudget.id == budget_id, VMBudget.is_active == True).first()
    if not row:
        raise HTTPException(404, "VM budget not found")
    row.monthly_budget = body.monthly_budget
    row.alert_50       = body.alert_50
    row.alert_70       = body.alert_70
    row.alert_90       = body.alert_90
    row.action_100     = body.action_100
    row.owner_email    = body.owner_email or ""
    row.notify_emails  = body.notify_emails or ""
    db.commit()
    db.refresh(row)
    return _vm_budget_dict(row)


@router.delete("/vm-budgets/{budget_id}")
def delete_vm_budget(budget_id: int, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    row = db.query(VMBudget).filter(VMBudget.id == budget_id).first()
    if not row:
        raise HTTPException(404, "VM budget not found")
    row.is_active = False
    db.commit()
    return {"message": "VM budget removed"}


@router.get("/vm-budget-alerts")
def get_vm_budget_alerts(limit: int = 100, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(VMBudgetAlertLog).order_by(VMBudgetAlertLog.sent_at.desc()).limit(limit).all()
    return [{"id": r.id, "vm_budget_id": r.vm_budget_id, "vm_name": r.vm_name, "cloud": r.cloud,
             "threshold": r.threshold, "current_cost": r.current_cost, "monthly_budget": r.monthly_budget,
             "action_taken": r.action_taken, "sent_at": r.sent_at.isoformat() if r.sent_at else None}
            for r in rows]


def _vm_budget_dict(r: VMBudget) -> dict:
    return {
        "id":             r.id,
        "vm_id":          r.vm_id,
        "vm_name":        r.vm_name,
        "cloud":          r.cloud,
        "region":         r.region,
        "instance_type":  r.instance_type,
        "monthly_budget": r.monthly_budget,
        "alert_50":       r.alert_50,
        "alert_70":       r.alert_70,
        "alert_90":       r.alert_90,
        "action_100":     r.action_100,
        "owner_email":    r.owner_email,
        "notify_emails":  r.notify_emails,
        "created_by":     r.created_by,
        "is_active":      r.is_active,
        "created_at":     r.created_at.isoformat() if r.created_at else None,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _budget_dict(r: BudgetConfig) -> dict:
    return {
        "id":            r.id,
        "name":          r.name,
        "cloud":         r.cloud,
        "monthly_limit": r.monthly_limit,
        "alert_50":      r.alert_50,
        "alert_70":      r.alert_70,
        "alert_90":      r.alert_90,
        "action_100":    r.action_100,
        "notify_emails": r.notify_emails,
        "created_by":    r.created_by,
        "is_active":     r.is_active,
        "created_at":    r.created_at.isoformat() if r.created_at else None,
    }
