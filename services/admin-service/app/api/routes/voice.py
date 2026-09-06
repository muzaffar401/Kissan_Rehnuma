"""Voice sessions endpoint — reads from voice_agent database."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_admin
from app.db import get_voice_session
from app.schemas.voice import VoiceSessionListResponse, VoiceSessionItem

router = APIRouter(prefix="/voice-sessions", tags=["voice-sessions"])


@router.get("", response_model=VoiceSessionListResponse)
async def list_voice_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: str = Query("", alias="status", description="Filter by status"),
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_voice_session),
):
    """List all voice agent sessions."""
    base = text("voice_sessions")

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
        VoiceSessionItem(
            id=row["id"],
            farmer_id=row["farmer_id"],
            provider=row.get("provider", "livekit"),
            room_name=row["room_name"],
            participant_name=row["participant_name"],
            language=row.get("language", "ur"),
            status=row["status"],
            started_at=row.get("started_at"),
            ended_at=row.get("ended_at"),
            expires_at=row.get("expires_at"),
            failure_code=row.get("failure_code"),
            complaint_count=row.get("complaint_count", 0),
            created_at=row["created_at"],
        )
        for row in rows
    ]

    return VoiceSessionListResponse(total=total, items=items)
