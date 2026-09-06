"""Audit endpoint — reads tool_executions from voice_agent database."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_admin
from app.db import get_voice_session
from app.schemas.voice import AuditListResponse, AuditItem

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=AuditListResponse)
async def list_audit_log(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tool_name: str = Query("", description="Filter by tool name"),
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_voice_session),
):
    """List all tool execution audit logs."""
    base = text("tool_executions")

    if tool_name.strip():
        where = text("tool_name = :tn")
        count_q = select(func.count()).select_from(base).where(where).params(tn=tool_name)
        data_q = (
            select(text("*"))
            .select_from(base)
            .where(where)
            .params(tn=tool_name)
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
        AuditItem(
            id=row["id"],
            farmer_id=row["farmer_id"],
            voice_session_id=row["voice_session_id"],
            tool_name=row["tool_name"],
            request_payload=row["request_payload"],
            response_payload=row.get("response_payload"),
            status=row["status"],
            error_code=row.get("error_code"),
            duration_ms=row.get("duration_ms"),
            created_at=row["created_at"],
        )
        for row in rows
    ]

    return AuditListResponse(total=total, items=items)
