"""Memory extraction and retrieval service for conversation memory.

Uses LLM to extract summaries from conversation transcripts and
provides memory context for the agent at session start.
"""

from __future__ import annotations

import json
from uuid import UUID

import httpx

from app.agents.context import get_session_context
from app.core.config import get_settings
from app.core.logging import logger
from app.db.session import get_session_factory
from app.repositories.conversation_memory_repository import ConversationMemoryRepository


# ---------------------------------------------------------------------------
# Memory extraction (post-session)
# ---------------------------------------------------------------------------

MEMORY_EXTRACTION_PROMPT = """You are a memory extraction system for a Pakistani farming voice assistant.

Given the following conversation transcript between a farmer and the Kissan Rehnuma voice agent, extract:

1. **summary**: A 2-3 sentence summary in Urdu of what was discussed.
2. **topics**: List of topics discussed (from: weather, market_rate, crop_disease, animal_disease, complaint, general)
3. **key_points**: List of 3-5 key facts/decisions from the conversation in Urdu (e.g., "گندم کا ریٹ 1500 روپے فی من ہے", "بارش کا امکان ہے تو کھاد نہ ڈالیں")

Respond in this exact JSON format:
{
  "summary": "اردو میں خلاصہ",
  "topics": ["weather", "market_rate"],
  "key_points": ["پہلا نکتہ", "دوسرا نکتہ"]
}

If the conversation was very short or just greetings, still extract what you can. If there's truly nothing meaningful, set summary to "مختصر بات چیت" and topics to ["general"].

Transcript:
"""


async def extract_and_save_memory(
    transcript: str,
    turn_count: int = 0,
    duration_seconds: int | None = None,
) -> None:
    """Extract memory from a conversation transcript and save to DB.

    This runs asynchronously after the session ends. It:
    1. Calls LLM to extract summary, topics, key_points
    2. Saves to conversation_memories table

    Args:
        transcript: Full conversation transcript (user/assistant turns).
        turn_count: Number of turns in the conversation.
        duration_seconds: Session duration in seconds.
    """
    ctx = get_session_context()
    settings = get_settings()

    # Convert farmer_id to UUID for DB
    try:
        farmer_uuid = UUID(str(ctx.farmer_id))
    except (ValueError, AttributeError):
        from uuid import UUID as UUID_cls
        farmer_uuid = UUID_cls(int=int(ctx.farmer_id))

    try:
        # Call LLM to extract memory
        extracted = await _call_llm_for_extraction(transcript, settings)

        # Save to DB
        session_factory = get_session_factory()
        async with session_factory() as db_session:
            repo = ConversationMemoryRepository(db_session)
            await repo.create_memory(
                farmer_id=farmer_uuid,
                voice_session_id=ctx.voice_session_id,
                summary=extracted.get("summary", ""),
                topics=extracted.get("topics", []),
                key_points=extracted.get("key_points", []),
                transcript=transcript,
                turn_count=turn_count,
                duration_seconds=duration_seconds,
            )

        logger.info(
            "Conversation memory saved",
            extra={
                "farmer_id": str(farmer_uuid),
                "voice_session_id": str(ctx.voice_session_id),
                "topics": extracted.get("topics", []),
            },
        )
    except Exception as e:
        logger.error(
            "Failed to extract/save conversation memory",
            extra={"error": str(e), "farmer_id": str(farmer_uuid)},
        )


async def _call_llm_for_extraction(
    transcript: str, settings
) -> dict:
    """Call OpenRouter LLM to extract memory from transcript."""
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key.get_secret_value()}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kissanrehnuma.com",
        "X-Title": "Kissan Rehnuma",
    }

    # Truncate transcript if too long (keep last 8000 chars)
    if len(transcript) > 8000:
        transcript = "...[earlier conversation truncated]...\n" + transcript[-8000:]

    payload = {
        "model": settings.openrouter_model,
        "messages": [
            {"role": "system", "content": MEMORY_EXTRACTION_PROMPT},
            {"role": "user", "content": transcript},
        ],
        "temperature": 0.3,
        "max_tokens": 500,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    # Parse the response
    content = data["choices"][0]["message"]["content"]

    # Try to parse as JSON
    try:
        # Handle case where LLM wraps JSON in markdown code blocks
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content.strip())
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM extraction response as JSON", extra={"content": content[:200]})
        return {
            "summary": content[:200],
            "topics": ["general"],
            "key_points": [],
        }


# ---------------------------------------------------------------------------
# Memory retrieval (pre-session)
# ---------------------------------------------------------------------------

async def load_farmer_memory(limit: int = 3) -> str:
    """Load recent conversation memories for the current farmer.

    Returns a formatted string to inject into the agent's instructions
    or chat context.

    Args:
        limit: Maximum number of recent memories to load.

    Returns:
        Formatted string with memory context, or empty string if no memories.
    """
    ctx = get_session_context()

    # Convert farmer_id to UUID
    try:
        farmer_uuid = UUID(str(ctx.farmer_id))
    except (ValueError, AttributeError):
        from uuid import UUID as UUID_cls
        farmer_uuid = UUID_cls(int=int(ctx.farmer_id))

    try:
        session_factory = get_session_factory()
        async with session_factory() as db_session:
            repo = ConversationMemoryRepository(db_session)
            memories = await repo.get_recent_memories(farmer_uuid, limit=limit)

        if not memories:
            return ""

        # Format memories for agent context
        lines = ["FARMER'S PAST CONVERSATIONS (for context only, do not mention unless relevant):"]
        for i, mem in enumerate(reversed(memories), 1):
            date_str = mem.created_at.strftime("%d %b %Y") if mem.created_at else "recent"
            lines.append(f"\n{i}. [{date_str}] Topics: {', '.join(mem.topics) if mem.topics else 'general'}")
            lines.append(f"   Summary: {mem.summary}")
            if mem.key_points:
                lines.append(f"   Key points: {'; '.join(mem.key_points[:3])}")

        return "\n".join(lines)

    except Exception as e:
        logger.warning(
            "Failed to load farmer memory",
            extra={"error": str(e), "farmer_id": str(farmer_uuid)},
        )
        return ""
