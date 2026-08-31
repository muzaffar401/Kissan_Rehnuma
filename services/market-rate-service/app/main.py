from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.endpoints import admin, rates
from app.services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
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
