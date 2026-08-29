from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.uplift.client import UpliftClient
from app.clients.uplift.exceptions import UpliftClientError
from app.core.config import Settings
from app.core.exceptions import ResourceNotFoundError, UpstreamUnavailableError
from app.models.helpline_session import HelplineSession, HelplineSessionStatus
from app.repositories.session_repository import SessionRepository
from app.schemas.session import SessionCreateResponse


class HelplineSessionService:
    def __init__(
        self,
        db: AsyncSession,
        uplift: UpliftClient | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.db = db
        self.uplift = uplift
        self.settings = settings
        self.sessions = SessionRepository(db)

    async def create(
        self, farmer_id: UUID, participant_name: str, language: str
    ) -> SessionCreateResponse:
        if self.uplift is None or self.settings is None:
            raise RuntimeError("Uplift client and settings are required to create a session")
        record = HelplineSession(
            farmer_id=farmer_id,
            participant_name=participant_name,
            language=language,
            status=HelplineSessionStatus.PENDING,
        )
        self.sessions.add(record)
        await self.db.commit()

        try:
            upstream = await self.uplift.create_session(participant_name)
        except UpliftClientError as exc:
            record.status = HelplineSessionStatus.FAILED
            record.failure_code = exc.code
            await self.db.commit()
            raise UpstreamUnavailableError("Voice assistant session could not be created") from exc

        now = datetime.now(UTC)
        record.provider_room_name = upstream.room_name
        record.status = HelplineSessionStatus.ACTIVE
        record.started_at = now
        record.expires_at = now + timedelta(seconds=self.settings.uplift_session_ttl_seconds)
        await self.db.commit()

        return SessionCreateResponse(
            session_id=record.id,
            token=upstream.token,
            ws_url=upstream.ws_url,
            room_name=upstream.room_name,
            expires_at=record.expires_at,
        )

    async def get(self, session_id: UUID, farmer_id: UUID) -> HelplineSession:
        record = await self.sessions.get_for_farmer(session_id, farmer_id)
        if record is None:
            raise ResourceNotFoundError("Helpline session not found")
        return record

    async def end(self, session_id: UUID, farmer_id: UUID) -> HelplineSession:
        record = await self.get(session_id, farmer_id)
        if record.status in {HelplineSessionStatus.PENDING, HelplineSessionStatus.ACTIVE}:
            record.status = HelplineSessionStatus.COMPLETED
            record.ended_at = datetime.now(UTC)
            await self.db.commit()
        return record
