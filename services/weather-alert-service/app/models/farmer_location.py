from sqlalchemy import Column, Integer, Float, ForeignKey
from app.db.base import Base


class FarmerLocation(Base):
    """Field coordinates per farmer, owned by this service.

    The shared `farmers` table (user-auth-service) only stores latitude
    as text, so weather coordinates are registered here instead.
    One row per farmer; upserted via PUT /farmers/{farmer_id}/location.
    """

    __tablename__ = "farmer_locations"

    farmer_id = Column(
        Integer, ForeignKey("farmers.id"), primary_key=True
    )
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
