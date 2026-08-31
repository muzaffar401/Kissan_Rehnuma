from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.farmer import Farmer


class FarmerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, farmer_id: int) -> Optional[Farmer]:
        return self.db.query(Farmer).filter(Farmer.id == farmer_id).first()

    def get_all(self) -> List[Farmer]:
        return self.db.query(Farmer).all()
