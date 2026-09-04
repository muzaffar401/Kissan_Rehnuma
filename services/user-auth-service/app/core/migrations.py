"""Auto-migration runner — applies pending Alembic migrations on startup."""

import subprocess
import sys


def run_migrations() -> None:
    """Run ``alembic upgrade head`` as a subprocess.

    Executed during FastAPI lifespan startup so the database schema
    is always in sync with the code — no manual CLI step needed.
    """
    print("[user-auth] Running Alembic migrations...")

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"[user-auth] Migration FAILED:\n{result.stderr.strip()}")
        raise RuntimeError(
            f"Alembic migration failed:\n{result.stderr.strip()}"
        )

    print("[user-auth] Migrations applied successfully.")
