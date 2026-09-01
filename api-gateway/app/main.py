from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, get_settings
from app.core.logger import get_logger, setup_logging
from app.core.rate_limiter import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.core.circuit_breaker import get_all_breaker_states
from fastapi.responses import JSONResponse
from app.api.routes.crop import router as crop_router
from app.api.routes.animal import router as animal_router

# Initialize logging
settings = get_settings()
setup_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    # Startup
    logger.info(
        "gateway_starting",
        app_name=settings.app_name,
        env=settings.app_env,
        port=settings.port,
    )

    # Create shared HTTP client for proxying requests
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(
            connect=10.0,
            read=120.0,  # Long timeout for AI image processing
            write=30.0,
            pool=10.0,
        ),
        limits=httpx.Limits(
            max_connections=100,
            max_keepalive_connections=20,
        ),
    )

    logger.info("gateway_started", message="API Gateway is ready")

    yield

    # Shutdown
    await app.state.http_client.aclose()
    logger.info("gateway_stopped", message="API Gateway shutdown complete")


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title=settings.app_name,
        description="Kissan Rehnuma API Gateway - Single entry point for all microservices",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # Rate Limiter (per slowapi official docs)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check endpoint
    @app.get("/health", tags=["Health"])
    async def health_check():
        """Gateway health check."""
        return {
            "status": "healthy",
            "service": settings.app_name,
            "version": "1.0.0",
        }

    # Circuit breaker status endpoint (for monitoring)
    @app.get("/circuit-breakers", tags=["Health"])
    async def circuit_breaker_status():
        """Get current state of all circuit breakers."""
        return {
            "circuit_breakers": get_all_breaker_states(),
        }

    # API info endpoint
    @app.get("/", tags=["Root"])
    async def root():
        """API Gateway information."""
        return {
            "name": "Kissan Rehnuma API Gateway",
            "version": "1.0.0",
            "docs": "/docs" if settings.debug else "Disabled in production",
            "services": {
                "auth": "/api/v1/auth/*",
                "crop": "/api/v1/crop/*",
                "animal": "/api/v1/animal/*",
                "weather": "/api/v1/weather/*",
                "market": "/api/v1/market/*",
                "helpline": "/api/v1/helpline/*",
            },
        }

    # Register route handlers
    app.include_router(crop_router)
    app.include_router(animal_router)

    return app


# Create the application instance
app = create_application()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
