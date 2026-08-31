"""Lock-screen push notifications via Firebase Cloud Messaging (FCM v1).

The mobile app registers its FCM token via POST /devices/register; when
a risk is detected the advisory is pushed with high priority so it shows
on the lock screen like any other app notification.

Production needs FCM_PROJECT_ID + FCM_SERVICE_ACCOUNT_FILE (Firebase
console -> Project settings -> Service accounts). When not configured,
messages are logged instead (dev mode).
"""
import logging

import httpx
from sqlalchemy.orm import Session

from app.core.config import (
    FCM_PROJECT_ID,
    FCM_SERVICE_ACCOUNT_FILE,
    HTTP_TIMEOUT_SECONDS,
)
from app.repositories.device_token_repo import DeviceTokenRepository

logger = logging.getLogger("weather_alert.push")


def _get_access_token() -> str | None:
    """OAuth2 token from the Firebase service-account JSON (lazy import)."""
    if not FCM_SERVICE_ACCOUNT_FILE:
        return None
    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account

        credentials = service_account.Credentials.from_service_account_file(
            FCM_SERVICE_ACCOUNT_FILE,
            scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
        credentials.refresh(Request())
        return credentials.token
    except Exception as exc:
        logger.error("FCM authentication failed: %s", exc)
        return None


def send_push_to_farmer(
    db: Session, farmer_id: int, title: str, body: str
) -> str:
    """Push to every device the farmer registered.

    Possible values: sent, failed, no_device
    """
    devices = DeviceTokenRepository(db).list_for_farmer(farmer_id)
    if not devices:
        logger.info("No registered devices for farmer %s", farmer_id)
        return "no_device"

    access_token = _get_access_token()
    if access_token is None:
        # Dev mode: FCM not configured
        for device in devices:
            logger.info(
                "PUSH (dev mode) farmer %s [%s]: %s - %s",
                farmer_id, device.platform, title, body,
            )
        return "sent"

    url = f"https://fcm.googleapis.com/v1/projects/{FCM_PROJECT_ID}/messages:send"
    sent = 0
    for device in devices:
        try:
            response = httpx.post(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "message": {
                        "token": device.token,
                        "notification": {"title": title, "body": body},
                        # high priority -> shows on lock screen even in doze
                        "android": {"priority": "high"},
                    }
                },
                timeout=HTTP_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            sent += 1
        except httpx.HTTPError as exc:
            logger.error("FCM push failed for farmer %s: %s", farmer_id, exc)
    return "sent" if sent else "failed"
