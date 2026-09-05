import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import DATABASE_URL

# Neon (and most managed Postgres) requires SSL; a self-hosted Postgres
# container (VPS/docker-compose) runs without SSL. Gate on the DB host so
# the same image works in both environments.
connect_args = {}
if "neon.tech" in DATABASE_URL:
    connect_args["sslmode"] = "require"

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
