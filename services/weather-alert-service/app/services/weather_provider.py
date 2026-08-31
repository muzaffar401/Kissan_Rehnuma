"""Weather data provider backed by the free Open-Meteo API (no key needed)."""
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

import httpx

from app.core.config import OPEN_METEO_BASE_URL, HTTP_TIMEOUT_SECONDS


class WeatherProviderError(Exception):
    """Raised when the external weather API cannot be reached or parsed."""


@dataclass
class CurrentWeather:
    latitude: float
    longitude: float
    temperature: float
    humidity: Optional[float]
    wind_speed_kmh: Optional[float]
    rain_mm: Optional[float]
    observed_at: datetime


@dataclass
class ForecastHour:
    time: datetime
    temp_min: float
    temp_max: float
    rain_mm: float
    wind_kmh: float


def fetch_current_weather(latitude: float, longitude: float) -> CurrentWeather:
    """Fetch live conditions for the given coordinates."""
    url = f"{OPEN_METEO_BASE_URL}/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation",
        "timezone": "auto",
    }
    try:
        response = httpx.get(url, params=params, timeout=HTTP_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
        current = data["current"]
        return CurrentWeather(
            latitude=float(data["latitude"]),
            longitude=float(data["longitude"]),
            temperature=float(current["temperature_2m"]),
            humidity=_optional_float(current, "relative_humidity_2m"),
            wind_speed_kmh=_optional_float(current, "wind_speed_10m"),
            rain_mm=_optional_float(current, "precipitation"),
            observed_at=datetime.fromisoformat(current["time"]),
        )
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        raise WeatherProviderError(f"Failed to fetch current weather: {exc}") from exc


def fetch_forecast(
    latitude: float, longitude: float, forecast_hours: int = 48
) -> List[ForecastHour]:
    """Fetch the next N hours of hourly forecast."""
    url = f"{OPEN_METEO_BASE_URL}/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,precipitation,wind_speed_10m",
        "forecast_hours": forecast_hours,
        "timezone": "auto",
    }
    try:
        response = httpx.get(url, params=params, timeout=HTTP_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
        hourly = data["hourly"]
        times = hourly["time"]
        temps = hourly["temperature_2m"]
        rain = hourly["precipitation"]
        wind = hourly["wind_speed_10m"]

        entries: List[ForecastHour] = []
        for i, time_str in enumerate(times):
            temp = temps[i]
            if temp is None:
                continue
            entries.append(
                ForecastHour(
                    time=datetime.fromisoformat(time_str),
                    temp_min=float(temp),
                    temp_max=float(temp),  # hourly resolution: min == max per hour
                    rain_mm=float(rain[i] or 0.0),
                    wind_kmh=float(wind[i] or 0.0),
                )
            )
        return entries
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        raise WeatherProviderError(f"Failed to fetch forecast: {exc}") from exc


def _optional_float(mapping: dict, key: str) -> Optional[float]:
    value = mapping.get(key)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
