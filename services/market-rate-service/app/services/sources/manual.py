"""Manual entry fetcher — stub.

Manual rows enter the system through POST /admin/prices (which reuses
the ingestion layer), so the scheduled pipeline has nothing to pull
from here. Kept so every source has the same fetch -> ingest shape.
"""
from typing import List

from app.services.sources.base import RawPrice


def fetch_manual_entry() -> List[RawPrice]:
    return []
