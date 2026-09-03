"""Proxy routes for user-auth-service."""

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
import httpx
import pybreaker

from app.core.config import get_settings
from app.core.logger import get_logger
from app.core.errors import handle_proxy_error
from app.core.rate_limiter import limiter, RATE_LIMIT_DEFAULT, RATE_LIMIT_HEALTH
from app.core.circuit_breaker import get_circuit_breaker

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

SERVICE_NAME = "user-auth-service"


def _get_target_url(path: str) -> str:
    """Gateway /api/v1/auth/* -> service /api/v1/auth/*"""
    return f"{settings.user_auth_service_url}{path}"


def _filter_headers(headers: dict) -> dict:
    skip = {
        "host", "connection", "keep-alive", "transfer-encoding",
        "te", "trailer", "upgrade", "proxy-authorization",
        "proxy-authenticate", "content-length", "content-type",
    }
    return {k: v for k, v in headers.items() if k.lower() not in skip}


async def _proxy_json(request: Request, target_url: str) -> Response:
    """Generic helper: forward a JSON body request to target_url."""
    client = request.app.state.http_client
    breaker = get_circuit_breaker(SERVICE_NAME)
    headers = _filter_headers(dict(request.headers))
    body = await request.body()

    try:
        with breaker.calling():
            response = await client.request(
                method=request.method,
                url=target_url,
                content=body,
                headers={**headers, "content-type": "application/json"},
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
# POST /api/v1/auth/signup  (public)
# =========================================================

@router.post("/signup", summary="Register a new farmer account")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_signup(request: Request):
    """Proxy to user-auth-service POST /api/v1/auth/signup"""
    return await _proxy_json(request, _get_target_url("/api/v1/auth/signup"))


# =========================================================
# POST /api/v1/auth/verify-signup-otp  (public)
# =========================================================

@router.post("/verify-signup-otp", summary="Verify email OTP after signup")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_verify_signup_otp(request: Request):
    """Proxy to user-auth-service POST /api/v1/auth/verify-signup-otp"""
    return await _proxy_json(request, _get_target_url("/api/v1/auth/verify-signup-otp"))


# =========================================================
# POST /api/v1/auth/login  (public — issues JWT)
# =========================================================

@router.post("/login", summary="Login and receive JWT token")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_login(request: Request):
    """Proxy to user-auth-service POST /api/v1/auth/login"""
    return await _proxy_json(request, _get_target_url("/api/v1/auth/login"))


# =========================================================
# POST /api/v1/auth/forgot-password  (public)
# =========================================================

@router.post("/forgot-password", summary="Request password reset OTP")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_forgot_password(request: Request):
    """Proxy to user-auth-service POST /api/v1/auth/forgot-password"""
    return await _proxy_json(request, _get_target_url("/api/v1/auth/forgot-password"))


# =========================================================
# POST /api/v1/auth/verify-otp  (public)
# =========================================================

@router.post("/verify-otp", summary="Verify password reset OTP")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_verify_otp(request: Request):
    """Proxy to user-auth-service POST /api/v1/auth/verify-otp"""
    return await _proxy_json(request, _get_target_url("/api/v1/auth/verify-otp"))


# =========================================================
# POST /api/v1/auth/reset-password  (public)
# =========================================================

@router.post("/reset-password", summary="Reset password with OTP")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_reset_password(request: Request):
    """Proxy to user-auth-service POST /api/v1/auth/reset-password"""
    return await _proxy_json(request, _get_target_url("/api/v1/auth/reset-password"))


# =========================================================
# POST /api/v1/auth/refresh  (public — rotates refresh token)
# =========================================================

@router.post("/refresh", summary="Refresh access token")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def proxy_refresh_token(request: Request):
    """Proxy to user-auth-service POST /api/v1/auth/refresh"""
    return await _proxy_json(request, _get_target_url("/api/v1/auth/refresh"))


# =========================================================
# GET /api/v1/auth/health  (public)
# =========================================================

@router.get("/health", summary="Auth service health check")
@limiter.limit(RATE_LIMIT_HEALTH)
async def proxy_health(request: Request):
    """Proxy to user-auth-service GET /"""
    client = request.app.state.http_client
    try:
        response = await client.get(f"{settings.user_auth_service_url}/")
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json"),
        )
    except (httpx.ConnectError, httpx.TimeoutException, Exception) as e:
        return await handle_proxy_error(e, SERVICE_NAME)
