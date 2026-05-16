from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class RequestComment(Base):
    __tablename__ = "request_comments"

    id         = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, nullable=False, index=True)
    author     = Column(String(64), nullable=False)
    text       = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
