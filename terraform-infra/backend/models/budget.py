from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class BudgetConfig(Base):
    __tablename__ = "budget_configs"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String(128), nullable=False)
    cloud          = Column(String(16),  nullable=False, default="all")  # aws/azure/gcp/all
    monthly_limit  = Column(Float,       nullable=False)
    alert_50       = Column(Boolean,     default=True)
    alert_70       = Column(Boolean,     default=True)
    alert_90       = Column(Boolean,     default=True)
    action_100     = Column(String(16),  default="notify")   # notify | stop
    notify_emails  = Column(Text,        default="")         # comma-separated
    created_by     = Column(String(64),  nullable=False)
    is_active      = Column(Boolean,     default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())


class BudgetAlertLog(Base):
    __tablename__ = "budget_alert_logs"

    id             = Column(Integer, primary_key=True, index=True)
    budget_id      = Column(Integer, nullable=False)
    budget_name    = Column(String(128))
    cloud          = Column(String(16))
    threshold      = Column(Integer)         # 50 / 70 / 90 / 100
    current_spend  = Column(Float)
    monthly_limit  = Column(Float)
    action_taken   = Column(String(64))      # notified | stopped | none
    sent_at        = Column(DateTime(timezone=True), server_default=func.now())
