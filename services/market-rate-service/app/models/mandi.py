from sqlalchemy import Column, Integer, String
from app.db.base import Base


class Mandi(Base):
    __tablename__ = "mandis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
