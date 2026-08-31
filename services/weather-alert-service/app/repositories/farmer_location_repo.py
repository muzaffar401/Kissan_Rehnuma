from typing import Optional

from sqlalchemy.orm import Session

from app.models.farmer_location import FarmerLocation


class FarmerLocationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, farmer_id: int) -> Optional[FarmerLocation]:
        return (
            self.db.query(FarmerLocation)
            .filter(FarmerLocation.farmer_id == farmer_id)
            .first()
        )

    def upsert(self, farmer_id: int, latitude: float, longitude: float) -> FarmerLocation:
        location = self.get(farmer_id)
        if location is None:
            location = FarmerLocation(
                farmer_id=farmer_id, latitude=latitude, longitude=longitude
            )
            self.db.add(location)
        else:
            location.latitude = latitude
            location.longitude = longitude
        self.db.commit()
        self.db.refresh(location)
        return location
