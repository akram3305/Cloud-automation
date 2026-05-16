from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class GcpCostSnapshot(Base):
    """Daily cost snapshot per GCP project — built up over time for trend charts."""
    __tablename__ = "gcp_cost_snapshots"

    id            = Column(Integer, primary_key=True, index=True)
    project_id    = Column(String(128), nullable=False, index=True)
    snapshot_date = Column(String(10),  nullable=False)   # YYYY-MM-DD
    compute_cost  = Column(Float, default=0.0)
    storage_cost  = Column(Float, default=0.0)
    network_cost  = Column(Float, default=0.0)
    total_cost    = Column(Float, default=0.0)
    instance_count = Column(Integer, default=0)
    running_count  = Column(Integer, default=0)
    resource_json  = Column(Text)                         # optional JSON detail
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
