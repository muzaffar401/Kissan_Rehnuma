"""Core configuration and settings."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env file before creating Settings
_env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(_env_path)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Kissan Rehnuma Voice Agent"
    app_env: Literal["development", "test", "staging", "production"] = "development"
    log_level: str = "INFO"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/voice_agent"

    # LiveKit
    livekit_api_key: SecretStr = Field(min_length=1)
    livekit_api_secret: SecretStr = Field(min_length=1)
    livekit_url: str = "wss://localhost:7880"

    # OpenRouter (LLM)
    openrouter_api_key: SecretStr = Field(min_length=1)
    openrouter_model: str = "openai/gpt-4o"

    # Deepgram (STT)
    deepgram_api_key: SecretStr = Field(min_length=1)

    # Uplift AI (TTS)
    uplift_api_key: SecretStr = Field(min_length=1)
    uplift_tts_base_url: str = "https://api.upliftai.org/v1/synthesis/text-to-speech"
    uplift_voice_id: str = "v_8eelc901"  # Info/Edu voice
    uplift_output_format: str = "WAV_22050_16"

    # Agent behavior
    agent_language: str = "ur"  # Urdu
    agent_max_complaints_per_session: int = 5


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()  # type: ignore[call-arg]
