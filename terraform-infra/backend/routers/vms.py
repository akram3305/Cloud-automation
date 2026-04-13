from fastapi import APIRouter, Depends, HTTPException
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
def start_vm(vm_id: int, db: Session = Depends(get_db), user: User = Depends(require_operator)):
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
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return vm


@router.post("/{vm_id}/stop", response_model=VMOut)
def stop_vm(vm_id: int, db: Session = Depends(get_db), user: User = Depends(require_operator)):
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
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return vm


# ✅ FIXED DELETE API (ONLY CHANGE HERE 🚀)
@router.delete("/{vm_id}", status_code=204)
def delete_vm(vm_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    if user.role != "admin" and vm.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if vm.instance_id:
        try:
            ec2c = boto3.client("ec2", region_name=vm.region or "ap-south-1")

            ec2c.stop_instances(InstanceIds=[vm.instance_id])

            ec2c.create_tags(
                Resources=[vm.instance_id],
                Tags=[{"Key": "AIonOS-Deleted", "Value": "true"}]
            )

        except Exception as _e:
            print(f"AWS tag/stop warning: {_e}")

    # Clean cost tracking
    vm.start_time = None

    db.delete(vm)
    db.commit()
    return


@router.patch("/{vm_id}/schedule", response_model=VMOut)
def update_schedule(vm_id: int, body: VMScheduleUpdate, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    vm.auto_start = body.auto_start
    vm.auto_stop = body.auto_stop
    db.commit()
    db.refresh(vm)
    return vm


from pydantic import BaseModel as SchedBase

class SchedPayload(SchedBase):
    auto_start: str = ""
    auto_stop: str = ""


@router.patch("/{vm_id}/set-schedule", response_model=VMOut)
def set_schedule(vm_id: int, body: SchedPayload, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    vm.auto_start = body.auto_start
    vm.auto_stop = body.auto_stop
    db.commit()
    db.refresh(vm)
    return vm