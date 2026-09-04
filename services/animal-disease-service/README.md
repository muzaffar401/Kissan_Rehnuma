<h1 align="center">Animal Disease Service</h1>

<p align="center">
  AI-powered animal disease detection from images with veterinary specialist matching
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12-blue?logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115+-green?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/LangGraph-Agent-1C3C3C" alt="LangGraph" />
  <img src="https://img.shields.io/badge/Docker-Multi--stage-2496ED?logo=docker" alt="Docker" />
</p>

---

## Overview

The Animal Disease Service detects visible diseases in livestock from images using the same architectural pattern as the Crop Disease Service — Vision LLM analysis, confidence gate, pgvector RAG, and LangGraph orchestration. In addition to disease diagnosis, it matches the farmer with a recommended veterinary specialist based on the identified disease.

Supports Pakistani livestock: cattle, buffalo, goats, sheep, and poultry.

---

## Architecture

```
Image Upload (animal photo)
     │
     ▼
┌─────────────────┐
│ Vision LLM       │  ← OpenRouter (Gemini) — disease classification
└────────┬────────┘
         ▼
┌─────────────────┐
│ Confidence Gate  │  ← ≥ 70% → proceed  |  < 70% → "need more info"
└────────┬────────┘
         ▼
┌─────────────────┐
│ Symptom Analyzer │  ← LangGraph: combines image + farmer context
└────────┬────────┘
         ▼
┌─────────────────┐
│ Specialist       │  ← pgvector RAG: match disease → recommended vet
│ Matcher          │
└────────┬────────┘
         ▼
   Disease + Symptoms + Doctor Recommendation
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/animal/detect` | JWT | Upload image → disease diagnosis + vet recommendation |
| `GET` | `/api/v1/animal/history` | JWT | Past scan results for current farmer |
| `GET` | `/api/v1/animal/health` | No | Service health check |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection (`kissan_animal_disease` DB) |
| `OPENROUTER_API_KEY` | Yes (prod) | — | Vision LLM API key |
| `VISION_MODEL` | No | `google/gemini-2.5-flash` | Vision model |
| `VISION_TEMPERATURE` | No | `0.3` | Slightly higher than crop (animal diseases more varied) |
| `CONFIDENCE_THRESHOLD` | No | `0.70` | Minimum confidence to proceed |
| `CLOUDINARY_*` | Yes (prod) | — | Image storage (folder: `kissan-rehnuma/animal-scans`) |
| `LANGSMITH_TRACING` | No | `false` | Enable LangSmith observability |
| `APP_ENV` | No | `development` | `production` enforces required keys |

---

## Quick Start

```bash
cd services/animal-disease-service

# Install dependencies (uv package manager)
uv sync

# Or with pip
pip install .

# Configure .env

# Start service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8003
```

### Docker

```bash
docker build -t animal-disease-service .
docker run -p 8003:8003 --env-file .env animal-disease-service
```

Service available at `http://localhost:8003`

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Same architecture as crop** | Proven pattern reused; LangGraph graph structure is identical, only prompts differ |
| **Higher temperature (0.3)** | Animal diseases have more visual variation than crop diseases; slight creativity helps |
| **Specialist matcher via RAG** | Maps disease → veterinary specialization → recommended doctor from knowledge base |
| **Separate database** | Animal scan data is domain-specific; no shared tables with other services |
| **Docker with uv** | Same multi-stage build pattern as crop-disease-service for consistency |

---

## Tech Stack

- **Framework:** FastAPI + Uvicorn (async)
- **AI Agent:** LangGraph (detect → gate → symptom analysis → specialist matching)
- **Vision:** OpenRouter Vision API (Gemini)
- **RAG:** pgvector (PostgreSQL vector similarity search)
- **Image Storage:** Cloudinary
- **ORM:** SQLAlchemy 2.0 (async)
- **Dependencies:** uv + pyproject.toml
- **Containerization:** Docker (multi-stage build)
- **Observability:** LangSmith tracing
