from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base


class CloudCredential(Base):
    __tablename__ = "cloud_credentials"

    id        = Column(Integer, primary_key=True, index=True)
    provider  = Column(String(32),   nullable=False)   # aws | azure | gcp
    key_name  = Column(String(128),  nullable=False)   # e.g. AWS_ACCESS_KEY_ID
    value_enc = Column(String(8192))                   # base64-encoded value
    label     = Column(String(256))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
