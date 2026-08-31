from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import WEATHER_CACHE_MINUTES, FORECAST_HOURS
from app.db.database import get_db
from app.models.weather_snapshot import WeatherSnapshot
from app.repositories.farmer_repo import FarmerRepository
from app.repositories.farmer_location_repo import FarmerLocationRepository
from app.repositories.weather_snapshot_repo import WeatherSnapshotRepository
from app.schemas.weather import (
    CurrentWeatherResponse,
    ForecastEntry,
    ForecastResponse,
    FarmerLocationRequest,
    FarmerLocationResponse,
)
from app.services import weather_provider

router = APIRouter()


def _resolve_location(farmer_id: int, db: Session):
    """Return (latitude, longitude) or raise 404 when not registered."""
    location = FarmerLocationRepository(db).get(farmer_id)
    if location is None:
        raise HTTPException(
            status_code=404,
            detail="No location registered for this farmer. "
            "Call PUT /farmers/{farmer_id}/location first.",
        )
    return location.latitude, location.longitude


@router.put("/farmers/{farmer_id}/location", response_model=FarmerLocationResponse)
def register_farmer_location(
    farmer_id: int, payload: FarmerLocationRequest, db: Session = Depends(get_db)
):
    farmer = FarmerRepository(db).get_by_id(farmer_id)
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    location = FarmerLocationRepository(db).upsert(
        farmer_id, payload.latitude, payload.longitude
    )
    return FarmerLocationResponse(
        farmer_id=farmer_id,
        latitude=location.latitude,
        longitude=location.longitude,
    )


@router.get("/weather/current/{farmer_id}", response_model=CurrentWeatherResponse)
def get_current_weather(farmer_id: int, db: Session = Depends(get_db)):
    farmer = FarmerRepository(db).get_by_id(farmer_id)
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    latitude, longitude = _resolve_location(farmer_id, db)
    snapshot_repo = WeatherSnapshotRepository(db)

    # Serve from DB cache when the last reading is still fresh
    cache_cutoff = datetime.utcnow() - timedelta(minutes=WEATHER_CACHE_MINUTES)
    snapshot = snapshot_repo.get_fresh(farmer_id, since=cache_cutoff)
    source = "cache"

    if snapshot is None:
        try:
            current = weather_provider.fetch_current_weather(latitude, longitude)
        except weather_provider.WeatherProviderError as exc:
            # External API down -> fall back to the last known reading
            snapshot = snapshot_repo.get_latest(farmer_id)
            if snapshot is None:
                raise HTTPException(
                    status_code=502,
                    detail=f"Weather provider unavailable: {exc}",
                )
            source = "cache"
        else:
            snapshot = snapshot_repo.create(
                WeatherSnapshot(
                    farmer_id=farmer_id,
                    latitude=current.latitude,
                    longitude=current.longitude,
                    temperature=current.temperature,
                    humidity=current.humidity,
                    wind_speed_kmh=current.wind_speed_kmh,
                    rain_mm=current.rain_mm,
                    source="api",
                )
            )
            source = "api"

    return CurrentWeatherResponse(
        farmer_id=farmer_id,
        latitude=snapshot.latitude,
        longitude=snapshot.longitude,
        temperature=snapshot.temperature,
        humidity=snapshot.humidity,
        wind_speed_kmh=snapshot.wind_speed_kmh,
        rain_mm=snapshot.rain_mm,
        source=source,
        fetched_at=snapshot.fetched_at,
    )


@router.get("/weather/forecast/{farmer_id}", response_model=ForecastResponse)
def get_weather_forecast(farmer_id: int, db: Session = Depends(get_db)):
    farmer = FarmerRepository(db).get_by_id(farmer_id)
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    latitude, longitude = _resolve_location(farmer_id, db)

    try:
        hours = weather_provider.fetch_forecast(
            latitude, longitude, forecast_hours=FORECAST_HOURS
        )
    except weather_provider.WeatherProviderError as exc:
        raise HTTPException(
            status_code=502, detail=f"Weather provider unavailable: {exc}"
        )

    forecast: List[ForecastEntry] = [
        ForecastEntry(
            time=h.time,
            temp_min=h.temp_min,
            temp_max=h.temp_max,
            rain_mm=h.rain_mm,
            wind_kmh=h.wind_kmh,
        )
        for h in hours
    ]
    return ForecastResponse(farmer_id=farmer_id, forecast=forecast)
