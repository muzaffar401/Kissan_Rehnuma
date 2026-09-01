"""Rate limiting configuration using slowapi.

Per official docs (https://slowapi.readthedocs.io/en/latest/):
- Limiter must be created with a key function
- app.state.limiter must be set
- RateLimitExceeded exception handler must be registered
- Decorator order: @router.method ABOVE @limiter.limit
- `request` param must be explicitly passed to endpoint
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.logger import get_logger

logger = get_logger(__name__)

# Create rate limiter instance
# Key function: rate limit per client IP address
limiter = Limiter(key_func=get_remote_address)

# Rate limit constants (per minute, per IP)
RATE_LIMIT_DEFAULT = "60/minute"      # Default for all endpoints
RATE_LIMIT_DETECT = "10/minute"       # Image detection (expensive AI processing)
RATE_LIMIT_HISTORY = "30/minute"      # History queries
RATE_LIMIT_HEALTH = "120/minute"      # Health checks (lightweight)
