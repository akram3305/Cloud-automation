from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class GcpSshKey(Base):
    __tablename__ = "gcp_ssh_keys"

    id            = Column(Integer, primary_key=True, index=True)
    instance_name = Column(String(128), nullable=False, index=True)
    username      = Column(String(64),  nullable=False, default="gcpuser")
    private_key   = Column(Text,        nullable=False)
    filename      = Column(String(256), nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())
