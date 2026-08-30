"""Kissan Rehnuma Voice Agent Service — main entry point.

This is the LiveKit Agent Server that connects to LiveKit rooms and handles
real-time voice conversations with farmers using:
- Deepgram STT (speech-to-text)
- OpenRouter LLM (GPT-4o, Gemini, etc.)
- Uplift AI TTS (Urdu text-to-speech)
- Custom tools for complaint registration, weather, market rates
"""

from __future__ import annotations

from uuid import uuid4

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentSession, RoomInputOptions, inference, tokenize
from livekit.plugins import deepgram, openai, silero, upliftai

from app.agents.kissan_agent import (
    KISSAN_AGENT_INSTRUCTIONS,
    SessionContext,
    check_complaint_status,
    check_weather_alert,
    get_market_rates,
    register_complaint,
    set_session_context,
)
from app.core.config import get_settings
from app.core.logging import logger

load_dotenv(".env")

settings = get_settings()

# Prewarm Silero VAD model at startup to avoid cold-start latency on first turn
# (Ref: https://livekit.com/blog/understand-and-improve-agent-latency)
_vad = silero.VAD.load()


class KissanRehnumaAgent(Agent):
    """The main Kissan Rehnuma voice agent."""

    def __init__(self) -> None:
        super().__init__(
            instructions=KISSAN_AGENT_INSTRUCTIONS,
            tools=[
                register_complaint,
                check_weather_alert,
                get_market_rates,
                check_complaint_status,
            ],
        )

    async def on_enter(self) -> None:
        """Called when the agent becomes active in a session."""
        await self.session.generate_reply(
            instructions="Greet the farmer warmly in Urdu script. "
            "Introduce yourself as Kissan Rehnuma and ask how you can help."
        )

    async def on_event(self, event: object) -> None:
        """Handle agent lifecycle events."""
        logger.info(f"Agent event: {type(event).__name__}")


server = agents.AgentServer()


@server.rtc_session(agent_name="kissan-rehnuma")
async def entrypoint(ctx: agents.JobContext):
    """Main entry point for each LiveKit room session."""

    # Generate session identifiers
    farmer_id = ctx.room.name  # In production, extract from room metadata
    voice_session_id = uuid4()
    room_name = ctx.room.name

    logger.info(
        "New voice session started",
        extra={
            "room_name": room_name,
            "farmer_id": farmer_id,
            "voice_session_id": str(voice_session_id),
        },
    )

    # Set up session context for tool calls
    session_ctx = SessionContext(
        farmer_id=farmer_id if isinstance(farmer_id, type(voice_session_id)) else voice_session_id,
        voice_session_id=voice_session_id,
        farmer_name="Farmer",
    )
    set_session_context(session_ctx)

    # Create the agent session with STT-LLM-TTS pipeline
    tts = upliftai.TTS(
        voice_id=settings.uplift_voice_id,
        output_format=settings.uplift_output_format,
        api_key=settings.uplift_api_key.get_secret_value(),
        word_tokenizer=tokenize.basic.SentenceTokenizer(),  # Send each sentence immediately
    )
    
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="ur",
        ),
        llm=openai.LLM.with_openrouter(
            model=settings.openrouter_model,
        ),
        tts=tts,
        vad=_vad,
        turn_handling={
            # Audio-based turn detection — analyzes intonation, pitch, and rhythm
            # for accurate end-of-turn prediction (Ref: https://docs.livekit.io/agents/logic/turns/turn-detector/)
            "turn_detection": inference.TurnDetector(),
            # Dynamic endpointing — adapts to conversation pace automatically
            # (Ref: https://docs.livekit.io/reference/agents/turn-handling-options/)
            "endpointing": {
                "mode": "dynamic",
                "min_delay": 0.3,
                "max_delay": 2.5,
                "alpha": 0.9,
            },
            # Adaptive interruption — trained model distinguishes true barge-in
            # from backchannels like "hmm", "haan", coughs
            # (Ref: https://livekit.com/blog/adaptive-interruption-handling)
            "interruption": {
                "mode": "adaptive",
                "min_duration": 0.5,
                "resume_false_interruption": True,
            },
            # Preemptive generation — start LLM+TTS before turn is confirmed
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
        agent=KissanRehnumaAgent(),
        room_input_options=RoomInputOptions(),
    )

    logger.info("Voice session active", extra={"room_name": room_name})


if __name__ == "__main__":
    agents.cli.run_app(server)
