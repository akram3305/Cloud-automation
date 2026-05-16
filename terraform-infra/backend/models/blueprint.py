from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime
from database import Base


class Blueprint(Base):
    __tablename__ = "blueprints"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, nullable=False, index=True)
    description   = Column(String, default="")
    cloud         = Column(String, nullable=False)    # aws | azure | gcp
    resource_type = Column(String, default="vm")      # vm | storage | network | kubernetes
    config        = Column(Text, nullable=False)       # JSON blob of full form config
    created_by    = Column(String, nullable=False, index=True)
    is_public     = Column(Boolean, default=True)
    use_count     = Column(Integer, default=0)
    icon          = Column(String, default="")
    created_at    = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at    = Column(DateTime, default=datetime.utcnow)
