"""Optional LLM advisory generation (OpenAI-compatible chat API).

Returns None when no LLM_API_KEY is configured or the call fails —
the caller then falls back to the static Roman-Urdu advisories.
"""
import logging
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import (
    HTTP_TIMEOUT_SECONDS,
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MODEL,
)
from app.services.risk_engine import RiskResult
from app.services.weather_provider import CurrentWeather

logger = logging.getLogger("weather_alert.llm")

_PROMPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "agents"
    / "prompts"
    / "advisory_prompt.txt"
)


def generate_advisory(risk: RiskResult, current: CurrentWeather) -> Optional[str]:
    """Ask the LLM for a localized advisory; None means use the fallback."""
    if not LLM_API_KEY:
        return None

    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    user_prompt = (
        f"Risk: {risk.risk_type} ({risk.detail}). "
        f"Current weather: {current.temperature}C, "
        f"rain {current.rain_mm or 0} mm, wind {current.wind_speed_kmh or 0} km/h."
    )
    try:
        response = httpx.post(
            f"{LLM_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {LLM_API_KEY}"},
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": 120,
            },
            timeout=HTTP_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()
        return text or None
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        logger.warning("LLM advisory failed, using static advisory: %s", exc)
        return None
