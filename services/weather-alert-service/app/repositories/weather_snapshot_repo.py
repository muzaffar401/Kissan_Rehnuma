from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.weather_snapshot import WeatherSnapshot


class WeatherSnapshotRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_latest(self, farmer_id: int) -> Optional[WeatherSnapshot]:
        return (
            self.db.query(WeatherSnapshot)
            .filter(WeatherSnapshot.farmer_id == farmer_id)
            .order_by(WeatherSnapshot.fetched_at.desc())
            .first()
        )

    def get_fresh(self, farmer_id: int, since: datetime) -> Optional[WeatherSnapshot]:
        """Latest snapshot that is younger than `since` (i.e. still cache-valid)."""
        return (
            self.db.query(WeatherSnapshot)
            .filter(
                WeatherSnapshot.farmer_id == farmer_id,
                WeatherSnapshot.fetched_at >= since,
            )
            .order_by(WeatherSnapshot.fetched_at.desc())
            .first()
        )

    def create(self, snapshot: WeatherSnapshot) -> WeatherSnapshot:
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def list_for_farmer(
        self, farmer_id: int, limit: int = 100
    ) -> List[WeatherSnapshot]:
        return (
            self.db.query(WeatherSnapshot)
            .filter(WeatherSnapshot.farmer_id == farmer_id)
            .order_by(WeatherSnapshot.fetched_at.desc())
            .limit(limit)
            .all()
        )
