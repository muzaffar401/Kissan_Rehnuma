from typing import Any, Optional, TypedDict

from langgraph.graph.state import CompiledStateGraph
from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.prompts.veterinary_prompt import SYSTEM_PROMPT
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import ScanStatus
from app.repositories.detection_repo import DetectionRepository
from app.schemas.animal import VisionDiagnosis
from app.services.openrouter_client import call_vision_model, OpenRouterError

log = get_logger(__name__)


# ── State ────────────────────────────────────────────────────────

class DiagnosisState(TypedDict):
    """Shared state across all graph nodes."""
    # Input (set by endpoint)
    image_bytes: bytes
    content_type: str
    user_id: Optional[str]
    language: str
    session: Any  # AsyncSession — not serialisable, but lives in memory
    # Set by validate_image (non-LLM pre-flight only)
    is_animal: bool
    # Set by upload_image
    image_url: str
    # Set by detect_disease
    diagnosis: Any  # VisionDiagnosis
    # Set by confidence_gate
    confidence_ok: bool
    # Set throughout flow
    scan_status: ScanStatus
    error_message: Optional[str]
    # Final output
    response: dict


# ── Node functions ───────────────────────────────────────────────

async def validate_image(state: DiagnosisState) -> dict:
    """Non-LLM pre-flight checks: format, size, dimensions.

    The animal/not-animal decision is now handled inside detect_disease
    by the comprehensive prompt — no separate LLM call needed.
    """
    from app.services.image_validator import ImageValidator, ImageValidationError

    image_bytes: bytes = state["image_bytes"]
    content_type: str = state["content_type"]

    validator = ImageValidator()
    try:
        validator.validate(image_bytes, content_type)
    except ImageValidationError as exc:
        log.warning("image_validation_failed", error=str(exc))
        return {
            "is_animal": False,
            "confidence_ok": False,
            "scan_status": ScanStatus.FAILED,
            "error_message": f"Image validation failed: {exc}",
        }

    return {"is_animal": True}


async def upload_image(state: DiagnosisState) -> dict:
    """Upload the validated image to Cloudinary."""
    from app.services.cloud_storage import CloudinaryStorage

    storage = CloudinaryStorage()
    image_bytes: bytes = state["image_bytes"]

    url = storage.upload(image_bytes)
    log.info("image_uploaded_to_cloudinary", url=url)
    return {"image_url": url}


async def detect_disease(state: DiagnosisState) -> dict:
    """Run the full diagnostic pipeline through Vision LLM.

    Uses a direct httpx call to OpenRouter (no LangChain overhead)
    with native json_schema response_format for speed.
    """
    import base64

    image_bytes: bytes = state["image_bytes"]
    content_type: str = state["content_type"]
    language: str = state.get("language", "en")
    b64 = base64.b64encode(image_bytes).decode()

    language_label = {
        "en": "English",
        "ur": "Urdu (اردو — Arabic/Urdu script, NOT Roman Urdu)",
        "pa": "Punjabi",
        "sd": "Sindhi (سنڌي — Arabic/Sindhi script, NOT Roman)",
    }.get(language, "English")

    # Combine system prompt + language instruction into one message
    full_prompt = f"{SYSTEM_PROMPT}\n\nRespond in {language_label}."
    image_data_uri = f"data:{content_type};base64,{b64}"

    try:
        diagnosis: VisionDiagnosis = await call_vision_model(
            prompt_text=full_prompt,
            image_data_uri=image_data_uri,
            response_model=VisionDiagnosis,
        )
    except OpenRouterError as exc:
        log.error("vision_model_failed", error=str(exc))
        return {
            "diagnosis": VisionDiagnosis(),
            "is_animal": False,
            "confidence_ok": False,
            "scan_status": ScanStatus.FAILED,
            "error_message": str(exc),
        }

    log.info(
        "disease_detected",
        disease=diagnosis.disease_name,
        confidence=diagnosis.confidence,
        is_animal=diagnosis.is_animal,
    )

    return {
        "diagnosis": diagnosis,
        "is_animal": diagnosis.is_animal,
    }


async def confidence_gate(state: DiagnosisState) -> dict:
    """Decide whether the diagnosis is trustworthy enough to present.

    Vision LLMs can be overconfident on out-of-distribution images.
    This gate catches low-confidence results and returns a
    "please retake" message instead of a potentially wrong diagnosis.
    """
    settings = get_settings()
    diagnosis: VisionDiagnosis = state["diagnosis"]
    threshold = settings.confidence_threshold

    # If not an animal, skip confidence check
    if not diagnosis.is_animal:
        return {
            "confidence_ok": True,
            "scan_status": ScanStatus.NOT_AN_ANIMAL,
        }

    is_ok = diagnosis.confidence >= threshold
    log.info(
        "confidence_gate",
        score=diagnosis.confidence,
        threshold=threshold,
        passed=is_ok,
    )

    return {
        "confidence_ok": is_ok,
        "scan_status": ScanStatus.COMPLETED if is_ok else ScanStatus.LOW_CONFIDENCE,
    }


async def save_to_database(state: DiagnosisState) -> dict:
    """Persist the scan result — whether successful, low-confidence, or failed.

    Every scan gets logged. This data becomes the training set for
    a future Pakistani livestock-specific CV model.
    """
    session: AsyncSession = state["session"]
    repo = DetectionRepository(session)

    diagnosis = state.get("diagnosis")
    image_url = state.get("image_url", "")
    status = state.get("scan_status", ScanStatus.FAILED)
    error_msg = state.get("error_message")

    log_entry = DetectionRepository.build_log(
        image_url=image_url,
        user_id=state.get("user_id"),
        language=state.get("language", "en"),
        diagnosis=diagnosis if diagnosis and diagnosis.is_animal else None,
        status=status,
        error_message=error_msg,
    )

    saved = await repo.save(log_entry)
    log.info("scan_saved", scan_id=str(saved.id), status=status.value)

    return {"response": _assemble_response(saved, diagnosis, status)}


# ── Routing ──────────────────────────────────────────────────────

def route_after_validation(state: DiagnosisState) -> str:
    if state.get("is_animal") and state.get("scan_status") != ScanStatus.FAILED:
        return "upload_image"
    return "save_to_database"


def route_after_confidence(state: DiagnosisState) -> str:
    return "save_to_database"


# ── Helpers ──────────────────────────────────────────────────────

def _assemble_response(log_entry, diagnosis, status: ScanStatus) -> dict:
    """Build the final JSON response from the saved log entry."""
    if status == ScanStatus.NOT_AN_ANIMAL:
        return {
            "scan_id": str(log_entry.id),
            "is_animal": False,
            "message": "No animal detected in the image. Please take a clear photo of the livestock or poultry.",
        }

    if status == ScanStatus.LOW_CONFIDENCE:
        return {
            "scan_id": str(log_entry.id),
            "is_animal": True,
            "confidence": diagnosis.confidence if diagnosis else None,
            "message": "Image is not clear enough for a reliable diagnosis. Please retake the photo in good lighting, from a closer distance.",
        }

    if status == ScanStatus.FAILED:
        return {
            "scan_id": str(log_entry.id),
            "is_animal": False,
            "message": "Something went wrong during the scan. Please try again.",
        }

    # Successful diagnosis
    return {
        "scan_id": str(log_entry.id),
        "is_animal": True,
        "animal_type": diagnosis.animal_type,
        "disease_name": diagnosis.disease_name,
        "scientific_name": diagnosis.scientific_name,
        "confidence": diagnosis.confidence,
        "symptoms": diagnosis.symptoms,
        "causes": diagnosis.causes,
        "treatment_recommendations": diagnosis.treatment_recommendations,
        "prevention_tips": diagnosis.prevention_tips,
        "affected_species": diagnosis.affected_species,
        "image_url": log_entry.image_url,
        "language": log_entry.language,
        "message": "",
    }


# ── Graph assembly ───────────────────────────────────────────────

def build_graph() -> CompiledStateGraph:
    """Construct and compile the LangGraph diagnosis workflow.

    Flow:
        validate_image (format/size only) → [pass?] → upload_image
                     → detect_disease (animal check + diagnosis in 1 call)
                     → confidence_gate → save_to_database → END
    """
    graph = StateGraph(DiagnosisState)

    # Register nodes
    graph.add_node("validate_image", validate_image)
    graph.add_node("upload_image", upload_image)
    graph.add_node("detect_disease", detect_disease)
    graph.add_node("confidence_gate", confidence_gate)
    graph.add_node("save_to_database", save_to_database)

    # Entry point
    graph.set_entry_point("validate_image")

    # Conditional: if image validation failed, skip to DB save
    graph.add_conditional_edges(
        "validate_image",
        route_after_validation,
        {
            "upload_image": "upload_image",
            "save_to_database": "save_to_database",
        },
    )

    # Linear flow for successful validations
    graph.add_edge("upload_image", "detect_disease")
    graph.add_edge("detect_disease", "confidence_gate")

    # After confidence check, always save to DB
    graph.add_conditional_edges(
        "confidence_gate",
        route_after_confidence,
        {
            "save_to_database": "save_to_database",
        },
    )

    graph.add_edge("save_to_database", END)

    return graph.compile()
