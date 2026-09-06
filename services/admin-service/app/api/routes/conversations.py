"""Conversations endpoint — reads from voice_agent database."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_admin
from app.db import get_voice_session
from app.schemas.voice import ConversationListResponse, ConversationItem

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_voice_session),
):
    """List all conversation memory summaries from voice sessions."""
    base = text("conversation_memories")
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
        ConversationItem(
            id=row["id"],
            farmer_id=row["farmer_id"],
            voice_session_id=row["voice_session_id"],
            summary=row["summary"],
            topics=row.get("topics", []),
            key_points=row.get("key_points", []),
            transcript=row.get("transcript"),
            turn_count=row.get("turn_count", 0),
            duration_seconds=row.get("duration_seconds"),
            created_at=row["created_at"],
        )
        for row in rows
    ]

    return ConversationListResponse(total=total, items=items)
