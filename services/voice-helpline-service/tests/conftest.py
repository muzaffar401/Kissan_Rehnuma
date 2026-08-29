import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("UPLIFT_API_KEY", "test-api-key")
os.environ.setdefault("UPLIFT_ASSISTANT_ID", "assistant-test")

