from datetime import date
from typing import Optional

from pydantic import BaseModel


class ManualPriceRequest(BaseModel):
    mandi: str
    city: str = ""
    crop: str            # raw name ok — ingestion standardizes it
    price: float         # price in the given unit
    unit: str = "kg"     # kg / 40kg / maund / 100kg
    recorded_date: Optional[date] = None


class ManualPriceResponse(BaseModel):
    stored: bool = True
    crop: str
    price_per_kg: float
    mandi: str
