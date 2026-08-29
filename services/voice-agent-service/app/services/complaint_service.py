"""Complaint business logic service."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus, ComplaintUrgency
from app.repositories.complaint_repository import ComplaintRepository


class ComplaintService:
    """Handles complaint business logic and validation."""

    def __init__(self, session: AsyncSession):
        self.repo = ComplaintRepository(session)
        self.session = session

    async def register_complaint(
        self,
        farmer_id: UUID,
        voice_session_id: UUID,
        category: str,
        description: str,
        district: str,
        crop: str | None = None,
        urgency: str = "normal",
    ) -> Complaint:
        """Register a new complaint with validation.

        Args:
            farmer_id: The farmer's unique identifier.
            voice_session_id: The voice session that created this complaint.
            category: Complaint category (crop_disease, animal_disease, etc.)
            description: Detailed description of the issue.
            district: Farmer's district.
            crop: Crop name if applicable.
            urgency: Priority level (low, normal, high, critical).

        Returns:
            The created Complaint with generated reference_number.

        Raises:
            ValueError: If category or urgency is invalid.
        """
        # Validate category
        try:
            complaint_category = ComplaintCategory(category)
        except ValueError:
            valid = [c.value for c in ComplaintCategory]
            raise ValueError(f"Invalid category '{category}'. Must be one of: {valid}")

        # Validate urgency
        try:
            complaint_urgency = ComplaintUrgency(urgency)
        except ValueError:
            valid = [u.value for u in ComplaintUrgency]
            raise ValueError(f"Invalid urgency '{urgency}'. Must be one of: {valid}")

        complaint = await self.repo.create_complaint(
            farmer_id=farmer_id,
            voice_session_id=voice_session_id,
            category=complaint_category,
            description=description,
            district=district,
            crop=crop,
            urgency=complaint_urgency,
        )

        logger.info(
            "Complaint registered",
            extra={
                "reference_number": complaint.reference_number,
                "farmer_id": str(farmer_id),
                "category": category,
                "district": district,
            },
        )

        return complaint

    async def get_complaint_by_reference(self, reference_number: str) -> Complaint | None:
        """Look up a complaint by reference number."""
        return await self.repo.get_complaint_by_reference(reference_number)

    async def get_farmer_complaints(
        self, farmer_id: UUID, limit: int = 10
    ) -> list[Complaint]:
        """Get recent complaints for a farmer."""
        return await self.repo.get_complaints_by_farmer(farmer_id, limit=limit)

    async def update_complaint_status(
        self, complaint_id: UUID, new_status: str, notes: str | None = None
    ) -> Complaint | None:
        """Update complaint status."""
        try:
            status = ComplaintStatus(new_status)
        except ValueError:
            raise ValueError(f"Invalid status '{new_status}'")
        return await self.repo.update_status(complaint_id, status, notes)
