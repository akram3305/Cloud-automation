content = """from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import VM, User
from schemas import VMOut, VMScheduleUpdate
from routers.auth import get_current_user, require_operator
import boto3

router = APIRouter(prefix="/vms", tags=["vms"])

@router.get("", response_model=list[VMOut])
def list_vms(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(VM)
    if user.role != "admin":
        q = q.filter(VM.owner_id == user.id)
    return q.order_by(VM.created_at.desc()).all()

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
        vm.state = "stopping"
        db.commit()
        db.refresh(vm)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return vm

@router.delete("/{vm_id}", status_code=204)
def delete_vm(vm_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    if user.role != "admin" and vm.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if vm.instance_id:
        try:
            boto3.client("ec2", region_name=vm.region).terminate_instances(InstanceIds=[vm.instance_id])
        except Exception as e:
            print(f"AWS termination warning: {e}")
    db.delete(vm)
    db.commit()
    return

@router.patch("/{vm_id}/schedule", response_model=VMOut)
def update_schedule(vm_id: int, body: VMScheduleUpdate, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    vm = db.query(VM).filter(VM.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    vm.auto_start = body.auto_start
    vm.auto_stop  = body.auto_stop
    db.commit()
    db.refresh(vm)
    return vm
"""
with open("routers/vms.py", "w", newline="\n", encoding="utf-8") as f:
    f.write(content)
print("Done")
