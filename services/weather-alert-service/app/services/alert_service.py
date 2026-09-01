"""Alert pipeline shared by the API and the background scheduler:
fetch weather -> detect risk -> generate advisory -> notify -> persist.
"""
from sqlalchemy.orm import Session

from app.core.config import FORECAST_HOURS
from app.models.alert_sent import AlertSent
from app.models.farmer import Farmer
from app.repositories.alert_sent_repo import AlertSentRepository
from app.repositories.farmer_location_repo import FarmerLocationRepository
from app.schemas.alert import TriggerCheckResponse
from app.services import advisories, llm_advisory, notifier, push, risk_engine
from app.services import weather_provider


def check_farmer(db: Session, farmer: Farmer) -> TriggerCheckResponse:
    """Run the full alert pipeline for one farmer."""
    location = FarmerLocationRepository(db).get(farmer.id)
    if location is None:
        return TriggerCheckResponse(
            farmer_id=farmer.id,
            risk_detected=False,
            notification_status="skipped_no_location",
        )

    try:
        current = weather_provider.fetch_current_weather(
            location.latitude, location.longitude
        )
        forecast = weather_provider.fetch_forecast(
            location.latitude, location.longitude, forecast_hours=FORECAST_HOURS
        )
    except weather_provider.WeatherProviderError:
        return TriggerCheckResponse(
            farmer_id=farmer.id,
            risk_detected=False,
            notification_status="weather_unavailable",
        )

    risk = risk_engine.detect_risk(current, forecast)
    if not risk.detected:
        return TriggerCheckResponse(
            farmer_id=farmer.id,
            risk_detected=False,
            notification_status="not_sent",
        )

    # LLM advisory with full weather context (current + forecast)
    # Falls back to static Roman-Urdu advisory if LLM is unavailable
    message = llm_advisory.generate_advisory(risk, current, forecast) or advisories.build_advisory(
        risk.risk_type, risk.detail
    )
    status = notifier.send_sms(farmer.phone_number, message)

    # Lock-screen push notification to the farmer's registered device(s)
    push_title = f"{risk.risk_type.replace('_', ' ').title()} Alert"
    push.send_push_to_farmer(db, farmer.id, push_title, message)

    AlertSentRepository(db).create(
        AlertSent(
            farmer_id=farmer.id,
            alert_type=risk.risk_type,
            message=message,
            risk_detected=True,
            status=status,
        )
    )

    return TriggerCheckResponse(
        farmer_id=farmer.id,
        risk_detected=True,
        risk_type=risk.risk_type,
        advisory_generated=message,
        notification_status=status,
    )
