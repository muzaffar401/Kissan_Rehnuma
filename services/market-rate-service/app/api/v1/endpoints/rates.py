from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.mandi import Mandi
from app.repositories.price_repo import PriceRepository
from app.schemas.rates import (
    AllRatesResponse, CropPrice, MandiPrice, RatesResponse,
    TrendEntry, TrendingResponse,
)
from app.services import cache, ingestion

router = APIRouter()


def _resolve_crop(crop: str) -> str:
    """Accept raw variants ("gandum") and standardize ("Wheat")."""
    return ingestion.standardize_crop(crop) or crop.strip().title()


@router.get("/rates", response_model=AllRatesResponse)
def get_all_rates(
    q: str = Query(None, description="Search by crop name"),
    db: Session = Depends(get_db),
):
    """All latest mandi rates, optionally filtered by crop name."""
    key = f"all_rates:{q or 'all'}"
    cached = cache.cache_get(key)
    if cached is not None:
        return cached

    repo = PriceRepository(db)
    rows = repo.all_latest(limit=500)

    # Optional search filter
    if q:
        q_lower = q.strip().lower()
        rows = [r for r in rows if q_lower in r["crop_name"].lower()]

    crops = [
        CropPrice(
            crop_name=r["crop_name"],
            mandi_name=r["mandi_name"],
            city=r["city"],
            price=r["price"],
            min_price=r["min_price"],
            max_price=r["max_price"],
            fqp_price=r["fqp_price"],
            recorded_date=r["recorded_date"],
            source=r["source"],
        )
        for r in rows
    ]

    recorded = rows[0]["recorded_date"] if rows else None
    response = AllRatesResponse(
        recorded_date=recorded,
        total=len(crops),
        crops=crops,
    ).model_dump(mode="json")
    cache.cache_set(key, response)
    return response


@router.get("/rates/trending", response_model=TrendingResponse)
def get_trending(days: int = 7, db: Session = Depends(get_db)):
    """Average price per crop: last `days` vs the `days` before that."""
    key = f"trending:{days}"
    cached = cache.cache_get(key)
    if cached is not None:
        return cached

    repo = PriceRepository(db)
    today = date.today()
    current = repo.averages_between(today - timedelta(days=days - 1), today)
    previous = repo.averages_between(
        today - timedelta(days=2 * days - 1), today - timedelta(days=days)
    )

    trends = []
    for crop, cur_avg in sorted(current.items()):
        prev_avg = previous.get(crop)
        if prev_avg is None:
            trends.append(
                TrendEntry(crop=crop, current_avg=round(cur_avg, 2), direction="new")
            )
            continue
        change = (cur_avg - prev_avg) / prev_avg * 100
        if change > 0.5:
            direction = "up"
        elif change < -0.5:
            direction = "down"
        else:
            direction = "flat"
        trends.append(
            TrendEntry(
                crop=crop,
                current_avg=round(cur_avg, 2),
                previous_avg=round(prev_avg, 2),
                change_percent=round(change, 2),
                direction=direction,
            )
        )

    response = TrendingResponse(days=days, trends=trends).model_dump(mode="json")
    cache.cache_set(key, response)
    return response


@router.get("/rates/{crop}", response_model=RatesResponse)
def get_rates(crop: str, db: Session = Depends(get_db)):
    """Latest price per mandi for a crop (cache first, DB on miss)."""
    name = _resolve_crop(crop)
    key = f"rates:{name.lower()}"
    cached = cache.cache_get(key)
    if cached is not None:
        cached["cached"] = True
        return cached

    rows = PriceRepository(db).latest_for_crop(name)
    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No prices recorded for '{name}'"
        )

    # Keep only the newest row per mandi
    latest_by_mandi = {}
    for row in rows:
        if row.mandi_id not in latest_by_mandi:
            latest_by_mandi[row.mandi_id] = row

    mandis = {
        m.id: m
        for m in db.query(Mandi)
        .filter(Mandi.id.in_(list(latest_by_mandi.keys())))
        .all()
    }
    prices = [
        MandiPrice(
            mandi=mandis[row.mandi_id].name,
            city=mandis[row.mandi_id].city,
            price_per_kg=float(row.price),
            min_price_per_kg=float(row.min_price) if row.min_price else None,
            max_price_per_kg=float(row.max_price) if row.max_price else None,
            fqp_price_per_kg=float(row.fqp_price) if row.fqp_price else None,
            recorded_date=row.recorded_date,
            source=row.source,
        )
        for row in latest_by_mandi.values()
    ]

    response = RatesResponse(crop=name, prices=prices).model_dump(mode="json")
    cache.cache_set(key, response)
    response["cached"] = False
    return response
