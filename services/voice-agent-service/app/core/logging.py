"""Structured logging configuration."""

import logging
import sys
from typing import Optional

from pythonjsonlogger import jsonlogger

from app.core.config import get_settings


def setup_logging(name: Optional[str] = None) -> logging.Logger:
    """Configure structured JSON logging for the application."""
    settings = get_settings()

    logger = logging.getLogger(name or "voice_agent")
    logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))

    # Remove existing handlers
    logger.handlers.clear()

    # Console handler with JSON formatting
    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Suppress noisy loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("aiohttp").setLevel(logging.WARNING)
    logging.getLogger("livekit").setLevel(logging.INFO)

    return logger


# Module-level logger
logger = setup_logging()
