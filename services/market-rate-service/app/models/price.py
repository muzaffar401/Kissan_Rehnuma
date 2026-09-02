from sqlalchemy import (
    Column, Integer, Numeric, Date, String, ForeignKey, DateTime
)
from datetime import datetime
from app.db.base import Base


class Price(Base):
    __tablename__ = "prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mandi_id = Column(
        Integer, ForeignKey("mandis.id"), nullable=False, index=True
    )
    crop_id = Column(
        Integer, ForeignKey("crops.id"), nullable=False, index=True
    )
    # Standardized unit: PKR per kg (ingestion converts from Rs/100kg)
    price = Column(Numeric(10, 2), nullable=False)
    min_price = Column(Numeric(10, 2), nullable=True)
    max_price = Column(Numeric(10, 2), nullable=True)
    fqp_price = Column(Numeric(10, 2), nullable=True)
    recorded_date = Column(Date, nullable=False)
    # Which pipeline produced the row: amis / zarai_mandi / manual
    source = Column(String(30), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
