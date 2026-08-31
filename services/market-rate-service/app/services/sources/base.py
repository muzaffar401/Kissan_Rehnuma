"""Common types shared by all data-source fetchers."""
from dataclasses import dataclass
from datetime import date
from typing import Optional


class SourceFetchError(Exception):
    """Raised when a source cannot be fetched or parsed."""


@dataclass
class RawPrice:
    """Source-specific data, exactly as the source wrote it.

    Fetchers must NOT normalize anything — that is the ingestion
    layer's job.
    """

    source: str            # amis / zarai_mandi / manual
    raw_crop: str          # e.g. "Gandum", "wheat_crop", "Basmati"
    raw_price: float       # price in the source's own unit
    raw_unit: str          # e.g. "40kg", "kg", "maund"
    mandi: str
    city: str = ""
    recorded_date: Optional[date] = None
