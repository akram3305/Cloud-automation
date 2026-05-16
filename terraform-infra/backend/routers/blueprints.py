# -*- coding: utf-8 -*-
"""
routers/blueprints.py — Save, list, and launch VM/infra configuration blueprints.
"""
import json
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from models.blueprint import Blueprint
from routers.auth import get_current_user

router = APIRouter(prefix="/blueprints", tags=["blueprints"])


def _serialize(b: Blueprint) -> dict:
    return {
        "id":            b.id,
        "name":          b.name,
        "description":   b.description or "",
        "cloud":         b.cloud,
        "resource_type": b.resource_type or "vm",
        "config":        json.loads(b.config) if b.config else {},
        "created_by":    b.created_by,
        "is_public":     b.is_public,
        "use_count":     b.use_count or 0,
        "icon":          b.icon or "",
        "created_at":    b.created_at.isoformat() if b.created_at else "",
    }


class BlueprintCreate(BaseModel):
    name:          str
    description:   str = ""
    cloud:         str
    resource_type: str = "vm"
    config:        Dict[str, Any]
    is_public:     bool = True
    icon:          str = ""


class BlueprintUpdate(BaseModel):
    name:        Optional[str]  = None
    description: Optional[str]  = None
    is_public:   Optional[bool] = None
    icon:        Optional[str]  = None


@router.get("")
def list_blueprints(
    cloud:         str = "all",
    resource_type: str = "all",
    db:            Session = Depends(get_db),
    user:          User    = Depends(get_current_user),
):
    q = db.query(Blueprint)
    if cloud != "all":
        q = q.filter(Blueprint.cloud == cloud)
    if resource_type != "all":
        q = q.filter(Blueprint.resource_type == resource_type)
    items = q.order_by(Blueprint.use_count.desc(), Blueprint.created_at.desc()).all()
    return [_serialize(b) for b in items]


@router.post("")
def create_blueprint(
    body: BlueprintCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    bp = Blueprint(
        name          = body.name,
        description   = body.description,
        cloud         = body.cloud,
        resource_type = body.resource_type,
        config        = json.dumps(body.config),
        created_by    = user.username,
        is_public     = body.is_public,
        icon          = body.icon,
    )
    db.add(bp)
    db.commit()
    db.refresh(bp)
    return _serialize(bp)


@router.get("/{bp_id}")
def get_blueprint(
    bp_id: int,
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    b = db.query(Blueprint).filter(Blueprint.id == bp_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    return _serialize(b)


@router.put("/{bp_id}")
def update_blueprint(
    bp_id: int,
    body:  BlueprintUpdate,
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    b = db.query(Blueprint).filter(Blueprint.id == bp_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    if b.created_by != user.username and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    if body.name        is not None: b.name        = body.name
    if body.description is not None: b.description = body.description
    if body.is_public   is not None: b.is_public   = body.is_public
    if body.icon        is not None: b.icon        = body.icon
    b.updated_at = datetime.utcnow()
    db.commit()
    return _serialize(b)


@router.delete("/{bp_id}")
def delete_blueprint(
    bp_id: int,
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    b = db.query(Blueprint).filter(Blueprint.id == bp_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    if b.created_by != user.username and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    db.delete(b)
    db.commit()
    return {"ok": True}


@router.post("/{bp_id}/launch")
def launch_from_blueprint(
    bp_id: int,
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    b = db.query(Blueprint).filter(Blueprint.id == bp_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    b.use_count = (b.use_count or 0) + 1
    db.commit()
    return {
        "ok":            True,
        "blueprint_id":  bp_id,
        "cloud":         b.cloud,
        "resource_type": b.resource_type,
        "config":        json.loads(b.config) if b.config else {},
    }
