"""Complaints endpoint — reads/writes voice_agent database, reads kissan_auth for farmer info."""

import uuid as _uuid_mod
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_admin
from app.db import get_voice_session, get_auth_session
from app.schemas.voice import (
    ComplaintListResponse, ComplaintItem, ComplaintEventItem,
    ComplaintStatusUpdate, FarmerDetail,
)

router = APIRouter(prefix="/complaints", tags=["complaints"])

# DB enum values are UPPERCASE; frontend uses lowercase.
_STATUS_MAP = {
    "registered": "REGISTERED",
    "in_review": "IN_REVIEW",
    "resolved": "RESOLVED",
    "closed": "CLOSED",
}
_CATEGORY_MAP = {
    "crop_disease": "CROP_DISEASE",
    "animal_disease": "ANIMAL_DISEASE",
    "weather_alert": "WEATHER_ALERT",
    "market_rate": "MARKET_RATE",
    "general_inquiry": "GENERAL_INQUIRY",
}
_VALID_LOWER = set(_STATUS_MAP.keys())


def _uuid_to_int(uid: str) -> int:
    """Extract the integer from a UUID like 00000000-0000-0000-0000-000000000002."""
    try:
        return int(_uuid_mod.UUID(uid))
    except (ValueError, AttributeError):
        return int(uid)


@router.get("", response_model=ComplaintListResponse)
async def list_complaints(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: str = Query("", alias="status", description="Filter by status"),
    category_filter: str = Query("", alias="category", description="Filter by category"),
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_voice_session),
):
    """List all complaints registered through voice agent."""
    base = text("complaints")
    conditions = []
    params = {}

    if status_filter.strip():
        # Frontend sends lowercase; DB enum is UPPERCASE
        db_val = _STATUS_MAP.get(status_filter.strip().lower(), status_filter.strip().upper())
        conditions.append("status = CAST(:st AS complaint_status)")
        params["st"] = db_val
    if category_filter.strip():
        db_val = _CATEGORY_MAP.get(category_filter.strip().lower(), category_filter.strip().upper())
        conditions.append("category = CAST(:cat AS complaint_category)")
        params["cat"] = db_val

    where = text(" AND ".join(conditions)) if conditions else None

    if where:
        count_q = select(func.count()).select_from(base).where(where).params(**params)
        data_q = (
            select(text("*"))
            .select_from(base)
            .where(where)
            .params(**params)
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
        ComplaintItem(
            id=row["id"],
            reference_number=row["reference_number"],
            farmer_id=row["farmer_id"],
            voice_session_id=row["voice_session_id"],
            category=row["category"].lower() if row["category"] else row["category"],
            description=row["description"],
            district=row["district"],
            crop=row.get("crop"),
            urgency=(row.get("urgency") or "normal").lower(),
            status=row["status"].lower() if row["status"] else row["status"],
            source=row.get("source", "voice_agent"),
            created_at=row["created_at"],
        )
        for row in rows
    ]

    return ComplaintListResponse(total=total, items=items)


@router.get("/{complaint_id}/events")
async def get_complaint_events(
    complaint_id: str,
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_voice_session),
):
    """Get audit trail (status change events) for a specific complaint."""
    # Pass uuid.UUID object so asyncpg sends it as a proper UUID type
    cid_uuid = _uuid_mod.UUID(complaint_id)
    q = (
        select(text("*"))
        .select_from(text("complaint_events"))
        .where(text("complaint_id = :cid"))
        .params(cid=cid_uuid)
        .order_by(text("created_at ASC"))
    )
    rows = (await db.execute(q)).mappings().all()
    return [
        ComplaintEventItem(
            id=row["id"],
            complaint_id=row["complaint_id"],
            event_type=row["event_type"],
            previous_status=row["previous_status"].lower() if row.get("previous_status") else None,
            new_status=row["new_status"].lower() if row.get("new_status") else None,
            notes=row.get("notes"),
            created_by=row.get("created_by"),
            created_at=row["created_at"],
        )
        for row in rows
    ]


@router.patch("/{complaint_id}/status")
async def update_complaint_status(
    complaint_id: str,
    body: ComplaintStatusUpdate,
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_voice_session),
):
    """Update complaint status and record an audit event."""
    if body.status not in _VALID_LOWER:
        raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(sorted(_VALID_LOWER))}")

    cid_uuid = _uuid_mod.UUID(complaint_id)

    # Fetch current complaint
    row = (await db.execute(
        select(text("*"))
        .select_from(text("complaints"))
        .where(text("id = :cid"))
        .params(cid=cid_uuid)
    )).mappings().first()

    if not row:
        raise HTTPException(404, "Complaint not found")

    previous_status_db = row["status"]  # UPPERCASE from DB enum
    new_status_db = _STATUS_MAP[body.status]  # convert lowercase -> UPPERCASE

    # Compare using lowercase for consistency
    prev_lower = previous_status_db.lower() if previous_status_db else ""
    if prev_lower == body.status:
        raise HTTPException(400, "Status is already set to this value")

    # Update the complaint status — CAST string to enum type
    await db.execute(
        text("UPDATE complaints SET status = CAST(:st AS complaint_status), updated_at = now() WHERE id = :cid")
        .bindparams(st=new_status_db, cid=cid_uuid)
    )

    # Insert audit event
    event_id = _uuid_mod.uuid4()
    await db.execute(
        text(
            "INSERT INTO complaint_events (id, complaint_id, event_type, previous_status, new_status, notes, created_at, updated_at) "
            "VALUES (:eid, :cid, 'status_change', CAST(:prev AS complaint_status), CAST(:new AS complaint_status), :notes, now(), now())"
        ).bindparams(
            eid=event_id, cid=cid_uuid,
            prev=previous_status_db, new=new_status_db,
            notes=body.notes or "",
        )
    )
    await db.commit()

    return {"ok": True, "previous_status": prev_lower, "new_status": body.status}


@router.get("/farmer/{farmer_id}", response_model=FarmerDetail)
async def get_farmer_detail(
    farmer_id: str,
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_auth_session),
):
    """Look up farmer name/email/phone from kissan_auth database.

    The complaints table stores farmer_id as a UUID (e.g. 00000000-...-000000000002)
    but the farmers table uses an integer primary key.  Extract the integer portion
    so the lookup works.
    """
    farmer_int = _uuid_to_int(farmer_id)

    row = (await db.execute(
        text(
            "SELECT id, name, lastname, email, \"Mobile_Number\", \"City\", country "
            "FROM farmers WHERE id = :fid"
        ).bindparams(fid=farmer_int)
    )).mappings().first()

    if not row:
        raise HTTPException(404, "Farmer not found")

    return FarmerDetail(
        id=row["id"],
        name=row["name"],
        lastname=row.get("lastname"),
        email=row.get("email"),
        mobile=row.get("Mobile_Number"),
        city=row.get("City"),
        country=row.get("country"),
    )
