"""Proxy routes for market-rate-service."""

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

router = APIRouter(prefix="/api/v1/market", tags=["Market Rates"])

SERVICE_NAME = "market-rate-service"


def _get_target_url(path: str) -> str:
    """Gateway /api/v1/market/* -> service /api/v1/*"""
    # Strip the /market prefix: /api/v1/market/rates/... -> /api/v1/rates/...
    service_path = path.replace("/api/v1/market/", "/api/v1/")
    return f"{settings.market_rate_service_url}{service_path}"


def _filter_headers(headers: dict) -> dict:
    skip = {
        "host", "connection", "keep-alive", "transfer-encoding",
        "te", "trailer", "upgrade", "proxy-authorization",
        "proxy-authenticate", "content-length", "content-type",
    }
    return {k: v for k, v in headers.items() if k.lower() not in skip}


async def _proxy_request(request: Request, target_url: str) -> Response:
    """Forward a request to target_url, preserving query params."""
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
                headers=headers,
                params=params,
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
# GET /api/v1/market/rates/trending  (protected)
# =========================================================

@router.get("/rates/trending", summary="Get trending crop price directions")
@limiter.limit(RATE_LIMIT_HISTORY)
async def proxy_trending(
    request: Request,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Proxy to market-rate-service GET /api/v1/rates/trending"""
    target = _get_target_url("/api/v1/market/rates/trending")
    logger.info("proxy_market_trending_request")
    return await _proxy_request(request, target)


# =========================================================
# GET /api/v1/market/rates/{crop}  (protected)
# =========================================================

@router.get("/rates/{crop}", summary="Get latest mandi prices for a crop")
@limiter.limit(RATE_LIMIT_HISTORY)
async def proxy_rates_by_crop(
    request: Request,
    crop: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Proxy to market-rate-service GET /api/v1/rates/{crop}"""
    target = _get_target_url(f"/api/v1/market/rates/{crop}")
    logger.info("proxy_market_rates_request", crop=crop)
    return await _proxy_request(request, target)


# =========================================================
# GET /api/v1/market/health  (public)
# =========================================================

@router.get("/health", summary="Market rate service health check")
@limiter.limit(RATE_LIMIT_HEALTH)
async def proxy_health(request: Request):
    """Proxy to market-rate-service GET /"""
    client = request.app.state.http_client
    try:
        response = await client.get(f"{settings.market_rate_service_url}/")
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json"),
        )
    except (httpx.ConnectError, httpx.TimeoutException, Exception) as e:
        return await handle_proxy_error(e, SERVICE_NAME)
