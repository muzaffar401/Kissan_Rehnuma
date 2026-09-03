# Kissan Rehnuma Dev Launcher

One-command launcher for all Kissan Rehnuma services during local development.
Each service opens in its own terminal window.

## What it starts

| Service | Port | Notes |
|---------|------|-------|
| mobile-web-app (Expo) | 8081 | React Native / web frontend |
| api-gateway | 3000 | Reverse proxy + JWT validation |
| crop-disease-service | 8001 | |
| user-auth-service | 8002 | |
| animal-disease-service | 8003 | |
| weather-alert-service | 8004 | |
| market-rate-service | 8005 | |
| token-server | 8080 | LiveKit JWT token server |
| voice-agent-service | — | LiveKit agent server (no HTTP port) |

## Prerequisites

1. PostgreSQL running locally (or update `.env` files to point to your DB).
2. Each Python service has its dependencies installed:
   - `api-gateway`: `pip install -r requirements.txt`
   - `crop-disease-service`: `uv sync --extra dev` (uses `uv`)
   - `user-auth-service`: `pip install -r requirements.txt`
   - `animal-disease-service`: `pip install -e .`
   - `weather-alert-service`: `pip install -r requirements.txt`
   - `market-rate-service`: `pip install -r requirements.txt`
   - `voice-agent-service`: `pip install -e .`
3. Node.js + npm for the frontend: `cd mobile-web-app && npm install`

## Usage

### Option 1: Python script (recommended)

```powershell
cd C:\Users\ma940\Desktop\Kissan_Rehnuma
python scripts\dev\start_all.py
```

### Option 2: Batch file (Windows)

```powershell
cd C:\Users\ma940\Desktop\Kissan_Rehnuma
scripts\dev\start_all.bat
```

### Stop everything

Close each terminal window individually. Each window belongs to one service, so you can stop/restart services independently.

## Output

Because every service runs in its own terminal, you can read logs per service without mixed prefixes.
