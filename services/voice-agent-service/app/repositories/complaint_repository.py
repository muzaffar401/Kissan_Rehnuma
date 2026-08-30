"""Repository for complaint data access."""

import json
import uuid
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.complaint import (
    Complaint,
    ComplaintCategory,
    ComplaintEvent,
    ComplaintStatus,
    ComplaintUrgency,
    ToolExecution,
)


class ComplaintRepository:
    """Handles database operations for complaints."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_complaint(
        self,
        farmer_id: UUID,
        voice_session_id: UUID,
        category: ComplaintCategory,
        description: str,
        district: str,
        crop: str | None = None,
        urgency: ComplaintUrgency = ComplaintUrgency.NORMAL,
    ) -> Complaint:
        """Create a new complaint."""
        complaint = Complaint(
            farmer_id=farmer_id,
            voice_session_id=voice_session_id,
            category=category,
            description=description,
            district=district,
            crop=crop,
            urgency=urgency,
            status=ComplaintStatus.REGISTERED,
            reference_number=self._generate_reference_number(),
        )
        self.session.add(complaint)
        await self.session.flush()

        # Create initial event
        event = ComplaintEvent(
            complaint_id=complaint.id,
            event_type="created",
            new_status=ComplaintStatus.REGISTERED.value,
            notes="Complaint registered via voice agent",
        )
        self.session.add(event)
        await self.session.flush()

        return complaint

    async def get_complaint_by_reference(self, reference_number: str) -> Complaint | None:
        """Get complaint by reference number."""
        result = await self.session.execute(
            select(Complaint).where(Complaint.reference_number == reference_number)
        )
        return result.scalar_one_or_none()

    async def get_complaints_by_farmer(
        self, farmer_id: UUID, limit: int = 10, offset: int = 0
    ) -> list[Complaint]:
        """Get complaints for a farmer."""
        result = await self.session.execute(
            select(Complaint)
            .where(Complaint.farmer_id == farmer_id)
            .order_by(Complaint.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def update_status(
        self, complaint_id: UUID, new_status: ComplaintStatus, notes: str | None = None
    ) -> Complaint | None:
        """Update complaint status."""
        result = await self.session.execute(select(Complaint).where(Complaint.id == complaint_id))
        complaint = result.scalar_one_or_none()
        if not complaint:
            return None

        previous_status = complaint.status
        complaint.status = new_status

        event = ComplaintEvent(
            complaint_id=complaint_id,
            event_type="status_change",
            previous_status=previous_status.value,
            new_status=new_status.value,
            notes=notes,
        )
        self.session.add(event)
        await self.session.flush()

        return complaint

    async def log_tool_execution(
        self,
        farmer_id: UUID,
        voice_session_id: UUID,
        tool_name: str,
        idempotency_key: str,
        request_payload: dict,
        status: str,
        response_payload: dict | None = None,
        error_code: str | None = None,
        duration_ms: int | None = None,
    ) -> ToolExecution:
        """Log a tool execution."""
        execution = ToolExecution(
            farmer_id=farmer_id,
            voice_session_id=voice_session_id,
            tool_name=tool_name,
            idempotency_key=idempotency_key,
            request_payload=json.dumps(request_payload),
            response_payload=json.dumps(response_payload) if response_payload else None,
            status=status,
            error_code=error_code,
            duration_ms=duration_ms,
        )
        self.session.add(execution)
        await self.session.flush()
        return execution

    async def check_idempotency(self, farmer_id: UUID, idempotency_key: str) -> bool:
        """Check if a tool execution with this idempotency key already exists."""
        result = await self.session.execute(
            select(ToolExecution).where(
                ToolExecution.farmer_id == farmer_id,
                ToolExecution.idempotency_key == idempotency_key,
            )
        )
        return result.scalar_one_or_none() is not None

    def _generate_reference_number(self) -> str:
        """Generate a unique reference number for a complaint."""
        year = datetime.now().year
        random_part = uuid.uuid4().hex[:12]
        return f"KR-{year}-{random_part}"
