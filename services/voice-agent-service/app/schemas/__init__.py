"""Pydantic schemas for request/response validation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ComplaintCreate(BaseModel):
    """Schema for creating a complaint via tool call."""

    category: str = Field(..., description="Type of complaint")
    crop: str | None = Field(None, description="Crop name if applicable")
    description: str = Field(..., description="Detailed description of the problem")
    district: str = Field(..., description="Farmer's district name")
    urgency: str = Field("normal", description="Priority: low, normal, high, critical")


class ComplaintResponse(BaseModel):
    """Schema for complaint response."""

    id: UUID
    reference_number: str
    farmer_id: UUID
    category: str
    crop: str | None
    description: str
    district: str
    urgency: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ToolResult(BaseModel):
    """Standard tool result returned to the LLM."""

    success: bool
    message: str
    reference_number: str | None = None
    data: dict | None = None
