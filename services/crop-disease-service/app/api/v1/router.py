from fastapi import APIRouter

from app.api.v1.endpoints import disease

router = APIRouter()
router.include_router(disease.router)
