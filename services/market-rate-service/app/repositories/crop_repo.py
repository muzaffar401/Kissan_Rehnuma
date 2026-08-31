from typing import Optional

from sqlalchemy.orm import Session

from app.models.crop import Crop


class CropRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, name: str) -> Optional[Crop]:
        return self.db.query(Crop).filter(Crop.name == name).first()

    def get_or_create(self, name: str) -> Crop:
        crop = self.get(name)
        if crop is None:
            crop = Crop(name=name)
            self.db.add(crop)
            self.db.commit()
            self.db.refresh(crop)
        return crop
