from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.db.database import get_db
from app.schemas.admin import ManualPriceRequest, ManualPriceResponse
from app.services import ingestion, pipeline
from app.services.sources.base import RawPrice

router = APIRouter()


@router.post(
    "/admin/prices",
    response_model=ManualPriceResponse,
    dependencies=[Depends(require_admin)],
)
def add_manual_price(payload: ManualPriceRequest, db: Session = Depends(get_db)):
    """Manual fallback entry — routed through the ingestion layer."""
    raw = [
        RawPrice(
            source="manual",
            raw_crop=payload.crop,
            raw_price=payload.price,
            raw_unit=payload.unit,
            mandi=payload.mandi,
            city=payload.city,
            recorded_date=payload.recorded_date,
        )
    ]
    records = ingestion.standardize(raw)
    if not records:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown crop '{payload.crop}' — add a synonym to the "
                "ingestion layer before storing it."
            ),
        )
    pipeline.store_records(db, records)
    rec = records[0]
    return ManualPriceResponse(
        crop=rec.crop_name, price_per_kg=rec.price_per_kg, mandi=rec.mandi_name
    )


@router.post("/admin/run-pipeline", dependencies=[Depends(require_admin)])
def trigger_pipeline(db: Session = Depends(get_db)):
    """Run fetch -> ingest -> store now (useful for testing the job)."""
    return {"sources": pipeline.run_pipeline(db)}
