import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph import build_graph
from app.api.deps import get_db_session
from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.disease import DiagnosisResponse, ErrorResponse

log = get_logger(__name__)
router = APIRouter(prefix="/disease", tags=["crop-disease"])


@router.post(
    "/detect",
    response_model=DiagnosisResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image"},
        500: {"model": ErrorResponse, "description": "Internal error"},
    },
    summary="Detect crop disease from leaf image",
)
async def detect_disease(
    image: UploadFile = File(..., description="Crop leaf/plant image"),
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
        is_plant=response_data.get("is_plant"),
    )

    return DiagnosisResponse(**response_data)


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
        "service": "crop-disease-service",
        "database": db_status,
        "vision_model": settings.vision_model,
    }
