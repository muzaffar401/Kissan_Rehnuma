from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.migrations import run_migrations
from app.api.v1.endpoints.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: run database migrations
    run_migrations()
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="Kissan Rehnuma User Auth Service",
    lifespan=lifespan,
)


app.include_router(
    auth_router,
    prefix="/api/v1"
)


@app.get("/")
def root():
    return {
        "message": "User Auth Service is running"
    }


@app.get("/health")
def health():
    """Liveness probe — reachable only after lifespan migrations succeed,
    so sibling services (weather-alert) can wait for the shared schema."""
    return {"status": "ok"}
