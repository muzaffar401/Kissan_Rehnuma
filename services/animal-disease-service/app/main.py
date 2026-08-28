from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.core.migrations import run_migrations
from app.db.session import close_engine

setup_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    log.info(
        "starting_service",
        name=settings.app_name,
        env=settings.app_env,
        vision_model=settings.vision_model,
    )
    run_migrations()
    yield
    await close_engine()
    log.info("service_stopped")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Kissan Rehnuma — Animal Disease Service",
        description="AI-powered animal disease detection for Pakistani livestock farmers",
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    # ── Test UI (debug only) ─────────────────────────────────────
    if settings.debug:
        static_dir = Path(__file__).parent / "static"
        app.mount("/static", StaticFiles(directory=static_dir), name="static")

        @app.get("/test")
        async def test_ui():
            return FileResponse(static_dir / "test.html")

    @app.exception_handler(Exception)
    async def catch_unexpected(request: Request, exc: Exception):
        log.error("unhandled_exception", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "scan_id": None},
        )

    return app


app = create_app()
