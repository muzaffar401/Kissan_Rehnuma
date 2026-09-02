"""AMIS Punjab fetcher — scrapes ViewPrices.aspx for all commodities across multiple cities.

Fetches the city-wise price page which shows Min/Max/FQP prices
in Rs/100Kg (quintal) for all commodities across Punjab mandis.

Source URL: http://www.amis.pk/ViewPrices.aspx?searchType=1&commodityId={city_id}

City ID mapping (discovered from AMIS):
  1=Lahore, 2=Faisalabad, 3=Gujranwala, 4=Okara, 5=Sargodha,
  6=Rawalpindi, 7=Multan, 8=RahimYarKhan, 9=Bhakkar, 10=Bhalwal,
  11=Kasur, 13=Sahiwal, 14=Vehari, 15=Burewala, 17=Gujrat,
  18=Khanewal, 19=MuzafarGhar, ...
"""
import logging
import re
from datetime import date
from typing import Dict, List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup

from app.core.config import AMIS_PRICES_URL, HTTP_TIMEOUT_SECONDS
from app.services.sources.base import RawPrice, SourceFetchError

logger = logging.getLogger("market_rate.amis")

# Known AMIS city IDs → city names (discovered from amis.pk/districtcities.aspx)
# searchType=1&commodityId=N shows all commodities for city N
CITY_IDS: Dict[int, str] = {
    1: "Lahore",
    2: "Faisalabad",
    3: "Gujranwala",
    4: "Okara",
    5: "Sargodha",
    6: "Rawalpindi",
    7: "Multan",
    8: "RahimYarKhan",
    9: "Bhakkar",
    10: "Bhalwal",
    11: "Kasur",
    12: "DGKhan",
    13: "Sahiwal",
    14: "Vehari",
    15: "Burewala",
    16: "Sheikhupura",
    17: "Gujrat",
    18: "Khanewal",
    19: "MuzafarGhar",
    20: "Jhang",
    21: "Chakwal",
    22: "Attock",
    23: "Mianwali",
    24: "Khushab",
    25: "Jhelum",
    26: "Chiniot",
    27: "Nankana",
    28: "Hafizabad",
    29: "MandiBahaudin",
    30: "Narowal",
    31: "Sialkot",
    32: "TobaTekSingh",
    33: "Lodhran",
    34: "Pakpattan",
    35: "Bahawalpur",
    36: "Bahawalnagar",
}

# Category headers in the AMIS table — skip these rows
_CATEGORY_HEADERS = {"grains", "vegetables", "fruits"}

# Base URL for city-wise commodity prices
_CITY_URL = "http://www.amis.pk/ViewPrices.aspx?searchType=1&commodityId={city_id}"


def fetch_from_amis(city_ids: Optional[List[int]] = None) -> List[RawPrice]:
    """Fetch all commodity prices from AMIS for multiple cities.

    Args:
        city_ids: List of city IDs to fetch. Defaults to all known cities.

    Returns raw price records with prices in Rs/100kg (as reported by AMIS).
    The ingestion layer handles unit conversion to Rs/kg.
    """
    if city_ids is None:
        city_ids = list(CITY_IDS.keys())

    all_records: List[RawPrice] = []
    recorded = date.today()

    for city_id in city_ids:
        city_name = CITY_IDS.get(city_id, f"City_{city_id}")
        try:
            records, page_date = _fetch_city(city_id, city_name)
            if records:
                all_records.extend(records)
                if page_date:
                    recorded = page_date
                logger.info("AMIS city %s: %d commodities with prices", city_name, len(records))
            else:
                logger.debug("AMIS city %s: no price data today", city_name)
        except Exception as exc:
            logger.warning("AMIS city %s failed: %s", city_name, exc)
            continue

    if not all_records:
        raise SourceFetchError("AMIS fetched but no price rows found for any city")

    logger.info("AMIS total: %d commodities across %d cities", len(all_records), len(city_ids))
    return all_records


def _fetch_city(city_id: int, city_name: str) -> Tuple[List[RawPrice], Optional[date]]:
    """Fetch prices for a single city from AMIS."""
    url = _CITY_URL.format(city_id=city_id)
    try:
        response = httpx.get(
            url,
            timeout=HTTP_TIMEOUT_SECONDS,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; KissanRehnuma/1.0)",
                "Accept": "text/html",
            },
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise SourceFetchError(f"AMIS request failed for {city_name}: {exc}") from exc

    soup = BeautifulSoup(response.text, "html.parser")
    records: List[RawPrice] = []
    recorded: Optional[date] = None

    # Extract date from page (format: "Dated:DD-MM-YYYY")
    date_match = re.search(r"Dated[:\s]*(\d{2})-(\d{2})-(\d{4})", response.text)
    if date_match:
        day, month, year = date_match.groups()
        try:
            recorded = date(int(year), int(month), int(day))
        except ValueError:
            pass

    # Find all table rows in the price grid
    for row in soup.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 5:
            continue

        # Cell structure: [N CommodityName] [Graph link] [Min] [Max] [FQP] [Quantity]
        first_text = cells[0].get_text(" ", strip=True)

        # Skip category header rows (e.g., "Grains", "Vegetables", "Fruits")
        if first_text.lower().strip() in _CATEGORY_HEADERS:
            continue

        # Parse "N CommodityName" pattern
        name_match = re.match(r"^(\d+)\s+(.+)$", first_text)
        if not name_match:
            continue

        crop_name = name_match.group(2).strip()

        # Extract prices from remaining cells
        # cells[1] = Graph link, cells[2] = Min, cells[3] = Max, cells[4] = FQP
        min_price = _parse_price(cells[2].get_text(strip=True) if len(cells) > 2 else "-")
        max_price = _parse_price(cells[3].get_text(strip=True) if len(cells) > 3 else "-")
        fqp_price = _parse_price(cells[4].get_text(strip=True) if len(cells) > 4 else "-")

        # Skip if no price data at all
        if min_price is None and max_price is None and fqp_price is None:
            continue

        # Use FQP as the primary price, fall back to min/max average
        if fqp_price is not None:
            primary_price = fqp_price
        elif min_price is not None and max_price is not None:
            primary_price = (min_price + max_price) / 2
        elif min_price is not None:
            primary_price = min_price
        else:
            primary_price = max_price

        records.append(
            RawPrice(
                source="amis",
                raw_crop=crop_name,
                raw_price=primary_price,
                raw_unit="100kg",  # AMIS reports in Rs/100Kg (quintal)
                mandi=city_name,
                city=city_name,
                recorded_date=recorded or date.today(),
                raw_min_price=min_price,
                raw_max_price=max_price,
                raw_fqp_price=fqp_price,
            )
        )

    return records, recorded


def _parse_price(text: str) -> Optional[float]:
    """Parse a price cell. Returns None for '-' or empty cells."""
    text = text.strip().replace(",", "")
    if not text or text == "-":
        return None
    try:
        return float(text)
    except ValueError:
        return None
