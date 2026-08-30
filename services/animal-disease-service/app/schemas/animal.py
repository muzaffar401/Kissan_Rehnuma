from uuid import UUID

from pydantic import BaseModel, Field


# ── Vision LLM structured output ─────────────────────────────────

class VisionDiagnosis(BaseModel):
    """Raw structured output from the Vision LLM."""

    is_animal: bool = False
    animal_type: str = ""
    disease_name: str = "unknown"
    scientific_name: str = ""
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    symptoms: list[str] = Field(default_factory=list)
    causes: str = ""
    treatment_recommendations: str = ""
    prevention_tips: list[str] = Field(default_factory=list)
    affected_species: str = ""


# ── API response schemas ─────────────────────────────────────────

class DiagnosisResponse(BaseModel):
    """Sent back to the farmer's app."""

    scan_id: UUID
    is_animal: bool
    animal_type: str | None = None
    disease_name: str | None = None
    scientific_name: str | None = None
    confidence: float | None = None
    symptoms: list[str] = Field(default_factory=list)
    causes: str = ""
    treatment_recommendations: str = ""
    prevention_tips: list[str] = Field(default_factory=list)
    affected_species: str = ""
    image_url: str = ""
    language: str = "en"
    message: str = ""


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "animal-disease-service"
    database: str = "unknown"
    vision_model: str = ""


class ErrorResponse(BaseModel):
    detail: str
    scan_id: UUID | None = None
