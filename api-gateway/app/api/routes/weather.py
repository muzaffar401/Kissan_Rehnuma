"""Proxy routes for weather-alert-service."""

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
import httpx
import pybreaker

from app.core.config import get_settings
from app.core.logger import get_logger
from app.core.errors import handle_proxy_error
from app.core.security import TokenPayload, get_current_user
from app.core.rate_limiter import limiter, RATE_LIMIT_DEFAULT, RATE_LIMIT_HISTORY, RATE_LIMIT_HEALTH
from app.core.circuit_breaker import get_circuit_breaker

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1", tags=["Weather & Alerts"])

SERVICE_NAME = "weather-alert-service"


def _get_target_url(path: str) -> str:
    """Gateway /api/v1/* -> service /api/v1/*"""
    return f"{settings.weather_alert_service_url}{path}"


def _filter_headers(headers: dict) -> dict:
    skip = {
        "host", "connection", "keep-alive", "transfer-encoding",
        "te", "trailer", "upgrade", "proxy-authorization",
        "proxy-authenticate", "content-length", "content-type",
    }
    return {k: v for k, v in headers.items() if k.lower() not in skip}


async def _proxy_request(request: Request, target_url: str, **kwargs) -> Response:
    """Forward any request to target_url, streaming body as-is."""
    client = request.app.state.http_client
    breaker = get_circuit_breaker(SERVICE_NAME)
    headers = _filter_headers(dict(request.headers))
    body = await request.body()
    params = dict(request.query_params)

    try:
        with breaker.calling():
            response = await client.request(
                method=request.method,
                url=target_url,
                content=body,
                headers={**headers, "content-type": "application/json"},
                params=params,
                **kwargs,
            )
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json"),
        )
    except pybreaker.CircuitBreakerError:
        logger.error("circuit_breaker_open", service=SERVICE_NAME)
        return JSONResponse(
            status_code=503,
            content={"detail": f"{SERVICE_NAME} is currently unavailable.", "error_code": "CIRCUIT_BREAKER_OPEN"},
        )
    except (httpx.ConnectError, httpx.TimeoutException, Exception) as e:
        return await handle_proxy_error(e, SERVICE_NAME)


# =========================================================
# PUT /api/v1/farmers/{farmer_id}/location  (protected)
# =========================================================

@router.put("/farmers/{farmer_id}/location", summary="Register farmer GPS location")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_register_location(
    request: Request,
    farmer_id: int,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Proxy to weather-alert-service PUT /api/v1/farmers/{farmer_id}/location"""
    target = _get_target_url(f"/api/v1/farmers/{farmer_id}/location")
    logger.info("proxy_weather_register_location", farmer_id=farmer_id)
    return await _proxy_request(request, target)


# =========================================================
# GET /api/v1/weather/current/{farmer_id}  (protected)
# =========================================================

@router.get("/weather/current/{farmer_id}", summary="Get current weather for farmer")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_current_weather(
    request: Request,
    farmer_id: int,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Proxy to weather-alert-service GET /api/v1/weather/current/{farmer_id}"""
    target = _get_target_url(f"/api/v1/weather/current/{farmer_id}")
    logger.info("proxy_weather_current_request", farmer_id=farmer_id)
    return await _proxy_request(request, target)


# =========================================================
# GET /api/v1/weather/forecast/{farmer_id}  (protected)
# =========================================================

@router.get("/weather/forecast/{farmer_id}", summary="Get weather forecast for farmer")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_weather_forecast(
    request: Request,
    farmer_id: int,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Proxy to weather-alert-service GET /api/v1/weather/forecast/{farmer_id}"""
    target = _get_target_url(f"/api/v1/weather/forecast/{farmer_id}")
    logger.info("proxy_weather_forecast_request", farmer_id=farmer_id)
    return await _proxy_request(request, target)


# =========================================================
# POST /api/v1/alerts/trigger-check  (protected)
# =========================================================

@router.post("/alerts/trigger-check", summary="Trigger weather alert check")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_trigger_alert_check(
    request: Request,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Proxy to weather-alert-service POST /api/v1/alerts/trigger-check"""
    target = _get_target_url("/api/v1/alerts/trigger-check")
    logger.info("proxy_alerts_trigger_check")
    return await _proxy_request(request, target)


# =========================================================
# GET /api/v1/alerts/history/{farmer_id}  (protected)
# =========================================================

@router.get("/alerts/history/{farmer_id}", summary="Get alert history for farmer")
@limiter.limit(RATE_LIMIT_HISTORY)
async def proxy_alert_history(
    request: Request,
    farmer_id: int,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Proxy to weather-alert-service GET /api/v1/alerts/history/{farmer_id}"""
    target = _get_target_url(f"/api/v1/alerts/history/{farmer_id}")
    logger.info("proxy_alerts_history_request", farmer_id=farmer_id)
    return await _proxy_request(request, target)


# =========================================================
# POST /api/v1/devices/register  (protected)
# =========================================================

@router.post("/devices/register", summary="Register device for push notifications")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_register_device(
    request: Request,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Proxy to weather-alert-service POST /api/v1/devices/register"""
    target = _get_target_url("/api/v1/devices/register")
    logger.info("proxy_devices_register")
    return await _proxy_request(request, target)


# =========================================================
# DELETE /api/v1/devices/unregister  (protected)
# =========================================================

@router.delete("/devices/unregister", summary="Unregister device from push notifications")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_unregister_device(
    request: Request,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Proxy to weather-alert-service DELETE /api/v1/devices/unregister"""
    target = _get_target_url("/api/v1/devices/unregister")
    logger.info("proxy_devices_unregister")
    return await _proxy_request(request, target)


# =========================================================
# GET /api/v1/weather/health  (public)
# =========================================================

@router.get("/weather/health", summary="Weather service health check")
@limiter.limit(RATE_LIMIT_HEALTH)
async def proxy_health(request: Request):
    """Proxy to weather-alert-service GET /"""
    client = request.app.state.http_client
    try:
        response = await client.get(f"{settings.weather_alert_service_url}/")
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json"),
        )
    except (httpx.ConnectError, httpx.TimeoutException, Exception) as e:
        return await handle_proxy_error(e, SERVICE_NAME)
