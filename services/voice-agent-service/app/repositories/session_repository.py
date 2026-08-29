"""Repository for voice session data access."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.voice_session import VoiceSession, VoiceSessionStatus


class SessionRepository:
    """Handles database operations for voice sessions."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_session(
        self,
        farmer_id: UUID,
        room_name: str,
        participant_name: str,
        language: str = "ur",
    ) -> VoiceSession:
        """Create a new voice session."""
        voice_session = VoiceSession(
            farmer_id=farmer_id,
            room_name=room_name,
            participant_name=participant_name,
            language=language,
            status=VoiceSessionStatus.PENDING,
        )
        self.session.add(voice_session)
        await self.session.flush()
        return voice_session

    async def get_session(self, session_id: UUID) -> VoiceSession | None:
        """Get a voice session by ID."""
        result = await self.session.execute(
            select(VoiceSession).where(VoiceSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_session_by_room(self, room_name: str) -> VoiceSession | None:
        """Get a voice session by room name."""
        result = await self.session.execute(
            select(VoiceSession).where(VoiceSession.room_name == room_name)
        )
        return result.scalar_one_or_none()

    async def activate_session(self, session_id: UUID, expires_at: datetime) -> bool:
        """Mark a session as active."""
        result = await self.session.execute(
            update(VoiceSession)
            .where(VoiceSession.id == session_id)
            .values(
                status=VoiceSessionStatus.ACTIVE,
                started_at=datetime.utcnow(),
                expires_at=expires_at,
            )
        )
        await self.session.flush()
        return result.rowcount > 0

    async def complete_session(self, session_id: UUID) -> bool:
        """Mark a session as completed."""
        result = await self.session.execute(
            update(VoiceSession)
            .where(VoiceSession.id == session_id)
            .values(
                status=VoiceSessionStatus.COMPLETED,
                ended_at=datetime.utcnow(),
            )
        )
        await self.session.flush()
        return result.rowcount > 0

    async def fail_session(self, session_id: UUID, failure_code: str) -> bool:
        """Mark a session as failed."""
        result = await self.session.execute(
            update(VoiceSession)
            .where(VoiceSession.id == session_id)
            .values(
                status=VoiceSessionStatus.FAILED,
                ended_at=datetime.utcnow(),
                failure_code=failure_code,
            )
        )
        await self.session.flush()
        return result.rowcount > 0

    async def increment_complaint_count(self, session_id: UUID) -> bool:
        """Increment the complaint count for a session."""
        result = await self.session.execute(
            update(VoiceSession)
            .where(VoiceSession.id == session_id)
            .values(complaint_count=VoiceSession.complaint_count + 1)
        )
        await self.session.flush()
        return result.rowcount > 0

    async def get_active_sessions_by_farmer(self, farmer_id: UUID) -> list[VoiceSession]:
        """Get all active sessions for a farmer."""
        result = await self.session.execute(
            select(VoiceSession).where(
                VoiceSession.farmer_id == farmer_id,
                VoiceSession.status == VoiceSessionStatus.ACTIVE,
            )
        )
        return list(result.scalars().all())
