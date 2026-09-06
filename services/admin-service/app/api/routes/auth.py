"""Admin login endpoint."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.core.security import create_admin_token, verify_admin_credentials
from app.schemas.dashboard import LoginRequest, LoginResponse

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def admin_login(
    body: LoginRequest,
    settings: Settings = Depends(get_settings),
):
    """Authenticate admin and return JWT token."""
    if not verify_admin_credentials(body.username, body.password, settings):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )
    token = create_admin_token(settings)
    return LoginResponse(access_token=token)
