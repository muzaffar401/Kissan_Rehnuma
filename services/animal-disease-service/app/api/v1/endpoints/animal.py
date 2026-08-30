import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph import build_graph
from app.api.deps import get_db_session
from app.core.config import get_settings
from app.core.logging import get_logger
from app.repositories.detection_repo import DetectionRepository
from app.schemas.animal import DiagnosisResponse, ErrorResponse

log = get_logger(__name__)
router = APIRouter(prefix="/animal", tags=["animal-disease"])


@router.post(
    "/detect",
    response_model=DiagnosisResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image"},
        500: {"model": ErrorResponse, "description": "Internal error"},
    },
    summary="Detect animal disease from livestock image",
)
async def detect_disease(
    image: UploadFile = File(..., description="Animal/livestock image"),
    user_id: str | None = Form(None, description="Farmer/user identifier"),
    language: str = Form("en", description="Response language: en, ur, pa, sd"),
    session: AsyncSession = Depends(get_db_session),
) -> DiagnosisResponse:
    image_bytes = await image.read()
    content_type = image.content_type or "image/jpeg"

    log.info(
        "detection_request",
        filename=image.filename,
        content_type=content_type,
        size_bytes=len(image_bytes),
        language=language,
        user_id=user_id,
    )

    graph = build_graph()

    result = await graph.ainvoke({
        "image_bytes": image_bytes,
        "content_type": content_type,
        "user_id": user_id,
        "language": language,
        "session": session,
    })

    response_data = result.get("response", {})
    log.info(
        "detection_complete",
        scan_id=response_data.get("scan_id"),
        is_animal=response_data.get("is_animal"),
    )

    return DiagnosisResponse(**response_data)


@router.get("/history", summary="Get scan history")
async def scan_history(
    user_id: str | None = Query(None, description="Filter by user/farmer ID"),
    limit: int = Query(50, ge=1, le=200, description="Max results"),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    repo = DetectionRepository(session)

    if user_id:
        logs = await repo.get_user_history(user_id, limit=limit)
    else:
        logs = await repo.get_all_history(limit=limit)

    return [_log_to_dict(log) for log in logs]


@router.get("/health", summary="Service health check")
async def health_check(session: AsyncSession = Depends(get_db_session)) -> dict:
    settings = get_settings()
    db_status = "connected"
    try:
        from sqlalchemy import text
        await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "animal-disease-service",
        "database": db_status,
        "vision_model": settings.vision_model,
    }


def _log_to_dict(log) -> dict:
    """Convert an AnimalDiseaseLog ORM instance to a JSON-safe dict."""
    return {
        "scan_id": str(log.id),
        "image_url": log.image_url,
        "user_id": log.user_id,
        "language": log.language,
        "is_animal": log.is_animal,
        "animal_type": log.animal_type,
        "disease_name": log.disease_name,
        "scientific_name": log.scientific_name,
        "confidence": log.confidence,
        "symptoms": log.symptoms or [],
        "causes": log.causes or "",
        "treatment_recommendations": log.treatment or "",
        "prevention_tips": log.prevention_tips or [],
        "affected_species": log.affected_species or "",
        "status": log.status.value if log.status else "",
        "error_message": log.error_message,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }
