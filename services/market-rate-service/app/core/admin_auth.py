from fastapi import Header, HTTPException

from app.core.config import ADMIN_API_KEY


def require_admin(x_admin_key: str = Header(default=None)):
    """Admin-only protection for /admin/** endpoints."""
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Admin key required")
