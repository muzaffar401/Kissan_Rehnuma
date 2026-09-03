"""Weather tool for the Kissan Rehnuma voice agent."""

from __future__ import annotations

import aiohttp
from livekit.agents import function_tool
from livekit.agents.llm import ToolError
from uuid import uuid4

from app.agents.context import get_session_context, generate_internal_jwt, get_http_session
from app.core.config import get_settings
from app.core.logging import logger


@function_tool
async def check_weather_alert() -> dict:
    """Check current weather conditions and forecast for the farmer.

    Use this IMMEDIATELY when a farmer asks about weather, rain, mausam,
    temperature, or climate. Do NOT ask the farmer any questions before
    calling this tool — the system already knows their location.
    Just call it right away with no arguments.

    Calls the weather-alert-service which uses Open-Meteo for real weather data.

    Returns:
        A dict with current weather conditions and short forecast summary.
    """
    ctx = get_session_context()
    settings = get_settings()
    token = generate_internal_jwt(ctx.farmer_id)
    session = await get_http_session()

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Service-Caller": "voice-agent-service",
        "X-Correlation-Id": str(uuid4()),
    }
    base_url = settings.weather_service_url
    timeout = aiohttp.ClientTimeout(total=15)

    logger.info("Weather requested", extra={"farmer_id": str(ctx.farmer_id)})

    try:
        # Fetch current weather + forecast + advisory in parallel
        current_url = f"{base_url}/api/v1/weather/current/{ctx.farmer_id}"
        forecast_url = f"{base_url}/api/v1/weather/forecast/{ctx.farmer_id}"
        advisory_url = f"{base_url}/api/v1/weather/advisory/{ctx.farmer_id}"

        async with session.get(current_url, headers=headers, timeout=timeout) as curr_resp:
            if curr_resp.status == 404:
                return {
                    "success": False,
                    "message": (
                        "Farmer ki location register nahi hai. "
                        "Tell the farmer they need to register their location first "
                        "through the mobile app before weather info is available."
                    ),
                }
            if curr_resp.status != 200:
                body = await curr_resp.text()
                raise ToolError(f"Weather service error ({curr_resp.status}): {body}")
            current_data = await curr_resp.json()

        async with session.get(forecast_url, headers=headers, timeout=timeout) as fc_resp:
            forecast_data = {}
            if fc_resp.status == 200:
                forecast_data = await fc_resp.json()

        async with session.get(advisory_url, headers=headers, timeout=timeout) as adv_resp:
            advisory_text = ""
            if adv_resp.status == 200:
                adv_data = await adv_resp.json()
                advisory_text = adv_data.get("advisory", "")

        # Build summary for the LLM
        temp = current_data.get("temperature", "N/A")
        humidity = current_data.get("humidity", "N/A")
        wind = current_data.get("wind_speed_kmh", "N/A")
        rain = current_data.get("rain_mm", "N/A")

        # Summarize forecast: next 12 hours
        forecast_entries = forecast_data.get("forecast", [])
        forecast_summary = ""
        if forecast_entries:
            temps = [e.get("temp_max", 0) for e in forecast_entries[:12]]
            rains = [e.get("rain_mm", 0) for e in forecast_entries[:12]]
            max_temp = max(temps) if temps else "N/A"
            min_temp = min(temps) if temps else "N/A"
            total_rain = sum(rains) if rains else 0
            forecast_summary = (
                f"Next 12 hours: temp range {min_temp}°C to {max_temp}°C, "
                f"expected rain {total_rain:.1f}mm."
            )

        # Check for alert conditions
        alerts = []
        try:
            if float(temp) >= 45:
                alerts.append("HEATWAVE WARNING: Temperature is extremely high.")
            elif float(temp) >= 40:
                alerts.append("Heat advisory: Temperature is very high.")
            if float(temp) <= 2:
                alerts.append("FROST WARNING: Temperature is near freezing.")
            if float(rain) >= 15:
                alerts.append("HEAVY RAIN WARNING: Significant rainfall.")
            if float(wind) >= 40:
                alerts.append("HIGH WIND WARNING: Strong winds detected.")
        except (ValueError, TypeError):
            pass

        alert_text = " | ".join(alerts) if alerts else "No active weather alerts."

        return {
            "success": True,
            "current": {
                "temperature_c": temp,
                "humidity_percent": humidity,
                "wind_speed_kmh": wind,
                "rain_mm": rain,
            },
            "forecast_summary": forecast_summary,
            "alerts": alert_text,
            "advisory": advisory_text,
            "message": (
                f"Temperature {temp}°C, humidity {humidity}%, "
                f"wind {wind} km/h, rain {rain}mm. {forecast_summary} {alert_text} "
                f"ADVISORY: {advisory_text}"
            ),
        }

    except ToolError:
        raise
    except (aiohttp.ClientError, TimeoutError) as e:
        logger.error("Weather service call failed", extra={"error": str(e)})
        raise ToolError(
            "Weather service is currently unavailable. "
            "Tell the farmer to try again later."
        ) from e
    except Exception as e:
        logger.error("Unexpected error in weather tool", extra={"error": str(e)})
        raise ToolError("Failed to fetch weather data. Please try again.") from e
