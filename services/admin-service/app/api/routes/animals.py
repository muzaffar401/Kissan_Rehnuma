"""Animal disease scans endpoint — reads from kissan_animal_disease database."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_admin
from app.db import get_animal_session
from app.schemas.scans import ScanListResponse, AnimalScanItem

router = APIRouter(prefix="/animal-scans", tags=["animal-scans"])


@router.get("", response_model=ScanListResponse)
async def list_animal_scans(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: str = Query("", alias="status", description="Filter by status"),
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_animal_session),
):
    """List all animal disease scan logs."""
    base = text("animal_disease_logs")

    if status_filter.strip():
        where = text("status = :st")
        count_q = select(func.count()).select_from(base).where(where).params(st=status_filter)
        data_q = (
            select(text("*"))
            .select_from(base)
            .where(where)
            .params(st=status_filter)
            .order_by(text("created_at DESC"))
            .offset(skip)
            .limit(limit)
        )
    else:
        count_q = select(func.count()).select_from(base)
        data_q = (
            select(text("*"))
            .select_from(base)
            .order_by(text("created_at DESC"))
            .offset(skip)
            .limit(limit)
        )

    total = (await db.execute(count_q)).scalar() or 0
    rows = (await db.execute(data_q)).mappings().all()

    items = [
        AnimalScanItem(
            id=row["id"],
            image_url=row["image_url"],
            user_id=row.get("user_id"),
            language=row.get("language", "en"),
            is_animal=row.get("is_animal", False),
            animal_type=row.get("animal_type"),
            disease_name=row.get("disease_name"),
            scientific_name=row.get("scientific_name"),
            confidence=row.get("confidence"),
            symptoms=row.get("symptoms"),
            causes=row.get("causes"),
            treatment=row.get("treatment"),
            status=row["status"],
            error_message=row.get("error_message"),
            created_at=row["created_at"],
        )
        for row in rows
    ]

    return ScanListResponse(total=total, items=items)
