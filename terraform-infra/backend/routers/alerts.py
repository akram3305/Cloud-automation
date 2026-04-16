from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.alert import Alert
from routers.auth import get_current_user, require_admin
from models.user import User

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Alert)
    if unread_only:
        q = q.filter(Alert.is_read == False)
    alerts = q.order_by(Alert.created_at.desc()).limit(50).all()
    return [
        {
            "id":         a.id,
            "vm_id":      a.vm_id,
            "vm_name":    a.vm_name,
            "alert_type": a.alert_type,
            "message":    a.message,
            "is_read":    a.is_read,
            "created_at": str(a.created_at),
        }
        for a in alerts
    ]


@router.get("/unread/count")
def unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    count = db.query(Alert).filter(Alert.is_read == False).count()
    return {"count": count}


@router.patch("/{alert_id}/read")
def mark_read(
    alert_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"ok": True}


@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    db.query(Alert).filter(Alert.is_read == False).update({"is_read": True})
    db.commit()
    return {"ok": True}
