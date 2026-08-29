from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.api.dependencies import DatabaseSession

router = APIRouter()


@router.get("/health/live")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
async def readiness(db: DatabaseSession) -> dict[str, str]:
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database is unavailable"
        ) from exc
    return {"status": "ready"}

