import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AnimalDiseaseLog, ScanStatus
from app.schemas.animal import VisionDiagnosis


class DetectionRepository:
    """Data access for animal_disease_logs.

    Kept deliberately flat — one table, a handful of queries.
    If this grows past ~5 methods, split by concern.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, log: AnimalDiseaseLog) -> AnimalDiseaseLog:
        self._session.add(log)
        await self._session.flush()
        await self._session.refresh(log)
        return log

    async def get_by_id(self, scan_id: uuid.UUID) -> AnimalDiseaseLog | None:
        result = await self._session.execute(
            select(AnimalDiseaseLog).where(AnimalDiseaseLog.id == scan_id)
        )
        return result.scalar_one_or_none()

    async def get_user_history(
        self, user_id: str, limit: int = 20
    ) -> list[AnimalDiseaseLog]:
        result = await self._session.execute(
            select(AnimalDiseaseLog)
            .where(AnimalDiseaseLog.user_id == user_id)
            .order_by(AnimalDiseaseLog.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_all_history(self, limit: int = 50) -> list[AnimalDiseaseLog]:
        result = await self._session.execute(
            select(AnimalDiseaseLog)
            .where(AnimalDiseaseLog.is_animal.is_(True))
            .order_by(AnimalDiseaseLog.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    @staticmethod
    def build_log(
        *,
        image_url: str,
        user_id: str | None,
        language: str,
        diagnosis: VisionDiagnosis | None = None,
        status: ScanStatus = ScanStatus.COMPLETED,
        error_message: str | None = None,
    ) -> AnimalDiseaseLog:
        """Factory: create an AnimalDiseaseLog from a diagnosis result."""
        return AnimalDiseaseLog(
            user_id=user_id,
            image_url=image_url,
            language=language,
            is_animal=diagnosis.is_animal if diagnosis else False,
            animal_type=diagnosis.animal_type if diagnosis else None,
            disease_name=diagnosis.disease_name if diagnosis else None,
            scientific_name=diagnosis.scientific_name if diagnosis else None,
            confidence=diagnosis.confidence if diagnosis else None,
            symptoms=diagnosis.symptoms if diagnosis else None,
            causes=diagnosis.causes if diagnosis else None,
            treatment=diagnosis.treatment_recommendations if diagnosis else None,
            prevention_tips=diagnosis.prevention_tips if diagnosis else None,
            affected_species=diagnosis.affected_species if diagnosis else None,
            status=status,
            error_message=error_message,
        )
