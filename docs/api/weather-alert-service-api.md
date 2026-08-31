# Weather Alert Service — API Documentation

**Service:** `services/weather-alert-service`
**Base URL:** `http://localhost:8002` (run with `python -m uvicorn app.main:app --port 8002`)
**Interactive docs:** `http://localhost:8002/docs` (Swagger UI, public)
**Tested:** 2026-08-30 against live PostgreSQL (`Farmers` DB) + live Open-Meteo data (Lahore, farmer id 5)

All results below are **actual responses** captured during testing.

---

## 1. Authentication

Every `/api/**` route is protected by `AuthMiddleware` (Bearer JWT).
Tokens are issued by **user-auth-service** (`POST /api/v1/login`) and verified
here with the shared secret (`JWT_SECRET_KEY`, default `change-this-secret-key`, HS256).

**Get a token (production flow):**

```http
POST http://localhost:8001/api/v1/login     ← user-auth-service
{ "email": "farmer@email.com", "password": "..." }

→ { "message": "Login successful", "access_token": "<JWT>", "token_type": "bearer" }
```

**Use it on every request below:**

```http
Authorization: Bearer <JWT>
```

**Public paths (no token needed):** `/`, `/docs`, `/redoc`, `/openapi.json`

### 1.1 Actual auth test results

| Test | Result |
|---|---|
| `GET /` (no token) | `200` `{"message":"Weather Alert Service is running"}` |
| `GET /api/v1/weather/current/5` (no token) | `401` `{"detail":"Not authenticated"}` |
| `GET /api/v1/weather/current/5` (garbage token) | `401` `{"detail":"Invalid or expired token"}` |
| `POST /api/v1/alerts/trigger-check` (no token) | `401` `{"detail":"Not authenticated"}` |
| Any endpoint with valid token | `200` (see below) |

---

## 2. Farmer Location

### `PUT /api/v1/farmers/{farmer_id}/location`

Registers/updates the field coordinates used for weather lookups
(the shared `farmers` table has no longitude).

```bash
curl -X PUT http://localhost:8002/api/v1/farmers/5/location ^
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" ^
  -d "{\"latitude\": 31.5204, \"longitude\": 74.3587}"
```

**Actual response — 200:**

```json
{"farmer_id": 5, "latitude": 31.5204, "longitude": 74.3587}
```

Errors: `404 {"detail":"Farmer not found"}` for unknown farmer.

---

## 3. Weather

### `GET /api/v1/weather/current/{farmer_id}`

Latest reading. Served from DB cache when younger than 30 min
(`WEATHER_CACHE_MINUTES`), otherwise fetched live from Open-Meteo and stored.

```bash
curl http://localhost:8002/api/v1/weather/current/5 -H "Authorization: Bearer <JWT>"
```

**Actual response — 200 (live fetch):**

```json
{
  "farmer_id": 5,
  "latitude": 31.528997,
  "longitude": 74.38995,
  "temperature": 33.8,
  "humidity": 56.0,
  "wind_speed_kmh": 3.8,
  "rain_mm": 0.0,
  "source": "api",
  "fetched_at": "2026-08-30T14:05:25.149311"
}
```

**Second call within 30 min → `"source": "cache"`** (same data, no external call).

Errors: `404 Farmer not found` · `404 No location registered...` · `502 Weather provider unavailable` (only if Open-Meteo is down AND no cached reading exists).

### `GET /api/v1/weather/forecast/{farmer_id}`

Next 48 hours (`FORECAST_HOURS`), hourly, live from Open-Meteo.

```bash
curl http://localhost:8002/api/v1/weather/forecast/5 -H "Authorization: Bearer <JWT>"
```

**Actual response — 200 (48 entries; first two shown):**

```json
{
  "farmer_id": 5,
  "forecast": [
    {"time": "2026-08-30T19:00:00", "temp_min": 33.8, "temp_max": 33.8, "rain_mm": 0.0, "wind_kmh": 3.8},
    {"time": "2026-08-30T20:00:00", "temp_min": 33.1, "temp_max": 33.1, "rain_mm": 0.0, "wind_kmh": 3.6}
  ]
}
```

---

## 4. Alerts

### `POST /api/v1/alerts/trigger-check`

Runs the pipeline: fetch weather → rule-based risk detection
(frost / heatwave / heavy_rain / high_wind) → advisory (LLM if configured,
else static Roman-Urdu) → SMS (Twilio) + lock-screen push (FCM) → save to `alerts_sent`.

Body `{"farmer_id": 5}` checks one farmer; `{}` checks **all** farmers (returns a list).

```bash
curl -X POST http://localhost:8002/api/v1/alerts/trigger-check ^
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" ^
  -d "{\"farmer_id\": 5}"
```

**Actual response — 200, no risk (default thresholds, mild weather):**

```json
{"farmer_id": 5, "risk_detected": false, "risk_type": null,
 "advisory_generated": null, "notification_status": "not_sent"}
```

**Actual response — 200, risk detected** (server started with `HEATWAVE_TEMP_C=30`
so the 33.8 °C reading triggers):

```json
{
  "farmer_id": 5,
  "risk_detected": true,
  "risk_type": "heatwave",
  "advisory_generated": "Shadeed garmi (heatwave) ki warning hai. Fasal ko subah sawere ya shaam ko seerab karein, dopahar mein spray na karein aur apna bhi khayal rakhein. (current temp 33.8°C)",
  "notification_status": "sent"
}
```

Other possible `notification_status` values: `failed`, `skipped_no_location`, `weather_unavailable`.

### `GET /api/v1/alerts/history/{farmer_id}`

Past alerts, newest first.

```bash
curl http://localhost:8002/api/v1/alerts/history/5 -H "Authorization: Bearer <JWT>"
```

**Actual response — 200 (after the heatwave alert above):**

```json
{
  "farmer_id": 5,
  "alerts": [
    {
      "alert_type": "heatwave",
      "message": "Shadeed garmi (heatwave) ki warning hai. Fasal ko subah sawere ya shaam ko seerab karein, dopahar mein spray na karein aur apna bhi khayal rakhein. (current temp 33.8°C)",
      "sent_at": "2026-08-30T14:07:48.398320",
      "status": "sent"
    }
  ]
}
```

(Empty state: `{"farmer_id": 5, "alerts": []}`)

---

## 5. Devices (lock-screen push)

### `POST /api/v1/devices/register`

Mobile app registers its FCM token so alerts appear on the lock screen.

```bash
curl -X POST http://localhost:8002/api/v1/devices/register ^
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" ^
  -d "{\"farmer_id\": 5, \"token\": \"<FCM_TOKEN>\", \"platform\": \"android\"}"
```

**Actual response — 200:** `{"farmer_id": 5, "platform": "android", "registered": true}`

### `DELETE /api/v1/devices/unregister?token=<FCM_TOKEN>`

**Actual response — 200:** `{"deleted": true}` · `404 {"detail":"Device not found"}`

---

## 6. Background scheduler

Runs the same check for **all farmers** automatically every 30 minutes
(`SCHEDULER_INTERVAL_MINUTES`), started/stopped with the app. Disable with
`SCHEDULER_ENABLED=false`.

---

## 7. Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/Farmers` | DB |
| `JWT_SECRET_KEY` / `JWT_ALGORITHM` | `change-this-secret-key` / `HS256` | must match user-auth-service |
| `WEATHER_CACHE_MINUTES` | `30` | current-weather cache TTL |
| `FORECAST_HOURS` | `48` | forecast window |
| `FROST_TEMP_C` | `2` | frost threshold |
| `HEATWAVE_TEMP_C` | `45` | heatwave threshold (lower it to test alerts) |
| `HEAVY_RAIN_TOTAL_MM` | `15` | rain threshold (48 h total) |
| `HIGH_WIND_KMH` | `40` | wind threshold |
| `SCHEDULER_ENABLED` / `SCHEDULER_INTERVAL_MINUTES` | `true` / `30` | background checks |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | empty | optional LLM advisories (fallback: static) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | empty | SMS (fallback: log) |
| `FCM_PROJECT_ID` / `FCM_SERVICE_ACCOUNT_FILE` | empty | push (fallback: log) |

## 8. Database tables (owned by this service)

`farmer_locations`, `weather_snapshots`, `alerts_sent`, `device_tokens`
(+ shared `farmers` from user-auth-service). Migrations: `python -m alembic upgrade head`
(own version table `weather_alembic_version`).
