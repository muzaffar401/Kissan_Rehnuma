from datetime import date
from typing import Dict, List, Optional

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
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        fqp_price: Optional[float] = None,
    ) -> Price:
        # Check for existing record (prevent duplicates from re-runs)
        existing = (
            self.db.query(Price)
            .filter(
                Price.mandi_id == mandi_id,
                Price.crop_id == crop_id,
                Price.recorded_date == recorded_date,
            )
            .first()
        )
        if existing:
            # Update with new values
            existing.price = price
            existing.min_price = min_price
            existing.max_price = max_price
            existing.fqp_price = fqp_price
            existing.source = source
            self.db.commit()
            self.db.refresh(existing)
            return existing

        row = Price(
            mandi_id=mandi_id,
            crop_id=crop_id,
            price=price,
            min_price=min_price,
            max_price=max_price,
            fqp_price=fqp_price,
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

    def all_latest(self, limit: int = 200) -> List[dict]:
        """Latest price per crop across all crops (most recent date)."""
        # Get the latest date first
        latest_date = (
            self.db.query(func.max(Price.recorded_date))
            .scalar()
        )
        if not latest_date:
            return []

        rows = (
            self.db.query(
                Crop.name.label("crop_name"),
                Mandi.name.label("mandi_name"),
                Mandi.city.label("city"),
                Price.price,
                Price.min_price,
                Price.max_price,
                Price.fqp_price,
                Price.recorded_date,
                Price.source,
            )
            .join(Crop, Price.crop_id == Crop.id)
            .join(Mandi, Price.mandi_id == Mandi.id)
            .filter(Price.recorded_date == latest_date)
            .order_by(Crop.name)
            .limit(limit)
            .all()
        )
        return [
            {
                "crop_name": r.crop_name,
                "mandi_name": r.mandi_name,
                "city": r.city,
                "price": float(r.price) if r.price else None,
                "min_price": float(r.min_price) if r.min_price else None,
                "max_price": float(r.max_price) if r.max_price else None,
                "fqp_price": float(r.fqp_price) if r.fqp_price else None,
                "recorded_date": r.recorded_date.isoformat() if r.recorded_date else None,
                "source": r.source,
            }
            for r in rows
        ]

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
