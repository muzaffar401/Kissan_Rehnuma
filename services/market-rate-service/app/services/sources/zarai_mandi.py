"""Zarai Mandi fetcher — stub until partnership/API status is confirmed.

If they offer an API, implement it here only; the ingestion layer and
everything downstream stays untouched.
"""
import logging
from typing import List

from app.services.sources.base import RawPrice

logger = logging.getLogger("market_rate.zarai_mandi")


def fetch_from_zarai_mandi() -> List[RawPrice]:
    logger.info("Zarai Mandi source skipped: partnership/API not confirmed yet")
    return []
