from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.helpline_session import HelplineSession


class SessionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def add(self, session: HelplineSession) -> None:
        self.db.add(session)

    async def get(self, session_id: UUID) -> HelplineSession | None:
        return await self.db.get(HelplineSession, session_id)

    async def get_for_farmer(self, session_id: UUID, farmer_id: UUID) -> HelplineSession | None:
        result = await self.db.execute(
            select(HelplineSession).where(
                HelplineSession.id == session_id, HelplineSession.farmer_id == farmer_id
            )
        )
        return result.scalar_one_or_none()

