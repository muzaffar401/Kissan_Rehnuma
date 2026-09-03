"""Market rates tool for the Kissan Rehnuma voice agent."""

from __future__ import annotations

import aiohttp
from livekit.agents import function_tool
from livekit.agents.llm import ToolError

from app.agents.context import get_http_session
from app.core.config import get_settings
from app.core.logging import logger


@function_tool
async def get_market_rates(crop: str, mandi: str = "nearest") -> dict:
    """Get current market rates for a crop across all mandis.

    Use this when a farmer asks about crop prices, mandi rates, or
    wants to know the current selling price of their produce.

    Calls the market-rate-service which has real mandi data from
    AMIS Punjab and IRFarm (112+ records, 56 crops, 4 cities).
    The service handles Urdu, Roman Urdu, and English crop names.

    IMPORTANT: Always pass crop names in Roman Urdu or English (e.g., "aloo",
    "gandum", "tamatar", "pyaz"). Do NOT pass Urdu script — the service
    handles the translation internally.

    Args:
        crop: Name of the crop in Roman Urdu or English (e.g., "aloo", "gandum",
              "sugarcane", "tamatar", "pyaz"). Do NOT use Urdu script.
        mandi: Name of the market/mandi in Roman Urdu or English. Use 'nearest'
               if farmer doesn't specify. When 'nearest', all available mandi
               prices are returned.

    Returns:
        A dict with mandi-wise prices including min/max/average per kg.
    """
    settings = get_settings()
    session = await get_http_session()
    base_url = settings.market_rate_service_url
    timeout = aiohttp.ClientTimeout(total=10)

    logger.info("Market rates requested", extra={"crop": crop, "mandi": mandi})

    try:
        url = f"{base_url}/api/v1/rates/{crop}"
        async with session.get(url, timeout=timeout) as resp:
            if resp.status == 404:
                return {
                    "success": False,
                    "crop": crop,
                    "message": (
                        f"No market rates found for '{crop}'. "
                        f"Tell the farmer this crop's rates are not available yet. "
                        f"They can try again later or check a different crop."
                    ),
                }
            if resp.status != 200:
                body = await resp.text()
                raise ToolError(f"Market service error ({resp.status}): {body}")
            data = await resp.json()

        prices = data.get("prices", [])
        if not prices:
            return {
                "success": False,
                "crop": crop,
                "message": f"No prices found for {crop}.",
            }

        # Filter by mandi if specified (not 'nearest')
        if mandi and mandi.lower() != "nearest":
            mandi_lower = mandi.lower()
            filtered = [
                p for p in prices
                if mandi_lower in p.get("mandi", "").lower()
                or mandi_lower in p.get("city", "").lower()
            ]
            if filtered:
                prices = filtered

        # Build price summary for the LLM
        price_lines = []
        for p in prices[:10]:  # Limit to 10 mandis max for voice
            mandi_name = p.get("mandi", "Unknown")
            city = p.get("city", "")
            price_kg = p.get("price_per_kg", 0)
            min_p = p.get("min_price_per_kg")
            max_p = p.get("max_price_per_kg")

            price_str = f"Rs {price_kg:.0f}/kg"
            if min_p and max_p:
                price_str = f"Rs {min_p:.0f}-{max_p:.0f}/kg (avg {price_kg:.0f})"

            location = f"{mandi_name}, {city}" if city else mandi_name
            price_lines.append(f"{location}: {price_str}")

        prices_text = ". ".join(price_lines)
        crop_name = data.get("crop", crop)

        return {
            "success": True,
            "crop": crop_name,
            "prices": prices[:10],
            "message": (
                f"Market rates for {crop_name}: {prices_text}. "
                f"All prices are per kg in Pakistani Rupees."
            ),
        }

    except ToolError:
        raise
    except (aiohttp.ClientError, TimeoutError) as e:
        logger.error("Market service call failed", extra={"error": str(e)})
        raise ToolError(
            "Market rate service is currently unavailable. "
            "Tell the farmer to try again later."
        ) from e
    except Exception as e:
        logger.error("Unexpected error in market rates tool", extra={"error": str(e)})
        raise ToolError("Failed to fetch market rates. Please try again.") from e
