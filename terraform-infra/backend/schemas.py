from pydantic import BaseModel, EmailStr
from typing import Optional, Any
from datetime import datetime

# ── Auth ──────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ── Requests ──────────────────────────────────────────────────

class CreateRequestPayload(BaseModel):
    resource_type: str          # vm | s3 | vpc
    resource_name: str
    instance_type: Optional[str] = "t3.micro"
    region: Optional[str] = "ap-south-1"
    ami_id: Optional[str] = "ami-0f58b397bc5c1f2e8"   # Amazon Linux 2 ap-south-1
    key_pair_name: Optional[str] = None
    security_group_ids: Optional[list[str]] = []
    subnet_id: Optional[str] = None
    tags: Optional[dict[str, str]] = {}

class ApproveRejectPayload(BaseModel):
    reason: Optional[str] = None

class RequestOut(BaseModel):
    id: int
    username: str
    resource_type: str
    resource_name: str
    status: str
    reject_reason: Optional[str]
    payload: str                # raw JSON string
    instance_id: Optional[str]
    approved_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

# ── VMs ───────────────────────────────────────────────────────

class VMOut(BaseModel):
    id: int
    name: str
    instance_id: str
    instance_type: str
    region: str
    ami_id: str
    state: str
    public_ip: Optional[str]
    private_ip: Optional[str]
    owner_username: str
    auto_start: Optional[str]
    auto_stop: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class VMScheduleUpdate(BaseModel):
    auto_start: Optional[str] = None   # "09:00" or null to clear
    auto_stop: Optional[str] = None    # "20:00" or null to clear

# ── Cost ──────────────────────────────────────────────────────

class DailyCost(BaseModel):
    date: str
    amount: float

class ServiceCost(BaseModel):
    service: str
    amount: float

class CostOverview(BaseModel):
    mtd_total: float
    running_vms: int
    stopped_vms: int
    pending_approvals: int
    last_updated: str
