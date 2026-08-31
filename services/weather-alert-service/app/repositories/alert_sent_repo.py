from typing import List

from sqlalchemy.orm import Session

from app.models.alert_sent import AlertSent


class AlertSentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, alert: AlertSent) -> AlertSent:
        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)
        return alert

    def get_history(self, farmer_id: int, limit: int = 100) -> List[AlertSent]:
        return (
            self.db.query(AlertSent)
            .filter(AlertSent.farmer_id == farmer_id)
            .order_by(AlertSent.sent_at.desc())
            .limit(limit)
            .all()
        )
