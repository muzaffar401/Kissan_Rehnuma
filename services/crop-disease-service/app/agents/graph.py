from typing import Any

from langgraph.graph.state import CompiledStateGraph
from langgraph.graph import END, StateGraph
from langchain_core.messages import HumanMessage
from langchain_openrouter import ChatOpenRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.prompts.diagnosis_prompt import SYSTEM_PROMPT
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import ScanStatus
from app.repositories.detection_repo import DetectionRepository
from app.schemas.disease import VisionDiagnosis

log = get_logger(__name__)


# ── State ────────────────────────────────────────────────────────
# Every node reads/writes from this shared dictionary.
# Fields are added progressively as the graph executes.

class DiagnosisState(dict):
    """Not a real class — LangGraph uses TypedDict-style state.

    We define it as a plain dict subclass for simplicity.
    Actual keys are documented below.

    Keys:
        image_bytes: bytes              — raw uploaded image
        content_type: str               — MIME type
        user_id: str | None             — farmer identifier
        language: str                   — response language code
        session: AsyncSession           — DB session (from configurable)
        is_plant: bool                  — set by validate_image node
        image_url: str                  — set by upload_image node
        diagnosis: VisionDiagnosis      — set by detect_disease node
        confidence_ok: bool             — set by confidence_gate node
        scan_status: ScanStatus         — set throughout flow
        error_message: str | None       — set on failure
        response: dict                  — final assembled response
    """


# ── Node functions ───────────────────────────────────────────────

async def validate_image(state: DiagnosisState) -> dict:
    """Check if the uploaded image is actually a plant.

    Uses the Vision LLM with a minimal prompt — just yes/no.
    This is a cheap gate to avoid running the full diagnostic
    pipeline on non-plant images (selfies, screenshots, etc.)
    """
    from app.services.image_validator import ImageValidator

    image_bytes: bytes = state["image_bytes"]
    content_type: str = state["content_type"]

    validator = ImageValidator()
    try:
        validator.validate(image_bytes, content_type)
    except Exception as exc:
        log.warning("image_validation_failed", error=str(exc))
        return {
            "is_plant": False,
            "confidence_ok": False,
            "scan_status": ScanStatus.FAILED,
            "error_message": f"Image validation failed: {exc}",
        }

    # Quick plant check via Vision LLM
    settings = get_settings()
    model = ChatOpenRouter(
        model=settings.vision_model,
        api_key=settings.openrouter_api_key,
        temperature=0.0,
        max_tokens=50,
    )

    import base64
    b64 = base64.b64encode(image_bytes).decode()

    response = await model.ainvoke([
        HumanMessage(content=[
            {"type": "text", "text": "Is this image showing a plant or plant part (leaf, stem, fruit, flower)? Answer ONLY 'yes' or 'no'."},
            {"type": "image_url", "image_url": {"url": f"data:{content_type};base64,{b64}"}},
        ])
    ])

    answer = response.content.strip().lower()
    is_plant = answer.startswith("yes")

    if not is_plant:
        log.info("image_not_a_plant", user_id=state.get("user_id"))

    return {
        "is_plant": is_plant,
        "confidence_ok": is_plant,
        "scan_status": ScanStatus.NOT_A_PLANT if not is_plant else ScanStatus.COMPLETED,
    }


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

    Uses Chain-of-Thought prompting (embedded in SYSTEM_PROMPT)
    and forces structured output via Pydantic + with_structured_output.
    """
    import base64

    settings = get_settings()
    model = ChatOpenRouter(
        model=settings.vision_model,
        api_key=settings.openrouter_api_key,
        temperature=settings.vision_temperature,
        max_tokens=settings.vision_max_tokens,
    )

    structured_model = model.with_structured_output(VisionDiagnosis)

    image_bytes: bytes = state["image_bytes"]
    content_type: str = state["content_type"]
    language: str = state.get("language", "en")
    b64 = base64.b64encode(image_bytes).decode()

    language_label = {
        "en": "English",
        "ur": "Urdu (Roman Urdu)",
        "pa": "Punjabi",
        "sd": "Sindhi",
    }.get(language, "English")

    user_prompt = (
        f"Analyze this crop image for diseases. "
        f"Respond in {language_label}."
    )

    diagnosis: VisionDiagnosis = await structured_model.ainvoke([
        {"role": "system", "content": SYSTEM_PROMPT},
        HumanMessage(content=[
            {"type": "text", "text": user_prompt},
            {"type": "image_url", "image_url": {"url": f"data:{content_type};base64,{b64}"}},
        ]),
    ])

    log.info(
        "disease_detected",
        disease=diagnosis.disease_name,
        confidence=diagnosis.confidence,
        is_plant=diagnosis.is_plant,
    )

    return {"diagnosis": diagnosis}


async def confidence_gate(state: DiagnosisState) -> dict:
    """Decide whether the diagnosis is trustworthy enough to present.

    Research shows Vision LLMs can be overconfident on out-of-distribution
    images. This gate catches low-confidence results and returns a
    "please retake" message instead of a potentially wrong diagnosis.
    """
    settings = get_settings()
    diagnosis: VisionDiagnosis = state["diagnosis"]
    threshold = settings.confidence_threshold

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
    a future Pakistani crop-specific CV model.
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
        language=state.get("language", "ur"),
        diagnosis=diagnosis if status == ScanStatus.COMPLETED else None,
        status=status,
        error_message=error_msg,
    )

    saved = await repo.save(log_entry)
    log.info("scan_saved", scan_id=str(saved.id), status=status.value)

    return {"response": _assemble_response(saved, diagnosis, status)}


# ── Routing ──────────────────────────────────────────────────────

def route_after_validation(state: DiagnosisState) -> str:
    if state.get("is_plant") and state.get("confidence_ok", True):
        return "upload_image"
    return "save_to_database"


def route_after_confidence(state: DiagnosisState) -> str:
    return "save_to_database"


# ── Helpers ──────────────────────────────────────────────────────

def _assemble_response(log_entry, diagnosis, status: ScanStatus) -> dict:
    """Build the final JSON response from the saved log entry."""
    if status == ScanStatus.NOT_A_PLANT:
        return {
            "scan_id": str(log_entry.id),
            "is_plant": False,
            "message": "No plant detected in the image. Please take a clear photo of the crop leaf or plant.",
        }

    if status == ScanStatus.LOW_CONFIDENCE:
        return {
            "scan_id": str(log_entry.id),
            "is_plant": True,
            "confidence": diagnosis.confidence if diagnosis else None,
            "message": "Image is not clear enough for a reliable diagnosis. Please retake the photo in good lighting, from a closer distance.",
        }

    if status == ScanStatus.FAILED:
        return {
            "scan_id": str(log_entry.id),
            "is_plant": False,
            "message": "Something went wrong during the scan. Please try again.",
        }

    # Successful diagnosis
    return {
        "scan_id": str(log_entry.id),
        "is_plant": True,
        "disease_name": diagnosis.disease_name,
        "scientific_name": diagnosis.scientific_name,
        "crop_type": diagnosis.crop_type,
        "confidence": diagnosis.confidence,
        "symptoms": diagnosis.symptoms,
        "causes": diagnosis.causes,
        "treatment": diagnosis.treatment.model_dump() if diagnosis.treatment else None,
        "prevention_tips": diagnosis.prevention_tips,
        "affected_crops": diagnosis.affected_crops,
        "image_url": log_entry.image_url,
        "language": log_entry.language,
        "message": "",
    }


# ── Graph assembly ───────────────────────────────────────────────

def build_graph() -> CompiledStateGraph:
    """Construct and compile the LangGraph diagnosis workflow.

    Flow:
        validate_image → [is_plant?] → upload_image → detect_disease
                     → confidence_gate → save_to_database → END
    """
    graph = StateGraph(dict)

    # Register nodes
    graph.add_node("validate_image", validate_image)
    graph.add_node("upload_image", upload_image)
    graph.add_node("detect_disease", detect_disease)
    graph.add_node("confidence_gate", confidence_gate)
    graph.add_node("save_to_database", save_to_database)

    # Entry point
    graph.set_entry_point("validate_image")

    # Conditional: if not a plant or validation failed, skip to DB save
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
