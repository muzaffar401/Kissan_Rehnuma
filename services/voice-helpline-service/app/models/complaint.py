import enum
from uuid import UUID, uuid4

from sqlalchemy import Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ComplaintStatus(str, enum.Enum):
    REGISTERED = "registered"
    IN_REVIEW = "in_review"
    RESOLVED = "resolved"
    CLOSED = "closed"


class ComplaintUrgency(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class Complaint(TimestampMixin, Base):
    __tablename__ = "complaints"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    reference_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    farmer_id: Mapped[UUID] = mapped_column(index=True)
    helpline_session_id: Mapped[UUID] = mapped_column(
        ForeignKey("helpline_sessions.id", ondelete="RESTRICT"), index=True
    )
    category: Mapped[str] = mapped_column(String(64))
    crop: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    district: Mapped[str | None] = mapped_column(String(100))
    urgency: Mapped[ComplaintUrgency] = mapped_column(
        Enum(ComplaintUrgency, name="complaint_urgency")
    )
    status: Mapped[ComplaintStatus] = mapped_column(
        Enum(ComplaintStatus, name="complaint_status"),
        default=ComplaintStatus.REGISTERED,
        index=True,
    )
    source: Mapped[str] = mapped_column(String(32), default="voice_assistant")


class ComplaintEvent(TimestampMixin, Base):
    __tablename__ = "complaint_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    complaint_id: Mapped[UUID] = mapped_column(
        ForeignKey("complaints.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(64))
    previous_status: Mapped[str | None] = mapped_column(String(32))
    new_status: Mapped[str | None] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID | None]


class ToolExecution(TimestampMixin, Base):
    __tablename__ = "tool_executions"
    __table_args__ = (UniqueConstraint("farmer_id", "idempotency_key"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    farmer_id: Mapped[UUID] = mapped_column(index=True)
    helpline_session_id: Mapped[UUID] = mapped_column(
        ForeignKey("helpline_sessions.id", ondelete="CASCADE"), index=True
    )
    tool_name: Mapped[str] = mapped_column(String(80))
    idempotency_key: Mapped[str] = mapped_column(String(128))
    request_payload: Mapped[dict] = mapped_column(JSON)
    response_payload: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32))
    error_code: Mapped[str | None] = mapped_column(String(80))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
