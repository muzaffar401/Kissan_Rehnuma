from typing import Optional

from sqlalchemy.orm import Session

from app.models.mandi import Mandi


class MandiRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, name: str, city: str) -> Optional[Mandi]:
        return (
            self.db.query(Mandi)
            .filter(Mandi.name == name, Mandi.city == city)
            .first()
        )

    def get_or_create(self, name: str, city: str) -> Mandi:
        mandi = self.get(name, city)
        if mandi is None:
            mandi = Mandi(name=name, city=city)
            self.db.add(mandi)
            self.db.commit()
            self.db.refresh(mandi)
        return mandi
