"""Session context and shared helpers for voice agent tools.

Manages per-call state (farmer_id, voice_session_id) and provides
service-to-service utilities (JWT generation, HTTP session pooling).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID, uuid4

import aiohttp
from jose import jwt
from livekit.agents import utils

from app.core.config import get_settings


# ---------------------------------------------------------------------------
# Per-session context
# ---------------------------------------------------------------------------

class SessionContext:
    """Holds per-call session data for tool functions."""

    def __init__(self, farmer_id: str | int | UUID, voice_session_id: UUID, farmer_name: str = "Farmer"):
        self.farmer_id = farmer_id
        self.voice_session_id = voice_session_id
        self.farmer_name = farmer_name
        self.complaints_this_session: int = 0


# Thread-local-like context set per room session
_current_context: SessionContext | None = None


def set_session_context(ctx: SessionContext) -> None:
    global _current_context
    _current_context = ctx


def get_session_context() -> SessionContext:
    if _current_context is None:
        raise RuntimeError("Session context not set. Call set_session_context first.")
    return _current_context


# ---------------------------------------------------------------------------
# Service-to-service helpers
# ---------------------------------------------------------------------------

def generate_internal_jwt(farmer_id: str | int | UUID) -> str:
    """Generate a JWT token for internal service-to-service calls.

    Uses the shared JWT secret that all Kissan Rehnuma services verify.
    The farmer_id is embedded as the 'sub' claim.
    """
    settings = get_settings()
    payload = {
        "sub": str(farmer_id),
        "iss": "voice-agent-service",
        "exp": datetime.utcnow() + timedelta(minutes=5),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


async def get_http_session() -> aiohttp.ClientSession:
    """Get the LiveKit-managed shared aiohttp session (connection pooling).

    Falls back to a standalone session if not inside a LiveKit job context.
    """
    try:
        return utils.http_context.http_session()
    except RuntimeError:
        return aiohttp.ClientSession()
