import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/Farmers",
)

# Redis cache. When unreachable/unset, an in-process TTL cache is used.
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", str(2 * 3600)))  # 1-3h

# Admin protection for /admin/** endpoints
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "change-this-admin-key")

# AMIS source page (swap to a partner API here if one becomes available)
AMIS_PRICES_URL = os.getenv("AMIS_PRICES_URL", "http://www.amis.pk/")
HTTP_TIMEOUT_SECONDS = float(os.getenv("HTTP_TIMEOUT_SECONDS", "10"))

# Daily pipeline schedule (24h clock) + optional run at startup
SCHEDULER_ENABLED = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
SCHEDULER_HOUR = int(os.getenv("SCHEDULER_HOUR", "7"))
RUN_PIPELINE_ON_STARTUP = os.getenv(
    "RUN_PIPELINE_ON_STARTUP", "false"
).lower() == "true"
