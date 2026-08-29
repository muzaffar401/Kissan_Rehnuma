from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.helpline_session import HelplineSessionStatus


class SessionCreateRequest(BaseModel):
    language: str = Field(default="ur", pattern=r"^[a-z]{2,3}(?:-[A-Z]{2})?$")


class SessionCreateResponse(BaseModel):
    session_id: UUID
    token: str
    ws_url: str
    room_name: str
    expires_at: datetime


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    farmer_id: UUID
    provider_room_name: str | None
    participant_name: str
    language: str
    status: HelplineSessionStatus
    started_at: datetime | None
    ended_at: datetime | None
    expires_at: datetime | None
    failure_code: str | None
    created_at: datetime

