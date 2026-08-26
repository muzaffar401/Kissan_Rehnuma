from uuid import UUID

from pydantic import BaseModel, Field


# ── Vision LLM structured output ─────────────────────────────────
# This is what GPT-4o returns via OpenRouter. The model is forced
# into this exact shape through with_structured_output().

class TreatmentPlan(BaseModel):
    chemical: list[str] = Field(default_factory=list)
    organic: list[str] = Field(default_factory=list)
    estimated_cost_pkr: str = ""


class VisionDiagnosis(BaseModel):
    """Raw structured output from the Vision LLM."""

    is_plant: bool = False
    disease_name: str = "unknown"
    scientific_name: str = ""
    crop_type: str = ""
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    symptoms: list[str] = Field(default_factory=list)
    causes: list[str] = Field(default_factory=list)
    treatment: TreatmentPlan = Field(default_factory=TreatmentPlan)
    prevention_tips: list[str] = Field(default_factory=list)
    affected_crops: list[str] = Field(default_factory=list)


# ── API response schemas ─────────────────────────────────────────

class DiagnosisResponse(BaseModel):
    """Sent back to the farmer's app."""

    scan_id: UUID
    is_plant: bool
    disease_name: str | None = None
    scientific_name: str | None = None
    crop_type: str | None = None
    confidence: float | None = None
    symptoms: list[str] = Field(default_factory=list)
    causes: list[str] = Field(default_factory=list)
    treatment: TreatmentPlan | None = None
    prevention_tips: list[str] = Field(default_factory=list)
    affected_crops: list[str] = Field(default_factory=list)
    image_url: str = ""
    language: str = "en"
    message: str = ""


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "crop-disease-service"
    database: str = "unknown"
    vision_model: str = ""


class ErrorResponse(BaseModel):
    detail: str
    scan_id: UUID | None = None
