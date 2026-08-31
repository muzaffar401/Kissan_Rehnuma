from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.device_token import DeviceToken


class DeviceTokenRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_farmer(self, farmer_id: int) -> List[DeviceToken]:
        return (
            self.db.query(DeviceToken)
            .filter(DeviceToken.farmer_id == farmer_id)
            .all()
        )

    def register(
        self, farmer_id: int, token: str, platform: str
    ) -> DeviceToken:
        """Idempotent by token: re-registering moves the device to the farmer."""
        device = (
            self.db.query(DeviceToken).filter(DeviceToken.token == token).first()
        )
        if device is None:
            device = DeviceToken(
                farmer_id=farmer_id, token=token, platform=platform
            )
            self.db.add(device)
        else:
            device.farmer_id = farmer_id
            device.platform = platform
        self.db.commit()
        self.db.refresh(device)
        return device

    def delete_by_token(self, token: str) -> bool:
        device: Optional[DeviceToken] = (
            self.db.query(DeviceToken).filter(DeviceToken.token == token).first()
        )
        if device is None:
            return False
        self.db.delete(device)
        self.db.commit()
        return True
