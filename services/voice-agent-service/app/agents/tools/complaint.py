"""Complaint tools for the Kissan Rehnuma voice agent."""

from __future__ import annotations

import time

from livekit.agents import function_tool

from app.agents.context import get_session_context
from app.core.logging import logger
from app.db.session import get_session_factory
from app.models.complaint import ComplaintCategory, ComplaintUrgency
from app.repositories.complaint_repository import ComplaintRepository


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
    from uuid import UUID
    ctx = get_session_context()

    # Convert farmer_id to UUID for DB query (handles int/str/UUID)
    try:
        farmer_uuid = UUID(str(ctx.farmer_id))
    except (ValueError, AttributeError):
        farmer_uuid = UUID(int=int(ctx.farmer_id))

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
                farmer_id=farmer_uuid,
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
async def check_complaint_status() -> dict:
    """Check the status of the farmer's complaints.

    Use this IMMEDIATELY when a farmer asks about their complaint status,
    shikayat, or any previously registered issue. Do NOT ask the farmer
    for any reference number — the system already knows who they are.
    Just call it right away with no arguments.

    Returns:
        A dict with all complaints registered by this farmer, their
        categories, statuses, and reference numbers.
    """
    from uuid import UUID
    ctx = get_session_context()

    # Convert farmer_id to UUID for DB query (handles int/str/UUID)
    try:
        farmer_uuid = UUID(str(ctx.farmer_id))
    except (ValueError, AttributeError):
        # If it's an integer farmer_id, convert to UUID string format
        # This handles the case where user-auth-service uses integer IDs
        farmer_uuid = UUID(int=int(ctx.farmer_id))

    try:
        session_factory = get_session_factory()
        async with session_factory() as db_session:
            repo = ComplaintRepository(db_session)
            complaints = await repo.get_complaints_by_farmer(farmer_uuid, limit=5)

            if not complaints:
                return {
                    "success": True,
                    "complaints": [],
                    "message": (
                        "No complaints found for this farmer. "
                        "Tell the farmer: آپ کی کوئی شکایت درج نہیں ہے۔"
                    ),
                }

            status_labels = {
                "registered": "درج شدہ (زیرِ جائزہ)",
                "in_review": "جائزہ لیا جا رہا ہے",
                "resolved": "حل ہو گئی",
                "closed": "بند",
            }

            complaint_lines = []
            for i, c in enumerate(complaints, 1):
                cat = c.category.value if hasattr(c.category, 'value') else str(c.category)
                st = c.status.value if hasattr(c.status, 'value') else str(c.status)
                st_urdu = status_labels.get(st, st)
                desc_short = c.description[:40] + "..." if len(c.description) > 40 else c.description
                complaint_lines.append(
                    f"{i}. {cat}: {desc_short} — {st_urdu}"
                )

            summary = " | ".join(complaint_lines)

            return {
                "success": True,
                "complaints": [
                    {
                        "category": c.category.value if hasattr(c.category, 'value') else str(c.category),
                        "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                        "description": c.description[:60],
                        "district": c.district,
                        "created": str(c.created_at),
                    }
                    for c in complaints
                ],
                "message": (
                    f"Found {len(complaints)} complaint(s). {summary}"
                ),
            }

    except Exception as e:
        logger.error("Failed to check complaint status", extra={"error": str(e)})
        return {
            "success": False,
            "message": f"Failed to check status. Error: {str(e)}",
        }
