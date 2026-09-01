from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class CurrentWeatherResponse(BaseModel):
    farmer_id: int
    latitude: float
    longitude: float
    temperature: float
    humidity: Optional[float]
    wind_speed_kmh: Optional[float]
    rain_mm: Optional[float]
    source: str
    fetched_at: datetime

    class Config:
        from_attributes = True


class ForecastEntry(BaseModel):
    time: datetime
    temp_min: float
    temp_max: float
    rain_mm: float
    wind_kmh: float


class ForecastResponse(BaseModel):
    farmer_id: int
    forecast: List[ForecastEntry]


class FarmerLocationRequest(BaseModel):
    latitude: float
    longitude: float


class FarmerLocationResponse(BaseModel):
    farmer_id: int
    latitude: float
    longitude: float

    class Config:
        from_attributes = True


class AdvisoryResponse(BaseModel):
    farmer_id: int
    advice: str
    source: str  # "llm" or "static"
