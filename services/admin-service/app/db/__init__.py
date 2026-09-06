"""Database module — 4 read-only async engines for the 4 service databases."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

# ── Lazy-initialised engines (one per database) ──────────────────────────────

_auth_engine = None
_crop_engine = None
_animal_engine = None
_voice_engine = None


def _get_engine(attr: str, url_attr: str):
    """Return a cached async engine for the given database."""
    engine = globals()[attr]
    if engine is None:
        settings = get_settings()
        url = getattr(settings, url_attr)
        engine = create_async_engine(
            url,
            echo=False,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
        globals()[attr] = engine
    return engine


def auth_engine():
    return _get_engine("_auth_engine", "auth_db_url")


def crop_engine():
    return _get_engine("_crop_engine", "crop_db_url")


def animal_engine():
    return _get_engine("_animal_engine", "animal_db_url")


def voice_engine():
    return _get_engine("_voice_engine", "voice_db_url")


# ── Session factories ────────────────────────────────────────────────────────

def _session_factory(engine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_auth_session() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory(auth_engine())() as session:
        yield session


async def get_crop_session() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory(crop_engine())() as session:
        yield session


async def get_animal_session() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory(animal_engine())() as session:
        yield session


async def get_voice_session() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory(voice_engine())() as session:
        yield session
