from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import (
    AppSettings,
    AuthenticatedUser,
    DatabaseSession,
    UpliftDependency,
)
from app.schemas.session import SessionCreateRequest, SessionCreateResponse, SessionRead
from app.services.helpline_session_service import HelplineSessionService

router = APIRouter()


@router.post("", response_model=SessionCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreateRequest,
    user: AuthenticatedUser,
    db: DatabaseSession,
    uplift: UpliftDependency,
    settings: AppSettings,
) -> SessionCreateResponse:
    return await HelplineSessionService(db, uplift, settings).create(
        farmer_id=user.id, participant_name=user.name, language=payload.language
    )


@router.get("/{session_id}", response_model=SessionRead)
async def get_session(
    session_id: UUID, user: AuthenticatedUser, db: DatabaseSession
) -> SessionRead:
    record = await HelplineSessionService(db).get(session_id, user.id)
    return SessionRead.model_validate(record)


@router.post("/{session_id}/end", response_model=SessionRead)
async def end_session(
    session_id: UUID, user: AuthenticatedUser, db: DatabaseSession
) -> SessionRead:
    record = await HelplineSessionService(db).end(session_id, user.id)
    return SessionRead.model_validate(record)
