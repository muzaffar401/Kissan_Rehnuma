"""Voice session, complaint, conversation, and audit schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# ── Voice Sessions ────────────────────────────────────────────────────────────

class VoiceSessionItem(BaseModel):
    id: UUID
    farmer_id: UUID
    provider: str
    room_name: str
    participant_name: str
    language: str
    status: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    expires_at: datetime | None = None
    failure_code: str | None = None
    complaint_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class VoiceSessionListResponse(BaseModel):
    total: int
    items: list[VoiceSessionItem]


# ── Complaints ────────────────────────────────────────────────────────────────

class ComplaintItem(BaseModel):
    id: UUID
    reference_number: str
    farmer_id: UUID
    voice_session_id: UUID
    category: str
    description: str
    district: str
    crop: str | None = None
    urgency: str
    status: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class ComplaintListResponse(BaseModel):
    total: int
    items: list[ComplaintItem]


class ComplaintEventItem(BaseModel):
    id: UUID
    complaint_id: UUID
    event_type: str
    previous_status: str | None = None
    new_status: str | None = None
    notes: str | None = None
    created_by: UUID | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ComplaintStatusUpdate(BaseModel):
    status: str
    notes: str | None = None


class FarmerDetail(BaseModel):
    id: int
    name: str
    lastname: str | None = None
    email: str | None = None
    mobile: str | None = None
    city: str | None = None
    country: str | None = None


# ── Conversation Memories ─────────────────────────────────────────────────────

class ConversationItem(BaseModel):
    id: UUID
    farmer_id: UUID
    voice_session_id: UUID
    summary: str
    topics: list = []
    key_points: list = []
    transcript: str | None = None
    turn_count: int = 0
    duration_seconds: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    total: int
    items: list[ConversationItem]


# ── Audit (Tool Executions) ───────────────────────────────────────────────────

class AuditItem(BaseModel):
    id: UUID
    farmer_id: UUID
    voice_session_id: UUID
    tool_name: str
    request_payload: str
    response_payload: str | None = None
    status: str
    error_code: str | None = None
    duration_ms: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditListResponse(BaseModel):
    total: int
    items: list[AuditItem]
