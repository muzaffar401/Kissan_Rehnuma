from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """API Gateway configuration."""

    # Application
    app_name: str = "api-gateway"
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    # Server
    host: str = "0.0.0.0"
    port: int = 3000

    # Service URLs (internal microservices)
    crop_disease_service_url: str = "http://localhost:8001"
    user_auth_service_url: str = "http://localhost:8002"
    animal_disease_service_url: str = "http://localhost:8003"
    weather_alert_service_url: str = "http://localhost:8004"
    market_rate_service_url: str = "http://localhost:8005"
    voice_helpline_service_url: str = "http://localhost:8006"

    # JWT Configuration
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    # Rate Limiting
    rate_limit_per_minute: int = 60

    # CORS
    cors_origins: str = "http://localhost:8081,http://localhost:8082,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


def get_settings() -> Settings:
    """Get application settings."""
    return Settings()
