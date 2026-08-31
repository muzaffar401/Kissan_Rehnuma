from sqlalchemy import Column, Integer, String
from app.db.base import Base


class Crop(Base):
    __tablename__ = "crops"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Standardized name (e.g. always "Wheat") — raw variants are mapped
    # by the ingestion layer before insert.
    name = Column(String(100), nullable=False, unique=True)
