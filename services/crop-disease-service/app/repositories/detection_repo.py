import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CropDiseaseLog, ScanStatus
from app.schemas.disease import VisionDiagnosis


class DetectionRepository:
    """Data access for crop_disease_logs.

    Kept deliberately flat — one table, a handful of queries.
    If this grows past ~5 methods, split by concern.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, log: CropDiseaseLog) -> CropDiseaseLog:
        self._session.add(log)
        await self._session.flush()
        await self._session.refresh(log)
        return log

    async def get_by_id(self, scan_id: uuid.UUID) -> CropDiseaseLog | None:
        result = await self._session.execute(
            select(CropDiseaseLog).where(CropDiseaseLog.id == scan_id)
        )
        return result.scalar_one_or_none()

    async def get_user_history(
        self, user_id: str, limit: int = 20
    ) -> list[CropDiseaseLog]:
        result = await self._session.execute(
            select(CropDiseaseLog)
            .where(CropDiseaseLog.user_id == user_id)
            .order_by(CropDiseaseLog.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_all_history(self, limit: int = 50) -> list[CropDiseaseLog]:
        result = await self._session.execute(
            select(CropDiseaseLog)
            .where(CropDiseaseLog.is_plant.is_(True))
            .order_by(CropDiseaseLog.created_at.desc())
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
    ) -> CropDiseaseLog:
        """Factory: create a CropDiseaseLog from a diagnosis result."""
        return CropDiseaseLog(
            user_id=user_id,
            image_url=image_url,
            language=language,
            is_plant=diagnosis.is_plant if diagnosis else False,
            disease_name=diagnosis.disease_name if diagnosis else None,
            scientific_name=diagnosis.scientific_name if diagnosis else None,
            confidence=diagnosis.confidence if diagnosis else None,
            crop_type=diagnosis.crop_type if diagnosis else None,
            symptoms=diagnosis.symptoms if diagnosis else None,
            causes=diagnosis.causes if diagnosis else None,
            treatment=diagnosis.treatment_recommendations if diagnosis else None,
            prevention_tips=diagnosis.prevention_tips if diagnosis else None,
            affected_crops=diagnosis.affected_crops if diagnosis else None,
            status=status,
            error_message=error_message,
        )
