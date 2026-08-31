from sqlalchemy import Column, Integer, String, Boolean
from app.db.base import Base


class Farmer(Base):
    """Full read/write mapping of the shared `farmers` table.

    The table is created by user-auth-service; this service reads it
    and registers new farmers via POST /farmers/register. Column names
    mirror the real schema (`Mobile_Number`, `Address`, `City`); note
    `latitude` is VARCHAR in the DB, hence String here. Coordinates for
    weather lookups live in `farmer_locations` (owned by this service).
    """

    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    email = Column(String(50), nullable=False, unique=True)
    lastname = Column(String(50), nullable=False)
    cnic = Column(String(20), nullable=False, unique=True)
    phone_number = Column("Mobile_Number", String(20), nullable=False, unique=True)
    address = Column("Address", String(100), nullable=False)
    city = Column("City", String(50), nullable=False)
    country = Column(String(50), nullable=False)
    latitude = Column(String(50), nullable=False)
    password_hash = Column(String(255), nullable=False)
    email_verified = Column(Boolean, nullable=False, default=False)
