# 🌾 Kissan Rehnuma — AI-Powered Farmer Assistance Platform

> **Empowering Pakistani farmers with AI-driven crop disease detection, animal health diagnosis, weather alerts, market rates, and voice-based emergency helpline — all through a resilient microservices architecture.**

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Features](#features)
- [Architecture](#architecture)
  - [High-Level System Architecture](#high-level-system-architecture)
  - [Microservices Breakdown](#microservices-breakdown)
  - [API Gateway](#api-gateway)
  - [Resilience Pattern](#resilience-pattern)
- [Tech Stack](#tech-stack)
- [Service Flow Diagrams](#service-flow-diagrams)
  - [Crop Disease Detection Flow](#crop-disease-detection-flow)
  - [Animal Disease Detection Flow](#animal-disease-detection-flow)
  - [Weather Alert Flow](#weather-alert-flow)
  - [Market Rate Flow](#market-rate-flow)
  - [Voice Helpline Flow](#voice-helpline-flow)
- [Folder Structure](#folder-structure)
- [Design Decisions (Research-Backed)](#design-decisions-research-backed)
  - [Why Provider Abstraction for CV Models?](#why-provider-abstraction-for-cv-models)
  - [Why pgvector over Standalone Vector DB?](#why-pgvector-over-standalone-vector-db)
  - [Why LangGraph over Plain LangChain?](#why-langgraph-over-plain-langchain)
  - [Confidence Gate Pattern](#confidence-gate-pattern)
  - [Why Not Let LLM Diagnose Diseases?](#why-not-let-llm-diagnose-diseases)
- [Dataset Strategy](#dataset-strategy)
- [Getting Started (Local Development)](#getting-started-local-development)
- [Project Status](#project-status)
- [Pending Work & Roadmap](#pending-work--roadmap)

---

## Overview

**Kissan Rehnuma** (کسان رہنما — "Farmer's Guide") is an AI-powered agricultural platform designed for Pakistani farmers. It provides:

1. **Crop disease detection** from leaf images with symptoms, recommendations, and treatment plans
2. **Animal disease diagnosis** from images with specialist doctor suggestions
3. **AI-based weather alerts** for proactive crop and livestock protection
4. **Real-time market rates** for informed selling decisions
5. **AI voice helpline** for emergency farmer support — in Urdu/Roman Urdu

Built as a **microservices system** with an API Gateway, each feature runs as an independent service ensuring fault isolation and independent scalability.

---

## Problem Statement

Pakistani farmers face multiple interconnected challenges:

| Problem | Impact |
|---------|--------|
| **Late crop disease identification** | 30-40% yield loss due to delayed diagnosis |
| **No access to veterinary specialists** | Animal diseases spread unchecked in rural areas |
| **Unpredictable weather events** | Crop damage from unseasonal rains, frost, heatwaves |
| **Market price information asymmetry** | Farmers sell below market rate due to lack of real-time data |
| **No emergency advisory system** | No immediate guidance during pest attacks, disease outbreaks |
| **Language and literacy barriers** | Most advisory apps are English-only, excluding rural farmers |

Kissan Rehnuma addresses all five problems through a unified, accessible platform.

---

## Features

### 🌿 Crop Disease Detection
- Upload crop leaf image → AI detects disease (or confirms healthy)
- Returns: disease name, confidence score, symptoms, treatment, preventive measures
- Supports major Pakistani crops: wheat, cotton, rice, sugarcane, mango, citrus, tomato, chili

### 🐄 Animal Disease Diagnosis
- Upload animal image → AI identifies visible disease indicators
- Returns: probable disease, symptoms analysis, recommended specialist doctor
- Connects farmers with veterinary expertise remotely

### 🌦️ AI Weather Alerts
- Location-based weather monitoring with agricultural risk assessment
- Proactive alerts: frost warning, heavy rain, heatwave, dust storm
- Crop-specific advisory based on growth stage and weather forecast

### 📊 Market Rates
- Real-time crop prices from major Pakistani mandis (markets)
- Historical price trends for informed selling decisions
- Price alerts when target rate is reached

### 📞 AI Voice Helpline
- Farmer calls helpline → AI voice agent answers in Urdu
- Understands farmer's problem through conversation
- Provides immediate advisory or escalates to human expert
- Works without smartphone or internet — basic phone call

---

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FARMER (Mobile/Web)                         │
│                    React Native (Expo) App                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────┐  │
│  │   Auth   │  │ Rate Limiter │  │ Circuit Breaker│  │  Logger   │  │
│  │  (JWT)   │  │              │  │               │  │           │  │
│  └──────────┘  └──────────────┘  └───────────────┘  └───────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Routing Layer                              │   │
│  │  /crop/* → crop-service    /animal/* → animal-service        │   │
│  │  /weather/* → weather-svc  /market/* → market-service        │   │
│  │  /voice/* → voice-service  /auth/* → user-auth-service       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
           │          │          │          │          │
           ▼          ▼          ▼          ▼          ▼
   ┌───────────┐┌───────────┐┌───────────┐┌───────────┐┌───────────┐
   │  Crop     ││  Animal   ││  Weather  ││  Market   ││  Voice    │
   │  Disease  ││  Disease  ││  Alert    ││  Rate     ││  Helpline │
   │  Service  ││  Service  ││  Service  ││  Service  ││  Service  │
   └─────┬─────┘└─────┬─────┘└─────┬─────┘└─────┬─────┘└─────┬─────┘
         │            │            │            │            │
         ▼            ▼            ▼            ▼            ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │              PostgreSQL (per-service schema)                     │
   │              + pgvector extension for RAG                       │
   └─────────────────────────────────────────────────────────────────┘
```

### Microservices Breakdown

| Service | Responsibility | Key Components |
|---------|---------------|----------------|
| `crop-disease-service` | Image → disease detection, diagnosis, treatment | LangGraph agent, CV detector, pgvector RAG |
| `animal-disease-service` | Image → animal disease, specialist suggestion | LangGraph agent, CV detector, pgvector RAG |
| `weather-alert-service` | Weather data → agricultural risk alerts | Weather API integration, LLM advisory |
| `market-rate-service` | Mandi prices, trends, alerts | External API scraper/sync, price engine |
| `voice-helpline-service` | Voice call → AI conversation → advisory | Twilio/voice API, LangGraph agent, STT/TTS |
| `user-auth-service` | Farmer registration, JWT auth, roles | JWT, OAuth, farmer profile management |

### API Gateway

The API Gateway is the **single entry point** for the frontend. It handles:

- **Authentication**: JWT validation on every request
- **Rate Limiting**: Prevents abuse (per-farmer, per-IP)
- **Circuit Breaker**: If one service is down, others continue working
- **Request Routing**: Forwards `/crop/*` → crop-service, `/animal/*` → animal-service, etc.
- **Error Isolation**: One service failure returns graceful error, doesn't crash the gateway
- **Logging/Monitoring**: Centralized request tracing via LangSmith

### Resilience Pattern

```
                    ┌─────────────────────┐
                    │   API Gateway       │
                    │                     │
  Request ─────────►│  Circuit Breaker    │
                    │         │           │
                    │    ┌────┴────┐      │
                    │    │         │      │
                    │  CLOSED   OPEN      │
                    │  (normal)  (fail)   │
                    │    │         │      │
                    │    ▼         ▼      │
                    │  Forward   Return   │
                    │  to svc    fallback │
                    │  response  error    │
                    └─────────────────────┘

States:
  CLOSED  → Requests flow normally to service
  OPEN    → Service is failing, return cached/fallback response immediately
  HALF-OPEN → Periodically test if service recovered
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend Framework** | Python 3.12+ / FastAPI | High-performance async API for each microservice |
| **API Gateway** | FastAPI | Single entry point with routing, auth, circuit breaker |
| **Agentic Framework** | LangGraph | Stateful AI agent workflows (diagnosis → RAG → response) |
| **LLM Orchestration** | LangChain | Chain composition, prompt management, tool integration |
| **Observability** | LangSmith | End-to-end tracing of LLM agent calls, debugging |
| **Database** | PostgreSQL 16 | Primary datastore (per-service schema isolation) |
| **Vector Search** | pgvector | Semantic search for disease knowledge RAG |
| **ORM** | SQLAlchemy 2.0 | Type-safe database access |
| **Migrations** | Alembic | Per-service database schema migrations |
| **Validation** | Pydantic v2 | Request/response schema validation |
| **CV Detection** | Provider pattern (Vision API / local model) | Pluggable disease detection from images |
| **Voice** | Twilio + STT/TTS | Voice call handling for helpline |
| **Weather** | OpenWeatherMap API | Weather data + forecasts |
| **Market Data** | Mandi price APIs / scraping | Real-time crop prices |
| **Frontend** | React Native (Expo) | Mobile + Web app from single codebase |
| **State Management** | Zustand | Lightweight client state management |
| **Containerization** | Docker + Docker Compose | Local dev environment, consistent deployments |
| **Orchestration** | Kubernetes (future) | Production scaling |

---

## Service Flow Diagrams

### Crop Disease Detection Flow

This is the most complex flow — it demonstrates the core "CV → Confidence Gate → RAG → LLM" pattern used across detection services.

```
                    FARMER
                       │
                       ▼
                 Upload Image
                 (leaf/crop photo)
                       │
                       ▼
              ┌─────────────────┐
              │ Image Validation │ ← size, format, quality check
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Disease Detector │ ← Provider abstraction (Vision API or local CV model)
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Confidence Gate  │
              └────────┬────────┘
                       │
              ┌────────┴─────────┐
              │                  │
         LOW (< 0.6)        HIGH (≥ 0.6)
              │                  │
              ▼                  ▼
     "Unable to           Disease ID
      confidently         (e.g. "early_blight")
      diagnose"                │
              │                ▼
              │       ┌─────────────────┐
              │       │ pgvector RAG     │ ← Retrieve verified disease knowledge
              │       │ (symptoms,       │   from vector store
              │       │  treatment,      │
              │       │  prevention)     │
              │       └────────┬────────┘
              │                │
              │                ▼
              │       ┌─────────────────┐
              │       │ LangGraph Agent  │ ← Orchestrates: retrieve → format → generate
              │       └────────┬────────┘
              │                │
              │                ▼
              │       ┌─────────────────┐
              │       │ LLM Response     │ ← Farmer-friendly explanation
              │       │ in Urdu /        │   in farmer's language
              │       │ Roman Urdu       │
              │       └────────┬────────┘
              │                │
              └────────┬───────┘
                       │
                       ▼
                 Farmer receives
                 diagnosis + advisory
```

**Key Design Principle:** The LLM does NOT diagnose the disease. The CV model diagnoses, the confidence gate validates, RAG retrieves verified knowledge, and the LLM only explains it in farmer-friendly language.

### Animal Disease Detection Flow

```
                    FARMER
                       │
                       ▼
                 Upload Image
                 (animal photo)
                       │
                       ▼
              ┌─────────────────┐
              │ Disease Detector │ ← Provider pattern (same as crop)
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Confidence Gate  │
              └────────┬────────┘
                       │
              ┌────────┴─────────┐
              │                  │
           LOW               HIGH
              │                  │
              ▼                  ▼
        "Need more         Disease identified
        information"             │
                                 ▼
                        ┌─────────────────┐
                        │ Symptom Analyzer │ ← LangGraph: combines image + farmer input
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Specialist       │ ← Matches disease → recommended vet doctor
                        │ Matcher (RAG)    │
                        └────────┬────────┘
                                 │
                                 ▼
                        Response: disease +
                        symptoms + doctor
                        recommendation
```

### Weather Alert Flow

```
              ┌─────────────────┐
              │ Weather API      │ ← OpenWeatherMap / weather service
              │ (scheduled poll) │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Risk Analyzer    │ ← LangGraph agent: weather data + crop calendar
              │ (LangGraph)      │   + location → agricultural risk assessment
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Alert Generator  │ ← LLM generates farmer-friendly alert
              │                  │   with actionable advisory
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Push Notification│ ← Sent to affected farmers in area
              │ + SMS / Voice    │
              └─────────────────┘
```

### Market Rate Flow

```
              ┌─────────────────┐
              │ Mandi Price      │ ← External API / data source
              │ Sync (scheduled) │   (PAR, government mandi data)
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Price Engine     │ ← Stores, normalizes, indexes prices
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Trend Analyzer   │ ← Historical analysis, price prediction
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Farmer Dashboard │ ← Current rates, trends, alerts
              │ (Mobile App)     │
              └─────────────────┘
```

### Voice Helpline Flow

```
              FARMER calls helpline number
                       │
                       ▼
              ┌─────────────────┐
              │ Twilio / Voice   │ ← Call handling, audio stream
              │ Gateway          │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Speech-to-Text   │ ← Convert farmer's Urdu speech → text
              │ (STT)            │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ LangGraph Agent  │ ← Understands problem, decides action:
              │ (Voice Agent)    │   - Crop question → query crop knowledge
              │                  │   - Emergency → immediate advisory
              │                  │   - Market query → fetch current rates
              │                  │   - Complex → escalate to human
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Text-to-Speech   │ ← Convert response → Urdu audio
              │ (TTS)            │
              └────────┬────────┘
                       │
                       ▼
              Farmer hears response
              in Urdu
```

---

## Folder Structure

```
kissan-rehnuma/
├── services/                              # Independent microservices
│   ├── crop-disease-service/              # Each follows same internal pattern:
│   │   ├── app/
│   │   │   ├── main.py                    # FastAPI entrypoint
│   │   │   ├── api/v1/endpoints/          # Route handlers
│   │   │   ├── core/                      # config, logging, security
│   │   │   ├── agents/                    # LangGraph state graphs + nodes
│   │   │   │   └── prompts/               # LLM prompt templates
│   │   │   ├── models/                    # CV/ML model wrappers
│   │   │   ├── db/                        # SQLAlchemy ORM models
│   │   │   ├── schemas/                   # Pydantic schemas
│   │   │   ├── services/                  # Business logic
│   │   │   └── repositories/              # Data access layer
│   │   ├── tests/unit/ + integration/
│   │   ├── alembic/versions/              # DB migrations
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── animal-disease-service/            # (same pattern)
│   ├── weather-alert-service/             # (same pattern)
│   ├── market-rate-service/               # (same pattern)
│   ├── voice-helpline-service/            # (same pattern)
│   └── user-auth-service/                 # Common auth service
│
├── api-gateway/                           # Single entry point
│   ├── app/
│   │   ├── core/                          # config, auth, rate-limit, circuit-breaker
│   │   ├── routing/                       # Proxy routes → services
│   │   ├── middleware/                     # Logging, error isolation
│   │   └── schemas/
│   ├── Dockerfile
│   └── requirements.txt
│
├── shared/                                # Internal pip package
│   └── shared_lib/
│       ├── logging/                       # Structured logging
│       ├── exceptions/                    # Common exception classes
│       ├── auth/                          # JWT verify helpers
│       └── observability/                 # LangSmith tracing config
│
├── mobile-web-app/                        # React Native (Expo)
│   ├── src/
│   │   ├── screens/                       # CropDetection, AnimalDetection, etc.
│   │   ├── components/                    # Reusable UI components
│   │   ├── navigation/                    # React Navigation
│   │   ├── services/                      # API client (→ gateway)
│   │   ├── store/                         # Zustand state
│   │   ├── hooks/
│   │   └── utils/
│   └── assets/
│
├── infra/                                 # Infrastructure
│   ├── docker/                            # Dockerfiles, compose
│   ├── k8s/                               # Kubernetes manifests
│   ├── nginx/                             # Reverse proxy
│   └── ci-cd/github-actions/
│
├── docs/                                  # Documentation
│   ├── architecture/
│   ├── api/
│   ├── adr/                               # Architecture Decision Records
│   ├── deployment/
│   └── development/
│
└── scripts/                               # Automation
    ├── setup/
    ├── deploy/
    └── db/
```

---

## Design Decisions (Research-Backed)

### Why Provider Abstraction for CV Models?

**Decision:** Disease detection uses a `Detector` interface with swappable providers.

```python
# Abstract interface
class DiseaseDetector:
    async def detect(self, image: bytes) -> DetectionResult: ...

# Hackathon MVP: Cloud Vision API
class VisionAPIDetector(DiseaseDetector): ...

# Future: Self-hosted fine-tuned model
class LocalCNNDetector(DiseaseDetector): ...

# Long-term: Pakistani crop-specific model
class PakistaniCropDetector(DiseaseDetector): ...
```

**Rationale:** Research consistently shows that models trained on controlled datasets (PlantVillage: 98-99% accuracy) degrade significantly on real-world field images. The Springer review "AI-based crop disease detection" (2025) confirms: *"DL models achieve >95% accuracy on controlled datasets like PlantVillage, performance degrades significantly on field images."*

By using a provider pattern, we can:
- **Start fast**: Use cloud Vision API for MVP (no model training needed)
- **Swap later**: Replace with fine-tuned EfficientNet/MobileNet when Pakistani dataset is ready
- **A/B test**: Run multiple detectors simultaneously
- **Fail gracefully**: If one provider is down, fallback to another

### Why pgvector over Standalone Vector DB?

**Decision:** Use pgvector (PostgreSQL extension) instead of Pinecone/Weaviate/Qdrant.

**Rationale:**
- **Single database**: Each service already uses PostgreSQL — adding pgvector means no extra infrastructure
- **Hybrid queries**: Combine vector similarity search with SQL filters (e.g., "find similar diseases WHERE crop = 'cotton'")
- **Simpler ops**: One backup, one migration system, one monitoring setup
- **Research-backed**: pgvector supports HNSW indexing for fast approximate nearest neighbor search, sufficient for our knowledge base size
- **Cost-effective**: No additional service to host/pay for during hackathon or early production

### Why LangGraph over Plain LangChain?

**Decision:** Use LangGraph for all agentic workflows.

**Rationale:**
- **Stateful workflows**: Disease diagnosis is multi-step (detect → validate → retrieve → generate). LangGraph provides explicit state management.
- **Conditional branching**: Confidence gate requires branching logic (low confidence → reject, high → proceed). LangGraph handles this natively.
- **Observability**: LangSmith integrates directly with LangGraph for trace visualization — critical for debugging and hackathon demos.
- **Human-in-the-loop**: Voice helpline may need to escalate to human expert. LangGraph supports interrupt/resume patterns.
- **Production-ready**: LangGraph's graph-based approach is the recommended pattern for agentic RAG systems (LangChain docs, 2025).

### Confidence Gate Pattern

**Decision:** Never trust low-confidence predictions. Always validate before RAG retrieval.

```
Detection Result
       │
       ▼
  confidence ≥ 0.6?
       │
  ┌────┴────┐
  NO        YES
  │          │
  ▼          ▼
"Cannot    Proceed to
diagnose"  RAG + LLM
```

**Rationale:** Research from Frontiers in Plant Science (2025) shows that Vision Transformers and CNNs can produce overconfident wrong predictions on out-of-distribution images. A confidence gate prevents the system from generating plausible-sounding but incorrect diagnoses. This is especially critical for Pakistani field conditions that differ from training data.

### Why Not Let LLM Diagnose Diseases?

**Decision:** LLM only explains verified diagnoses. It does NOT identify diseases.

```
WRONG:   Image → LLM → "This is Early Blight" → Treatment
RIGHT:   Image → CV Model → Disease ID → RAG (verified knowledge) → LLM → Explanation
```

**Rationale:**
- LLMs hallucinate — they can invent diseases or suggest wrong treatments
- CV models are trained specifically for visual disease classification
- RAG ensures treatment plans come from verified agricultural knowledge, not LLM memory
- This architecture is **defensible** to hackathon judges and **safe** for farmers

---

## Dataset Strategy

This is **more important than model architecture** for Kissan Rehnuma's success.

### Phase 1: Hackathon MVP
- Use **PlantVillage** dataset for initial model validation
- Use **Cloud Vision API** as primary detector (no training needed)
- Demonstrate the architecture and flow

### Phase 2: Real-World Validation
- Add **PlantDoc** dataset (real field images, not lab-controlled)
- Fine-tune EfficientNet-B0 or MobileNetV3 on combined dataset
- Benchmark accuracy drop from lab → field conditions

### Phase 3: Pakistani Crop Dataset (Long-term)
- Collect Pakistani farm images (partner with agricultural universities)
- Cover major crops: wheat, cotton, rice, sugarcane, mango, citrus
- Fine-tune detector on local conditions
- Target: robust performance on real Pakistani field images

> **Critical Insight:** Research repeatedly shows that PlantVillage's 99% accuracy does NOT transfer to real-world images. The gap between lab and field performance is the #1 challenge in plant disease detection AI. Kissan Rehnuma's dataset strategy addresses this explicitly.

---

## Getting Started (Local Development)

### Prerequisites
- Python 3.12+
- Node.js 18+ / npm
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/muzaffar401/Kissan_Rehnuma.git
cd Kissan_Rehnuma

# 2. Start all services with Docker Compose (coming soon)
docker-compose up -d

# 3. Access services
# API Gateway:     http://localhost:3000
# Auth Service:    http://localhost:8002
# Crop Service:    http://localhost:8001
# Animal Service:  http://localhost:8003
# Weather Service: http://localhost:8004
# Market Service:  http://localhost:8005
# Voice Service:   http://localhost:8006
# Frontend (Web):  http://localhost:8081
```

### Environment Variables

Each service has its own `.env.example` file. Common variables:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/kissan_rehnuma

# LLM
OPENAI_API_KEY=sk-...
LANGCHAIN_TRACING_V2=true
LANGSMITH_API_KEY=ls-...

# Service URLs (for gateway)
CROP_SERVICE_URL=http://localhost:8001
ANIMAL_SERVICE_URL=http://localhost:8002
WEATHER_SERVICE_URL=http://localhost:8003
MARKET_SERVICE_URL=http://localhost:8004
VOICE_SERVICE_URL=http://localhost:8005
```

---

## Project Status

| Component | Status | Notes |
|-----------|--------|-------|
| Folder Structure | ✅ Complete | Enterprise-level microservices layout |
| API Gateway | ✅ Working | Routing, JWT auth, circuit breaker, rate limiting, CORS |
| User Auth Service | ✅ Working | JWT signup/login, OTP verification, farmer registration |
| Crop Disease Service | ✅ Working | LangGraph agent, CV detector, pgvector RAG, treatment plans |
| Animal Disease Service | ✅ Working | LangGraph agent, CV detector, pgvector RAG, vet matching |
| Weather Alert Service | ✅ Working | OpenWeatherMap integration, LLM advisory, multi-layer caching (15/30/60min TTL) |
| Market Rate Service | ✅ Working | AMIS Punjab scraper, 47 commodities, min/max/FQP prices, 36 Punjab mandis seeded |
| Voice Helpline Service | 🔲 In Progress | Service structure created, core logic pending |
| Shared Library | ✅ Working | Logging, exceptions, JWT helpers, observability |
| Mobile/Web App (Frontend) | ✅ Working | All screens: Splash, Onboarding, Login, Home, Disease, Weather, Market, Helpline, Settings |
| Session Persistence | ✅ Working | JWT restore on refresh, onboarding tracking, logout flow |
| Docker Compose | 🔲 Pending | Not yet created |
| CI/CD Pipeline | 🔲 Pending | Not yet created |
| Tests | 🔲 Pending | Unit/integration test stubs exist, no coverage yet |

---

## Pending Work (Roadmap)

### 🔴 Critical — Must Complete

- [ ] **Market: Multi-city AMIS scraping** — Currently only Lahore mandi. Need Multan, Faisalabad, Rawalpindi, etc. (36 mandis seeded, scraper needs city iteration)
- [ ] **Market: Frontend ↔ Gateway connection verified** — Frontend calls `/market/rates` via gateway, needs JWT auth flow tested end-to-end
- [ ] **Voice Helpline Service** — Core voice agent logic, STT/TTS integration, LangGraph conversation flow
- [ ] **Docker Compose** — Single `docker-compose up` to start all services + PostgreSQL + Redis
- [ ] **Git push fix** — Repository URL needs correction (`muzaffar401/Kissan_Rehnuma` returns 404)

### 🟡 Medium — Enterprise Features

- [ ] **Market: Unique constraint on (mandi_id, crop_id, recorded_date)** — Prevent duplicate price entries on re-runs
- [ ] **Market: Data validation** — Reject prices outside reasonable range (e.g., Wheat can't be 0 or 1,000,000)
- [ ] **Market: Expand crop coverage** — AMIS has 136 commodities, scraper gets 47 with prices. Remaining 89 have no data today but should be captured when available
- [ ] **Market: Historical price chart** — Frontend shows price over time (line chart per crop)
- [ ] **Market: Per-mandi price comparison** — Show same crop's price across different mandis side-by-side
- [ ] **Weather: Multi-language advisory** — Urdu, Punjabi support beyond English
- [ ] **Auth: Password reset flow** — forgot-password endpoint exists, full flow not tested
- [ ] **API Gateway: Health dashboard** — Aggregated health of all downstream services

### 🟢 Low — Scale & Polish

- [ ] **Market: Multiple data sources** — Zarai Mandi, manual entry, Pakistan Agricultural Research Council
- [ ] **Market: Price alerts** — Farmer sets target price, notification when reached
- [ ] **Market: Price forecasting** — ARIMA/Prophet for next 7/30 day prediction
- [ ] **Market: "Best time to sell" advisory** — Based on trend, tell farmer when to sell
- [ ] **Market: Arrival quantity tracking** — AMIS provides arrival data, show supply levels
- [ ] **Market: International price comparison** — Global commodity prices for context
- [ ] **Frontend: Push notifications** — Weather alerts, price alerts
- [ ] **Frontend: Offline mode** — Cache last-known data for areas with poor connectivity
- [ ] **CI/CD: GitHub Actions** — Auto-test on PR, auto-deploy on merge
- [ ] **Testing: Unit tests** — All services need proper test coverage
- [ ] **Testing: Integration tests** — End-to-end API tests through gateway
- [ ] **Kubernetes manifests** — Production deployment configuration
- [ ] **Monitoring: Prometheus + Grafana** — Service metrics, alerting
- [ ] **Rate limiting: Per-farmer limits** — Currently IP-based, need user-based

### ✅ Completed

- [x] AMIS Punjab scraper rewritten — scrapes `ViewPrices.aspx` for all commodities with Min/Max/FQP
- [x] Crop synonyms expanded — 7 → 150+ mappings (Punjabi/Urdu/English → standard names)
- [x] DB migration — `min_price`, `max_price`, `fqp_price` columns added to prices table
- [x] 36 Punjab mandis seeded in database
- [x] `GET /api/v1/rates` endpoint — all latest rates with optional `?q=` search
- [x] Frontend MarketRatesScreen — real API data, search, category filters, loading/error states
- [x] Gateway proxy route for `/market/rates` (all rates)
- [x] Unit conversion — AMIS Rs/100kg (quintal) → PKR/kg
- [x] Session persistence — JWT restore on browser refresh, onboarding completion tracking
- [x] Logout functionality — Settings screen wired to `tokenStorage.clearAll()`
- [x] Weather service — multi-layer caching (current 15min, forecast 30min, LLM advisory 60min)
- [x] Weather service — farmer location registration after signup
- [x] All frontend screens — Splash, Onboarding, Language, Login, Home, Disease, Weather, Market, Helpline, Settings
- [x] Cross-screen navigation — Home ↔ Disease ↔ Weather ↔ Market ↔ Helpline

---

## Pending Work & Roadmap

> **Detailed task breakdown with checkboxes:** See [docs/PENDING_WORK.md](docs/PENDING_WORK.md)

**25 total items reviewed** — 4 completed, 21 remaining across Critical / Medium / Low priorities.

---

## License

This project is built for the **Qoder Hackathon**.

---

<p align="center">
  <strong>Kissan Rehnuma — ہر کسان کا اپنا رہنما</strong><br/>
  <em>Empowering farmers with AI, one crop at a time.</em>
</p>
