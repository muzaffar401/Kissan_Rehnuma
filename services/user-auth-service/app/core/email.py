import os

from email.message import EmailMessage
import aiosmtplib
from dotenv import load_dotenv

load_dotenv()


SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

# FIXED: MAIL_USERNAME matches .env
SMTP_USERNAME = os.getenv("MAIL_USERNAME")

SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


async def send_otp_email(
    to_email: str,
    otp: str,
    subject: str = "Kissan Rehnuma - OTP Verification",
    purpose: str = "email verification"
):
    message = EmailMessage()

    message["From"] = SMTP_USERNAME
    message["To"] = to_email
    message["Subject"] = subject

    message.set_content(
        f"""
Kissan Rehnuma

Your OTP for {purpose} is:

{otp}

This OTP is valid for 10 minutes.

If you did not request this OTP, please ignore this email.

Regards,
Kissan Rehnuma Team
"""
    )

    await aiosmtplib.send(
        message,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        start_tls=True,
        username=SMTP_USERNAME,
        password=SMTP_PASSWORD,
    )