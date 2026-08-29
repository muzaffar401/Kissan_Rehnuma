from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.responses import FileResponse, JSONResponse

from app.api.v1.router import router as api_v1_router
from app.clients.uplift.client import UpliftClient
from app.core.config import get_settings
from app.core.exceptions import (
    ConflictError,
    ResourceNotFoundError,
    UpstreamUnavailableError,
)
from app.core.logging import configure_logging
from app.db.session import engine

STATIC_DIR = Path(__file__).parent / "static"

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.uplift_client = UpliftClient(settings)
    yield
    await app.state.uplift_client.aclose()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)
app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/test", include_in_schema=False)
async def test_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "test.html")


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code, content={"error": {"code": code, "message": message}}
    )


@app.exception_handler(ResourceNotFoundError)
async def not_found_handler(_: Request, exc: ResourceNotFoundError) -> JSONResponse:
    return error_response(status.HTTP_404_NOT_FOUND, "not_found", str(exc))


@app.exception_handler(ConflictError)
async def conflict_handler(_: Request, exc: ConflictError) -> JSONResponse:
    return error_response(status.HTTP_409_CONFLICT, "conflict", str(exc))


@app.exception_handler(UpstreamUnavailableError)
async def upstream_handler(_: Request, exc: UpstreamUnavailableError) -> JSONResponse:
    return error_response(status.HTTP_503_SERVICE_UNAVAILABLE, "upstream_unavailable", str(exc))

