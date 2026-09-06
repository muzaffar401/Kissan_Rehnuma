"""User (farmer) schemas."""

from pydantic import BaseModel


class FarmerSummary(BaseModel):
    id: int
    name: str
    lastname: str
    email: str
    Mobile_Number: str
    City: str
    country: str
    email_verified: bool
    is_active: bool = True
    latitude: float
    longitude: float

    class Config:
        from_attributes = True


class FarmerListResponse(BaseModel):
    total: int
    items: list[FarmerSummary]


class FarmerUpdate(BaseModel):
    name: str | None = None
    lastname: str | None = None
    email: str | None = None
    Mobile_Number: str | None = None
    City: str | None = None
    country: str | None = None


class FarmerStatusToggle(BaseModel):
    is_active: bool
