"""Rule-based risk detection over current weather + hourly forecast."""
from dataclasses import dataclass
from typing import List, Optional

from app.services.weather_provider import CurrentWeather, ForecastHour
from app.core.config import (
    FROST_TEMP_C,
    HEATWAVE_TEMP_C,
    HEAVY_RAIN_TOTAL_MM,
    HIGH_WIND_KMH,
)

# Alert types, in priority order (first match wins)
FROST = "frost"
HEATWAVE = "heatwave"
HEAVY_RAIN = "heavy_rain"
HIGH_WIND = "high_wind"


@dataclass
class RiskResult:
    detected: bool
    risk_type: Optional[str] = None
    detail: Optional[str] = None


def detect_risk(
    current: CurrentWeather, forecast: List[ForecastHour]
) -> RiskResult:
    """Evaluate weather risks in priority order.

    Frost / heatwave can trigger on either the current reading or any
    forecast hour; rain and wind use the forecast window totals/peaks.
    """
    forecast_temps = [h.temp_min for h in forecast]

    # Frost: dangerous for standing crops overnight
    if current.temperature <= FROST_TEMP_C:
        return RiskResult(True, FROST, f"current temp {current.temperature}°C")
    if forecast_temps and min(forecast_temps) <= FROST_TEMP_C:
        return RiskResult(True, FROST, f"forecast min temp {min(forecast_temps)}°C")

    # Heatwave
    if current.temperature >= HEATWAVE_TEMP_C:
        return RiskResult(True, HEATWAVE, f"current temp {current.temperature}°C")
    if forecast_temps and max(forecast_temps) >= HEATWAVE_TEMP_C:
        return RiskResult(True, HEATWAVE, f"forecast max temp {max(forecast_temps)}°C")

    # Heavy rain: cumulative over the forecast window
    total_rain = sum(h.rain_mm for h in forecast) + (current.rain_mm or 0.0)
    if total_rain >= HEAVY_RAIN_TOTAL_MM:
        return RiskResult(True, HEAVY_RAIN, f"~{total_rain:.1f} mm expected")

    # High wind: peak in the forecast window or current gust
    peak_wind = max([h.wind_kmh for h in forecast], default=0.0)
    peak_wind = max(peak_wind, current.wind_speed_kmh or 0.0)
    if peak_wind >= HIGH_WIND_KMH:
        return RiskResult(True, HIGH_WIND, f"peak wind {peak_wind:.0f} km/h")

    return RiskResult(False)
