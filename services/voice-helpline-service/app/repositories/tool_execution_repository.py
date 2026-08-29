from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.complaint import ToolExecution


class ToolExecutionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def add(self, execution: ToolExecution) -> None:
        self.db.add(execution)

    async def get_by_idempotency_key(
        self, farmer_id: UUID, idempotency_key: str
    ) -> ToolExecution | None:
        result = await self.db.execute(
            select(ToolExecution).where(
                ToolExecution.farmer_id == farmer_id,
                ToolExecution.idempotency_key == idempotency_key,
            )
        )
        return result.scalar_one_or_none()
