"""Kissan Rehnuma Voice Agent Service — main entry point.

This is the LiveKit Agent Server that connects to LiveKit rooms and handles
real-time voice conversations with farmers using:
- Deepgram STT (speech-to-text)
- OpenRouter LLM (GPT-4o, Gemini, etc.)
- Uplift AI TTS (Urdu text-to-speech)
- Custom tools for complaint registration, weather, market rates

Latency optimizations applied (Ref: LiveKit latency guide):
- VAD pre-warmed at module level
- TTS pre-warmed via prewarm function (avoids cold-start on first turn)
- aec_warmup_duration for audio pre-buffering
- Tuned endpointing for faster response
- Sentence tokenizer for streaming TTS
"""

from __future__ import annotations

from uuid import UUID, uuid4

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, RoomInputOptions, inference, tokenize
from livekit.plugins import deepgram, openai, silero, upliftai

from app.agents.kissan_agent import KissanRehnumaAgent
from app.agents.context import SessionContext, set_session_context
from app.core.config import get_settings
from app.core.logging import logger
from app.services.memory_service import extract_and_save_memory, load_farmer_memory

import asyncio
import time as _time

load_dotenv(".env")

settings = get_settings()

# ---------------------------------------------------------------------------
# Pre-warm VAD at module level (avoids cold-start on first session)
# Ref: https://livekit.com/blog/understand-and-improve-agent-latency
# ---------------------------------------------------------------------------
_vad = silero.VAD.load(
    min_silence_duration=0.4,  # Faster turn detection (default is 0.5)
    prefix_padding_duration=0.2,  # Capture audio slightly before speech
)


server = agents.AgentServer()

# ---------------------------------------------------------------------------
# Prewarm function — pre-initialize TTS to avoid cold-start latency
# Ref: https://docs.livekit.io/agents/server/options/
# ---------------------------------------------------------------------------
def prewarm(proc: agents.JobProcess) -> None:
    """Pre-warm TTS connection before any session starts.
    
    This avoids the cold-connect tax on the first turn where the user
    hears silence or audio cutting while TTS establishes connection.
    """
    proc.userdata["tts"] = upliftai.TTS(
        voice_id=settings.uplift_voice_id,
        output_format=settings.uplift_output_format,
        api_key=settings.uplift_api_key.get_secret_value(),
        word_tokenizer=tokenize.basic.SentenceTokenizer(),
    )
    logger.info("TTS pre-warmed in worker process")


# Set the prewarm function on the server (runs before any jobs are assigned)
server.setup_fnc = prewarm


@server.rtc_session(agent_name="kissan-rehnuma")
async def entrypoint(ctx: agents.JobContext):
    """Main entry point for each LiveKit room session."""

    # Extract farmer_id and farmer_name from job metadata (set by token_server)
    real_farmer_id = None
    farmer_name = "kissan"  # default
    try:
        metadata = ctx.job.metadata
        if metadata:
            import json as _json
            meta_dict = _json.loads(metadata)
            real_farmer_id = meta_dict.get("farmer_id")
            farmer_name = meta_dict.get("farmer_name") or "kissan"
            logger.info(
                "Job metadata parsed",
                extra={"real_farmer_id": real_farmer_id, "farmer_name": farmer_name},
            )
    except Exception as e:
        logger.warning("Failed to parse job metadata", extra={"error": str(e)})

    # Generate session identifiers
    room_name = ctx.room.name
    voice_session_id = uuid4()

    # Use real farmer_id if available, otherwise fall back to voice_session_id
    # farmer_id can be an integer (from DB) or a UUID string
    if real_farmer_id:
        # Try to parse as integer first (most common case)
        try:
            farmer_id = int(real_farmer_id)
        except (ValueError, TypeError):
            # Fall back to UUID if not an integer
            try:
                farmer_id = UUID(real_farmer_id)
            except (ValueError, TypeError):
                farmer_id = voice_session_id
    else:
        farmer_id = voice_session_id

    logger.info(
        "New voice session started",
        extra={
            "room_name": room_name,
            "farmer_id": str(farmer_id),
            "farmer_name": farmer_name,
            "voice_session_id": str(voice_session_id),
            "has_real_farmer_id": real_farmer_id is not None,
        },
    )

    # Set up session context for tool calls
    session_ctx = SessionContext(
        farmer_id=farmer_id,
        voice_session_id=voice_session_id,
        farmer_name=farmer_name,
    )
    set_session_context(session_ctx)

    # ---------------------------------------------------------------------------
    # Load farmer memory from past conversations (cross-session memory)
    # Ref: https://mem0.ai/blog/ai-memory-for-voice-agents
    # ---------------------------------------------------------------------------
    farmer_memory = await load_farmer_memory(limit=3)
    if farmer_memory:
        logger.info(
            "Farmer memory loaded",
            extra={"farmer_id": str(farmer_id), "memory_length": len(farmer_memory)},
        )
    else:
        logger.info("No past memories found for farmer", extra={"farmer_id": str(farmer_id)})

    # Use pre-warmed TTS from worker process (avoids cold-start latency)
    # Falls back to creating new TTS if prewarm didn't run
    tts = ctx.proc.userdata.get("tts")
    if tts is None:
        logger.warning("TTS not found in userdata, creating new instance")
        tts = upliftai.TTS(
            voice_id=settings.uplift_voice_id,
            output_format=settings.uplift_output_format,
            api_key=settings.uplift_api_key.get_secret_value(),
            word_tokenizer=tokenize.basic.SentenceTokenizer(),
        )

    # Track session start time for duration calculation
    session_start_time = _time.time()

    # ---------------------------------------------------------------------------
    # AgentSession with latency optimizations
    # Ref: https://livekit.com/blog/understand-and-improve-agent-latency
    # ---------------------------------------------------------------------------
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="ur",
            # Enable interim results for faster partial transcripts
            # This allows preemptive generation to work effectively
        ),
        llm=openai.LLM.with_openrouter(
            model=settings.openrouter_model,
        ),
        tts=tts,
        vad=_vad,
        # Audio pre-buffering — warm up echo canceller so first audio
        # frames are processed immediately (saves 80-200ms perceived latency)
        aec_warmup_duration=3.0,
        turn_handling={
            # Audio-based turn detection — analyzes intonation, pitch, and rhythm
            # for accurate end-of-turn prediction
            "turn_detection": inference.TurnDetector(),
            # Dynamic endpointing — tuned for faster response
            # min_delay=0.3: Floor for endpointing (faster response)
            # max_delay=2.0: Ceiling so agent never waits too long
            "endpointing": {
                "mode": "dynamic",
                "min_delay": 0.3,  # Faster response (was 0.3, good)
                "max_delay": 2.0,  # Reduced from 2.5 for snappier feel
                "alpha": 0.9,
            },
            # Adaptive interruption — trained model distinguishes true barge-in
            # from backchannels like "hmm", "haan", coughs
            "interruption": {
                "mode": "adaptive",
                "min_duration": 0.5,
                "resume_false_interruption": True,
            },
            # Preemptive generation — start LLM+TTS before turn is confirmed
            # This is critical for reducing perceived latency
            "preemptive_generation": {
                "preemptive_tts": True,
                "max_speech_duration": 10.0,
                "max_retries": 3,
            },
        },
    )

    # Start the session
    await session.start(
        room=ctx.room,
        agent=KissanRehnumaAgent(farmer_name=farmer_name, farmer_memory=farmer_memory),
        room_input_options=RoomInputOptions(),
    )

    logger.info(
        "Voice session active",
        extra={"room_name": room_name, "farmer_name": farmer_name},
    )

    # ---------------------------------------------------------------------------
    # Wait for session to close (blocks until farmer disconnects or session ends)
    # Ref: https://docs.livekit.io/agents/logic/sessions/
    # ---------------------------------------------------------------------------
    close_event = asyncio.Event()

    @session.on("close")
    def on_session_close(ev):
        logger.info(
            "Session close event fired",
            extra={
                "room_name": room_name,
                "reason": getattr(ev, "reason", "unknown"),
                "error": getattr(ev, "error", None),
            },
        )
        close_event.set()

    # Block until session closes (farmer disconnects)
    await close_event.wait()

    # ---------------------------------------------------------------------------
    # Post-session: extract transcript and save conversation memory
    # Ref: https://mem0.ai/blog/ai-memory-for-voice-agents
    # ---------------------------------------------------------------------------
    session_duration = int(_time.time() - session_start_time)

    try:
        # Extract transcript from session history
        # session.history contains all ChatContext items (messages, tool calls, etc.)
        transcript_lines = []
        turn_count = 0
        for item in session.history.items:
            # Only process message items (skip function calls, handoffs, etc.)
            if hasattr(item, "role") and hasattr(item, "text_content"):
                role = item.role
                text = item.text_content
                if text and role in ("user", "assistant"):
                    transcript_lines.append(f"{role}: {text}")
                    if role == "user":
                        turn_count += 1

        transcript = "\n".join(transcript_lines)

        if transcript:
            logger.info(
                "Extracting conversation memory",
                extra={
                    "room_name": room_name,
                    "turn_count": turn_count,
                    "transcript_length": len(transcript),
                    "duration_seconds": session_duration,
                },
            )
            # Save memory to DB (LLM extraction + DB write)
            await extract_and_save_memory(
                transcript=transcript,
                turn_count=turn_count,
                duration_seconds=session_duration,
            )
        else:
            logger.info(
                "No transcript to save (empty or very short session)",
                extra={"room_name": room_name},
            )
    except Exception as e:
        logger.error(
            "Failed to save conversation memory",
            extra={"error": str(e), "room_name": room_name},
        )


if __name__ == "__main__":
    agents.cli.run_app(server)
