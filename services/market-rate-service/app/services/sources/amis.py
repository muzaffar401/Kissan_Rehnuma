"""AMIS Punjab fetcher (isolated scraper).

No public/partner API is documented (checked 2026-08-30: amis.pk serves
HTML pages and an Android app only), so this scrapes the public prices
page. If AMIS/PITB later exposes an API, ONLY this file changes.
"""
import logging
from datetime import date
from typing import List, Optional

import httpx
from bs4 import BeautifulSoup

from app.core.config import AMIS_PRICES_URL, HTTP_TIMEOUT_SECONDS
from app.services.sources.base import RawPrice, SourceFetchError

logger = logging.getLogger("market_rate.amis")


def fetch_from_amis() -> List[RawPrice]:
    """Return raw, source-specific rows. Raises SourceFetchError on failure."""
    try:
        response = httpx.get(
            AMIS_PRICES_URL,
            timeout=HTTP_TIMEOUT_SECONDS,
            follow_redirects=True,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise SourceFetchError(f"AMIS request failed: {exc}") from exc

    soup = BeautifulSoup(response.text, "html.parser")
    records: List[RawPrice] = []

    # Tolerant heuristic: any table row whose first cell looks like a
    # commodity name and which contains a numeric price cell. AMIS
    # reports most crops per 40kg bag.
    for row in soup.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in row.find_all(["td", "th"])]
        if len(cells) < 2:
            continue
        raw_crop = cells[0]
        price = _extract_price(cells[1:])
        if not raw_crop or price is None or raw_crop.lower() in (
            "commodity", "crop", "name"
        ):
            continue
        records.append(
            RawPrice(
                source="amis",
                raw_crop=raw_crop,
                raw_price=price,
                raw_unit="40kg",
                mandi="AMIS Punjab",
                city="Punjab",
                recorded_date=date.today(),
            )
        )

    if not records:
        raise SourceFetchError("AMIS page parsed but no price rows found")
    logger.info("AMIS fetched %d raw rows", len(records))
    return records


def _extract_price(cells: List[str]) -> Optional[float]:
    for cell in cells:
        try:
            return float(cell.replace(",", ""))
        except ValueError:
            continue
    return None
