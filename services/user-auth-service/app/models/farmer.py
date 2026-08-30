from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Farmer(Base):
    __tablename__ = 'farmers'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    email = Column(String(50), nullable=False, unique=True)
    lastname = Column(String(50), nullable=False)
    cnic = Column(String(20), nullable=False, unique=True)
    Mobile_Number = Column(String(20), nullable=False, unique=True)
    Address = Column(String(100), nullable=False, unique=True)
    City = Column(String(50), nullable=False)
    country = Column(String(50), nullable=False)
    latitude = Column(String(50), nullable=False)
    password_hash = Column(String(255), nullable=False)
    email_verified = Column(Boolean, nullable=False, default=False)