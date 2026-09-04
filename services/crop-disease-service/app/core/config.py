from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Self

from pydantic import BeforeValidator, Field, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def _split_comma(value: Any) -> Any:
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return value


CommaSeparatedList = Annotated[list[str], NoDecode, BeforeValidator(_split_comma)]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────
    app_name: str = "crop-disease-service"
    app_env: str = "development"
    debug: bool = False
    log_level: str = "INFO"

    # ── Database ─────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kissan_crop_disease"
    database_pool_size: int = 10
    database_max_overflow: int = 5

    # ── Vision LLM (OpenRouter) ──────────────────────────────────
    openrouter_api_key: str = ""
    vision_model: str = "openai/gpt-4o"
    vision_temperature: float = 0.2
    vision_max_tokens: int = 2048

    # ── Confidence Gate ──────────────────────────────────────────
    confidence_threshold: float = Field(default=0.70, ge=0.0, le=1.0)

    # ── Cloudinary ───────────────────────────────────────────────
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    cloudinary_folder: str = "kissan-rehnuma/crop-scans"

    # ── LangSmith ────────────────────────────────────────────────
    langsmith_tracing: bool = False
    langsmith_api_key: str = ""
    langsmith_project: str = "crop-disease-service"

    # ── Image Constraints ────────────────────────────────────────
    max_image_size_mb: int = 10
    min_image_width: int = 224
    min_image_height: int = 224
    allowed_content_types: CommaSeparatedList = ["image/jpeg", "image/png", "image/webp"]

    # ── SSL (set by _production_setup) ─────────────────────────────
    db_ssl_enabled: bool = False

    @property
    def max_image_bytes(self) -> int:
        return self.max_image_size_mb * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @model_validator(mode="after")
    def _production_setup(self) -> Self:
        if self.app_env == "production":
            missing = []
            if not self.openrouter_api_key:
                missing.append("OPENROUTER_API_KEY")
            if not self.cloudinary_api_key:
                missing.append("CLOUDINARY_API_KEY")
            if missing:
                raise ValueError(
                    f"Production requires these env vars: {', '.join(missing)}"
                )
            # Neon provides postgresql:// but async SQLAlchemy needs postgresql+asyncpg://
            if self.database_url.startswith("postgresql://"):
                self.database_url = self.database_url.replace(
                    "postgresql://", "postgresql+asyncpg://", 1
                )
            # asyncpg does NOT accept sslmode in the URL — strip it and
            # enable SSL via connect_args instead.
            self.database_url = self.database_url.split("?sslmode=")[0]
            self.db_ssl_enabled = True
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
