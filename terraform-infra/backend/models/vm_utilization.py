from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base


class VMUtilization(Base):
    __tablename__ = "vm_utilizations"

    id           = Column(Integer, primary_key=True, index=True)
    cloud        = Column(String(16),  nullable=False)   # aws / gcp / azure
    vm_id        = Column(String(256), nullable=False, index=True)
    vm_name      = Column(String(256))
    region       = Column(String(64))
    instance_type = Column(String(64))
    owner_email  = Column(String(256))
    avg_cpu_24h  = Column(Float)                         # 0–100, None if unavailable
    max_cpu_24h  = Column(Float)
    status       = Column(String(16))                    # idle / underutilized / active / stopped / unknown
    state        = Column(String(32))                    # running / stopped / etc.
    alert_sent   = Column(Boolean, default=False)
    checked_at   = Column(DateTime(timezone=True), server_default=func.now())
