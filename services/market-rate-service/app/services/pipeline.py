"""fetch -> ingest -> store pipeline with per-source error isolation.

One failing source is logged and skipped; the others still run.
"""
import logging
from typing import Callable, Dict, List

from sqlalchemy.orm import Session

from app.repositories.crop_repo import CropRepository
from app.repositories.mandi_repo import MandiRepository
from app.repositories.price_repo import PriceRepository
from app.services import ingestion
from app.services.sources import amis, manual, zarai_mandi
from app.services.sources.base import RawPrice

logger = logging.getLogger("market_rate.pipeline")

SOURCES: List[tuple] = [
    ("amis", amis.fetch_from_amis),
    ("zarai_mandi", zarai_mandi.fetch_from_zarai_mandi),
    ("manual", manual.fetch_manual_entry),
]


def store_records(db: Session, records: List[ingestion.StandardPrice]) -> int:
    mandi_repo = MandiRepository(db)
    crop_repo = CropRepository(db)
    price_repo = PriceRepository(db)
    stored = 0
    for rec in records:
        mandi = mandi_repo.get_or_create(rec.mandi_name, rec.city)
        crop = crop_repo.get_or_create(rec.crop_name)
        price_repo.create(
            mandi.id, crop.id, rec.price_per_kg, rec.recorded_date, rec.source
        )
        stored += 1
    return stored


def run_pipeline(db: Session) -> Dict[str, dict]:
    """Run every source; failures are logged, never fatal to the job."""
    results: Dict[str, dict] = {}
    for name, fetcher in SOURCES:
        try:
            raw: List[RawPrice] = fetcher()
            records = ingestion.standardize(raw)
            stored = store_records(db, records)
            results[name] = {"status": "ok", "stored": stored}
            logger.info("Source %s: stored %d record(s)", name, stored)
        except Exception as exc:
            logger.error("Source %s failed (continuing with others): %s", name, exc)
            results[name] = {"status": "failed", "error": str(exc)}
    return results
