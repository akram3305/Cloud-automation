from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from database import Base

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    id           = Column(Integer, primary_key=True, index=True)
    requested_by = Column(String, nullable=False)
    action       = Column(String, nullable=False)
    resource     = Column(String, nullable=False)
    resource_id  = Column(String, nullable=True)
    resource_name= Column(String, nullable=True)
    payload      = Column(Text, nullable=True)
    status       = Column(String, default="pending")
    reviewed_by  = Column(String, nullable=True)
    review_note  = Column(Text, nullable=True)
    created_at   = Column(DateTime, server_default=func.now())
    reviewed_at  = Column(DateTime, nullable=True)
