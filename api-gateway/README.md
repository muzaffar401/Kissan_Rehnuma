# Kissan Rehnuma API Gateway

Centralized API Gateway for Kissan Rehnuma microservices architecture. Built with **FastAPI** to provide a single entry point for all client requests.

## 🏗 Architecture

```
Frontend (React Native/Expo)
        ↓
   API Gateway (:3000)
   ├── JWT Authentication
   ├── Rate Limiting
   ├── Circuit Breaker
   └── Request Routing
        ↓
┌───────────────────────────────────────┐
│  Microservices (internal network)     │
│  ├── crop-disease-service (:8001)     │
│  ├── user-auth-service (:8002)        │
│  ├── animal-disease-service (:8003)   │
│  ├── weather-alert-service (:8004)    │
│  ├── market-rate-service (:8005)      │
│  └── voice-helpline-service (:8006)   │
└───────────────────────────────────────┘
```

## 🚀 Features

- **Reverse Proxy**: Routes requests to appropriate microservices using `httpx` async client
- **JWT Authentication**: Validates tokens before forwarding to protected services
- **Rate Limiting**: Prevents abuse with configurable rate limits
- **Circuit Breaker**: Graceful degradation when services are down
- **CORS Support**: Configurable cross-origin resource sharing
- **Structured Logging**: JSON logs with `structlog`
- **Health Checks**: Monitor gateway and downstream services
- **API Documentation**: Auto-generated Swagger UI (debug mode)

## 📁 Project Structure

```
api-gateway/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── core/
│   │   ├── config.py        # Environment configuration (Pydantic Settings)
│   │   ├── logger.py        # Structured logging setup
│   │   ├── errors.py        # Error handling utilities (proxy errors)
│   │   ├── security.py      # ✅ JWT auth dependencies (get_current_user)
│   │   ├── rate_limiter.py  # ✅ Rate limiting (slowapi)
│   │   └── circuit_breaker.py # ✅ Circuit breaker (pybreaker)
│   └── api/
│       └── routes/          # Route handlers for each microservice
│           ├── crop.py      # ✅ → crop-disease-service (proxy routes)
│           ├── auth.py      # → user-auth-service
│           ├── animal.py    # → animal-disease-service
│           ├── weather.py   # → weather-alert-service
│           ├── market.py    # → market-rate-service
│           └── helpline.py  # → voice-helpline-service
├── .env                     # Environment variables
├── requirements.txt         # Python dependencies
└── README.md
```

## 🛠 Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | FastAPI 0.115+ | High-performance async API |
| HTTP Client | httpx 0.27+ | Async proxy requests |
| Auth | python-jose | JWT token validation |
| Rate Limit | slowapi | Request throttling |
| Circuit Breaker | pybreaker | Fault tolerance |
| Logging | structlog | Structured JSON logs |
| Config | pydantic-settings | Type-safe env vars |

## 📋 Prerequisites

- Python 3.12+
- All microservices running (or at least the ones you want to proxy to)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd api-gateway
pip install -r requirements.txt
```

### 2. Configure Environment

Copy and edit `.env`:

```bash
# Server
HOST=0.0.0.0
PORT=3000

# Service URLs (internal)
CROP_DISEASE_SERVICE_URL=http://localhost:8001
USER_AUTH_SERVICE_URL=http://localhost:8002
ANIMAL_DISEASE_SERVICE_URL=http://localhost:8003
WEATHER_ALERT_SERVICE_URL=http://localhost:8004
MARKET_RATE_SERVICE_URL=http://localhost:8005
VOICE_HELPLINE_SERVICE_URL=http://localhost:8006

# JWT (must match user-auth-service SECRET_KEY)
JWT_SECRET_KEY=change-this-secret-key
JWT_ALGORITHM=HS256

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60

# CORS
CORS_ORIGINS=http://localhost:8081,http://localhost:3000
```

### 3. Run the Gateway

```bash
# Development
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 3000

# Production
python -m uvicorn app.main:app --host 0.0.0.0 --port 3000 --workers 4
```

### 4. Verify

```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/

# Swagger docs (debug mode only)
open http://localhost:3000/docs
```

## 📡 API Routes

| Gateway Route | Proxied To | Auth Required | Status |
|---------------|------------|---------------|--------|
| `GET /health` | Gateway itself | No | ✅ |
| `GET /` | Gateway info | No | ✅ |
| **Crop Disease** | | | |
| `POST /api/v1/crop/detect` | crop-disease-service:8001/api/v1/disease/detect | **Yes** | ✅ |
| `GET /api/v1/crop/history` | crop-disease-service:8001/api/v1/disease/history | **Yes** | ✅ |
| `GET /api/v1/crop/health` | crop-disease-service:8001/api/v1/disease/health | No | ✅ |
| **Auth** | | | |
| `POST /api/v1/auth/*` | user-auth-service:8002 | No | ⏳ |
| **Animal Disease** | | | |
| `POST /api/v1/animal/detect` | animal-disease-service:8003 | **Yes** | ⏳ |
| **Weather** | | | |
| `GET /api/v1/weather/*` | weather-alert-service:8004 | **Yes** | ⏳ |
| **Market** | | | |
| `GET /api/v1/market/*` | market-rate-service:8005 | **Yes** | ⏳ |
| **Helpline** | | | |
| `POST /api/v1/helpline/*` | voice-helpline-service:8006 | **Yes** | ⏳ |

## 🔐 Authentication Flow

```
1. Client → POST /api/v1/auth/login (no auth)
2. Auth Service → Returns JWT token
3. Client → Stores token securely
4. Client → GET /api/v1/crop/history
             Headers: Authorization: Bearer <token>
5. Gateway → Validates JWT
6. Gateway → Proxies to crop-disease-service
7. Crop Service → Returns response
8. Gateway → Returns to client
```

## 🧪 Testing

```bash
# Test gateway health (public)
curl http://localhost:3000/health

# Test protected endpoint WITHOUT token → 401
curl http://localhost:3000/api/v1/crop/history

# Test protected endpoint WITH valid JWT → proxied
curl http://localhost:3000/api/v1/crop/history \
  -H "Authorization: Bearer <token>"

# Test crop disease service health (public, proxied)
curl http://localhost:3000/api/v1/crop/health

# Test crop disease detection (requires auth + running service)
curl -X POST http://localhost:3000/api/v1/crop/detect \
  -H "Authorization: Bearer <token>" \
  -F "image=@leaf.jpg" \
  -F "language=en"
```

### Test Results (Step 3 — JWT Auth)

| Test | Expected | Result |
|------|----------|--------|
| `GET /health` (no token) | 200 OK | ✅ Pass |
| `GET /api/v1/crop/history` (no token) | 401 Unauthorized | ✅ Pass |
| `GET /api/v1/crop/history` (valid JWT) | Auth passes → proxy | ✅ Pass |
| `GET /api/v1/crop/history` (invalid JWT) | 401 Unauthorized | ✅ Pass |
| Structured JWT logging | `jwt_validated` / `jwt_invalid` | ✅ Pass |
| User ID extraction from JWT | `current_user.sub` used | ✅ Pass |

### Test Results (Step 4 — Rate Limiting + Circuit Breaker)

| Test | Expected | Result |
|------|----------|--------|
| Rate limit: 5 requests allowed | 200 OK | ✅ Pass |
| Rate limit: 6th request blocked | 429 Too Many Requests | ✅ Pass |
| Circuit breaker: 4 failures counted | 503 SERVICE_UNAVAILABLE | ✅ Pass |
| Circuit breaker: opens after 5th failure | 503 CIRCUIT_BREAKER_OPEN | ✅ Pass |
| Circuit breaker: subsequent requests | Immediate 503 (no connection attempt) | ✅ Pass |
| `/circuit-breakers` monitoring endpoint | All states visible | ✅ Pass |
| Structured CB logging | `circuit_breaker_failure`, `state_change` | ✅ Pass |

### Test Results (Step 2 — Proxy Routing)

| Test | Result |
|------|--------|
| `GET /health` | ✅ 200 OK |
| `GET /api/v1/crop/health` (service down) | ✅ 503 Service Unavailable (correct error) |
| Structured logging | ✅ JSON logs working |
| Error handling | ✅ ConnectError → 503, TimeoutException → 504 |

## 📝 Implementation Status

| Step | Task | Status | Details |
|------|------|--------|---------|
| 1 | Project structure + basic FastAPI app | ✅ Complete | Directories, config, logger, main.py, CORS |
| 2 | Proxy routing to crop-disease-service | ✅ Complete | 3 routes (detect, history, health), error handling |
| 3 | JWT authentication middleware | ✅ Complete | security.py, get_current_user dep, protected routes |
| 4 | Rate limiting + circuit breaker | ✅ Complete | slowapi + pybreaker, per-route limits, per-service breakers |
| 5 | End-to-end testing | ✅ Skipped | Tested within each step |
| 6 | Frontend API client setup | ✅ Complete | 5 service files, expo-secure-store, JWT auto-inject |
| 7 | Connect DiseaseScanScreen | ✅ Complete | expo-image-picker, 5 scan phases, API integration |
| 8 | PDF Diagnosis Report | ✅ Complete | expo-print + expo-sharing, HTML→PDF, native share |
| 9 | Scan History Screen | ✅ Complete | Past scans list, pull-to-refresh, PDF download per scan |

### Step 9 Details (Scan History)

**Files Created:**
- `src/screens/ScanHistoryScreen.tsx` — Full history screen with scan cards

**Files Modified:**
- `src/services/cropService.ts` — Updated `HistoryItem` to extend `DetectResponse` + `created_at`
- `App.tsx` — Added `'history'` screen + navigation wiring
- `src/screens/DiseaseScanScreen.tsx` — History icon (clock) in app bar → navigates to history

**Features:**
- Fetches past scans from `GET /api/v1/crop/history` (JWT auth, rate limited, circuit breaker)
- Card-based layout: image thumbnail, disease name, crop type, confidence %, date/time
- Pull-to-refresh support
- Empty state with "Scan Now" CTA
- Error state with "Try Again" retry button
- Responsive: 2-column grid on wide screens (>480px)
- Download PDF report per scan via `pdfService`
- Summary bar showing total scan count

### Step 8 Details (PDF Report)

**Dependencies Installed:**
- `expo-print` — HTML-to-PDF generation (official Expo library)
- `expo-sharing` — Native share sheet for saving/downloading files

**Files Created:**
- `src/services/pdfService.ts` — Professional HTML report template + PDF generation + share

**Files Modified:**
- `src/services/index.ts` — Added pdfService barrel export
- `src/screens/DiseaseScanScreen.tsx` — Added "Download Report" button on result screen

**How It Works:**
```
Result Screen → "Download Report" button → pdfService.generateAndShareReport()
  → Build professional HTML (diagnosis, symptoms, treatment, prevention)
  → Print.printToFileAsync({ html }) → PDF file
  → shareAsync(uri) → Native share sheet (save to Downloads, WhatsApp, etc.)
  → On Web: Opens browser print dialog → "Save as PDF"
```

**Report Contains:**
- Header: Kissan Rehnuma branding
- Status: Healthy/Disease Detected with confidence %
- Diagnosis: Disease name, scientific name, crop type
- Symptoms, Causes, Treatment Recommendations, Prevention Tips, Affected Crops
- Footer: Disclaimer and branding

### Step 4 Details

**Files Created:**
- `app/core/rate_limiter.py` — Rate limiting with slowapi (per official docs)
- `app/core/circuit_breaker.py` — Circuit breaker with pybreaker (per official docs)

**Files Modified:**
- `app/main.py` — Registered limiter, exception handler, `/circuit-breakers` monitoring endpoint
- `app/api/routes/crop.py` — Added rate limits + circuit breaker to all proxy routes

**Rate Limiting Configuration:**
| Endpoint | Limit | Rationale |
|----------|-------|----------|
| `POST /api/v1/crop/detect` | 10/min | Expensive AI image processing |
| `GET /api/v1/crop/history` | 30/min | Database queries |
| `GET /api/v1/crop/health` | 120/min | Lightweight health check |

**Circuit Breaker Configuration:**
| Parameter | Value | Meaning |
|-----------|-------|--------|
| `fail_max` | 5 | Open circuit after 5 consecutive failures |
| `reset_timeout` | 60s | Try again after 60 seconds (half-open) |
| `success_threshold` | 2 | 2 successes to close from half-open |

**Key Implementation Decisions:**
- `slowapi` with `get_remote_address` key function (per official docs)
- `app.state.limiter` + `RateLimitExceeded` exception handler (per official docs)
- Decorator order: `@router.method` ABOVE `@limiter.limit` (per official docs)
- One `pybreaker.CircuitBreaker` per downstream service (application scope)
- `GatewayCircuitBreakerListener` for structured logging of all CB events
- Circuit breaker wraps only the httpx proxy call via `breaker.calling()` context manager
- `CircuitBreakerError` caught separately → returns `CIRCUIT_BREAKER_OPEN` error code
- `/circuit-breakers` endpoint for monitoring all breaker states
- Health endpoints NOT circuit-broken (they ARE the health check)

### Step 6 Details (Frontend API Client)

**Location:** `mobile-web-app/src/services/`

**Dependency Installed:**
- `expo-secure-store@57.0.2` — Encrypted token storage (Keychain on iOS, Keystore on Android)

**Files Created:**
- `src/services/config.ts` — API base URL + all endpoint paths
- `src/services/tokenStorage.ts` — Secure JWT storage with web fallback (localStorage)
- `src/services/apiClient.ts` — Fetch wrapper with auto Bearer token injection
- `src/services/authService.ts` — Auth API calls (login, signup, OTP, password reset)
- `src/services/cropService.ts` — Crop disease API calls (detect, history, health)

**Architecture:**
```
Frontend Screen → authService/cropService → apiClient → Gateway (:3000) → Microservice
```

**Key Implementation Decisions:**
- Native `fetch` API — no extra HTTP library needed
- `expo-secure-store` for encrypted token storage (platform adapter: Keychain/Keystore on native, localStorage on web)
- `apiClient` auto-injects `Authorization: Bearer <token>` from secure storage
- `skipAuth: true` option for public endpoints (login, signup, health)
- 401 response → auto-clear token + trigger `onUnauthorized` callback (redirect to login)
- `setOnUnauthorized(callback)` — register redirect handler from App.tsx
- Request timeout: 30s default (configurable per request)
- FormData support for image uploads (`postForm` method)
- JWT payload decoded client-side (no verification) for caching user info
- All endpoints go through Gateway, never directly to microservices

### Step 7 Details (Frontend Integration)

**Location:** `mobile-web-app/src/screens/DiseaseScanScreen.tsx`

**Dependencies Installed:**
- `expo-image-picker` — Camera + gallery image selection

**Files Created:**
- `src/services/index.ts` — Barrel exports for all service modules

**Files Modified:**
- `src/screens/DiseaseScanScreen.tsx` — Full API integration with 5-phase state machine

**Scan Phases (state machine):**
```
idle → preview → analyzing → result
  ↑         ↓                    ↓
  └── error ←────────────────────┘
```

| Phase | UI |
|-------|-----|
| `idle` | Viewfinder + Take Photo / Pick from Gallery buttons |
| `preview` | Selected image preview + Scan for Disease / Choose Another |
| `analyzing` | Image with dark overlay + ActivityIndicator + scanner animation |
| `result` | Disease name, confidence %, severity badge, symptoms, treatment, prevention |
| `error` | Error icon + message + error code + Try Again / Go Back |

**Key Implementation Decisions:**
- `expo-image-picker` with `allowsEditing: true`, `aspect: [3,4]`, `quality: 0.8`
- Camera permission requested before `launchCameraAsync()`
- FormData multipart upload matching crop-disease-service's `POST /detect`
- Error handling via `ApiError` type (detail, error_code, status)
- Results display: disease name, confidence %, severity badge, symptoms list, treatment list, prevention list
- `ScrollView` wrapper for result content (may be long)
- All styles match Stitch design system (PlusJakartaSans + BeVietnamPro fonts)

### Step 3 Details

**Files Created:**
- `app/core/security.py` — JWT authentication & authorization dependencies

**Files Modified:**
- `app/api/routes/crop.py` — Added `get_current_user` dependency to `/detect` and `/history`
- `.env` — Updated `JWT_SECRET_KEY` to match user-auth-service's `SECRET_KEY`

**Key Implementation Decisions:**
- Uses `python-jose` (same library as user-auth-service) for JWT decode/verify
- `OAuth2PasswordBearer` with `auto_error=False` for flexible token extraction
- `get_current_user` — Strict auth dependency (401 if no/invalid token)
- `get_optional_user` — Optional auth (returns None if no token, for flexible endpoints)
- `TokenPayload` Pydantic model matches auth service payload: `{sub: farmer_id, email: farmer_email}`
- Protected routes auto-extract `user_id` from JWT if not explicitly provided
- `/health` endpoints remain public (no auth required)

### Step 2 Details

**Files Created:**
- `app/core/errors.py` — Error handling utilities (ServiceUnavailableError, ServiceTimeoutError, handle_proxy_error)
- `app/api/routes/crop.py` — Proxy routes for crop-disease-service

**Files Modified:**
- `app/main.py` — Registered crop_router

**Key Implementation Decisions:**
- Used `httpx.AsyncClient` (shared via `app.state.http_client`) for async proxy requests
- File uploads forwarded using multipart form-data with raw bytes
- Hop-by-hop headers filtered out before forwarding
- 120s read timeout configured for AI image processing
- Graceful error handling: ConnectError → 503, TimeoutException → 504

## 🔧 Development

### Adding a New Route

1. Create route file in `app/api/routes/`
2. Define proxy handler using `app.state.http_client`
3. Register router in `app/main.py`

Example:

```python
# app/api/routes/example.py
from fastapi import APIRouter, Request, Response

router = APIRouter(prefix="/api/v1/example", tags=["example"])

@router.get("/test")
async def proxy_test(request: Request):
    client = request.app.state.http_client
    response = await client.get(f"{settings.example_service_url}/test")
    return Response(content=response.content, status_code=response.status_code)
```

## 📄 License

Private - Kissan Rehnuma Project
