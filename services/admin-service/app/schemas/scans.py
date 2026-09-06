"""Scan log response schemas (crop + animal)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CropScanItem(BaseModel):
    id: UUID
    image_url: str
    user_id: str | None = None
    language: str = "en"
    is_plant: bool = False
    disease_name: str | None = None
    scientific_name: str | None = None
    confidence: float | None = None
    crop_type: str | None = None
    symptoms: list | dict | str | None = None
    causes: str | None = None
    treatment: str | None = None
    status: str
    error_message: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AnimalScanItem(BaseModel):
    id: UUID
    image_url: str
    user_id: str | None = None
    language: str = "en"
    is_animal: bool = False
    animal_type: str | None = None
    disease_name: str | None = None
    scientific_name: str | None = None
    confidence: float | None = None
    symptoms: list | dict | str | None = None
    causes: str | None = None
    treatment: str | None = None
    status: str
    error_message: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ScanListResponse(BaseModel):
    total: int
    items: list
