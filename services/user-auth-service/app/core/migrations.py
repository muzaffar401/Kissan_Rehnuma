"""Auto-migration runner — applies pending Alembic migrations on startup."""

import subprocess
import sys
import time

# Postgres may still be starting when a sibling container boots first
# (depends_on healthcheck can pass during postgres' internal restart).
# Retry a few times before giving up so the container doesn't crash-loop.
MAX_ATTEMPTS = 5
RETRY_DELAY_SECONDS = 5


def run_migrations() -> None:
    """Run ``alembic upgrade head`` as a subprocess.

    Executed during FastAPI lifespan startup so the database schema
    is always in sync with the code — no manual CLI step needed.
    """
    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"[user-auth] Running Alembic migrations (attempt {attempt}/{MAX_ATTEMPTS})...")

        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            print("[user-auth] Migrations applied successfully.")
            return

        stderr = result.stderr.strip()
        print(f"[user-auth] Migration attempt {attempt} failed:\n{stderr}")

        # Only retry on connection errors — schema errors won't self-heal
        transient = (
            "not yet accepting connections" in stderr
            or "Connection refused" in stderr
            or "could not connect to server" in stderr
        )
        if not transient or attempt == MAX_ATTEMPTS:
            raise RuntimeError(f"Alembic migration failed:\n{stderr}")

        time.sleep(RETRY_DELAY_SECONDS)
