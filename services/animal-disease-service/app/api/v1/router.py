from fastapi import APIRouter

from app.api.v1.endpoints import animal

router = APIRouter()
router.include_router(animal.router)
