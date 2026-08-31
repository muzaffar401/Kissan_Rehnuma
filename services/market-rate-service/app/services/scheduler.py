"""Daily fetch -> ingest -> store job (APScheduler, in-process)."""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import (
    RUN_PIPELINE_ON_STARTUP, SCHEDULER_ENABLED, SCHEDULER_HOUR
)

logger = logging.getLogger("market_rate.scheduler")

_scheduler = None


def _run_daily_pipeline():
    from app.db.database import SessionLocal
    from app.services.pipeline import run_pipeline

    db = SessionLocal()
    try:
        results = run_pipeline(db)
        logger.info("Pipeline result: %s", results)
    finally:
        db.close()


def start_scheduler():
    global _scheduler
    if not SCHEDULER_ENABLED:
        logger.info("Scheduler disabled (SCHEDULER_ENABLED=false)")
        return
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _run_daily_pipeline,
        CronTrigger(hour=SCHEDULER_HOUR, minute=0),
        id="market_pipeline_daily",
        replace_existing=True,
    )
    if RUN_PIPELINE_ON_STARTUP:
        _scheduler.add_job(
            _run_daily_pipeline, id="market_pipeline_startup", replace_existing=True
        )
    _scheduler.start()
    logger.info("Daily pipeline scheduled at %02d:00", SCHEDULER_HOUR)


def stop_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
