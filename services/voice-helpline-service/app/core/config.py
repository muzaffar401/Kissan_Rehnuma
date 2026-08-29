from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    app_name: str = "Kissan Rehnuma Voice Helpline"
    app_env: Literal["development", "test", "staging", "production"] = "development"
    log_level: str = "INFO"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/voice_helpline"

    uplift_api_base_url: AnyHttpUrl = "https://api.upliftai.org"
    uplift_api_key: SecretStr = Field(min_length=1)
    uplift_assistant_id: str = Field(min_length=1)
    uplift_session_ttl_seconds: int = Field(default=900, ge=60, le=3600)
    uplift_connect_timeout_seconds: float = Field(default=5.0, gt=0, le=30)
    uplift_read_timeout_seconds: float = Field(default=15.0, gt=0, le=60)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

