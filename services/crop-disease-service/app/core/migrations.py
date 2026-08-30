"""Auto-migration runner — applies pending Alembic migrations on startup."""

import subprocess
import sys

from app.core.logging import get_logger

log = get_logger(__name__)


def run_migrations() -> None:
    """Run ``alembic upgrade head`` as a subprocess.

    Executed during FastAPI lifespan startup so the database schema
    is always in sync with the code — no manual CLI step needed.
    """
    log.info("running_migrations")

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        log.error(
            "migration_failed",
            stderr=result.stderr.strip(),
            stdout=result.stdout.strip(),
        )
        raise RuntimeError(
            f"Alembic migration failed:\n{result.stderr.strip()}"
        )

    log.info("migrations_applied")
