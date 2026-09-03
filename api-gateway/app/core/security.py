"""JWT authentication and authorization for API Gateway."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from typing import Optional

from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()

# OAuth2 scheme for extracting Bearer token from Authorization header
# tokenUrl points to the auth service login endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


class TokenPayload(BaseModel):
    """JWT token payload structure (matches user-auth-service).
    
    email is optional because service-to-service JWTs (from voice-agent)
    only contain 'sub' (farmer_id) without email.
    """
    sub: str  # farmer ID
    email: Optional[str] = None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> TokenPayload:
    """
    Validate JWT token and extract user information.
    
    This dependency:
    1. Extracts Bearer token from Authorization header
    2. Decodes and validates JWT using shared secret
    3. Returns token payload with user ID and email
    
    Raises:
        HTTPException 401: If token is missing, invalid, or expired
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if token is None:
        raise credentials_exception
    
    try:
        # Decode JWT token using python-jose (same library as auth service)
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        
        # Extract user information from payload
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if user_id is None:
            logger.warning("jwt_missing_sub", "Token payload missing 'sub' field")
            raise credentials_exception
        
        logger.debug(
            "jwt_validated",
            user_id=user_id,
            email=email,
        )
        
        return TokenPayload(sub=user_id, email=email)
        
    except JWTError as e:
        logger.warning(
            "jwt_invalid",
            error=str(e),
        )
        raise credentials_exception


async def get_optional_user(
    token: str = Depends(oauth2_scheme),
) -> Optional[TokenPayload]:
    """
    Optional authentication - returns None if no valid token.
    
    Use this for endpoints that work with or without authentication.
    """
    if token is None:
        return None
    
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if user_id is None:
            return None
        
        return TokenPayload(sub=user_id, email=email)
        
    except JWTError:
        return None
