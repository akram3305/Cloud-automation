from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base   

class VM(Base):
    __tablename__ = "vms"

    id            = Column(Integer, primary_key=True, index=True)
    request_id    = Column(Integer, ForeignKey("requests.id"), nullable=True)
    owner_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner_username= Column(String(64), nullable=False)

    name          = Column(String(128), nullable=False)
    instance_id   = Column(String(32), unique=True, nullable=False, index=True)
    instance_type = Column(String(32), nullable=False)
    region        = Column(String(32), nullable=False)
    ami_id        = Column(String(32), nullable=False)

    state         = Column(String(20), default="pending", nullable=False)
    public_ip     = Column(String(20), nullable=True)
    private_ip    = Column(String(20), nullable=True)

    auto_start    = Column(String(8), nullable=True)
    auto_stop     = Column(String(8), nullable=True)

    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    start_time   = Column(DateTime, nullable=True)
    environment  = Column(String(32), nullable=True, default="dev")
    project_tag  = Column(String(128), nullable=True)
    owner_tag    = Column(String(128), nullable=True)