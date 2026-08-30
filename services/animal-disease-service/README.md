# Animal Disease Detection Service

> **Kissan Rehnuma's** second microservice — detects livestock and poultry diseases from images using a comprehensive veterinary differential diagnosis pipeline, identifies symptoms, and recommends treatments with local Pakistani context (medicines, weight-based dosages, PKR costs).

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
       │  POST /api/v1/animal/detect
       ▼
┌──────────────────────────────────────────────┐
│            FastAPI Application                │
│                                              │
│  validate_image (non-LLM)                    │
│    → format, size, dimensions                │
│                                              │
│  upload_image                                │
│    → Cloudinary storage                      │
│                                              │
│  detect_disease (single LLM call)            │
│    → base64 encode → direct httpx POST       │
│    → OpenRouter with native json_schema      │
│    → veterinary prompt + image               │
│    → returns VisionDiagnosis                 │
│                                              │
│  confidence_gate                             │
│    → threshold check (default 0.70)          │
│                                              │
│  save_to_database                            │
│    → PostgreSQL animal_disease_logs          │
└──────────────────────────────────────────────┘
```

### Single LLM Call Design

The animal/not-animal check is merged INTO the main detection prompt.
One LLM call handles: animal identification + disease diagnosis + treatment.
No separate validation round-trip — saves 5-10 seconds per scan.

### Direct API Client

Instead of LangChain's ChatOpenRouter (which adds 15-25% latency overhead),
this service uses a **direct httpx client** that calls OpenRouter's REST API
with native `json_schema` response_format.

---

## Project Structure

```
animal-disease-service/
├── app/
│   ├── agents/
│   │   ├── graph.py                  # LangGraph StateGraph + nodes
│   │   └── prompts/
│   │       └── veterinary_prompt.py  # 150-line veterinary prompt
│   ├── api/
│   │   ├── deps.py                   # DB session dependency
│   │   ├── router.py                 # Top-level API router
│   │   └── v1/
│   │       ├── router.py             # v1 router
│   │       └── endpoints/
│   │           └── animal.py         # POST /detect, GET /history
│   ├── core/
│   │   ├── config.py                 # pydantic-settings
│   │   ├── logging.py                # structlog setup
│   │   └── migrations.py             # auto-migration runner
│   ├── db/
│   │   ├── base.py                   # SQLAlchemy Base
│   │   ├── models.py                 # AnimalDiseaseLog ORM
│   │   └── session.py                # async engine + session
│   ├── repositories/
│   │   └── detection_repo.py         # CRUD for animal_disease_logs
│   ├── schemas/
│   │   └── animal.py                 # Pydantic schemas
│   ├── services/
│   │   ├── openrouter_client.py      # direct httpx → OpenRouter
│   │   ├── cloud_storage.py          # Cloudinary uploader
│   │   └── image_validator.py        # PIL-based pre-flight checks
│   ├── static/
│   │   └── test.html                 # Browser test UI
│   └── main.py                       # FastAPI app factory
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── a1b2c3d4e5f6_initial_schema.py
├── alembic.ini
├── pyproject.toml
├── Dockerfile
├── .env
└── README.md
```

---

## API Endpoints

### POST /api/v1/animal/detect

Detect disease from an animal/livestock image.

**Form data:**
- `image` (file, required) — JPEG, PNG, or WebP
- `user_id` (string, optional) — farmer identifier
- `language` (string, default: "en") — en, ur, pa, sd

**Response:**
```json
{
  "scan_id": "uuid",
  "is_animal": true,
  "animal_type": "Cow",
  "disease_name": "Foot-and-Mouth Disease",
  "scientific_name": "Aphthovirus",
  "confidence": 0.92,
  "symptoms": ["Vesicles on tongue", "Drooling", "Lameness"],
  "causes": "Viral infection caused by Aphthovirus...",
  "treatment_recommendations": "Isolate animal immediately...",
  "prevention_tips": ["FMD vaccine every 6 months", "..."],
  "affected_species": "Cattle, buffalo, sheep, goats",
  "image_url": "https://res.cloudinary.com/...",
  "language": "en",
  "message": ""
}
```

### GET /api/v1/animal/history

Get past scan results.

**Query params:**
- `user_id` (optional) — filter by farmer ID
- `limit` (default: 50, max: 200)

### GET /api/v1/animal/health

Service health check.

---

## Database Schema

```sql
animal_disease_logs
├── id              UUID (auto-generated)
├── image_url       TEXT (required)
├── user_id         VARCHAR(255) (indexed)
├── language        VARCHAR(5)
├── is_animal       BOOLEAN
├── animal_type     VARCHAR(255)
├── disease_name    VARCHAR(255)
├── scientific_name VARCHAR(255)
├── confidence      FLOAT
├── symptoms        JSONB (array of strings)
├── causes          TEXT (narrative)
├── treatment       TEXT (narrative)
├── prevention_tips JSONB (array of strings)
├── affected_species TEXT (narrative)
├── status          ENUM (completed, low_confidence, not_an_animal, failed)
├── error_message   TEXT
└── created_at      TIMESTAMPTZ
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL connection |
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `VISION_MODEL` | `google/gemini-2.5-flash` | Vision LLM model |
| `VISION_TEMPERATURE` | `0.3` | LLM temperature |
| `CONFIDENCE_THRESHOLD` | `0.70` | Minimum confidence to pass |
| `CLOUDINARY_CLOUD_NAME` | — | Cloudinary cloud |
| `CLOUDINARY_API_KEY` | — | Cloudinary key |
| `CLOUDINARY_API_SECRET` | — | Cloudinary secret |
| `CLOUDINARY_FOLDER` | `kissan-rehnuma/animal-scans` | Upload folder |

---

## Local Development

```bash
# Install dependencies
uv pip install -e .

# Create PostgreSQL database
createdb kissan_animal_disease

# Set environment variables in .env

# Run service (port 8002)
python -m uvicorn app.main:app --reload --port 8002

# Open test UI
# http://localhost:8002/test
```

---

## Design Decisions

### Why temperature 0.3?
Veterinary diagnosis demands higher consistency than crop analysis.
Lower temperature reduces variation in treatment recommendations.

### Why separate database?
Each microservice owns its data. Animal disease scans have different
fields (animal_type, affected_species) than crop scans (crop_type,
affected_crops). Separate DBs prevent schema coupling.

### Why `animal_scan_status` enum?
Uses a distinct PostgreSQL enum name (`animal_scan_status`) to avoid
collision with the crop service's `scan_status` enum in shared PG instances.

---

## Testing

### Browser Test UI
Visit `http://localhost:8002/test` for an interactive UI:
- Upload animal/livestock images
- View diagnosis results with symptoms, treatment, prevention
- Browse scan history with image thumbnails
- Auto-refresh after each scan
