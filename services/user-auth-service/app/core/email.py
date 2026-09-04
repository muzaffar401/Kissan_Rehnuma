import os

import httpx
from dotenv import load_dotenv

load_dotenv()

# ── Brevo (HTTP API — works on Render free tier, port 443) ────────
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "noreply@kissanrehnuma.com")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "Kissan Rehnuma")

# ── Legacy SMTP (kept as fallback for local dev) ──────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("MAIL_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


async def send_otp_email(
    to_email: str,
    otp: str,
    subject: str = "Kissan Rehnuma - OTP Verification",
    purpose: str = "email verification",
):
    """Send OTP email via Brevo API. Falls back to SMTP if Brevo is not configured."""

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
      <h2 style="color: #2d6a4f;">Kissan Rehnuma</h2>
      <p>Your OTP for <strong>{purpose}</strong> is:</p>
      <div style="background: #f0f7f4; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2d6a4f;">{otp}</span>
      </div>
      <p>This OTP is valid for <strong>10 minutes</strong>.</p>
      <p style="color: #888; font-size: 12px;">If you did not request this OTP, please ignore this email.</p>
      <p style="color: #888; font-size: 12px;">— Kissan Rehnuma Team</p>
    </div>
    """

    # ── Try Brevo first (HTTP API, port 443 — works on Render) ────
    if BREVO_API_KEY:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": BREVO_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={
                    "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
                    "to": [{"email": to_email}],
                    "subject": subject,
                    "htmlContent": html_content,
                },
            )
            if resp.status_code in (200, 201):
                print(f"[email] OTP sent via Brevo to {to_email}")
                return
            else:
                print(f"[email] Brevo failed ({resp.status_code}): {resp.text}")
                raise RuntimeError(f"Brevo email send failed: {resp.status_code}")

    # ── Fallback: SMTP (local dev only, blocked on Render free) ────
    if SMTP_USERNAME and SMTP_PASSWORD:
        from email.message import EmailMessage
        import aiosmtplib

        message = EmailMessage()
        message["From"] = SMTP_USERNAME
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(f"Your OTP for {purpose} is: {otp}\n\nValid for 10 minutes.")

        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            start_tls=True,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
        )
        print(f"[email] OTP sent via SMTP to {to_email}")
        return

    # ── No email service configured ─────────────────────────────────
    print(f"[email] WARNING: No email service configured! OTP for {to_email}: {otp}")
    print("[email] Set BREVO_API_KEY env var for production email delivery.")
