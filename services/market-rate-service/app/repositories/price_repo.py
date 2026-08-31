from datetime import date
from typing import Dict, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.crop import Crop
from app.models.mandi import Mandi
from app.models.price import Price


class PriceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        mandi_id: int,
        crop_id: int,
        price: float,
        recorded_date: date,
        source: str,
    ) -> Price:
        row = Price(
            mandi_id=mandi_id,
            crop_id=crop_id,
            price=price,
            recorded_date=recorded_date,
            source=source,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def latest_for_crop(self, crop_name: str, limit: int = 100) -> List[Price]:
        """Newest price rows for a crop (joins mandi + crop), newest first."""
        return (
            self.db.query(Price)
            .join(Crop, Price.crop_id == Crop.id)
            .filter(Crop.name == crop_name)
            .order_by(Price.recorded_date.desc(), Price.id.desc())
            .limit(limit)
            .all()
        )

    def averages_between(
        self, start: date, end: date
    ) -> Dict[str, float]:
        """Average price per crop within [start, end]."""
        rows = (
            self.db.query(Crop.name, func.avg(Price.price))
            .join(Price, Price.crop_id == Crop.id)
            .filter(Price.recorded_date.between(start, end))
            .group_by(Crop.name)
            .all()
        )
        return {name: float(avg) for name, avg in rows}
