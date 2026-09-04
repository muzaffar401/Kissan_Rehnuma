import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

from app.db.base import Base
from app.models.farmer import Farmer
from app.models.farmer_location import FarmerLocation
from app.models.weather_snapshot import WeatherSnapshot
from app.models.alert_sent import AlertSent
from app.models.device_token import DeviceToken

config = context.config

# Override sqlalchemy.url from DATABASE_URL env var (critical for production)
db_url = os.getenv("DATABASE_URL")
if db_url:
    config.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# This service shares the database with user-auth-service, so it keeps
# its own version tracking table to avoid clashing with the auth chain.
VERSION_TABLE = "weather_alembic_version"


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        version_table=VERSION_TABLE,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Add SSL for production (Neon requires SSL)
    import os as _os
    connect_args = {}
    if _os.getenv("APP_ENV", "development") == "production":
        connect_args["sslmode"] = "require"

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table=VERSION_TABLE,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
