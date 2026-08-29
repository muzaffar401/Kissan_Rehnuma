from fastapi import APIRouter

from app.api.v1.endpoints import complaints, health, sessions

router = APIRouter()
router.include_router(health.router, tags=["health"])
router.include_router(sessions.router, prefix="/helpline/sessions", tags=["helpline sessions"])
router.include_router(complaints.router, prefix="/complaints", tags=["complaints"])

