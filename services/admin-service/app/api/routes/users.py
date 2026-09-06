"""Users (farmers) endpoint — reads/writes kissan_auth database."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_admin
from app.db import get_auth_session
from app.schemas.users import (
    FarmerListResponse, FarmerSummary, FarmerUpdate, FarmerStatusToggle,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=FarmerListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", description="Search by name, email, or city"),
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_auth_session),
):
    """List all registered farmers with optional search filter."""
    base_query = text("farmers")

    if search.strip():
        where_clause = text(
            "LOWER(name) LIKE :s OR LOWER(lastname) LIKE :s "
            "OR LOWER(email) LIKE :s OR LOWER(\"City\") LIKE :s OR \"Mobile_Number\" LIKE :s"
        )
        search_param = f"%{search.strip().lower()}%"
        count_q = select(func.count()).select_from(base_query).where(where_clause).params(s=search_param)
        data_q = (
            select(text("*"))
            .select_from(base_query)
            .where(where_clause)
            .params(s=search_param)
            .order_by(text("id DESC"))
            .offset(skip)
            .limit(limit)
        )
    else:
        count_q = select(func.count()).select_from(base_query)
        data_q = (
            select(text("*"))
            .select_from(base_query)
            .order_by(text("id DESC"))
            .offset(skip)
            .limit(limit)
        )

    total = (await db.execute(count_q)).scalar() or 0
    rows = (await db.execute(data_q)).mappings().all()

    items = [
        FarmerSummary(
            id=row["id"],
            name=row["name"],
            lastname=row["lastname"],
            email=row["email"],
            Mobile_Number=row["Mobile_Number"],
            City=row["City"],
            country=row["country"],
            email_verified=row["email_verified"],
            is_active=row.get("is_active", True),
            latitude=row["latitude"],
            longitude=row.get("longitude", 0.0),
        )
        for row in rows
    ]

    return FarmerListResponse(total=total, items=items)


@router.put("/{farmer_id}", response_model=FarmerSummary)
async def update_user(
    farmer_id: int,
    body: FarmerUpdate,
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_auth_session),
):
    """Update a farmer's profile fields."""
    # Build dynamic SET clause from non-None fields
    updates = {}
    for field in ("name", "lastname", "email", "Mobile_Number", "City", "country"):
        val = getattr(body, field, None)
        if val is not None:
            updates[field] = val

    if not updates:
        raise HTTPException(400, "No fields to update")

    # Check farmer exists
    existing = (await db.execute(
        select(text("*")).select_from(text("farmers")).where(text("id = :fid")).params(fid=farmer_id)
    )).mappings().first()

    if not existing:
        raise HTTPException(404, "Farmer not found")

    # Build SET clause — quote column names so PostgreSQL preserves case
    # (e.g. "Mobile_Number" not mobile_number)
    set_parts = []
    for col, val in updates.items():
        set_parts.append(f'"{col}" = :{col}')
    set_clause = ", ".join(set_parts)

    await db.execute(
        text(f"UPDATE farmers SET {set_clause} WHERE id = :fid").bindparams(fid=farmer_id, **updates)
    )
    await db.commit()

    # Return updated farmer
    row = (await db.execute(
        select(text("*")).select_from(text("farmers")).where(text("id = :fid")).params(fid=farmer_id)
    )).mappings().first()

    return FarmerSummary(
        id=row["id"],
        name=row["name"],
        lastname=row["lastname"],
        email=row["email"],
        Mobile_Number=row["Mobile_Number"],
        City=row["City"],
        country=row["country"],
        email_verified=row["email_verified"],
        is_active=row.get("is_active", True),
        latitude=row["latitude"],
        longitude=row.get("longitude", 0.0),
    )


@router.patch("/{farmer_id}/status", response_model=FarmerSummary)
async def toggle_user_status(
    farmer_id: int,
    body: FarmerStatusToggle,
    _admin: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_auth_session),
):
    """Enable or disable a farmer account (soft-delete)."""
    # Check farmer exists
    existing = (await db.execute(
        select(text("*")).select_from(text("farmers")).where(text("id = :fid")).params(fid=farmer_id)
    )).mappings().first()

    if not existing:
        raise HTTPException(404, "Farmer not found")

    await db.execute(
        text("UPDATE farmers SET is_active = :active WHERE id = :fid")
        .bindparams(fid=farmer_id, active=body.is_active)
    )
    await db.commit()

    # Return updated farmer
    row = (await db.execute(
        select(text("*")).select_from(text("farmers")).where(text("id = :fid")).params(fid=farmer_id)
    )).mappings().first()

    return FarmerSummary(
        id=row["id"],
        name=row["name"],
        lastname=row["lastname"],
        email=row["email"],
        Mobile_Number=row["Mobile_Number"],
        City=row["City"],
        country=row["country"],
        email_verified=row["email_verified"],
        is_active=row.get("is_active", True),
        latitude=row["latitude"],
        longitude=row.get("longitude", 0.0),
    )
