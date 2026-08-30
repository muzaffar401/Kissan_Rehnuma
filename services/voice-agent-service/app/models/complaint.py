"""Complaint models for tracking farmer issues."""

import enum
from uuid import UUID, uuid4

from sqlalchemy import Enum, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimestampMixin


class ComplaintStatus(str, enum.Enum):
    """Status of a complaint in the system."""

    REGISTERED = "registered"
    IN_REVIEW = "in_review"
    RESOLVED = "resolved"
    CLOSED = "closed"


class ComplaintUrgency(str, enum.Enum):
    """Urgency level of a complaint."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class ComplaintCategory(str, enum.Enum):
    """Category of complaint."""

    CROP_DISEASE = "crop_disease"
    ANIMAL_DISEASE = "animal_disease"
    WEATHER_ALERT = "weather_alert"
    MARKET_RATE = "market_rate"
    GENERAL_INQUIRY = "general_inquiry"


class Complaint(TimestampMixin, Base):
    """Farmer complaint/issue registered through the voice agent."""

    __tablename__ = "complaints"

    # Python 3.14 compatibility: required fields first
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    reference_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    farmer_id: Mapped[UUID] = mapped_column(index=True)
    voice_session_id: Mapped[UUID] = mapped_column(index=True)
    category: Mapped[ComplaintCategory] = mapped_column(
        Enum(ComplaintCategory, name="complaint_category")
    )
    description: Mapped[str] = mapped_column(Text)
    district: Mapped[str] = mapped_column(String(100))

    # Optional fields with defaults
    crop: Mapped[str | None] = mapped_column(String(100), default=None)
    urgency: Mapped[ComplaintUrgency] = mapped_column(
        Enum(ComplaintUrgency, name="complaint_urgency"),
        default=ComplaintUrgency.NORMAL,
    )
    status: Mapped[ComplaintStatus] = mapped_column(
        Enum(ComplaintStatus, name="complaint_status"),
        default=ComplaintStatus.REGISTERED,
        index=True,
    )
    source: Mapped[str] = mapped_column(String(32), default="voice_agent")


class ComplaintEvent(TimestampMixin, Base):
    """Audit trail for complaint status changes."""

    __tablename__ = "complaint_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    complaint_id: Mapped[UUID] = mapped_column(index=True)
    event_type: Mapped[str] = mapped_column(String(64))
    previous_status: Mapped[str | None] = mapped_column(String(32), default=None)
    new_status: Mapped[str | None] = mapped_column(String(32), default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    created_by: Mapped[UUID | None] = mapped_column(default=None)


class ToolExecution(TimestampMixin, Base):
    """Audit log for tool executions during voice sessions."""

    __tablename__ = "tool_executions"
    __table_args__ = (UniqueConstraint("farmer_id", "idempotency_key", name="uq_tool_execution"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    farmer_id: Mapped[UUID] = mapped_column(index=True)
    voice_session_id: Mapped[UUID] = mapped_column(index=True)
    tool_name: Mapped[str] = mapped_column(String(80))
    idempotency_key: Mapped[str] = mapped_column(String(128))
    request_payload: Mapped[str] = mapped_column(Text)  # JSON as string
    response_payload: Mapped[str | None] = mapped_column(Text, default=None)  # JSON as string
    status: Mapped[str] = mapped_column(String(32))
    error_code: Mapped[str | None] = mapped_column(String(80), default=None)
    duration_ms: Mapped[int | None] = mapped_column(Integer, default=None)
