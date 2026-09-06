"""Admin service configuration — reads 4 database URLs + admin credentials."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8006

    # Four separate database URLs (read-only access)
    auth_db_url: str = "postgresql+asyncpg://kissan:kissan@localhost:5432/kissan_auth"
    crop_db_url: str = "postgresql+asyncpg://kissan:kissan@localhost:5432/kissan_crop_disease"
    animal_db_url: str = "postgresql+asyncpg://kissan:kissan@localhost:5432/kissan_animal_disease"
    voice_db_url: str = "postgresql+asyncpg://kissan:kissan@localhost:5432/voice_agent"

    # Admin credentials
    admin_username: str = "admin"
    admin_password: str = "changeme"
    admin_secret_key: str = "super-secret-jwt-key-change-in-production"
    admin_token_expiry_minutes: int = 480  # 8 hours

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8081,http://localhost:8082,http://localhost:8083"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
