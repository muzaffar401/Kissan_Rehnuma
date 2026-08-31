from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.repositories.alert_sent_repo import AlertSentRepository
from app.repositories.farmer_repo import FarmerRepository
from app.schemas.alert import (
    AlertHistoryItem,
    AlertHistoryResponse,
    TriggerCheckRequest,
    TriggerCheckResponse,
)
from app.services.alert_service import check_farmer

router = APIRouter()


@router.post("/alerts/trigger-check")
def trigger_alert_check(
    payload: TriggerCheckRequest, db: Session = Depends(get_db)
):
    farmer_repo = FarmerRepository(db)

    if payload.farmer_id is not None:
        farmer = farmer_repo.get_by_id(payload.farmer_id)
        if not farmer:
            raise HTTPException(status_code=404, detail="Farmer not found")
        return check_farmer(db, farmer)

    # No farmer_id -> run for all farmers
    results: List[TriggerCheckResponse] = [
        check_farmer(db, farmer) for farmer in farmer_repo.get_all()
    ]
    return results


@router.get("/alerts/history/{farmer_id}", response_model=AlertHistoryResponse)
def get_alert_history(farmer_id: int, db: Session = Depends(get_db)):
    farmer = FarmerRepository(db).get_by_id(farmer_id)
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    alerts = AlertSentRepository(db).get_history(farmer_id)
    return AlertHistoryResponse(
        farmer_id=farmer_id,
        alerts=[
            AlertHistoryItem(
                alert_type=a.alert_type,
                message=a.message,
                sent_at=a.sent_at,
                status=a.status,
            )
            for a in alerts
        ],
    )
