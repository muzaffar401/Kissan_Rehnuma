"""Kissan Rehnuma Voice Agent — LiveKit Agent with tools.

This module defines the voice agent that handles real-time conversations
with Pakistani farmers. It uses OpenRouter for LLM inference (Mixed Approach:
English instructions + Roman Urdu responses) and provides tools for complaint
registration, weather lookup, and market rate queries.
"""

from __future__ import annotations

import json
import time
from uuid import UUID, uuid4

from livekit.agents import Agent, function_tool
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.db.session import get_session_factory
from app.models.complaint import ComplaintCategory, ComplaintUrgency
from app.repositories.complaint_repository import ComplaintRepository
from app.repositories.session_repository import SessionRepository

# ---------------------------------------------------------------------------
# Context: per-session data shared across tool calls
# ---------------------------------------------------------------------------

class SessionContext:
    """Holds per-call session data for tool functions."""

    def __init__(self, farmer_id: UUID, voice_session_id: UUID, farmer_name: str = "Farmer"):
        self.farmer_id = farmer_id
        self.voice_session_id = voice_session_id
        self.farmer_name = farmer_name
        self.complaints_this_session: int = 0


# Thread-local-like context set per room session
_current_context: SessionContext | None = None


def set_session_context(ctx: SessionContext) -> None:
    global _current_context
    _current_context = ctx


def get_session_context() -> SessionContext:
    if _current_context is None:
        raise RuntimeError("Session context not set. Call set_session_context first.")
    return _current_context


# ---------------------------------------------------------------------------
# Tool functions — these are called by the LLM during conversation
# ---------------------------------------------------------------------------

@function_tool
async def register_complaint(
    category: str,
    description: str,
    district: str,
    crop: str | None = None,
    urgency: str = "normal",
) -> dict:
    """Register a new farmer complaint in the Kissan Rehnuma system.

    Use this when a farmer reports any issue — crop disease, animal disease,
    weather damage, market problems, or general agricultural complaints.

    Args:
        category: Type of complaint. MUST be one of these EXACT English values:
                  - "crop_disease" (for فصل کی بیماری / plant diseases)
                  - "animal_disease" (for جانوروں کی بیماری / livestock issues)
                  - "weather_alert" (for موسم کی وارننگ / weather damage)
                  - "market_rate" (for منڈی کے ریٹ / market problems)
                  - "general_inquiry" (for عمومی سوالات / other issues)
                  DO NOT pass Urdu text for category — use the English codes above.
        description: Detailed description of the problem the farmer is facing.
                     Include symptoms, affected area, duration if mentioned.
        district: The farmer's district name (e.g., Faisalabad, Lahore, Multan, Shikarpur).
        crop: Name of the affected crop if applicable (e.g., wheat, sugarcane, cotton).
              Pass null for animal diseases or non-crop issues.
        urgency: Priority level — "low", "normal", "high", or "critical".
                 Use 'critical' for widespread disease outbreaks or emergencies.

    Returns:
        A dict with success status, reference_number, and confirmation message.
    """
    ctx = get_session_context()

    # Validate category
    valid_categories = [c.value for c in ComplaintCategory]
    if category not in valid_categories:
        logger.warning(
            "Invalid category received",
            extra={"received_category": category, "valid_categories": valid_categories},
        )
        return {
            "success": False,
            "message": f"Invalid category. Choose from: {', '.join(valid_categories)}",
        }

    # Validate urgency
    valid_urgencies = [u.value for u in ComplaintUrgency]
    if urgency not in valid_urgencies:
        return {
            "success": False,
            "message": f"Invalid urgency. Choose from: {', '.join(valid_urgencies)}",
        }

    start_time = time.perf_counter()

    try:
        session_factory = get_session_factory()
        async with session_factory() as db_session:
            repo = ComplaintRepository(db_session)

            complaint = await repo.create_complaint(
                farmer_id=ctx.farmer_id,
                voice_session_id=ctx.voice_session_id,
                category=ComplaintCategory(category),
                description=description,
                district=district,
                crop=crop,
                urgency=ComplaintUrgency(urgency),
            )

            await db_session.commit()
            ctx.complaints_this_session += 1

            duration_ms = int((time.perf_counter() - start_time) * 1000)

            logger.info(
                "Complaint registered via tool",
                extra={
                    "reference_number": complaint.reference_number,
                    "farmer_id": str(ctx.farmer_id),
                    "category": category,
                    "district": district,
                    "duration_ms": duration_ms,
                },
            )

            return {
                "success": True,
                "reference_number": complaint.reference_number,
                "message": (
                    f"Complaint registered successfully. "
                    f"Reference number is {complaint.reference_number}. "
                    f"Tell the farmer their complaint has been recorded."
                ),
            }

    except Exception as e:
        logger.error("Failed to register complaint", extra={"error": str(e)})
        return {
            "success": False,
            "message": f"Failed to register complaint. Error: {str(e)}",
        }


@function_tool
async def check_weather_alert(district: str) -> dict:
    """Check current weather alerts for a farmer's district.

    Use this when a farmer asks about weather conditions, rain forecasts,
    heatwave warnings, or storm alerts for their area.

    Args:
        district: The farmer's district name (e.g., Faisalabad, Lahore, Multan).

    Returns:
        A dict with weather alert information for the district.
    """
    # Placeholder — will be connected to weather service later
    logger.info("Weather alert requested", extra={"district": district})

    return {
        "success": True,
        "district": district,
        "alert": "No active weather alerts for your area.",
        "forecast": "Clear skies expected. Normal temperatures for the season.",
        "message": f"No active alerts for {district}. Tell the farmer conditions are normal.",
    }


@function_tool
async def get_market_rates(crop: str, mandi: str = "nearest") -> dict:
    """Get current market rates for a crop at a specific mandi (market).

    Use this when a farmer asks about crop prices, market rates, or
    wants to know the current selling price of their produce.

    Args:
        crop: Name of the crop (e.g., wheat, sugarcane, cotton, rice).
        mandi: Name of the market/mandi. Use 'nearest' if farmer doesn't specify.

    Returns:
        A dict with current market rate information.
    """
    # Placeholder — will be connected to market rate service later
    logger.info("Market rates requested", extra={"crop": crop, "mandi": mandi})

    return {
        "success": True,
        "crop": crop,
        "mandi": mandi,
        "rate": "Rates data will be available soon.",
        "unit": "PKR per maund (40kg)",
        "message": (
            f"Market rate lookup for {crop} is coming soon. "
            f"Tell the farmer this feature will be available shortly."
        ),
    }


@function_tool
async def check_complaint_status(reference_number: str) -> dict:
    """Check the status of an existing complaint by reference number.

    Use this when a farmer asks about the status of a previously
    registered complaint or wants an update.

    Args:
        reference_number: The complaint reference number (format: KR-YYYY-xxxxxxxxxxxx).

    Returns:
        A dict with complaint status information.
    """
    ctx = get_session_context()

    try:
        session_factory = get_session_factory()
        async with session_factory() as db_session:
            repo = ComplaintRepository(db_session)
            complaint = await repo.get_complaint_by_reference(reference_number)

            if not complaint:
                return {
                    "success": False,
                    "message": f"No complaint found with reference {reference_number}.",
                }

            status_messages = {
                "registered": "Your complaint has been registered and is waiting for review.",
                "in_review": "Your complaint is currently being reviewed by our team.",
                "resolved": "Your complaint has been resolved.",
                "closed": "This complaint has been closed.",
            }

            return {
                "success": True,
                "reference_number": complaint.reference_number,
                "category": complaint.category.value if hasattr(complaint.category, 'value') else str(complaint.category),
                "status": complaint.status.value if hasattr(complaint.status, 'value') else str(complaint.status),
                "message": status_messages.get(
                    complaint.status.value if hasattr(complaint.status, 'value') else str(complaint.status),
                    "Status unknown.",
                ),
            }

    except Exception as e:
        logger.error("Failed to check complaint status", extra={"error": str(e)})
        return {
            "success": False,
            "message": f"Failed to check status. Error: {str(e)}",
        }


# ---------------------------------------------------------------------------
# Agent instructions — Urdu script output for Uplift AI TTS
# ---------------------------------------------------------------------------

KISSAN_AGENT_INSTRUCTIONS = """
You are Kissan Rehnuma, a voice assistant for Pakistani farmers. You help farmers
with agricultural issues by registering complaints, checking weather alerts,
and providing market rate information.

## Language Rules
- Use Pakistani Urdu only (proper Urdu script, no Roman Urdu)
- Simple, conversational language that anyone can understand
- Avoid English except for widely known terms
- Keep responses short and clear — this is a voice conversation, not text
- Use "آپ" for respect
- Do not use emojis, asterisks, or complex formatting
- Write as continuous oral narration — no bullet points or symbols
- For numbers, use Urdu words: "انیس سو سینتالیس" not "1947"

## Behavior
- Greet the farmer warmly when the conversation starts.
- Listen carefully and ask clarifying questions if needed.
- Before registering a complaint, confirm: category, crop (if applicable),
  district, and a brief description.
- After successful registration, tell the farmer the reference number clearly.
- If the farmer wants to register multiple complaints, handle them one at a time.
- Be empathetic — farmers may be distressed about crop/animal issues.
- If you don't understand something, politely ask the farmer to repeat.
- When the farmer describes a problem, use the available tools to help.
  Do NOT describe what tool you will call — just call it directly.

## Example Responses (in Urdu script)
- Greeting: "السلام علیکم! میں کسان رہنما ہوں۔ بتائیے میں آپ کی کیا مدد کر سکتا ہوں؟"
- Confirming: "ٹھیک ہے، میں آپ کی شکایت درج کر رہا ہوں۔ ایک لمحے۔"
- Success: "آپ کی شکایت درج ہو گئی ہے۔ حوالہ نمبر ہے KR-2026-abc12345۔ ہم جلد آپ کو اپ ڈیٹ دیں گے۔"
- Weather: "آپ کے علاقے کے لیے کوئی موسم کی وارننگ نہیں ہے۔ حالات معمول کے مطابق ہیں۔"
"""
