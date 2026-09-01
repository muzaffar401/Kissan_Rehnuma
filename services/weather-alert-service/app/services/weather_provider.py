"""Weather data provider backed by the free Open-Meteo API (no key needed)."""
import random
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Tuple

from cachetools import TTLCache
import httpx

from app.core.config import OPEN_METEO_BASE_URL, HTTP_TIMEOUT_SECONDS, WEATHER_CACHE_MINUTES


# Stale-while-offline: serve last-known-good data when API is unreachable.
# Entries older than this are too old to trust — raise instead.
_STALE_MAX_SECONDS = 6 * 3600  # 6 hours absolute max age


class WeatherProviderError(Exception):
    """Raised when the external weather API cannot be reached or parsed."""


# In-memory caches keyed by (lat, lon) — avoids hitting Open-Meteo on every request.
# Current weather: 15 min TTL + jitter (weather changes fast).
# Forecast: 30 min TTL + jitter (forecasts update less frequently).
# Jitter (±10%) prevents thundering-herd: all entries expiring at the same instant.
_CURRENT_TTL = 15 * 60  # 15 minutes
_FORECAST_TTL = WEATHER_CACHE_MINUTES * 60  # 30 minutes (from config)
_current_cache: TTLCache = TTLCache(maxsize=50, ttl=_CURRENT_TTL)
_forecast_cache: TTLCache = TTLCache(maxsize=50, ttl=_FORECAST_TTL)

# Stale-while-offline stores: (value, stored_at) — survives TTL expiry when API is down
_stale_current: dict = {}
_stale_forecast: dict = {}


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


def _cache_key(latitude: float, longitude: float, **extra) -> Tuple:
    """Build a hashable cache key from coordinates + extra params.
    
    Rounds to 2 decimals (~1.1 km grid) so nearby requests share one entry.
    """
    return (round(latitude, 2), round(longitude, 2)) + tuple(sorted(extra.items()))


def _jittered_ttl(base_ttl: int) -> int:
    """Add ±10% jitter to TTL to prevent thundering-herd cache stampede."""
    return base_ttl + random.randint(-base_ttl // 10, base_ttl // 10)


def _get_stale(store: dict, key: Tuple):
    """Return stale cached value if it's within the max age limit."""
    entry = store.get(key)
    if entry is None:
        return None
    value, stored_at = entry
    age = (datetime.utcnow() - stored_at).total_seconds()
    if age > _STALE_MAX_SECONDS:
        store.pop(key, None)  # too old to trust
        return None
    return value


def _save_stale(store: dict, key: Tuple, value):
    """Save value to stale-while-offline store with timestamp."""
    store[key] = (value, datetime.utcnow())


def fetch_current_weather(latitude: float, longitude: float) -> CurrentWeather:
    """Fetch live conditions for the given coordinates.
    
    Caching strategy:
    - Hot cache: 15 min TTL with ±10% jitter
    - Stale fallback: serve up to 6h old data when API is unreachable
    """
    key = _cache_key(latitude, longitude)
    cached = _current_cache.get(key)
    if cached is not None:
        return cached

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
        result = CurrentWeather(
            latitude=float(data["latitude"]),
            longitude=float(data["longitude"]),
            temperature=float(current["temperature_2m"]),
            humidity=_optional_float(current, "relative_humidity_2m"),
            wind_speed_kmh=_optional_float(current, "wind_speed_10m"),
            rain_mm=_optional_float(current, "precipitation"),
            observed_at=datetime.fromisoformat(current["time"]),
        )
        _current_cache[key] = result
        _save_stale(_stale_current, key, result)
        return result
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        # API failed — try stale data before giving up
        stale = _get_stale(_stale_current, key)
        if stale is not None:
            return stale
        raise WeatherProviderError(f"Failed to fetch current weather: {exc}") from exc


def fetch_forecast(
    latitude: float, longitude: float, forecast_hours: int = 48
) -> List[ForecastHour]:
    """Fetch the next N hours of hourly forecast.
    
    Caching strategy:
    - Hot cache: 30 min TTL with ±10% jitter
    - Stale fallback: serve up to 6h old data when API is unreachable
    """
    key = _cache_key(latitude, longitude, hours=forecast_hours)
    cached = _forecast_cache.get(key)
    if cached is not None:
        return cached

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
        _forecast_cache[key] = entries
        _save_stale(_stale_forecast, key, entries)
        return entries
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        # API failed — try stale data before giving up
        stale = _get_stale(_stale_forecast, key)
        if stale is not None:
            return stale
        raise WeatherProviderError(f"Failed to fetch forecast: {exc}") from exc


def _optional_float(mapping: dict, key: str) -> Optional[float]:
    value = mapping.get(key)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
