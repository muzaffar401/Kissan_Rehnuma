
from sqlalchemy import Column, Integer, String, DateTime

from app.models.farmer import Base


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    email = Column(
        String(50),
        nullable=False
    )

    otp = Column(
        String(6),
        nullable=False
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )

