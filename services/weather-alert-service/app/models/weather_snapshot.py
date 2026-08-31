from sqlalchemy import Column, Integer, Float, DateTime, String
from datetime import datetime
from app.db.base import Base


class WeatherSnapshot(Base):
    __tablename__ = "weather_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # No DB-level FK to farmers: that table is owned by user-auth-service.
    # Existence is validated in the API layer.
    farmer_id = Column(Integer, nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=True)
    wind_speed_kmh = Column(Float, nullable=True)
    rain_mm = Column(Float, nullable=True)
    source = Column(String(20), default="api")   # "api" or "cache"
    fetched_at = Column(DateTime, default=datetime.utcnow)
