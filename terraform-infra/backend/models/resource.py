from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base

class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    arn = Column(String, unique=True, index=True)
    service = Column(String)
    resource_type = Column(String)
    region = Column(String)
    name = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())