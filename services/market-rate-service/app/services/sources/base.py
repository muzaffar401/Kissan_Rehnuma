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
    raw_price: float       # primary price (FQP or avg) in source unit
    raw_unit: str          # e.g. "100kg", "kg", "40kg"
    mandi: str
    city: str = ""
    recorded_date: Optional[date] = None
    raw_min_price: Optional[float] = None
    raw_max_price: Optional[float] = None
    raw_fqp_price: Optional[float] = None
