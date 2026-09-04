from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

# Load .env from service root
_env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_env_path)

from app.api.v1.endpoints import admin, rates
from app.services.scheduler import start_scheduler, stop_scheduler
from app.core.migrations import run_migrations


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Kissan Rehnuma — Market Rate Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(rates.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/")
def health_check():
    return {"status": "ok", "service": "market-rate-service"}
