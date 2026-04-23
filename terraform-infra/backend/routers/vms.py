from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import VM, User
from schemas import VMOut, VMScheduleUpdate
from routers.auth import get_current_user, require_operator
import boto3

router = APIRouter(prefix="/vms", tags=["vms"])


@router.get("", response_model=list[VMOut])
def list_vms(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # All authenticated users see all VMs (including AWS-discovered ones)
    return db.query(VM).order_by(VM.created_at.desc()).all()


@router.get("/{vm_id}", response_model=VMOut)
def get_vm(vm_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    if user.role != "admin" and vm.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return vm


@router.post("/{vm_id}/start", response_model=VMOut)
def start_vm(vm_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    if user.role != "admin" and vm.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        ec2 = boto3.client("ec2", region_name=vm.region)
        ec2.start_instances(InstanceIds=[vm.instance_id])
        vm.start_time = datetime.utcnow()
        vm.state = "pending"
        db.commit()
        db.refresh(vm)
        _vm = {"name": vm.name, "instance_id": vm.instance_id, "region": vm.region, "owner": vm.owner_username}
        background_tasks.add_task(_notify_action, "start", "aws", _vm, user.username, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return vm


@router.post("/{vm_id}/stop", response_model=VMOut)
def stop_vm(vm_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    if user.role != "admin" and vm.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        ec2 = boto3.client("ec2", region_name=vm.region)
        ec2.stop_instances(InstanceIds=[vm.instance_id])
        vm.start_time = None
        vm.state = "stopping"
        db.commit()
        db.refresh(vm)
        _vm = {"name": vm.name, "instance_id": vm.instance_id, "region": vm.region, "owner": vm.owner_username}
        background_tasks.add_task(_notify_action, "stop", "aws", _vm, user.username, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return vm


@router.delete("/{vm_id}", status_code=204)
def delete_vm(vm_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    if user.role != "admin" and vm.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    _vm = {"name": vm.name, "instance_id": vm.instance_id, "region": vm.region, "owner": vm.owner_username}

    if vm.instance_id:
        try:
            ec2c = boto3.client("ec2", region_name=vm.region or "ap-south-1")
            ec2c.stop_instances(InstanceIds=[vm.instance_id])
            ec2c.create_tags(Resources=[vm.instance_id], Tags=[{"Key": "AIonOS-Deleted", "Value": "true"}])
        except Exception as _e:
            print(f"AWS tag/stop warning: {_e}")

    vm.start_time = None
    db.delete(vm)
    db.commit()
    background_tasks.add_task(_notify_action, "delete", "aws", _vm, user.username, db)
    return


@router.patch("/{vm_id}/schedule", response_model=VMOut)
def update_schedule(vm_id: int, body: VMScheduleUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    vm.auto_start = body.auto_start
    vm.auto_stop  = body.auto_stop
    db.commit()
    db.refresh(vm)
    background_tasks.add_task(_notify_schedule, vm.name, "aws", vm.owner_username, user.username, body.auto_start, body.auto_stop, db)
    return vm


from pydantic import BaseModel as SchedBase

class SchedPayload(SchedBase):
    auto_start: str = ""
    auto_stop: str = ""


@router.patch("/{vm_id}/set-schedule", response_model=VMOut)
def set_schedule(vm_id: int, body: SchedPayload, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    vm.auto_start = body.auto_start
    vm.auto_stop  = body.auto_stop
    db.commit()
    db.refresh(vm)
    background_tasks.add_task(_notify_schedule, vm.name, "aws", vm.owner_username, user.username, body.auto_start, body.auto_stop, db)
    return vm


# ── Notification helpers ───────────────────────────────────────────────────────

def _notify_action(action: str, cloud: str, vm: dict, actor: str, db):
    try:
        from services.notification_service import notify_vm_action
        from database import SessionLocal
        _db = SessionLocal()
        notify_vm_action(_db, action=action, cloud=cloud, vm_name=vm["name"],
                         region=vm.get("region",""), actor_username=actor,
                         owner_username=vm.get("owner"), instance_id=vm.get("instance_id"))
        _db.close()
    except Exception as e:
        print(f"[Notify] action email error: {e}")


def _notify_schedule(vm_name, cloud, owner, actor, auto_start, auto_stop, db):
    try:
        from services.notification_service import notify_schedule_set
        from database import SessionLocal
        _db = SessionLocal()
        notify_schedule_set(_db, vm_name=vm_name, cloud=cloud, owner_username=owner,
                            actor_username=actor, auto_start=auto_start, auto_stop=auto_stop)
        _db.close()
    except Exception as e:
        print(f"[Notify] schedule email error: {e}")