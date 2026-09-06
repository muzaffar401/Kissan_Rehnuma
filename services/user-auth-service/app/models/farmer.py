from sqlalchemy import Column, Integer, String, Boolean, Float
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Farmer(Base):
    __tablename__ = 'farmers'

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(50), nullable=False)
    email = Column(String(50), nullable=False, unique=True)
    lastname = Column(String(50), nullable=True, default="")

    cnic = Column(String(20), nullable=False, unique=True)

    Mobile_Number = Column(
        String(20),
        nullable=False,
        unique=True
    )

    Address = Column(
        String(100),
        nullable=True,
        default=""
    )

    City = Column(String(50), nullable=True, default="")

    country = Column(String(50), nullable=True, default="Pakistan")

    latitude = Column(Float, nullable=True, default=0.0)
    longitude = Column(Float, nullable=True, default=0.0)

    password_hash = Column(String(255), nullable=False)

    email_verified = Column(
        Boolean,
        nullable=False,
        default=False
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True
    )