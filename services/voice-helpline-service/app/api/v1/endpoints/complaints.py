from typing import Annotated
from fastapi import APIRouter, Header, Query, status

from app.api.dependencies import AuthenticatedUser, DatabaseSession
from app.schemas.complaint import (
    ComplaintCreate,
    ComplaintList,
    ComplaintRead,
)
from app.services.complaint_service import ComplaintService

router = APIRouter()


@router.post("", response_model=ComplaintRead, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    payload: ComplaintCreate,
    user: AuthenticatedUser,
    db: DatabaseSession,
    idempotency_key: Annotated[
        str, Header(alias="Idempotency-Key", min_length=8, max_length=128)
    ],
) -> ComplaintRead:
    complaint = await ComplaintService(db).create(user.id, payload, idempotency_key)
    return ComplaintRead.model_validate(complaint)


@router.get("", response_model=ComplaintList)
async def list_complaints(
    user: AuthenticatedUser,
    db: DatabaseSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ComplaintList:
    items = await ComplaintService(db).list(user.id, limit, offset)
    return ComplaintList(
        items=[ComplaintRead.model_validate(item) for item in items], limit=limit, offset=offset
    )


@router.get("/{reference_number}", response_model=ComplaintRead)
async def get_complaint(
    reference_number: str, user: AuthenticatedUser, db: DatabaseSession
) -> ComplaintRead:
    complaint = await ComplaintService(db).get_by_reference(reference_number, user.id)
    return ComplaintRead.model_validate(complaint)
