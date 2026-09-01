from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

# Load .env from service root
_env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_env_path)

from app.api.v1.endpoints.weather import router as weather_router
from app.api.v1.endpoints.alerts import router as alerts_router
from app.api.v1.endpoints.devices import router as devices_router
from app.middleware.auth import AuthMiddleware
from app.services import scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start_scheduler()
    yield
    scheduler.stop_scheduler()


app = FastAPI(
    title="Kissan Rehnuma Weather Alert Service",
    lifespan=lifespan,
)

app.add_middleware(AuthMiddleware)

app.include_router(weather_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(devices_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "Weather Alert Service is running"}
