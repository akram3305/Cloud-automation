from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class AwsSshKey(Base):
    __tablename__ = "aws_ssh_keys"

    id          = Column(Integer, primary_key=True, index=True)
    key_name    = Column(String(128), nullable=False, index=True, unique=True)
    region      = Column(String(64),  nullable=False, default="ap-south-1")
    private_key = Column(Text,        nullable=False)
    filename    = Column(String(256), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
