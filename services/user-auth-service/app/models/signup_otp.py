from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime

from app.models.farmer import Base


class SignupOTP(Base):
    __tablename__ = "signup_otps"

    id = Column(Integer, primary_key=True, autoincrement=True)

    email = Column(String(50), nullable=False)

    otp = Column(String(6), nullable=False)

    expires_at = Column(DateTime, nullable=False)

    is_used = Column(Boolean, nullable=False, default=False)