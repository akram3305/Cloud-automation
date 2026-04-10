from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(64), unique=True, index=True, nullable=False)
    email      = Column(String(128), unique=True, nullable=False)
    full_name  = Column(String(128), nullable=False)
    # role: viewer | operator | admin
    role       = Column(String(20), default="operator", nullable=False)
    hashed_pwd = Column(String(256), nullable=False)
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
