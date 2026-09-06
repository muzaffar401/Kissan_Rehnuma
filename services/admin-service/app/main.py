"""Kissan Rehnuma Admin Service — read-only dashboard for all 4 databases."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import get_settings
from app.api.routes import auth, dashboard, users, crops, animals, voice, complaints, conversations, audit


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    settings = get_settings()
    print(f"[admin-service] Starting on port {settings.port}")
    print(f"[admin-service] CORS origins: {settings.cors_origin_list}")

    # Auto-migrate: ensure is_active column exists on farmers table
    from app.db import auth_engine
    try:
        engine = auth_engine()
        async with engine.begin() as conn:
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'farmers' AND column_name = 'is_active'"
            ))
            if not result.first():
                await conn.execute(text(
                    "ALTER TABLE farmers ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE"
                ))
                print("[admin-service] Added is_active column to farmers table")
    except Exception as e:
        print(f"[admin-service] is_active migration skipped: {e}")

    yield
    print("[admin-service] Shutting down")


app = FastAPI(
    title="Kissan Rehnuma Admin API",
    description="Read-only admin dashboard API — aggregates data from all service databases.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/admin")
app.include_router(dashboard.router, prefix="/admin")
app.include_router(users.router, prefix="/admin")
app.include_router(crops.router, prefix="/admin")
app.include_router(animals.router, prefix="/admin")
app.include_router(voice.router, prefix="/admin")
app.include_router(complaints.router, prefix="/admin")
app.include_router(conversations.router, prefix="/admin")
app.include_router(audit.router, prefix="/admin")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "admin-service"}
