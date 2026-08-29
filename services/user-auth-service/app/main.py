from fastapi import FastAPI

from app.api.v1.endpoints.auth import router as auth_router


app = FastAPI(
    title="Kissan Rehnuma User Auth Service"
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