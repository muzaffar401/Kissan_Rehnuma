# 🌿 Crop Disease Detection Service

> **Kissan Rehnuma's** first microservice — detects crop diseases from leaf images, identifies symptoms, and recommends treatments with local Pakistani context (chemicals, PKR costs).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI (async) |
| AI Engine | LangGraph (stateful agent workflow) |
| Vision LLM | GPT-4o via OpenRouter |
| Database | PostgreSQL 16 + asyncpg |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Image Storage | Cloudinary |
| Validation | Pydantic v2 (structured output) |
| Observability | LangSmith tracing |
| Container | Docker (multi-stage) |

---

## Architecture

```
Farmer (Mobile App)
       │
       │  POST /api/v1/disease/detect
       │  (image file + language)
       ▼
┌──────────────────────────────────────────────────────┐
│                  FastAPI Server                       │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │            LangGraph Workflow                    │ │
│  │                                                  │ │
│  │  [validate_image]                                │ │
│  │       │                                          │ │
│  │       ├── NOT a plant ──────────► [save_to_db]   │ │
│  │       │                          → "not a plant" │ │
│  │       ▼ (is a plant)                             │ │
│  │  [upload_image]  ──► Cloudinary                  │ │
│  │       │                                          │ │
│  │       ▼                                          │ │
│  │  [detect_disease] ──► GPT-4o + CoT Prompt       │ │
│  │       │                 + Structured Output       │ │
│  │       ▼                                          │ │
│  │  [confidence_gate]                               │ │
│  │       │                                          │ │
│  │       ├── LOW (< 0.70) ─────────► [save_to_db]   │ │
│  │       │                          → "retake photo"│ │
│  │       ▼ (HIGH)                                   │ │
│  │  [save_to_database] ──► PostgreSQL               │ │
│  │       │                                          │ │
│  │       ▼                                          │ │
│  │  DiagnosisResponse (JSON)                        │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
       │
       ▼
  Farmer gets: disease name, symptoms, treatment (English),
  chemical + organic options with PKR cost
```

---

## Project Structure

```
crop-disease-service/
├── app/
│   ├── main.py                    # FastAPI app factory + lifespan
│   ├── core/
│   │   ├── config.py              # Pydantic Settings (env-based config)
│   │   ├── logging.py             # structlog (JSON in prod, console in dev)
│   │   └── migrations.py          # Auto-migration runner (runs on startup)
│   ├── db/
│   │   ├── base.py                # SQLAlchemy DeclarativeBase
│   │   ├── session.py             # Async engine + session factory
│   │   └── models.py              # CropDiseaseLog ORM model
│   ├── schemas/
│   │   └── disease.py             # Pydantic schemas (request/response/LLM output)
│   ├── repositories/
│   │   └── detection_repo.py      # DB queries + log builder
│   ├── services/
│   │   ├── image_validator.py     # PIL-based image pre-flight checks
│   │   └── cloud_storage.py       # Cloudinary upload wrapper
│   ├── agents/
│   │   ├── graph.py               # LangGraph StateGraph (5 nodes + routing)
│   │   └── prompts/
│   │       └── diagnosis_prompt.py # System prompt (Pakistani Agri-Botanist)
│   └── api/
│       ├── deps.py                # Dependency injection (DB session)
│       ├── router.py              # Root router (/api/v1)
│       └── v1/
│           ├── router.py          # V1 route aggregation
│           └── endpoints/
│               └── disease.py     # POST /detect, GET /health
├── alembic/                       # Database migrations
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example                   # Environment variables template
├── pyproject.toml                 # Dependencies + project metadata
├── alembic.ini                    # Alembic configuration
└── Dockerfile                     # Multi-stage container build
```

---

## API Endpoints

### `POST /api/v1/disease/detect`

Detect crop disease from a leaf/plant image.

**Request:** `multipart/form-data`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `image` | File | Yes | — | Crop leaf/plant image (JPEG, PNG, WebP) |
| `user_id` | String | No | null | Farmer/user identifier |
| `language` | String | No | `en` | Response language: `en`, `ur`, `pa`, `sd` |

**Response (200):**

```json
{
  "scan_id": "a1b2c3d4-...",
  "is_plant": true,
  "disease_name": "Tomato Early Blight",
  "scientific_name": "Alternaria solani",
  "crop_type": "tomato",
  "confidence": 0.87,
  "symptoms": [
    "Brown/black concentric rings on leaves (target spots)",
    "Lower leaves affected more severely than upper canopy",
    "Yellowing and drying of affected leaves"
  ],
  "causes": [
    "Alternaria solani fungus",
    "Spreads rapidly in warm and humid conditions",
    "Clay soil and poor air circulation"
  ],
  "treatment": {
    "chemical": [
      "Mancozeb 75% WP — 2gm/L water, spray every 10-12 days",
      "Chlorothalonil — 2ml/L water"
    ],
    "organic": [
      "Neem oil 5ml/L water spray",
      "Trichoderma viride soil application",
      "Remove and destroy affected leaves immediately"
    ],
    "estimated_cost_pkr": "Rs. 800-1200 per acre (chemical)"
  },
  "prevention_tips": [
    "Practice crop rotation (2-3 year cycle)",
    "Use resistant varieties",
    "Ensure proper field drainage"
  ],
  "affected_crops": ["tomato", "potato", "pepper"],
  "image_url": "https://res.cloudinary.com/.../scan.jpg",
  "language": "en",
  "message": ""
}
```

**Response — Not a plant:**

```json
{
  "scan_id": "x9y8z7...",
  "is_plant": false,
  "message": "No plant detected in the image. Please take a clear photo of the crop leaf or plant."
}
```

**Response — Low confidence:**

```json
{
  "scan_id": "m3n4o5...",
  "is_plant": true,
  "confidence": 0.42,
  "message": "Image is not clear enough for a reliable diagnosis. Please retake the photo in good lighting, from a closer distance."
}
```

### `GET /api/v1/disease/health`

Service health check.

```json
{
  "status": "healthy",
  "service": "crop-disease-service",
  "database": "connected",
  "vision_model": "openai/gpt-4o"
}
```

---

## Setup (Local Development)

### Prerequisites

- Python 3.12+
- PostgreSQL 16 (running on `localhost:5432`)
- [uv](https://docs.astral.sh/uv/) — fast Python package manager
- OpenRouter API key ([openrouter.ai](https://openrouter.ai))
- Cloudinary account ([cloudinary.com](https://cloudinary.com))
- LangSmith API key (optional, for tracing)

### Steps

```bash
# 1. Navigate to service directory
cd services/crop-disease-service

# 2. Install uv (if not already installed)
pip install uv
# macOS/Linux: curl -LsSf https://astral.sh/uv/install.sh | sh
# Windows:     powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 3. Create virtual environment + install dependencies (one command)
uv sync --extra dev

# 4. Configure environment
copy .env.example .env
# Edit .env with your actual API keys and DB credentials

# 5. Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE kissan_crop_disease;"

# 6. Generate initial migration (one-time only)
uv run alembic revision --autogenerate -m "initial schema"

# 7. Start the service (migrations run automatically on startup)
uv run uvicorn app.main:app --reload --port 8001
```

Service will be available at `http://localhost:8001`
API docs at `http://localhost:8001/docs` (debug mode only)

> **Auto-migration:** Database migrations run automatically on every service startup. When you change models, just generate a new migration (`uv run alembic revision --autogenerate -m "description"`) — it will be applied the next time the service starts.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql+asyncpg://...` | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key for GPT-4o |
| `VISION_MODEL` | No | `openai/gpt-4o` | Model identifier on OpenRouter |
| `CONFIDENCE_THRESHOLD` | No | `0.70` | Minimum confidence to accept diagnosis |
| `CLOUDINARY_CLOUD_NAME` | Yes | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | — | Cloudinary API secret |
| `LANGSMITH_TRACING` | No | `false` | Enable LangSmith tracing |
| `LANGSMITH_API_KEY` | No | — | LangSmith API key |
| `MAX_IMAGE_SIZE_MB` | No | `10` | Maximum upload file size |
| `MIN_IMAGE_WIDTH` | No | `224` | Minimum image width in pixels |
| `MIN_IMAGE_HEIGHT` | No | `224` | Minimum image height in pixels |

---

## Database Schema

**Table: `crop_disease_logs`**

Every scan is persisted — successful, failed, or low-confidence. This data serves as audit trail and future training data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | String (nullable) | Farmer identifier |
| `image_url` | Text | Cloudinary URL |
| `language` | String(5) | Response language code |
| `is_plant` | Boolean | Whether image showed a plant |
| `disease_name` | String (nullable) | Detected disease |
| `scientific_name` | String (nullable) | Latin/binomial name |
| `confidence` | Float (nullable) | Model confidence (0.0–1.0) |
| `crop_type` | String (nullable) | Affected crop |
| `symptoms` | JSONB (nullable) | Array of symptoms |
| `causes` | JSONB (nullable) | Array of causes |
| `treatment` | JSONB (nullable) | Treatment plan object |
| `prevention_tips` | JSONB (nullable) | Array of prevention tips |
| `affected_crops` | JSONB (nullable) | Array of affected crops |
| `status` | Enum | `completed`, `low_confidence`, `not_a_plant`, `failed` |
| `error_message` | Text (nullable) | Error details if failed |
| `created_at` | Timestamp | When scan was performed |

---

## Key Design Decisions

### Why LangGraph?
The diagnosis flow has **conditional branching** (confidence gate) and **state accumulation** (each node adds to the result). LangGraph handles this natively with `StateGraph` + conditional edges — cleaner than if/else chains in a single function.

### Why OpenRouter instead of direct OpenAI?
OpenRouter provides a unified API with automatic failover. If OpenAI is down, it can route to another provider. One API key, multiple models.

### Why structured output?
The Vision LLM is forced to return a `VisionDiagnosis` Pydantic model via `with_structured_output()`. This guarantees the frontend always receives valid JSON — no parsing errors, no crashes.

### Why conservative confidence?
Research (LeafBench 2025) shows GPT-4o achieves ~85% accuracy on disease identification but only ~52% on symptom identification. A 0.70 threshold prevents overconfident wrong diagnoses from reaching farmers.

### Why every scan is saved?
Failed and low-confidence scans are as valuable as successful ones. This data becomes the training set for a future Pakistani crop-specific CV model.

---

## Testing

```bash
# Unit tests (no DB, no API calls)
uv run pytest tests/unit/ -v

# Integration tests (requires running PostgreSQL)
uv run pytest tests/integration/ -v

# All tests
uv run pytest -v
```

---

## Docker

```bash
# Build image (uv installed inside container)
docker build -t crop-disease-service .

# Run container
docker run -p 8001:8001 --env-file .env crop-disease-service
```

---

## Future Roadmap

| Phase | What | When |
|-------|------|------|
| Phase 2 | Add pgvector RAG for verified disease knowledge retrieval | Post-hackathon |
| Phase 3 | Fine-tuned EfficientNet as primary detector (replace Vision LLM) | When Pakistani dataset ready |
| Phase 4 | Edge-optimized MobileNet for on-device inference | Production |

---

<p align="center">
  <strong>Kissan Rehnuma — Crop Disease Service</strong><br/>
  <em>Crop disease detection, powered by AI.</em>
</p>
