from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class MandiPrice(BaseModel):
    mandi: str
    city: str
    price_per_kg: float
    recorded_date: date
    source: str


class RatesResponse(BaseModel):
    crop: str
    unit: str = "PKR/kg"
    prices: List[MandiPrice]
    cached: bool = False


class TrendEntry(BaseModel):
    crop: str
    current_avg: Optional[float] = None
    previous_avg: Optional[float] = None
    change_percent: Optional[float] = None
    direction: str   # up / down / flat / new


class TrendingResponse(BaseModel):
    days: int
    trends: List[TrendEntry]
