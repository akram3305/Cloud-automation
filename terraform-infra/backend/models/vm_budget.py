from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class VMBudget(Base):
    __tablename__ = "vm_budgets"

    id             = Column(Integer, primary_key=True, index=True)
    vm_id          = Column(String(256), nullable=False, index=True)   # instance_id / name
    vm_name        = Column(String(256), nullable=False)
    cloud          = Column(String(16),  nullable=False)               # aws / gcp / azure
    region         = Column(String(64))
    instance_type  = Column(String(64))
    monthly_budget = Column(Float, nullable=False)
    alert_50       = Column(Boolean, default=True)
    alert_70       = Column(Boolean, default=True)
    alert_90       = Column(Boolean, default=True)
    action_100     = Column(String(16), default="notify")              # notify | stop
    owner_email    = Column(String(256), default="")
    notify_emails  = Column(Text, default="")                          # comma-separated extras
    created_by     = Column(String(64), nullable=False)
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())


class VMBudgetAlertLog(Base):
    __tablename__ = "vm_budget_alert_logs"

    id             = Column(Integer, primary_key=True, index=True)
    vm_budget_id   = Column(Integer, nullable=False)
    vm_name        = Column(String(256))
    cloud          = Column(String(16))
    threshold      = Column(Integer)        # 50 / 70 / 90 / 100
    current_cost   = Column(Float)
    monthly_budget = Column(Float)
    action_taken   = Column(String(64))     # notified | stopped
    sent_at        = Column(DateTime(timezone=True), server_default=func.now())
