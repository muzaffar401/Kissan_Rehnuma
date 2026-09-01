from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logger import get_logger, setup_logging
from app.core.rate_limiter import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.core.circuit_breaker import get_all_breaker_states
from app.api.routes.crop import router as crop_router
from app.api.routes.animal import router as animal_router
from app.api.routes.auth import router as auth_router
from app.api.routes.weather import router as weather_router
from app.api.routes.market import router as market_router

settings = get_settings()
setup_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("gateway_starting", app_name=settings.app_name, env=settings.app_env, port=settings.port)
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0),
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    )
    logger.info("gateway_started", message="API Gateway is ready")
    yield
    await app.state.http_client.aclose()
    logger.info("gateway_stopped", message="API Gateway shutdown complete")


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="Kissan Rehnuma API Gateway",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["Health"])
    async def health_check():
        return {"status": "healthy", "service": settings.app_name, "version": "1.0.0"}

    @app.get("/circuit-breakers", tags=["Health"])
    async def circuit_breaker_status():
        return {"circuit_breakers": get_all_breaker_states()}

    @app.get("/", tags=["Root"])
    async def root():
        return {"name": "Kissan Rehnuma API Gateway", "version": "1.0.0"}

    app.include_router(auth_router)
    app.include_router(crop_router)
    app.include_router(animal_router)
    app.include_router(weather_router)
    app.include_router(market_router)

    return app


app = create_application()
