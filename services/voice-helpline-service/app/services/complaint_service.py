from datetime import UTC, datetime
from time import monotonic
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ResourceNotFoundError
from app.models.complaint import Complaint, ComplaintEvent, ComplaintStatus, ToolExecution
from app.models.helpline_session import HelplineSessionStatus
from app.repositories.complaint_repository import ComplaintRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.tool_execution_repository import ToolExecutionRepository
from app.schemas.complaint import ComplaintCreate, ComplaintStatusUpdate


class ComplaintService:
    TOOL_NAME = "register_complaint"

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.complaints = ComplaintRepository(db)
        self.sessions = SessionRepository(db)
        self.executions = ToolExecutionRepository(db)

    async def create(
        self, farmer_id: UUID, payload: ComplaintCreate, idempotency_key: str
    ) -> Complaint:
        existing = await self.executions.get_by_idempotency_key(farmer_id, idempotency_key)
        if existing is not None:
            if existing.status == "succeeded" and existing.response_payload:
                complaint_id = UUID(existing.response_payload["complaint_id"])
                complaint = await self.complaints.get_for_farmer(complaint_id, farmer_id)
                if complaint is not None:
                    return complaint
            raise ConflictError("This idempotency key is already being processed")

        session = await self.sessions.get_for_farmer(payload.helpline_session_id, farmer_id)
        if session is None:
            raise ResourceNotFoundError("Helpline session not found")
        if session.status != HelplineSessionStatus.ACTIVE:
            raise ConflictError("Complaint can only be registered for an active session")

        started = monotonic()
        complaint_id = uuid4()
        complaint = Complaint(
            id=complaint_id,
            reference_number=self._reference_number(complaint_id),
            farmer_id=farmer_id,
            helpline_session_id=payload.helpline_session_id,
            category=payload.category,
            crop=payload.crop,
            description=payload.description,
            district=payload.district,
            urgency=payload.urgency,
            status=ComplaintStatus.REGISTERED,
        )
        execution = ToolExecution(
            farmer_id=farmer_id,
            helpline_session_id=payload.helpline_session_id,
            tool_name=self.TOOL_NAME,
            idempotency_key=idempotency_key,
            request_payload=payload.model_dump(mode="json"),
            response_payload={
                "complaint_id": str(complaint.id),
                "reference_number": complaint.reference_number,
            },
            status="succeeded",
            duration_ms=int((monotonic() - started) * 1000),
        )
        self.complaints.add(complaint)
        self.complaints.add_event(
            ComplaintEvent(
                complaint_id=complaint.id,
                event_type="registered",
                new_status=ComplaintStatus.REGISTERED.value,
                created_by=farmer_id,
            )
        )
        self.executions.add(execution)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            concurrent = await self.executions.get_by_idempotency_key(
                farmer_id, idempotency_key
            )
            if (
                concurrent is None
                or concurrent.status != "succeeded"
                or not concurrent.response_payload
            ):
                raise
            concurrent_complaint = await self.complaints.get_for_farmer(
                UUID(concurrent.response_payload["complaint_id"]), farmer_id
            )
            if concurrent_complaint is None:
                raise
            return concurrent_complaint
        return complaint

    async def get_by_reference(self, reference: str, farmer_id: UUID) -> Complaint:
        complaint = await self.complaints.get_by_reference(reference.upper(), farmer_id)
        if complaint is None:
            raise ResourceNotFoundError("Complaint not found")
        return complaint

    async def list(self, farmer_id: UUID, limit: int, offset: int) -> list[Complaint]:
        return await self.complaints.list_for_farmer(farmer_id, limit, offset)

    async def update_status(
        self, complaint_id: UUID, farmer_id: UUID, payload: ComplaintStatusUpdate
    ) -> Complaint:
        complaint = await self.complaints.get_for_farmer(complaint_id, farmer_id)
        if complaint is None:
            raise ResourceNotFoundError("Complaint not found")
        previous_status = complaint.status
        complaint.status = payload.status
        self.complaints.add_event(
            ComplaintEvent(
                complaint_id=complaint.id,
                event_type="status_changed",
                previous_status=previous_status.value,
                new_status=payload.status.value,
                notes=payload.notes,
                created_by=farmer_id,
            )
        )
        await self.db.commit()
        return complaint

    @staticmethod
    def _reference_number(complaint_id: UUID) -> str:
        return f"KR-{datetime.now(UTC).year}-{complaint_id.hex[:12].upper()}"
