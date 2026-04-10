from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from database import Base

class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), nullable=False)
    resource_name = Column(String(128), nullable=False)
    resource_type = Column(String(32), default="ec2")
    status = Column(String(32), default="pending")

    payload = Column(Text, nullable=True)
    instance_id = Column(String(64), nullable=True)

    approved_by = Column(String(64), nullable=True)
    reject_reason = Column(String(512), nullable=True)

    subnet_id = Column(String(128), nullable=True)  # Changed from Text to String
    security_groups = Column(String(512), nullable=True)  # Changed from Text to String
    key_name = Column(String(128), nullable=True)  # Changed from Text to String
    ami_id = Column(String(32), nullable=True)  # Changed from Text to String

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Add these for better tracking
    cloud_provider = Column(String(20), default="aws")
    region = Column(String(32), nullable=True)
    cost_estimate = Column(String(32), nullable=True)
