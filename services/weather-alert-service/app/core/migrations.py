"""Auto-migration runner — applies pending Alembic migrations on startup."""

import subprocess
import sys


def run_migrations() -> None:
    """Run ``alembic upgrade head`` as a subprocess."""
    print("[weather-alert] Running Alembic migrations...")

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"[weather-alert] Migration FAILED:\n{result.stderr.strip()}")
        raise RuntimeError(
            f"Alembic migration failed:\n{result.stderr.strip()}"
        )

    print("[weather-alert] Migrations applied successfully.")
