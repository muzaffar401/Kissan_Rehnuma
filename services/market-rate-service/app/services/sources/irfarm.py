"""IRFarm fetcher — scrapes daily mandi rates from irfarm.com.

IRFarm is a Shopify-based site. Data is embedded in WhatsApp share links
within the HTML. Each commodity has a wa.me link containing:
  - Commodity name
  - Date
  - City-wise min/max prices
  - Unit (kg or Dozen)

Source URL: https://irfarm.com/pages/daily-mandi-rates
Data format: PKR/kg (no conversion needed)
Cities: Lahore, Karachi, Islamabad, Multan, Sargodha, Faisalabad
"""
import logging
import re
from datetime import date
from typing import Dict, List, Optional, Tuple
from urllib.parse import unquote

import httpx

from app.core.config import HTTP_TIMEOUT_SECONDS
from app.services.sources.base import RawPrice, SourceFetchError

logger = logging.getLogger("market_rate.irfarm")

_IRFARM_URL = "https://irfarm.com/pages/daily-mandi-rates"

# Cities covered by IRFarm
CITIES = ["Lahore", "Karachi", "Islamabad", "Multan", "Sargodha", "Faisalabad"]


def fetch_from_irfarm() -> List[RawPrice]:
    """Fetch all commodity prices from IRFarm daily mandi rates.

    Parses WhatsApp share links embedded in the HTML to extract
    commodity prices for multiple cities.

    Returns raw price records with prices already in PKR/kg.
    """
    try:
        response = httpx.get(
            _IRFARM_URL,
            timeout=HTTP_TIMEOUT_SECONDS,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; KissanRehnuma/1.0)",
                "Accept": "text/html",
            },
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise SourceFetchError(f"IRFarm request failed: {exc}") from exc

    records: List[RawPrice] = []
    recorded = date.today()

    # Extract date from page (format: "3 September 2026")
    date_match = re.search(r"(\d{1,2})\s+(\w+)\s+(\d{4})", response.text)
    if date_match:
        day, month_str, year = date_match.groups()
        try:
            month = _parse_month(month_str)
            recorded = date(int(year), month, int(day))
        except ValueError:
            pass

    # Find all WhatsApp share links — they contain the full price data
    wa_links = re.findall(r'https://wa\.me/\?text=([^"\'&\s]+)', response.text)
    logger.info("Found %d WhatsApp share links", len(wa_links))

    for wa_text in wa_links:
        decoded = unquote(wa_text).replace("+", " ")
        # Parse: "Aaj ka {Commodity} mandi rate ({date}):\r\n{City}: Rs {Min}-{Max} / {Unit}\r\n..."
        parsed = _parse_wa_link(decoded, recorded)
        if parsed:
            records.extend(parsed)

    if not records:
        raise SourceFetchError("IRFarm page parsed but no price data found")

    # Deduplicate (same crop+city may appear in multiple links)
    seen = set()
    unique = []
    for r in records:
        key = (r.raw_crop, r.city)
        if key not in seen:
            seen.add(key)
            unique.append(r)

    cities_found = set(r.city for r in unique)
    crops_found = set(r.raw_crop for r in unique)
    logger.info(
        "IRFarm fetched %d records: %d crops x %d cities",
        len(unique), len(crops_found), len(cities_found),
    )
    return unique


def _parse_wa_link(text: str, recorded: date) -> List[RawPrice]:
    """Parse a WhatsApp share text into RawPrice records."""
    records = []

    # Extract commodity name: "Aaj ka {Name} mandi rate ({date}):"
    name_match = re.match(r"Aaj ka (.+?) mandi rate", text)
    if not name_match:
        return records
    raw_crop = name_match.group(1).strip()

    # Extract date from the text
    date_match = re.search(r"\((\d{2}-\d{2}-\d{4})\)", text)
    if date_match:
        parts = date_match.group(1).split("-")
        if len(parts) == 3:
            try:
                recorded = date(int(parts[2]), int(parts[1]), int(parts[0]))
            except ValueError:
                pass

    # Extract city-wise prices: "{City}: Rs {Min}-{Max} / {Unit}"
    city_prices = re.findall(
        r'(Lahore|Karachi|Islamabad|Multan|Sargodha|Faisalabad)'
        r':\s*Rs\s+([\d.]+)-([\d.]+)\s*/\s*(\w+)',
        text
    )

    for city, min_str, max_str, unit in city_prices:
        try:
            min_price = float(min_str)
            max_price = float(max_str)
            avg_price = round((min_price + max_price) / 2, 2)

            # Normalize unit
            raw_unit = unit.lower().strip()
            if raw_unit in ("kg", "/kg"):
                raw_unit = "kg"
            elif raw_unit in ("dozen", "/dozen"):
                raw_unit = "dozen"

            records.append(
                RawPrice(
                    source="irfarm",
                    raw_crop=raw_crop,
                    raw_price=avg_price,
                    raw_unit=raw_unit,
                    mandi=city,
                    city=city,
                    recorded_date=recorded,
                    raw_min_price=min_price,
                    raw_max_price=max_price,
                    raw_fqp_price=avg_price,
                )
            )
        except ValueError:
            continue

    return records


def _parse_month(month_str: str) -> int:
    """Parse month name to number."""
    months = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
    }
    return months.get(month_str.lower(), 1)
