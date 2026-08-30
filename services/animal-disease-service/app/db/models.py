import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, String, Text, text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScanStatus(str, enum.Enum):
    COMPLETED = "completed"
    LOW_CONFIDENCE = "low_confidence"
    NOT_AN_ANIMAL = "not_an_animal"
    FAILED = "failed"


class AnimalDiseaseLog(Base):
    """Persists every scan result — successful or not.

    This table is the audit trail for the detection pipeline and
    the future training data source for a custom CV model.
    """

    __tablename__ = "animal_disease_logs"

    # ── Primary key (server-generated, excluded from __init__) ──
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        init=False,
    )

    # ── Required fields (no defaults — must come first) ─────────
    image_url: Mapped[str] = mapped_column(Text, nullable=False)

    # ── Optional fields (all have defaults) ─────────────────────
    user_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True, default=None
    )
    language: Mapped[str] = mapped_column(String(5), nullable=False, default="en")

    # ── Detection results ────────────────────────────────────────
    is_animal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    animal_type: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    disease_name: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    scientific_name: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)

    # ── Rich diagnostic fields ──────────────────────────────────
    symptoms: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    causes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    treatment: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    prevention_tips: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    affected_species: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    # ── Metadata ─────────────────────────────────────────────────
    status: Mapped[ScanStatus] = mapped_column(
        Enum(ScanStatus, name="animal_scan_status"),
        nullable=False,
        default=ScanStatus.COMPLETED,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        init=False,
    )
