from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from database import Base


class UserActivity(Base):
    __tablename__ = "user_activity"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String, nullable=False, index=True)
    cloud         = Column(String, default="platform")   # aws | azure | gcp | platform
    action        = Column(String, nullable=False)
    resource_type = Column(String, default="")
    resource      = Column(String, default="")
    detail        = Column(String, default="")
    status        = Column(String, default="success")    # success | failed | pending
    ip_address    = Column(String, default="")
    created_at    = Column(DateTime, default=datetime.utcnow, index=True)
