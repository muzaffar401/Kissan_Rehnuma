# 🌿 Crop Disease Detection Service

> **Kissan Rehnuma's** first microservice — detects crop diseases from leaf images using a comprehensive differential diagnosis pipeline, identifies symptoms, and recommends treatments with local Pakistani context (chemicals, PKR costs).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI (async) |
| AI Workflow | LangGraph (stateful agent graph) |
| Vision LLM | Configurable via OpenRouter (Gemini Flash, GPT-4o, etc.) |
| API Client | Direct httpx → OpenRouter REST API (no LangChain overhead) |
| Structured Output | Native `json_schema` response_format + Pydantic v2 validation |
| Database | PostgreSQL 16 + asyncpg |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic (auto-run on startup) |
| Image Storage | Cloudinary |
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
┌──────────────────────────────────────────────────────────┐
│                    FastAPI Server                         │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │            LangGraph Workflow                       │ │
│  │                                                     │ │
│  │  [validate_image]  ← PIL format/size/dimensions     │ │
│  │       │               (no LLM call — instant)       │ │
│  │       ├── FAIL ───────────────────► [save_to_db]    │ │
│  │       │                              → "failed"     │ │
│  │       ▼ (pass)                                      │ │
│  │  [upload_image]  ──► Cloudinary                     │ │
│  │       │                                             │ │
│  │       ▼                                             │ │
│  │  [detect_disease] ──► Direct httpx → OpenRouter     │ │
│  │       │                 + json_schema response_format │ │
│  │       │                 + 7-step CoT prompt          │ │
│  │       │                 (plant check + diagnosis     │ │
│  │       │                  in SINGLE call)             │ │
│  │       ▼                                             │ │
│  │  [confidence_gate]                                  │ │
│  │       │                                             │ │
│  │       ├── NOT A PLANT ────────────► [save_to_db]    │ │
│  │       ├── LOW (< 0.70) ───────────► [save_to_db]    │ │
│  │       │                              → "retake"     │ │
│  │       ▼ (HIGH)                                      │ │
│  │  [save_to_database] ──► PostgreSQL                  │ │
│  │       │                                             │ │
│  │       ▼                                             │ │
│  │  DiagnosisResponse (JSON)                           │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
       │
       ▼
  Farmer gets: disease name, symptoms, causes, treatment
  recommendations (chemical + organic + PKR cost), prevention
  tips, affected crops
```

### Key Design: Single LLM Call

Unlike a naive two-call approach (separate plant check + disease detection), this service combines **everything into one LLM call**. The comprehensive system prompt handles plant verification, systematic visual examination, differential diagnosis, confidence scoring, and treatment recommendations — all in a single request. This saves ~5-10 seconds per detection.

### Key Design: Direct API Client

Instead of LangChain's `ChatOpenRouter` (which adds 15-25% latency overhead from serialization, tool-definition tokens, and middleware), this service uses a **direct httpx client** that calls OpenRouter's REST API with native `json_schema` response_format.

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
│   │   └── disease.py             # Pydantic schemas (VisionDiagnosis, API responses)
│   ├── repositories/
│   │   └── detection_repo.py      # DB queries + log builder + history
│   ├── services/
│   │   ├── image_validator.py     # PIL-based image pre-flight checks
│   │   ├── cloud_storage.py       # Cloudinary upload wrapper
│   │   └── openrouter_client.py   # Direct httpx → OpenRouter (no LangChain)
│   ├── agents/
│   │   ├── graph.py               # LangGraph StateGraph (5 nodes + routing)
│   │   └── prompts/
│   │       └── diagnosis_prompt.py # Comprehensive 7-step diagnosis prompt
│   ├── static/
│   │   └── test.html              # Browser test UI (upload + history)
│   └── api/
│       ├── deps.py                # Dependency injection (DB session)
│       ├── router.py              # Root router (/api/v1)
│       └── v1/
│           ├── router.py          # V1 route aggregation
│           └── endpoints/
│               └── disease.py     # POST /detect, GET /history, GET /health
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

**Response (200) — Successful diagnosis:**

```json
{
  "scan_id": "a1b2c3d4-...",
  "is_plant": true,
  "disease_name": "Tomato Early Blight",
  "scientific_name": "Alternaria solani",
  "crop_type": "Tomato",
  "confidence": 0.87,
  "symptoms": [
    "Dark brown spots with concentric rings (target lesions) on older leaves",
    "Yellow halo surrounding each spot, 2-10mm diameter",
    "Lower canopy affected first, progressing upward"
  ],
  "causes": "Alternaria solani fungus. Spreads via wind and water splash. Favored by warm temperatures (24-29°C), high humidity, and prolonged leaf wetness. Overwinters on crop debris and volunteer plants.",
  "treatment_recommendations": "Chemical: Mancozeb 75% WP at 2g/L water, foliar spray every 10-12 days. Chlorothalonil 75% WP at 2ml/L as preventive. Organic: Neem oil 5ml/L spray. Trichoderma viride soil application at 2kg/acre with FYM. Remove and destroy infected leaves immediately. Cost: approximately PKR 1500-2500 per acre.",
  "prevention_tips": [
    "Practice 2-3 year crop rotation with non-solanaceous crops",
    "Use certified disease-free seeds and resistant varieties",
    "Ensure proper field drainage and avoid overhead irrigation"
  ],
  "affected_crops": "Tomato, potato, pepper, eggplant (Solanaceae family)",
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

### `GET /api/v1/disease/history`

Get scan history. Returns all successful plant scans, newest first.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `user_id` | String | null | Filter by farmer/user ID |
| `limit` | Integer | 50 | Max results (1-200) |

**Response (200):**

```json
[
  {
    "scan_id": "a1b2c3d4-...",
    "image_url": "https://res.cloudinary.com/.../scan.jpg",
    "user_id": "farmer_001",
    "language": "en",
    "is_plant": true,
    "disease_name": "Tomato Early Blight",
    "scientific_name": "Alternaria solani",
    "confidence": 0.87,
    "crop_type": "Tomato",
    "symptoms": ["Dark brown concentric ring spots...", "..."],
    "causes": "Alternaria solani fungus...",
    "treatment_recommendations": "Chemical: Mancozeb...",
    "prevention_tips": ["Crop rotation...", "..."],
    "affected_crops": "Tomato, potato, pepper...",
    "status": "completed",
    "error_message": null,
    "created_at": "2026-08-27T01:47:33+00:00"
  }
]
```

### `GET /api/v1/disease/health`

Service health check.

```json
{
  "status": "healthy",
  "service": "crop-disease-service",
  "database": "connected",
  "vision_model": "google/gemini-2.5-flash"
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

# 6. Start the service (migrations run automatically on startup)
uv run uvicorn app.main:app --reload --port 8001
```

Service will be available at `http://localhost:8001`
API docs at `http://localhost:8001/docs` (debug mode only)
Test UI at `http://localhost:8001/test` (debug mode only)

> **Auto-migration:** Database migrations run automatically on every service startup. When you change models, generate a new migration (`uv run alembic revision --autogenerate -m "description"`) — it will be applied the next time the service starts.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql+asyncpg://...` | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key |
| `VISION_MODEL` | No | `openai/gpt-4o` | Model identifier on OpenRouter |
| `VISION_TEMPERATURE` | No | `0.2` | LLM sampling temperature |
| `VISION_MAX_TOKENS` | No | `2048` | Max response tokens |
| `CONFIDENCE_THRESHOLD` | No | `0.70` | Minimum confidence to accept diagnosis |
| `CLOUDINARY_CLOUD_NAME` | Yes | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | — | Cloudinary API secret |
| `LANGSMITH_TRACING` | No | `false` | Enable LangSmith tracing |
| `LANGSMITH_API_KEY` | No | — | LangSmith API key |
| `MAX_IMAGE_SIZE_MB` | No | `10` | Maximum upload file size |
| `MIN_IMAGE_WIDTH` | No | `224` | Minimum image width in pixels |
| `MIN_IMAGE_HEIGHT` | No | `224` | Minimum image height in pixels |
| `ALLOWED_CONTENT_TYPES` | No | `image/jpeg,image/png,image/webp` | Accepted MIME types (comma-separated) |

---

## Database Schema

**Table: `crop_disease_logs`**

Every scan is persisted — successful, failed, or low-confidence. This data serves as audit trail and future training data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (server-generated) |
| `user_id` | String (nullable) | Farmer identifier |
| `image_url` | Text | Cloudinary URL |
| `language` | String(5) | Response language code |
| `is_plant` | Boolean | Whether image showed a plant |
| `disease_name` | String (nullable) | Detected disease |
| `scientific_name` | String (nullable) | Latin/binomial name |
| `confidence` | Float (nullable) | Model confidence (0.0–1.0) |
| `crop_type` | String (nullable) | Affected crop |
| `symptoms` | JSONB (nullable) | Array of symptom descriptions |
| `causes` | Text (nullable) | Disease cause explanation |
| `treatment` | Text (nullable) | Treatment recommendations |
| `prevention_tips` | JSONB (nullable) | Array of prevention tips |
| `affected_crops` | Text (nullable) | Commonly affected crops |
| `status` | Enum | `completed`, `low_confidence`, `not_a_plant`, `failed` |
| `error_message` | Text (nullable) | Error details if failed |
| `created_at` | Timestamp | When scan was performed |

---

## Key Design Decisions

### Why direct httpx instead of LangChain?
LangChain's `ChatOpenRouter` + `with_structured_output()` adds 15-25% latency overhead from message serialization, tool-definition tokens, and middleware. A direct `httpx` POST to OpenRouter with native `json_schema` response_format is faster and gives the model more room for actual content. The `openrouter_client.py` module handles JSON extraction with fallback (markdown fences, partial JSON) and Pydantic validation.

### Why single LLM call instead of two?
A separate "is this a plant?" LLM call wastes ~5-10 seconds. The comprehensive system prompt includes plant verification as Step 1, so the model handles both checks in a single request. Non-LLM image validation (format, size, dimensions) still happens instantly via PIL before any API call.

### Why LangGraph?
The diagnosis flow has **conditional branching** (confidence gate, not-a-plant routing) and **state accumulation** (each node adds to the result). LangGraph handles this natively with `StateGraph` + conditional edges — cleaner than if/else chains in a single function.

### Why comprehensive prompt?
The 7-step differential diagnosis prompt includes a Pakistani crop disease database with exact pathogen names (e.g., *Puccinia triticina* for wheat leaf rust), systematic visual examination protocol, validation checklist, and conservative confidence scoring. This produces significantly more accurate and detailed diagnoses than a generic prompt.

### Why conservative confidence?
Vision LLMs can be overconfident on out-of-distribution images. A 0.70 threshold prevents wrong diagnoses from reaching farmers. A wrong diagnosis is worse than no diagnosis — Pakistani farmers act on this advice.

### Why every scan is saved?
Failed and low-confidence scans are as valuable as successful ones. This data becomes the training set for a future Pakistani crop-specific CV model.

---

## Testing

### Browser Test UI

Open `http://localhost:8001/test` for a drag-and-drop test interface with:
- Image upload with preview
- Language selector (English, Urdu, Punjabi, Sindhi)
- Diagnosis result display with confidence badges
- Scan history with image thumbnails, symptoms, and treatment
- Raw JSON toggle for debugging

### Automated Tests

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
