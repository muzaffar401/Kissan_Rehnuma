"""Advisory messages generated per detected risk type (Roman Urdu)."""
from typing import Optional

from app.services.risk_engine import FROST, HEATWAVE, HEAVY_RAIN, HIGH_WIND

ADVISORIES = {
    FROST: (
        "Aaj raat pala (frost) parne ka khatra hai. "
        "Fasal par halka pani lagayein aur mumkin ho to dhuaan ya plastic "
        "sheet se cover karein taake nuqsan se bacha ja sake."
    ),
    HEATWAVE: (
        "Shadeed garmi (heatwave) ki warning hai. "
        "Fasal ko subah sawere ya shaam ko seerab karein, dopahar mein "
        "spray na karein aur apna bhi khayal rakhein."
    ),
    HEAVY_RAIN: (
        "Agley 24-48 ghanton mein tez barish ki peshangoi hai. "
        "Spray aur khad ka istemal muakhar karein, zameen ka drainage "
        "saaf rakhein taake pani jama na ho."
    ),
    HIGH_WIND: (
        "Tez hawaon ki warning hai. Spray na karein, plastic tunnels aur "
        "nursery ko mazbooti se baandh lein."
    ),
}


def build_advisory(risk_type: str, detail: Optional[str] = None) -> str:
    """Return the farmer-facing advisory for a risk type."""
    base = ADVISORIES.get(risk_type, "Mausam ki surat-e-haal par nazar rakhein.")
    if detail:
        return f"{base} ({detail})"
    return base
