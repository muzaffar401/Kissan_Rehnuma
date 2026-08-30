"""Voice session models for tracking LiveKit agent sessions."""

import enum
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimestampMixin


class VoiceSessionStatus(str, enum.Enum):
    """Status of a voice agent session."""

    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class VoiceSession(TimestampMixin, Base):
    """Tracks voice agent sessions with LiveKit room information."""

    __tablename__ = "voice_sessions"

    # Python 3.14 compatibility: required fields first, then fields with defaults
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    farmer_id: Mapped[UUID] = mapped_column(index=True)
    provider: Mapped[str] = mapped_column(String(32), default="livekit")
    room_name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    participant_name: Mapped[str] = mapped_column(String(256))
    language: Mapped[str] = mapped_column(String(8), default="ur")
    status: Mapped[VoiceSessionStatus] = mapped_column(
        Enum(VoiceSessionStatus, name="voice_session_status"),
        default=VoiceSessionStatus.PENDING,
        index=True,
    )

    # Timestamps with server defaults - use init=False for Python 3.14 compatibility
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    failure_code: Mapped[str | None] = mapped_column(String(64), default=None)
    metadata_json: Mapped[str | None] = mapped_column(Text, default=None)
    complaint_count: Mapped[int] = mapped_column(Integer, default=0)
