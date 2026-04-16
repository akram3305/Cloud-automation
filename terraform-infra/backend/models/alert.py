from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id         = Column(Integer, primary_key=True, index=True)
    vm_id      = Column(Integer, nullable=True)
    vm_name    = Column(String, nullable=True)
    alert_type = Column(String, default="scheduler_failure")   # scheduler_failure | info
    message    = Column(String, nullable=False)
    is_read    = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
