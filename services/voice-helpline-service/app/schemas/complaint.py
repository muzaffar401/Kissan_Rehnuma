from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.complaint import ComplaintStatus, ComplaintUrgency

ComplaintCategory = Literal[
    "crop_disease", "animal_health", "market", "weather", "irrigation", "other"
]


class ComplaintCreate(BaseModel):
    helpline_session_id: UUID
    category: ComplaintCategory
    crop: str | None = Field(default=None, min_length=1, max_length=100)
    description: str = Field(min_length=5, max_length=2000)
    district: str | None = Field(default=None, min_length=1, max_length=100)
    urgency: ComplaintUrgency = ComplaintUrgency.NORMAL


class ComplaintRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reference_number: str
    farmer_id: UUID
    helpline_session_id: UUID
    category: str
    crop: str | None
    description: str
    district: str | None
    urgency: ComplaintUrgency
    status: ComplaintStatus
    source: str
    created_at: datetime
    updated_at: datetime


class ComplaintStatusUpdate(BaseModel):
    status: ComplaintStatus
    notes: str | None = Field(default=None, max_length=1000)


class ComplaintList(BaseModel):
    items: list[ComplaintRead]
    limit: int
    offset: int

