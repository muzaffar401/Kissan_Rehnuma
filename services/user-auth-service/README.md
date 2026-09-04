<h1 align="center">User Auth Service</h1>

<p align="center">
  Farmer registration, JWT authentication, and profile management for Kissan Rehnuma
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12-blue?logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115+-green?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql" alt="PostgreSQL" />
</p>

---

## Overview

The User Auth Service handles all farmer authentication and profile management. It issues JWT access and refresh tokens consumed by every other microservice for request verification. It also owns the `farmers` table shared with the weather-alert and market-rate services.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/signup` | No | Register new farmer (sends OTP to email) |
| `POST` | `/api/v1/auth/verify-signup-otp` | No | Verify OTP and activate account |
| `POST` | `/api/v1/auth/login` | No | Login with email/phone + password → JWT pair |
| `POST` | `/api/v1/auth/refresh` | No | Refresh expired access token |
| `POST` | `/api/v1/auth/forgot-password` | No | Send password reset OTP |
| `POST` | `/api/v1/auth/verify-otp` | No | Verify reset OTP |
| `POST` | `/api/v1/auth/reset-password` | No | Set new password after OTP verification |
| `GET` | `/api/v1/auth/profile` | JWT | Get current farmer's profile |
| `GET` | `/` | No | Health check |

---

## Database Schema

```sql
-- farmers table (owned by this service, shared with weather + market)
CREATE TABLE farmers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    phone       VARCHAR(20),
    password    VARCHAR(255) NOT NULL,    -- Argon2 hashed
    city        VARCHAR(100),
    district    VARCHAR(100),
    province    VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (Farmers DB) |
| `JWT_SECRET_KEY` | Yes | — | Secret for signing JWTs (must match gateway + weather) |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `JWT_EXPIRY_MINUTES` | No | `1440` | Access token TTL (default: 24 hours) |
| `SMTP_HOST` | No | `smtp.gmail.com` | Email server for OTP delivery |
| `SMTP_PORT` | No | `587` | SMTP port |
| `MAIL_USERNAME` | Yes | — | Sender email address |
| `SMTP_PASSWORD` | Yes | — | SMTP app password (Gmail App Password) |
| `APP_ENV` | No | `development` | `development` or `production` |

---

## Quick Start

```bash
cd services/user-auth-service

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env    # then fill in DATABASE_URL, JWT_SECRET_KEY, SMTP creds

# Run migrations
alembic upgrade head

# Start service
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

Service available at `http://localhost:8002`

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Argon2 password hashing** | Memory-hard function resistant to GPU/ASIC attacks; via `pwdlib` |
| **Shared Farmers table** | Weather and market services read farmer data without duplicating auth logic |
| **SMTP OTP (not SMS)** | Email OTP is free via Gmail App Password; SMS (Twilio) costs per message |
| **Sync SQLAlchemy** | Auth service has simple CRUD patterns; async adds complexity without throughput benefit |

---

## Tech Stack

- **Framework:** FastAPI + Uvicorn
- **ORM:** SQLAlchemy 2.0 (synchronous)
- **Migrations:** Alembic
- **Auth:** python-jose (JWT), pwdlib (Argon2 hashing)
- **Email:** aiosmtplib (async SMTP for OTP delivery)
- **Validation:** Pydantic v2
