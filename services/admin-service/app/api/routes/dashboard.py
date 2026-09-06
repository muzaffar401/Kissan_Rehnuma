"""Dashboard — aggregate stats from all 4 databases."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text

from app.core.security import get_current_admin
from app.db import get_auth_session, get_crop_session, get_animal_session, get_voice_session
from app.schemas.dashboard import DashboardResponse, TodayStats
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    _admin: str = Depends(get_current_admin),
    auth_db: AsyncSession = Depends(get_auth_session),
    crop_db: AsyncSession = Depends(get_crop_session),
    animal_db: AsyncSession = Depends(get_animal_session),
    voice_db: AsyncSession = Depends(get_voice_session),
):
    """Return aggregate stats for the admin dashboard."""
    # Total counts
    total_farmers = (await auth_db.execute(
        select(func.count()).select_from(text("farmers"))
    )).scalar() or 0

    total_crop_scans = (await crop_db.execute(
        select(func.count()).select_from(text("crop_disease_logs"))
    )).scalar() or 0

    total_animal_scans = (await animal_db.execute(
        select(func.count()).select_from(text("animal_disease_logs"))
    )).scalar() or 0

    total_voice_sessions = (await voice_db.execute(
        select(func.count()).select_from(text("voice_sessions"))
    )).scalar() or 0

    total_complaints = (await voice_db.execute(
        select(func.count()).select_from(text("complaints"))
    )).scalar() or 0

    # Today's counts (UTC date)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Farmers table has no created_at column — skip today's farmer count
    today_farmers = 0

    today_crop = (await crop_db.execute(
        select(func.count()).select_from(text("crop_disease_logs")).where(
            text("created_at >= :t")
        ).params(t=today_start)
    )).scalar() or 0

    today_animal = (await animal_db.execute(
        select(func.count()).select_from(text("animal_disease_logs")).where(
            text("created_at >= :t")
        ).params(t=today_start)
    )).scalar() or 0

    today_voice = (await voice_db.execute(
        select(func.count()).select_from(text("voice_sessions")).where(
            text("created_at >= :t")
        ).params(t=today_start)
    )).scalar() or 0

    today_complaints = (await voice_db.execute(
        select(func.count()).select_from(text("complaints")).where(
            text("created_at >= :t")
        ).params(t=today_start)
    )).scalar() or 0

    return DashboardResponse(
        total_farmers=total_farmers,
        total_crop_scans=total_crop_scans,
        total_animal_scans=total_animal_scans,
        total_voice_sessions=total_voice_sessions,
        total_complaints=total_complaints,
        today=TodayStats(
            new_farmers=today_farmers,
            crop_scans=today_crop,
            animal_scans=today_animal,
            voice_sessions=today_voice,
            complaints=today_complaints,
        ),
    )
