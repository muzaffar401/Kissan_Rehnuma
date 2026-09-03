"""Conversation memory model for cross-session farmer memory.

Stores summaries of past voice sessions so the agent can recall
what the farmer discussed in previous calls.
"""

import enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimestampMixin


class MemoryTopic(str, enum.Enum):
    """Topics that can be discussed in a voice session."""

    WEATHER = "weather"
    MARKET_RATE = "market_rate"
    CROP_DISEASE = "crop_disease"
    ANIMAL_DISEASE = "animal_disease"
    COMPLAINT = "complaint"
    GENERAL = "general"


class ConversationMemory(TimestampMixin, Base):
    """Summary of a past voice session for a farmer.

    After each voice session ends, the agent extracts a summary of what
    was discussed and stores it here. On the next call, the agent loads
    recent memories to provide continuity.
    """

    __tablename__ = "conversation_memories"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    farmer_id: Mapped[UUID] = mapped_column(index=True)
    voice_session_id: Mapped[UUID] = mapped_column(index=True)

    # LLM-generated summary of the conversation (in Urdu)
    summary: Mapped[str] = mapped_column(Text)

    # Topics discussed in this session
    topics: Mapped[list] = mapped_column(
        JSONB, default=list
    )

    # Key points / facts discussed (e.g., "gandum ka rate 1500 hai")
    key_points: Mapped[list] = mapped_column(
        JSONB, default=list
    )

    # Full transcript (optional, for debugging)
    transcript: Mapped[str | None] = mapped_column(Text, default=None)

    # Number of turns in the conversation
    turn_count: Mapped[int] = mapped_column(Integer, default=0)

    # Session duration in seconds
    duration_seconds: Mapped[int | None] = mapped_column(Integer, default=None)
