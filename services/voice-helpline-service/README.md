# Kissan Rehnuma Voice Helpline Service

FastAPI backend responsible for private Uplift AI session creation and voice-originated
complaint persistence. Audio, STT, LLM and TTS remain hosted by Uplift AI/LiveKit.

## Architecture — simple overview

Is service ko **secure bridge + business data service** samjhein. Yeh khud farmer ki audio process
nahi karti. Uplift AI voice conversation chalata hai, jabke yeh FastAPI service secure session
banati aur complaints PostgreSQL mein save karti hai.

```text
User / Helpline Client
        |
        | 1. Authenticated HTTP request
        v
API Gateway
        |
        | Verified X-User-Id + X-User-Name
        v
Voice Helpline Service (FastAPI)
        |                         |
        | 2. Create session       | 5. Save session/complaint
        v                         v
Uplift AI Assistants API      PostgreSQL
        |
        | 3. token + wsUrl + roomName
        v
Voice Helpline Service
        |
        | 4. Safe session response
        v
User / Helpline Client ---- LiveKit room ---- Uplift hosted voice agent
```

### Service kya karta hai?

```text
Session management  -> Uplift se private voice session banwana
Complaint handling  -> complaint validate, register aur retrieve karna
Persistence         -> sessions, complaints aur audit data PostgreSQL mein rakhna
Security boundary   -> Uplift API key aur internal data client se chhupana
Reliability         -> timeout, provider errors aur duplicate tool calls handle karna
```

### Service kya nahi karta?

- Audio stream receive ya process nahi karta.
- STT, LLM aur TTS models khud host nahi karta.
- LiveKit token generate nahi karta; token Uplift se milta hai.
- LiveKit token database ya application logs mein save nahi karta.
- Assistant har call par create nahi karta.
- Abhi Uplift se direct backend tool callback assume nahi karta; current tools client RPC use karte
  hain.

## Main request flows

### 1. Voice session create karna

```text
1. Authenticated user POST /api/v1/helpline/sessions call karta hai.
2. API Gateway user verify karke identity headers inject karta hai.
3. FastAPI PostgreSQL mein session ko "pending" status ke saath create karti hai.
4. UpliftClient private createSession endpoint ko server-side API key ke saath call karta hai.
5. Uplift token, wsUrl aur roomName return karta hai.
6. Service roomName aur expiry save karke session ko "active" karti hai.
7. Token, wsUrl aur roomName caller ko return hote hain.
8. Token sirf response mein jata hai—database ya logs mein nahi.
```

Success:

```text
pending -> active -> completed
```

Uplift failure:

```text
pending -> failed
```

Provider ka sensitive/raw error caller ko nahi milta. API controlled `503` response return karti
hai aur database mein safe failure code store hota hai.

### 2. Complaint register karna

Voice agent jab `register_complaint` tool choose karta hai, current Uplift architecture mein tool
client device par RPC ke through execute hota hai. Client phir is backend ko complaint request
bhejta hai:

```text
Uplift voice agent
        |
        | register_complaint RPC
        v
Client tool handler
        |
        | POST /api/v1/complaints
        | X-User-Id + Idempotency-Key
        v
FastAPI
        |
        | Validate user, payload and active session
        v
PostgreSQL transaction
        |
        +-- complaint
        +-- complaint event
        +-- successful tool execution audit
```

Complaint create karte waqt:

1. `Idempotency-Key` required hoti hai.
2. Service check karti hai ke session isi farmer ka aur `active` hai.
3. Category, description, urgency aur optional fields validate hote hain.
4. Complaint ko unique `KR-YYYY-...` reference number milta hai.
5. Complaint, initial event aur tool audit ek database transaction mein save hote hain.
6. Same successful request dobara aaye to nayi complaint banane ke bajaye pehli complaint return
   hoti hai.

### 3. Session end karna

```text
POST /api/v1/helpline/sessions/{id}/end
        |
        +-- ownership verify
        +-- status = completed
        +-- ended_at set
```

Operation idempotent hai: completed session ko dobara end karne se duplicate record nahi banta.

## Internal code architecture

```text
app/main.py
    |
    +-- api/             HTTP routes, headers and request/response handling
    |
    +-- services/        Business workflows and transaction coordination
    |
    +-- repositories/    SQLAlchemy database queries
    |
    +-- models/          PostgreSQL table mappings
    |
    +-- schemas/         Pydantic validation and public API contracts
    |
    +-- clients/uplift/  Uplift HTTP contract, authentication and error mapping
    |
    +-- core/            Settings, logging and application exceptions
    |
    +-- agents/          Reviewed assistant template and Urdu prompt
```

Request ka normal path:

```text
Endpoint -> Service -> Repository -> PostgreSQL
                  |
                  +-> UpliftClient -> Uplift API
```

Rules:

- Endpoint mein business logic nahi hogi.
- Repository Uplift API ko call nahi karegi.
- Uplift client database access nahi karega.
- Service layer workflow aur transaction coordinate karegi.
- Pydantic schemas external input ko SQLAlchemy model banne se pehle validate karengi.

## Database overview

| Table | Purpose |
|---|---|
| `helpline_sessions` | Farmer aur Uplift room ki safe session metadata |
| `complaints` | Registered farmer complaints |
| `complaint_events` | Complaint creation/status audit history |
| `tool_executions` | RPC tool request, result aur idempotency audit |

Important relationships:

```text
helpline_sessions 1 ---- many complaints
helpline_sessions 1 ---- many tool_executions
complaints        1 ---- many complaint_events
```

`tool_executions` mein `(farmer_id, idempotency_key)` unique hai, isliye concurrent/repeated tool
calls duplicate complaint create nahi karte.

## Assistant lifecycle

Assistant configuration [app/agents/config/assistant.json](app/agents/config/assistant.json) mein
reviewed template ke taur par rakhi gayi hai aur Urdu behavior
[app/agents/prompts/helpline_agent.md](app/agents/prompts/helpline_agent.md) mein hai.

```text
Deployment/setup time: assistant config provision/update
Runtime per call:       existing assistant par createSession
```

Yani assistant har farmer call par dobara create nahi hota. Runtime service `.env` se existing
`UPLIFT_ASSISTANT_ID` use karti hai.

## Boundaries

This service:

- creates private Uplift realtime-assistant sessions;
- persists session metadata, never the LiveKit token;
- registers and tracks complaints;
- enforces idempotency for complaint tool calls;
- keeps complaint and tool-execution audit records.

Assistant provisioning is deliberately not exposed as a runtime HTTP endpoint. The checked-in
configuration under `app/agents/` is a reviewed template for provisioning through an operational
process or the Uplift dashboard.

## Trust and authentication

All business endpoints expect `X-User-Id` and `X-User-Name`. These headers are a service-internal
contract and **must be stripped and re-injected by the trusted API gateway after authentication**.
Do not expose this service directly to the internet with that trust model.

Complaint creation also requires a stable `Idempotency-Key`. Replaying a successful request for
the same farmer returns the original complaint.

## Local setup

Requirements: Python 3.12+, Docker, and an Uplift private assistant/API key.

```powershell
docker compose up -d postgres
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

Set real `UPLIFT_API_KEY` and `UPLIFT_ASSISTANT_ID` values in `.env`. Never commit `.env`.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health/live` | Process liveness |
| GET | `/api/v1/health/ready` | Database readiness |
| POST | `/api/v1/helpline/sessions` | Create private Uplift session |
| GET | `/api/v1/helpline/sessions/{id}` | Read owned session metadata |
| POST | `/api/v1/helpline/sessions/{id}/end` | Mark owned session complete |
| POST | `/api/v1/complaints` | Register an idempotent complaint |
| GET | `/api/v1/complaints` | List farmer complaints |
| GET | `/api/v1/complaints/{reference}` | Read complaint by reference |

Complaint status mutation is intentionally not exposed until the API gateway provides a verified
staff/admin scope. Farmer identity alone must not authorize operational status changes.

## Database migrations and tests

```powershell
alembic upgrade head
pytest
ruff check .
ruff format --check .
```

The integration tests use in-memory SQLite and mock Uplift. PostgreSQL migration execution should
also be tested in CI because PostgreSQL enum behavior is dialect-specific.

## Operational notes

- Uplift API credentials only exist server-side.
- HTTP logs intentionally omit request/response bodies and authorization headers.
- Uplift session creation is not automatically retried, avoiding accidental duplicate rooms.
- `UPLIFT_SESSION_TTL_SECONDS` must match the assistant's configured TTL.
- Direct external API tools are not assumed; current Uplift tools execute through client RPC.
