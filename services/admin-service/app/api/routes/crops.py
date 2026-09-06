"""Crop disease scans endpoint — reads from kissan_crop_disease database."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_admin
from app.db import get_crop_session
from app.schemas.scans import ScanListResponse, CropScanItem

router = APIRouter(prefix="/crop-scans", tags=["crop-scans"])


@router.get("", response_model=ScanListResponse)
async def list_crop_scans(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: str = Query("", alias="status", description="Filter by status"),
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_crop_session),
):
    """List all crop disease scan logs."""
    base = text("crop_disease_logs")

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
        CropScanItem(
            id=row["id"],
            image_url=row["image_url"],
            user_id=row.get("user_id"),
            language=row.get("language", "en"),
            is_plant=row.get("is_plant", False),
            disease_name=row.get("disease_name"),
            scientific_name=row.get("scientific_name"),
            confidence=row.get("confidence"),
            crop_type=row.get("crop_type"),
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
