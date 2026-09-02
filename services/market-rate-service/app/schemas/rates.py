from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class MandiPrice(BaseModel):
    mandi: str
    city: str
    price_per_kg: float
    min_price_per_kg: Optional[float] = None
    max_price_per_kg: Optional[float] = None
    fqp_price_per_kg: Optional[float] = None
    recorded_date: date
    source: str


class RatesResponse(BaseModel):
    crop: str
    unit: str = "PKR/kg"
    prices: List[MandiPrice]
    cached: bool = False


class CropPrice(BaseModel):
    """Single crop entry in the all-rates list."""
    crop_name: str
    mandi_name: str
    city: str
    price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    fqp_price: Optional[float] = None
    recorded_date: Optional[str] = None
    source: str


class AllRatesResponse(BaseModel):
    unit: str = "PKR/kg"
    recorded_date: Optional[str] = None
    total: int
    crops: List[CropPrice]


class TrendEntry(BaseModel):
    crop: str
    current_avg: Optional[float] = None
    previous_avg: Optional[float] = None
    change_percent: Optional[float] = None
    direction: str   # up / down / flat / new


class TrendingResponse(BaseModel):
    days: int
    trends: List[TrendEntry]
