"""SMS delivery via the Twilio REST API.

When Twilio is not configured (no SID/token/from-number) the message is
logged instead, so the pipeline stays fully functional in development.
"""
import logging

import httpx

from app.core.config import (
    HTTP_TIMEOUT_SECONDS,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
)

logger = logging.getLogger("weather_alert.notifier")


def send_sms(phone_number: str, message: str) -> str:
    """Attempt delivery; returns a status string stored on AlertSent.

    Possible values: sent, failed
    """
    if not phone_number:
        logger.warning("Notification skipped: farmer has no phone number")
        return "failed"

    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER):
        # Dev mode: no Twilio credentials configured
        logger.info("SMS to %s: %s", phone_number, message)
        return "sent"

    try:
        response = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            data={
                "To": phone_number,
                "From": TWILIO_FROM_NUMBER,
                "Body": message,
            },
            timeout=HTTP_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        logger.info("SMS sent via Twilio to %s", phone_number)
        return "sent"
    except httpx.HTTPError as exc:
        logger.error("Twilio send failed for %s: %s", phone_number, exc)
        return "failed"
