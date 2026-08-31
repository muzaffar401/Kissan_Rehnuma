# Kissan Rehnuma — Backend Services Overview (Frontend Onboarding Guide)

This document explains how the three completed backend services work, what each
endpoint does, and shows real sample requests/responses. Read this before
starting frontend work — it tells you exactly what to call, with what headers,
and what comes back.

---

## 1. The Big Picture

```
                         +-------------------------+
                         |   Farmer Mobile App     |
                         +-----------+-------------+
                                     |  HTTPS + Bearer token
        +----------------------------+----------------------------+
        |                            |                            |
+-------v--------+        +----------v---------+        +---------v--------+
| user-auth-     |        | weather-alert-     |        | market-rate-     |
| service        |        | service            |        | service          |
|                |        |                    |        |                  |
| signup/login/  | issues | weather, forecast, |        | mandi rates,     |
| OTP/password   | JWT    | risk alerts, push  |        | trends, admin    |
+-------+--------+        +----------+---------+        +---------+--------+
        |                            |                            |
        +----------------------------+----------------------------+
                                     |
                        PostgreSQL ("Farmers" DB)
                        shared tables: farmers
                        owned tables per service
```

- Every service is **FastAPI**, same layered structure
  (`app/api/v1/endpoints` → `app/services` → `app/repositories` → `app/db`).
- All services share one PostgreSQL database. The `farmers` table is owned by
  the auth service; other services read/write their own tables.
- Each service exposes interactive docs at `GET /docs` (Swagger UI).
- Run any service: `python -m uvicorn app.main:app --port <port>` from its
  folder.

### Service port convention (used during development)

| Service              | Port (used in testing) | Auth required?                     |
|----------------------|------------------------|-------------------------------------|
| user-auth-service    | set at startup         | No (it issues the tokens)           |
| weather-alert-service| 8002                   | Yes — JWT on every `/api/**` route  |
| market-rate-service  | 8007                   | No for GETs; `X-Admin-Key` for `/admin/**` |

---

## 2. user-auth-service

**Purpose:** the only service that creates users. Farmers register here, verify
their email via OTP, and log in to receive a JWT. That JWT is the key to every
other service.

### Endpoints

| Method | Endpoint                    | What it does                                   |
|--------|-----------------------------|------------------------------------------------|
| POST   | `/api/v1/auth/signup`       | Register farmer; sends OTP to email            |
| POST   | `/api/v1/auth/verify-signup-otp` | Confirm OTP → account activated           |
| POST   | `/api/v1/auth/login`        | Login → returns JWT                            |
| POST   | `/api/v1/auth/forgot-password` | Sends reset OTP to email                    |
| POST   | `/api/v1/auth/verify-otp`   | Verify reset OTP                               |
| POST   | `/api/v1/auth/reset-password` | Set new password with verified OTP           |

### Sample: signup

```http
POST /api/v1/auth/signup
{
  "name": "Ali",
  "lastname": "Raza",
  "email": "ali@kissanrehnuma.local",
  "cnic": "35202-1234567-1",
  "Mobile_Number": "03001236667",
  "Address": "Village X, Tehsil Y",
  "City": "Lahore",
  "country": "Pakistan",
  "latitude": "31.5204",
  "password": "secret123"
}
```
→ OTP is emailed. Then:

```http
POST /api/v1/auth/verify-signup-otp
{ "email": "ali@kissanrehnuma.local", "otp": "123456" }
```

### Sample: login

```http
POST /api/v1/auth/login
{ "email": "ali@kissanrehnuma.local", "password": "secret123" }
```
Actual response:
```json
{
  "message": "Login successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1IiwiZW1haWwiOiJhbGlAa2lzc2FucmVobnVtYS5sb2NhbCJ9.HgB5aShafAAWtU2Mp1SHHSHiY1RO4StgYVnWvbX8eig",
  "token_type": "bearer"
}
```

**What the token contains:** `{ "sub": "<farmer_id>", "email": "..." }`.
`sub` is the farmer's database id — the weather service reads this to know
WHO is calling.

> **Frontend rule #1:** store `access_token` after login, and send
> `Authorization: Bearer <token>` on every request to the weather service.

Errors: `401` wrong credentials, `403` email not verified yet.

---

## 3. weather-alert-service

**Purpose:** knows where each farmer is, fetches live weather (Open-Meteo),
detects risks (frost / heatwave / heavy rain / high wind), and alerts the
farmer via SMS + lock-screen push notification. A background job repeats the
check every 30 minutes.

**Auth:** every `/api/**` route requires the JWT from the auth service.
Without it → `401 {"detail": "Not authenticated"}`.

### How the alert pipeline works

```
scheduler (every 30 min) or POST /alerts/trigger-check
   → resolve farmer location (farmer_locations table)
   → fetch current + 48h forecast from Open-Meteo
   → risk engine (thresholds configurable via env)
   → if risk: LLM advisory (optional) or built-in Roman-Urdu advisory
   → send SMS (Twilio) + push notification (FCM, lock-screen priority)
   → save row in alerts_sent
```

### Endpoints

| Method | Endpoint                                | What it does                          |
|--------|------------------------------------------|---------------------------------------|
| PUT    | `/api/v1/farmers/{farmer_id}/location`   | Register/update lat-lon               |
| GET    | `/api/v1/weather/current/{farmer_id}`    | Live current weather (30-min cache)   |
| GET    | `/api/v1/weather/forecast/{farmer_id}`   | 48-hour hourly forecast               |
| POST   | `/api/v1/alerts/trigger-check`           | Run risk check now (one or all)       |
| GET    | `/api/v1/alerts/history/{farmer_id}`     | Past alerts sent to this farmer       |
| POST   | `/api/v1/devices/register`               | Register FCM token for push           |
| DELETE | `/api/v1/devices/unregister?token=...`   | Remove a device token                 |

### Sample: current weather (actual live result)

```http
GET /api/v1/weather/current/5
Authorization: Bearer <token>
```
```json
{
  "farmer_id": 5,
  "temperature_c": 34.9,
  "humidity_percent": 48,
  "wind_speed_kmh": 7.2,
  "precipitation_mm": 0.0,
  "fetched_at": "2026-08-30T13:20:11",
  "source": "api"
}
```
`source` is `"api"` on a fresh fetch, `"cache"` when served from the DB cache
(30-minute TTL).

### Sample: risk alert triggered (actual result)

```http
POST /api/v1/alerts/trigger-check
Authorization: Bearer <token>
{ "farmer_id": 5 }
```
```json
{
  "farmer_id": 5,
  "risk_detected": true,
  "risk_type": "heatwave",
  "message": "Garmi ki lehar hai. Kheti ka kaam subah ya shaam ko karein...",
  "notification_status": "sent"
}
```

### Sample: register device for lock-screen alerts

```http
POST /api/v1/devices/register
Authorization: Bearer <token>
{ "farmer_id": 5, "token": "<FCM token from mobile SDK>", "platform": "android" }
```
When a risk is detected, FCM pushes a high-priority notification that shows on
the lock screen — same behavior as any offer/namaz notification.

### 404 behavior
Farmer without a registered location:
```json
{ "detail": "No location registered for farmer 5. Call PUT /farmers/5/location first." }
```

---

## 4. market-rate-service

**Purpose:** collects crop mandi (market) rates from multiple sources, stores
them standardized (always one crop name, always PKR/kg), and serves them
through a cached API. Rates refresh on a **daily scheduled job**.

**Auth:** GET endpoints are public (farmer app convenience). `/admin/**`
endpoints need the header `X-Admin-Key: <ADMIN_API_KEY>` — anything else is
`403`.

### How the data pipeline works

```
daily scheduler (default 07:00) or POST /admin/run-pipeline
   → fetchers (one per source, isolated):
        amis        → scrapes amis.pk (no public API exists)
        zarai_mandi → stub until partnership confirmed
        manual      → rows enter via POST /admin/prices instead
   → ingestion layer: THE single place mapping
        "Gandum"/"گندم"/"wheat_crop" → "Wheat"
        40kg-bag price ÷ 40 → PKR/kg
   → PostgreSQL: mandis / crops / prices
   → Redis cache (TTL default 2h; in-process fallback if Redis is down)
   → GET endpoints
```

Key design rules:
- One failing source never aborts the job — others continue, the failure is logged.
- Adding a new source = new fetcher file + (maybe) new synonyms in ingestion.
  Nothing else changes.

### Endpoints

| Method | Endpoint                          | What it does                            |
|--------|-----------------------------------|------------------------------------------|
| GET    | `/api/v1/rates/{crop}`            | Latest price per mandi (cache → DB)      |
| GET    | `/api/v1/rates/trending?days=7`   | Avg price change vs previous period      |
| POST   | `/api/v1/admin/prices`            | Manual entry fallback (admin key)        |
| POST   | `/api/v1/admin/run-pipeline`      | Run fetch→ingest→store now (admin key)   |

### Sample: latest rate (actual result)

```http
GET /api/v1/rates/wheat
```
```json
{
  "crop": "Wheat",
  "unit": "PKR/kg",
  "prices": [
    { "mandi": "Multan Mandi", "city": "Multan", "price_per_kg": 82.5,
      "recorded_date": "2026-08-30", "source": "manual" },
    { "mandi": "Lahore Mandi", "city": "Lahore", "price_per_kg": 80.0,
      "recorded_date": "2026-08-30", "source": "manual" }
  ],
  "cached": false
}
```
- `GET /rates/gandum` works too — synonyms resolve to `Wheat`.
- Second identical request returns `"cached": true`.
- Unknown crop → `404`.

### Sample: trending (actual result)

```http
GET /api/v1/rates/trending?days=7
```
```json
{
  "days": 7,
  "trends": [
    { "crop": "Rice", "current_avg": 220.0, "previous_avg": 230.0,
      "change_percent": -4.35, "direction": "down" },
    { "crop": "Wheat", "current_avg": 81.25, "previous_avg": 75.0,
      "change_percent": 8.33, "direction": "up" }
  ]
}
```
`direction` is `up` / `down` / `flat` (±0.5%) / `new` (no previous data).

### Sample: manual entry (admin fallback, actual result)

```http
POST /api/v1/admin/prices
X-Admin-Key: change-this-admin-key
{ "mandi": "Lahore Mandi", "city": "Lahore",
  "crop": "Gandum", "price": 3200, "unit": "40kg" }
```
```json
{ "stored": true, "crop": "Wheat", "price_per_kg": 80.0, "mandi": "Lahore Mandi" }
```
Unknown crop (e.g. `dragonfruit`) → `400` until added to ingestion synonyms.

---

## 5. What the frontend must do (integration checklist)

1. **Signup/Login screens** → call `user-auth-service` (`/signup`,
   `/verify-signup-otp`, `/login`). Store `access_token` + derive `farmer_id`
   (it is the JWT `sub` claim; backend also returns it implicitly via APIs).
2. **Attach the token** — every weather-service call needs
   `Authorization: Bearer <token>`. Market-rate GETs don't.
3. **First-run setup** — after login, ensure the farmer's location exists:
   `PUT /api/v1/farmers/{farmer_id}/location` (weather service). Without it,
   weather + alerts return 404 guidance.
4. **Register push token** — once the mobile SDK gives you an FCM token:
   `POST /api/v1/devices/register`. Alerts then arrive on the lock screen
   automatically (no polling needed).
5. **Weather screens** — `GET /weather/current/{id}` for the dashboard,
   `GET /weather/forecast/{id}` for the hourly list.
6. **Market screens** — `GET /rates/{crop}` for the mandi rate card,
   `GET /rates/trending` for the up/down indicators.
7. **Errors to handle** — `401` (token missing/expired → re-login),
   `404` (no location / no data for crop), `403` (unverified email on login).

## 6. Not built yet (planned services)

- `crop-disease-service`, `animal-disease-service` (image detection + advice)
- `voice-helpline-service` (voice queries)
- `api-gateway` (single entry point once all services exist)

Detailed per-service docs: `docs/api/weather-alert-service-api.md`.
