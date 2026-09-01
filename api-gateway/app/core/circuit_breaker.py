"""Circuit breaker configuration using pybreaker.

Per official docs (https://github.com/danielfm/pybreaker):
- Create CircuitBreaker instances per integration point (per service)
- Instances should live in application scope (across requests)
- Parameters: fail_max (threshold), reset_timeout (seconds)
- Use calling() context manager for wrapping calls
- State: closed (normal) → open (failing) → half-open (testing)
"""

import pybreaker

from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


class GatewayCircuitBreakerListener(pybreaker.CircuitBreakerListener):
    """Listener for circuit breaker events with structured logging."""

    def before_call(self, cb, func, *args, **kwargs):
        """Called before each circuit breaker protected call."""
        pass

    def success(self, cb):
        """Called when a protected call succeeds."""
        logger.debug(
            "circuit_breaker_success",
            breaker=cb.name,
        )

    def failure(self, cb, exc):
        """Called when a protected call fails."""
        logger.warning(
            "circuit_breaker_failure",
            breaker=cb.name,
            failure_count=cb.fail_counter,
            fail_max=cb.fail_max,
            error=str(exc),
        )

    def state_change(self, cb, old_state, new_state):
        """Called when circuit breaker state changes."""
        logger.warning(
            "circuit_breaker_state_change",
            breaker=cb.name,
            old_state=old_state,
            new_state=new_state,
        )


# Circuit breaker configuration per service
# fail_max: consecutive failures before opening circuit
# reset_timeout: seconds before trying again (half-open)
CIRCUIT_BREAKER_CONFIG = {
    "fail_max": 5,              # Open after 5 consecutive failures
    "reset_timeout": 60,        # Try again after 60 seconds
    "success_threshold": 2,     # 2 successes to close circuit from half-open
}

# Create circuit breakers for each downstream microservice
_service_breakers = {
    "crop-disease-service": pybreaker.CircuitBreaker(
        name="crop-disease-service",
        listeners=[GatewayCircuitBreakerListener()],
        **CIRCUIT_BREAKER_CONFIG,
    ),
    "user-auth-service": pybreaker.CircuitBreaker(
        name="user-auth-service",
        listeners=[GatewayCircuitBreakerListener()],
        **CIRCUIT_BREAKER_CONFIG,
    ),
    "animal-disease-service": pybreaker.CircuitBreaker(
        name="animal-disease-service",
        listeners=[GatewayCircuitBreakerListener()],
        **CIRCUIT_BREAKER_CONFIG,
    ),
    "weather-alert-service": pybreaker.CircuitBreaker(
        name="weather-alert-service",
        listeners=[GatewayCircuitBreakerListener()],
        **CIRCUIT_BREAKER_CONFIG,
    ),
    "market-rate-service": pybreaker.CircuitBreaker(
        name="market-rate-service",
        listeners=[GatewayCircuitBreakerListener()],
        **CIRCUIT_BREAKER_CONFIG,
    ),
    "voice-helpline-service": pybreaker.CircuitBreaker(
        name="voice-helpline-service",
        listeners=[GatewayCircuitBreakerListener()],
        **CIRCUIT_BREAKER_CONFIG,
    ),
}

# Default/fallback circuit breaker
_default_breaker = pybreaker.CircuitBreaker(
    name="default",
    listeners=[GatewayCircuitBreakerListener()],
    **CIRCUIT_BREAKER_CONFIG,
)


def get_circuit_breaker(service_name: str) -> pybreaker.CircuitBreaker:
    """Get the circuit breaker for a specific service.
    
    Args:
        service_name: Name of the downstream microservice
        
    Returns:
        CircuitBreaker instance for the service, or default breaker
    """
    return _service_breakers.get(service_name, _default_breaker)


def get_all_breaker_states() -> dict:
    """Get current state of all circuit breakers for monitoring.
    
    Returns:
        Dict mapping service name to circuit breaker state
    """
    states = {}
    for name, breaker in _service_breakers.items():
        states[name] = breaker.current_state
    return states
