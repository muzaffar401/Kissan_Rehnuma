"""LLM-powered agricultural advisory generation via OpenRouter (Gemini).

Generates context-aware Roman-Urdu advisories using:
- Current weather conditions (temperature, rain, wind, humidity)
- Hourly forecast summary (next 24-48h: min/max temp, total rain, peak wind)
- Detected risk type with details

Falls back to None when the API key is missing or the call fails —
the caller then uses static Roman-Urdu advisories from advisories.py.
"""
import logging
from pathlib import Path
from typing import List, Optional

import httpx

from app.core.config import (
    HTTP_TIMEOUT_SECONDS,
    LLM_BASE_URL,
    LLM_MAX_TOKENS,
    LLM_MODEL,
    LLM_TEMPERATURE,
    OPENROUTER_API_KEY,
)
from app.services.risk_engine import RiskResult
from app.services.weather_provider import CurrentWeather, ForecastHour

logger = logging.getLogger("weather_alert.llm")

_PROMPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "agents"
    / "prompts"
    / "advisory_prompt.txt"
)

_GENERAL_PROMPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "agents"
    / "prompts"
    / "general_advisory_prompt.txt"
)


def _build_forecast_summary(forecast: List[ForecastHour]) -> str:
    """Compress hourly forecast into a short textual summary for the LLM."""
    if not forecast:
        return "No forecast data available."

    temps = [h.temp_min for h in forecast]
    rain_total = sum(h.rain_mm for h in forecast)
    peak_wind = max(h.wind_kmh for h in forecast)

    # Find rain-heavy windows (>= 2mm in any 6-hour block)
    heavy_rain_periods = []
    for i in range(0, len(forecast) - 5, 6):
        block = forecast[i : i + 6]
        block_rain = sum(h.rain_mm for h in block)
        if block_rain >= 2.0:
            start_time = block[0].time.strftime("%H:%M")
            end_time = block[-1].time.strftime("%H:%M")
            heavy_rain_periods.append(f"{start_time}-{end_time}")

    summary_parts = [
        f"Next {len(forecast)} hours:",
        f"  Temp range: {min(temps):.1f}°C to {max(temps):.1f}°C",
        f"  Total expected rain: {rain_total:.1f} mm",
        f"  Peak wind: {peak_wind:.0f} km/h",
    ]
    if heavy_rain_periods:
        summary_parts.append(
            f"  Heavy rain expected around: {', '.join(heavy_rain_periods)}"
        )

    return "\n".join(summary_parts)


def generate_advisory(
    risk: RiskResult,
    current: CurrentWeather,
    forecast: Optional[List[ForecastHour]] = None,
) -> Optional[str]:
    """Ask the LLM for a localized advisory; None means use the fallback."""
    if not OPENROUTER_API_KEY:
        logger.debug("No OPENROUTER_API_KEY configured, skipping LLM advisory")
        return None

    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")

    forecast_summary = (
        _build_forecast_summary(forecast) if forecast else "No forecast data."
    )

    user_prompt = (
        f"DETECTED RISK: {risk.risk_type} — {risk.detail}\n"
        f"\n"
        f"CURRENT WEATHER:\n"
        f"  Temperature: {current.temperature}°C\n"
        f"  Humidity: {current.humidity or 'N/A'}%\n"
        f"  Wind: {current.wind_speed_kmh or 'N/A'} km/h\n"
        f"  Rain: {current.rain_mm or 0} mm\n"
        f"\n"
        f"FORECAST:\n"
        f"{forecast_summary}\n"
        f"\n"
        f"Generate a short, actionable advisory for the farmer."
    )

    try:
        response = httpx.post(
            f"{LLM_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://kissanrehnuma.com",
                "X-Title": "Kissan Rehnuma Weather Alerts",
            },
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": LLM_TEMPERATURE,
                "max_tokens": LLM_MAX_TOKENS,
            },
            timeout=max(HTTP_TIMEOUT_SECONDS, 30.0),
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()

        if not text:
            logger.warning("LLM returned empty advisory")
            return None

        logger.info(
            "llm_advisory_generated",
            risk=risk.risk_type,
            length=len(text),
        )
        return text

    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        logger.warning("LLM advisory failed, using static fallback: %s", exc)
        return None


def generate_general_advisory(
    current: CurrentWeather,
    forecast: Optional[List[ForecastHour]] = None,
) -> Optional[str]:
    """Generate general weather-based farming advice via LLM.

    Unlike generate_advisory(), this does NOT require a detected risk —
    it produces everyday farming guidance based on current conditions
    and the upcoming forecast.
    """
    if not OPENROUTER_API_KEY:
        logger.debug("No OPENROUTER_API_KEY configured, skipping general advisory")
        return None

    system_prompt = _GENERAL_PROMPT_PATH.read_text(encoding="utf-8")
    forecast_summary = (
        _build_forecast_summary(forecast) if forecast else "No forecast data."
    )

    user_prompt = (
        f"CURRENT WEATHER:\n"
        f"  Temperature: {current.temperature}°C\n"
        f"  Humidity: {current.humidity or 'N/A'}%\n"
        f"  Wind: {current.wind_speed_kmh or 'N/A'} km/h\n"
        f"  Rain: {current.rain_mm or 0} mm\n"
        f"\n"
        f"FORECAST:\n"
        f"{forecast_summary}\n"
        f"\n"
        f"Generate practical farming advice for the next 24-48 hours."
    )

    try:
        response = httpx.post(
            f"{LLM_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://kissanrehnuma.com",
                "X-Title": "Kissan Rehnuma Weather Alerts",
            },
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": LLM_TEMPERATURE,
                "max_tokens": LLM_MAX_TOKENS,
            },
            timeout=max(HTTP_TIMEOUT_SECONDS, 30.0),
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()

        if not text:
            logger.warning("LLM returned empty general advisory")
            return None

        logger.info("llm_general_advisory_generated", length=len(text))
        return text

    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        logger.warning("LLM general advisory failed: %s", exc)
        return None
