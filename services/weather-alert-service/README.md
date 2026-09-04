<h1 align="center">Weather Alert Service</h1>

<p align="center">
  Location-based weather monitoring with AI risk assessment and agricultural advisories
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12-blue?logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115+-green?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Open--Meteo-Free_API-orange" alt="Open-Meteo" />
</p>

---

## Overview

The Weather Alert Service monitors weather conditions for registered farmers and generates proactive agricultural alerts. It uses Open-Meteo (free, no API key) for weather data, an LLM (Gemini via OpenRouter) to generate Roman-Urdu advisories, and a background scheduler to periodically scan for frost, heatwave, heavy rain, and high wind risks.

Shares the `farmers` table with user-auth-service (reads farmer locations) and owns its own tables for locations, weather snapshots, alerts, and device tokens.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/weather/current/{farmer_id}` | JWT | Current weather for a farmer's location |
| `GET` | `/api/v1/weather/forecast/{farmer_id}` | JWT | 7-day hourly forecast |
| `GET` | `/api/v1/weather/advisory/{farmer_id}` | JWT | AI-generated agricultural advisory |
| `POST` | `/api/v1/farmers/{farmer_id}/location` | JWT | Register farmer's GPS location |
| `GET` | `/api/v1/alerts/history/{farmer_id}` | JWT | Past alerts sent to farmer |
| `POST` | `/api/v1/devices/register` | JWT | Register device for push notifications |
| `GET` | `/` | No | Health check |

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Open-Meteo API  │────►│  Weather Cache   │────►│  Risk Analyzer   │
│  (free, no key)  │     │  (DB + TTL)      │     │  (thresholds)    │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                            │
                                                            ▼
                                                   ┌──────────────────┐
                                                   │  LLM Advisory    │
                                                   │  (Gemini →       │
                                                   │   Roman Urdu)    │
                                                   └────────┬─────────┘
                                                            │
                                                            ▼
                                                   ┌──────────────────┐
                                                   │  Alert Dispatch  │
                                                   │  (Log / SMS /    │
                                                   │   Push Notif)    │
                                                   └──────────────────┘
```

### Multi-Layer Caching

| Data | TTL | Rationale |
|------|-----|-----------|
| Current weather | 15 min | Changes frequently |
| Forecast | 30 min | Updates every few hours |
| LLM advisory | 60 min | Expensive to regenerate |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL (shared Farmers DB) |
| `JWT_SECRET_KEY` | Yes | — | Must match user-auth-service |
| `SCHEDULER_ENABLED` | No | `true` | Enable background risk scanning |
| `SCHEDULER_INTERVAL_MINUTES` | No | `30` | How often to scan all farmers |
| `OPENROUTER_API_KEY` | No | — | For LLM advisory generation (falls back to static) |
| `LLM_MODEL` | No | `google/gemini-2.5-flash` | Model for advisory text |
| `FROST_TEMP_C` | No | `2` | Temperature threshold for frost alert |
| `HEATWAVE_TEMP_C` | No | `45` | Temperature threshold for heatwave alert |
| `HEAVY_RAIN_TOTAL_MM` | No | `15` | Rainfall threshold (daily total) |
| `HIGH_WIND_KMH` | No | `40` | Wind speed threshold |
| `TWILIO_*` | No | — | Optional SMS delivery |
| `FCM_*` | No | — | Optional Firebase push notifications |

---

## Quick Start

```bash
cd services/weather-alert-service

pip install -r requirements.txt

# Configure .env (DATABASE_URL, JWT_SECRET_KEY required)

alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8004
```

Service available at `http://localhost:8004`

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Open-Meteo (not OpenWeatherMap)** | Free, no API key, sufficient accuracy for agricultural use |
| **LLM advisory in Roman Urdu** | Pakistani farmers speak Urdu/Punjabi; Roman Urdu is readable without special fonts |
| **Background scheduler** | Proactive alerts without farmer needing to open the app |
| **Multi-layer caching** | Reduces API calls and LLM costs; weather data doesn't change every request |
| **Auth middleware (not per-endpoint)** | JWT validation on all routes except health check, applied at middleware level |

---

## Tech Stack

- **Framework:** FastAPI + Uvicorn
- **ORM:** SQLAlchemy 2.0 (synchronous)
- **Weather Data:** Open-Meteo API (via httpx)
- **LLM:** OpenRouter (Gemini) for advisory generation
- **Scheduling:** APScheduler (in-process)
- **Auth:** JWT verification middleware
