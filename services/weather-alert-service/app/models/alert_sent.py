from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from datetime import datetime
from app.db.base import Base


class AlertSent(Base):
    __tablename__ = "alerts_sent"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # No DB-level FK to farmers: that table is owned by user-auth-service.
    farmer_id = Column(Integer, nullable=False, index=True)
    alert_type = Column(String(30), nullable=False)   # frost, heavy_rain, heatwave, high_wind
    message = Column(Text, nullable=False)
    risk_detected = Column(Boolean, default=True)
    status = Column(String(20), default="sent")       # sent, delivered, failed, not_sent
    sent_at = Column(DateTime, default=datetime.utcnow)
