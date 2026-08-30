# Voice Agent Service

LiveKit Agents-based real-time voice assistant for Pakistani farmers. Provides natural conversational AI with complaint registration, weather alerts, and market rate lookup — all in Urdu script with smooth voice output.

## Architecture

```
Farmer (Browser/Phone)
        │
        ▼
┌─── LiveKit Room ─────────────────────────────────────────────────┐
│                                                                  │
│  [Silero VAD] ──► [Deepgram STT] ──► [Turn Detector] ──►       │
│   Voice activity   Urdu speech        Audio-based                │
│   detection        → text              end-of-turn               │
│                                                                  │
│  ──► [OpenRouter LLM] ──► [Uplift AI TTS] ──► Farmer hears     │
│      Gemini 2.5 Flash    Streaming Urdu       Urdu response      │
│      + function tools    audio via WebSocket                      │
│      + tool execution                                            │
│                                                                  │
│  Latency optimizations:                                          │
│  • Preemptive generation (LLM+TTS before turn confirmed)         │
│  • Sentence-level tokenization (per-sentence TTS streaming)      │
│  • Dynamic endpointing (adapts to conversation pace)             │
│  • Adaptive interruption (distinguishes barge-in from hmm/coughs)│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
        │                       │
        │                       ▼
        │              ┌─── PostgreSQL ───┐
        │              │  complaints       │
        │              │  complaint_events │
        │              │  voice_sessions   │
        │              │  tool_executions  │
        │              └───────────────────┘
```

### Pipeline Components

| Component | Provider | Purpose |
|-----------|----------|---------|
| **VAD** | Silero | Voice activity detection (prewarmed at startup) |
| **STT** | Deepgram Nova-3 | Speech-to-text (Urdu optimized, streaming) |
| **Turn Detection** | LiveKit Audio Turn Detector | Intonation/pitch-based end-of-turn prediction |
| **LLM** | OpenRouter (Gemini 2.5 Flash) | Intent understanding + structured tool calling |
| **TTS** | Uplift AI (official plugin) | Streaming Urdu text-to-speech via WebSocket |
| **Tools** | LiveKit `@function_tool` | Direct DB operations, no RPC round-trip |

### Language Strategy

- **System prompt**: English (for accurate LLM reasoning and tool calling)
- **Response language**: Urdu script (proper Urdu, not Roman Urdu)
- **TTS engine**: Uplift AI expects Urdu script — produces natural, smooth Pakistani Urdu voice
- **Result**: Accurate tool calls + high-quality Urdu speech output

## Project Structure

```
voice-agent-service/
├── app/
│   ├── main.py                  # LiveKit Agent Server entry point
│   ├── core/
│   │   ├── config.py            # Settings from environment variables
│   │   └── logging.py           # Structured JSON logging
│   ├── agents/
│   │   └── kissan_agent.py      # Agent class with tool definitions
│   ├── services/
│   │   └── complaint_service.py # Business logic layer
│   ├── repositories/
│   │   ├── complaint_repository.py  # Complaint DB operations
│   │   └── session_repository.py    # Session DB operations
│   ├── models/
│   │   ├── complaint.py         # Complaint, ComplaintEvent, ToolExecution
│   │   └── voice_session.py     # VoiceSession tracking
│   ├── schemas/
│   │   └── __init__.py          # Pydantic request/response schemas
│   └── db/
│       ├── __init__.py          # Base, mixins, naming conventions
│       └── session.py           # Async engine + session factory
├── alembic/
│   ├── env.py                   # Migration environment
│   ├── script.py.mako           # Migration template
│   └── versions/                # Migration files
├── pyproject.toml               # Dependencies and build config
├── alembic.ini                  # Alembic configuration
├── .env                         # Environment variables
├── Dockerfile                   # Container build
└── README.md                    # This file
```

## Available Tools

The LLM can call these tools during conversation:

| Tool | Description | Parameters |
|------|-------------|------------|
| `register_complaint` | Register a farmer complaint | category, description, district, crop?, urgency? |
| `check_weather_alert` | Check weather for a district | district |
| `get_market_rates` | Get crop market rates | crop, mandi? |
| `check_complaint_status` | Check complaint by reference | reference_number |

### Tool Call Flow

```
1. Farmer speaks in Urdu
2. Silero VAD detects voice activity
3. Deepgram STT converts speech → text (streaming)
4. LiveKit Turn Detector confirms end of turn (audio-based)
5. Preemptive generation starts LLM on partial transcript
6. LLM understands intent, makes structured tool call
7. Tool executes directly → saves to PostgreSQL
8. Tool returns result to LLM
9. LLM generates Urdu script response
10. SentenceTokenizer sends each sentence to TTS immediately
11. Uplift AI TTS streams Urdu audio via WebSocket
12. Farmer hears the response
```

## Available Uplift AI Voices

| Voice ID | Name | Style |
|----------|------|-------|
| `v_8eelc901` | Info/Edu | Informational, educational (default) |
| `v_kwmp7zxt` | Gen Z | Young, casual |
| `v_yypgzenx` | Dada Jee | Elderly, wise |
| `v_30s70t3a` | Nostalgic News | Classic news anchor |

## Setup

### Prerequisites

- Python 3.10+
- PostgreSQL database
- API keys for: LiveKit, OpenRouter, Deepgram, Uplift AI

### Installation

```bash
cd services/voice-agent-service

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -e .
```

### Configuration

Copy and edit the `.env` file:

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required API keys:
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` — from [LiveKit Cloud](https://cloud.livekit.io)
- `OPENROUTER_API_KEY` — from [OpenRouter](https://openrouter.ai/settings/keys)
- `DEEPGRAM_API_KEY` — from [Deepgram](https://console.deepgram.com)
- `UPLIFT_API_KEY` — from [Uplift AI](https://platform.upliftai.org/studio/api-keys)

### Database Setup

```bash
# Create the database
createdb voice_agent

# Run migrations
python -m alembic upgrade head
```

### Running

```bash
# Development mode (connects to LiveKit Cloud)
python -m app.main dev

# Production mode
python -m app.main start
```

The agent server will connect to LiveKit Cloud and wait for room connections.

## Key Design Decisions

### Why LiveKit Agents?

- **Enterprise-grade**: Managed infrastructure, auto-scaling via LiveKit Cloud
- **Flexible pipeline**: Mix and match STT/LLM/TTS providers
- **Function calling**: Native tool support through LLM plugins
- **Real-time**: Low-latency audio streaming with room-based architecture

### Why OpenRouter for LLM?

- **500+ models**: Access GPT-4o, Gemini, Claude, DeepSeek through one API
- **Automatic fallback**: Configure fallback models for resilience
- **Provider routing**: Control which providers handle inference
- **Single billing**: One API key for all models

### Why Official Uplift AI Plugin?

- **WebSocket streaming**: Real-time audio delivery via `livekit-plugins-upliftai`
- **Urdu script input**: Uplift AI expects Urdu script — produces natural Pakistani Urdu voice
- **Sentence-level tokenization**: Each sentence sent to TTS immediately (no batching)
- **Multiple voices**: 4 distinct voice profiles available

### Latency Optimizations

| Optimization | What it does | Impact |
|-------------|-------------|--------|
| **Preemptive Generation** | Starts LLM+TTS before user turn is confirmed | 150-350ms faster |
| **Sentence Tokenizer** | Sends each sentence to TTS as soon as complete (not all words) | Eliminates audio cutting |
| **Audio Turn Detector** | Analyzes intonation, pitch, rhythm for accurate turn boundaries | 150-300ms faster commits |
| **Dynamic Endpointing** | Adapts delay to conversation pace (fast chat vs thoughtful pause) | Natural rhythm |
| **Adaptive Interruption** | Trained model distinguishes true barge-in from "hmm", coughs, noise | 51% fewer false interruptions |
| **VAD Prewarming** | Silero model loaded at startup, not per-session | Faster first turn |
| **Urdu Script Output** | LLM outputs Urdu script, TTS produces smooth voice | Better voice quality |

## Difference from voice-helpline-service

| | voice-helpline-service | voice-agent-service |
|---|---|---|
| **Architecture** | Bridge to Uplift Assistants | Own agent with STT-LLM-TTS pipeline |
| **Tool execution** | Client RPC → browser → backend | Direct Python function → DB |
| **LLM control** | Uplift dashboard config | Full code control |
| **STT/LLM/TTS** | Bundled in Uplift | Separate, swappable providers |
| **Latency** | Extra RPC hop | Zero extra hop + preemptive generation |
| **Turn detection** | None | Audio turn detector + adaptive interruption |
| **Extensibility** | Limited to Uplift features | Unlimited custom logic |
