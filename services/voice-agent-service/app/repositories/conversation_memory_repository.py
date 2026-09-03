"""Repository for conversation memory CRUD operations."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation_memory import ConversationMemory


class ConversationMemoryRepository:
    """CRUD operations for conversation memories."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_memory(
        self,
        farmer_id: UUID,
        voice_session_id: UUID,
        summary: str,
        topics: list[str] | None = None,
        key_points: list[str] | None = None,
        transcript: str | None = None,
        turn_count: int = 0,
        duration_seconds: int | None = None,
    ) -> ConversationMemory:
        """Create a new conversation memory entry."""
        memory = ConversationMemory(
            farmer_id=farmer_id,
            voice_session_id=voice_session_id,
            summary=summary,
            topics=topics or [],
            key_points=key_points or [],
            transcript=transcript,
            turn_count=turn_count,
            duration_seconds=duration_seconds,
        )
        self.session.add(memory)
        await self.session.commit()
        await self.session.refresh(memory)
        return memory

    async def get_recent_memories(
        self,
        farmer_id: UUID,
        limit: int = 5,
    ) -> list[ConversationMemory]:
        """Get the most recent conversation memories for a farmer.

        Args:
            farmer_id: The farmer's UUID.
            limit: Maximum number of memories to return (default 5).

        Returns:
            List of ConversationMemory objects, most recent first.
        """
        stmt = (
            select(ConversationMemory)
            .where(ConversationMemory.farmer_id == farmer_id)
            .order_by(ConversationMemory.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_memory_count(self, farmer_id: UUID) -> int:
        """Get the total number of memories for a farmer."""
        from sqlalchemy import func
        stmt = (
            select(func.count(ConversationMemory.id))
            .where(ConversationMemory.farmer_id == farmer_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0
