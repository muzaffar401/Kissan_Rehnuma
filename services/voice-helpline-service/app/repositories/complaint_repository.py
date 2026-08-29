from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.complaint import Complaint, ComplaintEvent


class ComplaintRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def add(self, complaint: Complaint) -> None:
        self.db.add(complaint)

    def add_event(self, event: ComplaintEvent) -> None:
        self.db.add(event)

    async def get_for_farmer(self, complaint_id: UUID, farmer_id: UUID) -> Complaint | None:
        result = await self.db.execute(
            select(Complaint).where(Complaint.id == complaint_id, Complaint.farmer_id == farmer_id)
        )
        return result.scalar_one_or_none()

    async def get_by_reference(self, reference: str, farmer_id: UUID) -> Complaint | None:
        result = await self.db.execute(
            select(Complaint).where(
                Complaint.reference_number == reference, Complaint.farmer_id == farmer_id
            )
        )
        return result.scalar_one_or_none()

    async def list_for_farmer(self, farmer_id: UUID, limit: int, offset: int) -> list[Complaint]:
        result = await self.db.execute(
            select(Complaint)
            .where(Complaint.farmer_id == farmer_id)
            .order_by(Complaint.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars())

