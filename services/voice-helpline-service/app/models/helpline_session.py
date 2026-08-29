import enum
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class HelplineSessionStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class HelplineSession(TimestampMixin, Base):
    __tablename__ = "helpline_sessions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    farmer_id: Mapped[UUID] = mapped_column(index=True)
    provider: Mapped[str] = mapped_column(String(32), default="upliftai")
    provider_room_name: Mapped[str | None] = mapped_column(String(255), unique=True)
    participant_name: Mapped[str] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(16), default="ur")
    status: Mapped[HelplineSessionStatus] = mapped_column(
        Enum(HelplineSessionStatus, name="helpline_session_status"),
        default=HelplineSessionStatus.PENDING,
        index=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_code: Mapped[str | None] = mapped_column(String(80))

