from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.db.base import Base


class DeviceToken(Base):
    """FCM device tokens registered by the mobile app per farmer.

    The app obtains the token from Firebase on login/startup and calls
    POST /devices/register so alerts can be pushed to the lock screen.
    """

    __tablename__ = "device_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # No DB-level FK to farmers: that table is owned by user-auth-service.
    farmer_id = Column(Integer, nullable=False, index=True)
    token = Column(String(500), nullable=False, unique=True)
    platform = Column(String(20), default="android")   # android / ios / web
    created_at = Column(DateTime, default=datetime.utcnow)
