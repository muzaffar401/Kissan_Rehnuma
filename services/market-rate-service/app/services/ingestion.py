"""Ingestion layer — the SINGLE place raw source data is standardized.

Adding a new source later means adding its fetcher plus, at most, new
synonym/unit entries here. Nothing else in the codebase changes.
"""
from dataclasses import dataclass
from datetime import date
from typing import List, Optional

from app.services.sources.base import RawPrice

# raw lowercase variant -> standardized crop name
CROP_SYNONYMS = {
    "wheat": "Wheat", "gandum": "Wheat", "گندم": "Wheat", "wheat_crop": "Wheat",
    "rice": "Rice", "basmati": "Rice", "chawal": "Rice", "paddy": "Rice",
    "maize": "Maize", "corn": "Maize", "makai": "Maize",
    "cotton": "Cotton", "kapas": "Cotton",
    "sugarcane": "Sugarcane",
    "potato": "Potato", "aloo": "Potato",
    "onion": "Onion", "pyaz": "Onion",
    "tomato": "Tomato", "tamatar": "Tomato",
}

# raw unit -> divisor converting the raw price into PKR per kg
UNIT_DIVISORS = {
    "kg": 1.0, "1kg": 1.0,
    "40kg": 40.0, "40 kg": 40.0, "maund": 40.0,
    "100kg": 100.0, "quintal": 100.0,
}


@dataclass
class StandardPrice:
    crop_name: str
    mandi_name: str
    city: str
    price_per_kg: float
    recorded_date: date
    source: str


def standardize_crop(raw: str) -> Optional[str]:
    """Map a raw crop name to the standardized one; None if unknown."""
    return CROP_SYNONYMS.get(raw.strip().lower())


def standardize(raw_records: List[RawPrice]) -> List[StandardPrice]:
    """Normalize crop names + units; unknown variants are skipped, not guessed."""
    out: List[StandardPrice] = []
    for record in raw_records:
        crop = standardize_crop(record.raw_crop)
        if crop is None:
            continue
        divisor = UNIT_DIVISORS.get(record.raw_unit.strip().lower(), 1.0)
        out.append(
            StandardPrice(
                crop_name=crop,
                mandi_name=record.mandi,
                city=record.city,
                price_per_kg=round(record.raw_price / divisor, 2),
                recorded_date=record.recorded_date or date.today(),
                source=record.source,
            )
        )
    return out
