"""JWT verification for tokens issued by user-auth-service."""
from typing import Optional

from jose import JWTError, jwt

from app.core.config import JWT_ALGORITHM, JWT_SECRET_KEY


def verify_token(token: str) -> Optional[dict]:
    """Return the token payload, or None when invalid/expired.

    Expected payload (same as auth-service login): {"sub": "<farmer_id>", "email": "..."}
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
