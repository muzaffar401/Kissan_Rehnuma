"""Error handling utilities for API Gateway."""

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
import httpx

from app.core.logger import get_logger

logger = get_logger(__name__)


class ServiceUnavailableError(HTTPException):
    """Raised when a downstream microservice is unavailable."""

    def __init__(self, service_name: str, detail: str = None):
        super().__init__(
            status_code=503,
            detail=detail or f"{service_name} is currently unavailable. Please try again later.",
        )
        self.service_name = service_name


class ServiceTimeoutError(HTTPException):
    """Raised when a downstream microservice times out."""

    def __init__(self, service_name: str, detail: str = None):
        super().__init__(
            status_code=504,
            detail=detail or f"{service_name} request timed out. Please try again.",
        )
        self.service_name = service_name


class ServiceError(HTTPException):
    """Raised when a downstream microservice returns an error."""

    def __init__(self, status_code: int, detail: str, service_name: str = None):
        super().__init__(status_code=status_code, detail=detail)
        self.service_name = service_name


async def handle_proxy_error(
    error: Exception,
    service_name: str,
) -> JSONResponse:
    """Handle errors from proxy requests and return appropriate responses."""

    if isinstance(error, httpx.ConnectError):
        logger.error(
            "service_connection_error",
            service=service_name,
            error=str(error),
        )
        return JSONResponse(
            status_code=503,
            content={
                "detail": f"{service_name} is currently unavailable. Please try again later.",
                "error_code": "SERVICE_UNAVAILABLE",
            },
        )

    if isinstance(error, httpx.TimeoutException):
        logger.error(
            "service_timeout_error",
            service=service_name,
            error=str(error),
        )
        return JSONResponse(
            status_code=504,
            content={
                "detail": f"{service_name} request timed out. Please try again.",
                "error_code": "SERVICE_TIMEOUT",
            },
        )

    if isinstance(error, httpx.HTTPStatusError):
        # Pass through the error status from the downstream service
        logger.warning(
            "service_http_error",
            service=service_name,
            status_code=error.response.status_code,
            error=str(error),
        )
        return JSONResponse(
            status_code=error.response.status_code,
            content={
                "detail": f"{service_name} returned an error.",
                "error_code": "SERVICE_ERROR",
                "original_status": error.response.status_code,
            },
        )

    # Unexpected error
    logger.exception(
        "unexpected_proxy_error",
        service=service_name,
        error=str(error),
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred.",
            "error_code": "INTERNAL_ERROR",
        },
    )
