"""Admin JWT authentication — separate from farmer JWT auth."""

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import Settings, get_settings

ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)


def create_admin_token(settings: Settings) -> str:
    """Create a JWT token for the admin user."""
    payload = {
        "sub": settings.admin_username,
        "role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.admin_token_expiry_minutes),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.admin_secret_key, algorithm=ALGORITHM)


def verify_admin_credentials(username: str, password: str, settings: Settings) -> bool:
    """Verify admin username/password."""
    return username == settings.admin_username and password == settings.admin_password


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    settings: Settings = Depends(get_settings),
) -> str:
    """Validate the JWT token and return the admin username."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        payload = jwt.decode(
            credentials.credentials, settings.admin_secret_key, algorithms=[ALGORITHM]
        )
        username: str | None = payload.get("sub")
        role: str | None = payload.get("role")
        if username is None or role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid admin credentials",
            )
        return username
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
