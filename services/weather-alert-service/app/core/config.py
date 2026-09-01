import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/Farmers",
)

# JWT verification — must match user-auth-service, which issues the tokens
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-key")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Open-Meteo (free, no API key needed)
OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1"
HTTP_TIMEOUT_SECONDS = float(os.getenv("HTTP_TIMEOUT_SECONDS", "15"))

# Current weather readings younger than this are served from DB cache
WEATHER_CACHE_MINUTES = int(os.getenv("WEATHER_CACHE_MINUTES", "30"))

# How far ahead the forecast endpoint looks (24-48h)
FORECAST_HOURS = int(os.getenv("FORECAST_HOURS", "48"))

# Background scheduler: re-checks every farmer for weather risks
SCHEDULER_ENABLED = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
SCHEDULER_INTERVAL_MINUTES = int(os.getenv("SCHEDULER_INTERVAL_MINUTES", "30"))

# LLM advisory via OpenRouter (Gemini). Generates Roman-Urdu agricultural
# advisories. Falls back to static advisories when the key is missing or
# the LLM call fails.
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemini-2.5-flash")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.3"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "200"))

# Optional Twilio SMS. When not configured, notifications are logged only.
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")

# Risk thresholds (env-tunable so the alert flow can be tested easily,
# e.g. HEATWAVE_TEMP_C=30 makes a 35C day trigger an alert)
FROST_TEMP_C = float(os.getenv("FROST_TEMP_C", "2"))
HEATWAVE_TEMP_C = float(os.getenv("HEATWAVE_TEMP_C", "45"))
HEAVY_RAIN_TOTAL_MM = float(os.getenv("HEAVY_RAIN_TOTAL_MM", "15"))
HIGH_WIND_KMH = float(os.getenv("HIGH_WIND_KMH", "40"))

# Optional Firebase Cloud Messaging (lock-screen push notifications).
# FCM_SERVICE_ACCOUNT_FILE = path to the Firebase service-account JSON.
# When not configured, push messages are logged only.
FCM_PROJECT_ID = os.getenv("FCM_PROJECT_ID", "")
FCM_SERVICE_ACCOUNT_FILE = os.getenv("FCM_SERVICE_ACCOUNT_FILE", "")
