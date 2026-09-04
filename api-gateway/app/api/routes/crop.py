"""Proxy routes for crop-disease-service."""

from fastapi import APIRouter, Depends, Request, Response, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse, StreamingResponse
import httpx
import pybreaker

from app.core.config import get_settings
from app.core.logger import get_logger
from app.core.errors import handle_proxy_error
from app.core.security import TokenPayload, get_current_user
from app.core.rate_limiter import limiter, RATE_LIMIT_DETECT, RATE_LIMIT_HISTORY, RATE_LIMIT_HEALTH
from app.core.circuit_breaker import get_circuit_breaker

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1/crop", tags=["Crop Disease"])

# Service name for logging
SERVICE_NAME = "crop-disease-service"


def _get_target_url(path: str) -> str:
    """Build target URL for crop-disease-service."""
    base_url = settings.crop_disease_service_url
    # Map gateway paths to service paths
    # Gateway: /api/v1/crop/* -> Service: /api/v1/disease/*
    service_path = path.replace("/api/v1/crop/", "/api/v1/disease/")
    return f"{base_url}{service_path}"


def _filter_headers(headers: dict) -> dict:
    """Filter out hop-by-hop headers and content headers that httpx will regenerate."""
    # Headers to remove (hop-by-hop per HTTP spec + content headers for re-encoding)
    skip = {
        "host",
        "connection",
        "keep-alive",
        "transfer-encoding",
        "te",
        "trailer",
        "upgrade",
        "proxy-authorization",
        "proxy-authenticate",
        # Content headers — httpx regenerates these for the new request body
        "content-length",
        "content-type",
    }
    return {k: v for k, v in headers.items() if k.lower() not in skip}


# =========================================================
# POST /api/v1/crop/detect - Detect crop disease from image
# PROTECTED: Requires JWT authentication
# RATE LIMITED: 10 requests/minute (expensive AI processing)
# CIRCUIT BREAKER: Opens after 5 consecutive failures
# =========================================================

@router.post("/detect", summary="Detect crop disease from leaf image")
@limiter.limit(RATE_LIMIT_DETECT)
async def proxy_detect_disease(
    request: Request,
    current_user: TokenPayload = Depends(get_current_user),
    image: UploadFile = File(..., description="Crop leaf/plant image"),
    user_id: str = Form(None, description="Farmer/user identifier (defaults to JWT user)"),
    language: str = Form("en", description="Response language: en, ur, pa, sd"),
):
    """
    Proxy to crop-disease-service /api/v1/disease/detect
    
    Forwards the image upload to the crop disease detection service.
    The service will:
    1. Upload image to Cloudinary
    2. Call OpenRouter (Gemini Vision) for analysis
    3. Apply Confidence Gate
    4. Return diagnosis with treatment recommendations
    """
    client = request.app.state.http_client
    breaker = get_circuit_breaker(SERVICE_NAME)
    
    # Build target URL
    target_url = _get_target_url("/api/v1/crop/detect")
    
    # Use JWT user ID if not explicitly provided
    effective_user_id = user_id or current_user.sub
    
    # Read image bytes
    image_bytes = await image.read()
    
    # Build multipart form data for forwarding
    files = {
        "image": (image.filename, image_bytes, image.content_type or "image/jpeg")
    }
    data = {
        "user_id": effective_user_id,
        "language": language,
    }
    
    # Forward relevant headers
    headers = _filter_headers(dict(request.headers))
    
    logger.info(
        "proxy_detect_request",
        target_url=target_url,
        filename=image.filename,
        content_type=image.content_type,
        size_bytes=len(image_bytes),
        language=language,
        user_id=effective_user_id,
        authenticated=True,
    )
    
    try:
        # Circuit breaker: wraps the actual proxy call
        with breaker.calling():
            # Forward request to crop-disease-service
            response = await client.post(
                target_url,
                files=files,
                data=data,
                headers=headers,
            )
        
        logger.info(
            "proxy_detect_response",
            status_code=response.status_code,
            content_length=len(response.content),
        )
        
        # Return response with original status code
        return Response(
            content=response.text,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json"),
        )
        
    except pybreaker.CircuitBreakerError:
        logger.error(
            "circuit_breaker_open",
            service=SERVICE_NAME,
            endpoint="/detect",
        )
        return JSONResponse(
            status_code=503,
            content={
                "detail": f"{SERVICE_NAME} is currently experiencing issues. Please try again later.",
                "error_code": "CIRCUIT_BREAKER_OPEN",
            },
        )
    except httpx.ConnectError as e:
        return await handle_proxy_error(e, SERVICE_NAME)
    except httpx.TimeoutException as e:
        return await handle_proxy_error(e, SERVICE_NAME)
    except Exception as e:
        return await handle_proxy_error(e, SERVICE_NAME)


# =========================================================
# GET /api/v1/crop/history - Get scan history
# PROTECTED: Requires JWT authentication
# RATE LIMITED: 30 requests/minute
# CIRCUIT BREAKER: Opens after 5 consecutive failures
# =========================================================

@router.get("/history", summary="Get scan history")
@limiter.limit(RATE_LIMIT_HISTORY)
async def proxy_scan_history(
    request: Request,
    current_user: TokenPayload = Depends(get_current_user),
    user_id: str = Query(None, description="Filter by user/farmer ID (defaults to JWT user)"),
    limit: int = Query(50, ge=1, le=200, description="Max results"),
):
    """
    Proxy to crop-disease-service /api/v1/disease/history
    
    Returns scan history for a user or all scans.
    """
    client = request.app.state.http_client
    breaker = get_circuit_breaker(SERVICE_NAME)
    
    # Use JWT user ID if not explicitly provided
    effective_user_id = user_id or current_user.sub
    
    # Build target URL with query params
    target_url = _get_target_url("/api/v1/crop/history")
    params = {}
    if effective_user_id:
        params["user_id"] = effective_user_id
    if limit:
        params["limit"] = limit
    
    # Forward relevant headers
    headers = _filter_headers(dict(request.headers))
    
    logger.info(
        "proxy_history_request",
        target_url=target_url,
        user_id=effective_user_id,
        limit=limit,
        authenticated=True,
    )
    
    try:
        # Circuit breaker: wraps the actual proxy call
        with breaker.calling():
            response = await client.get(
                target_url,
                params=params,
                headers=headers,
            )
        
        logger.info(
            "proxy_history_response",
            status_code=response.status_code,
        )
        
        return Response(
            content=response.text,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json"),
        )
        
    except pybreaker.CircuitBreakerError:
        logger.error(
            "circuit_breaker_open",
            service=SERVICE_NAME,
            endpoint="/history",
        )
        return JSONResponse(
            status_code=503,
            content={
                "detail": f"{SERVICE_NAME} is currently experiencing issues. Please try again later.",
                "error_code": "CIRCUIT_BREAKER_OPEN",
            },
        )
    except httpx.ConnectError as e:
        return await handle_proxy_error(e, SERVICE_NAME)
    except httpx.TimeoutException as e:
        return await handle_proxy_error(e, SERVICE_NAME)
    except Exception as e:
        return await handle_proxy_error(e, SERVICE_NAME)


# =========================================================
# GET /api/v1/crop/health - Service health check
# RATE LIMITED: 120 requests/minute (lightweight)
# =========================================================

@router.get("/health", summary="Crop disease service health check")
@limiter.limit(RATE_LIMIT_HEALTH)
async def proxy_health_check(request: Request):
    """
    Proxy to crop-disease-service /api/v1/disease/health
    
    Returns health status of the crop disease detection service.
    """
    client = request.app.state.http_client
    
    # Build target URL
    target_url = _get_target_url("/api/v1/crop/health")
    
    logger.info("proxy_health_request", target_url=target_url)
    
    try:
        response = await client.get(target_url)
        
        logger.info(
            "proxy_health_response",
            status_code=response.status_code,
        )
        
        return Response(
            content=response.text,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json"),
        )
        
    except httpx.ConnectError as e:
        return await handle_proxy_error(e, SERVICE_NAME)
    except httpx.TimeoutException as e:
        return await handle_proxy_error(e, SERVICE_NAME)
    except Exception as e:
        return await handle_proxy_error(e, SERVICE_NAME)