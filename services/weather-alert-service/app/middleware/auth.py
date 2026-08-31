"""Bearer-token auth for every /api/** route.

Tokens are issued by user-auth-service (POST /login); this service only
verifies them with the shared secret. Docs and health-check stay public.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.security import verify_token

PUBLIC_PATHS = {"/", "/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in PUBLIC_PATHS or not path.startswith("/api/"):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Not authenticated"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = verify_token(auth_header.removeprefix("Bearer ").strip())
        if payload is None or "sub" not in payload:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Downstream handlers can read the authenticated farmer id
        request.state.farmer_id = int(payload["sub"])
        return await call_next(request)
