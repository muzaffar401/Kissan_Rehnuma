"""Background scheduler: periodic weather-risk checks for all farmers.

Runs the same pipeline as POST /alerts/trigger-check, every
SCHEDULER_INTERVAL_MINUTES (default 30), in a daemon thread.
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import SCHEDULER_ENABLED, SCHEDULER_INTERVAL_MINUTES
from app.db.database import SessionLocal
from app.repositories.farmer_repo import FarmerRepository
from app.services.alert_service import check_farmer

logger = logging.getLogger("weather_alert.scheduler")

_scheduler: BackgroundScheduler | None = None


def _run_scheduled_checks() -> None:
    db = SessionLocal()
    try:
        farmers = FarmerRepository(db).get_all()
        logger.info("Scheduled risk check for %d farmer(s)", len(farmers))
        for farmer in farmers:
            result = check_farmer(db, farmer)
            if result.risk_detected:
                logger.warning(
                    "Scheduled check: %s risk for farmer %s -> %s",
                    result.risk_type,
                    farmer.id,
                    result.notification_status,
                )
    except Exception:
        logger.exception("Scheduled risk check failed")
    finally:
        db.close()


def start_scheduler() -> None:
    global _scheduler
    if not SCHEDULER_ENABLED or _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _run_scheduled_checks,
        "interval",
        minutes=SCHEDULER_INTERVAL_MINUTES,
        id="weather_risk_check",
    )
    _scheduler.start()
    logger.info(
        "Scheduler started: risk check every %d minute(s)",
        SCHEDULER_INTERVAL_MINUTES,
    )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler stopped")
