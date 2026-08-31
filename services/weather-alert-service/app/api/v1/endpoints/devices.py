from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.repositories.device_token_repo import DeviceTokenRepository
from app.repositories.farmer_repo import FarmerRepository
from app.schemas.device import DeviceRegisterRequest, DeviceRegisterResponse

router = APIRouter()


@router.post("/devices/register", response_model=DeviceRegisterResponse)
def register_device(payload: DeviceRegisterRequest, db: Session = Depends(get_db)):
    """Mobile app calls this with its FCM token so alerts reach the lock screen."""
    farmer = FarmerRepository(db).get_by_id(payload.farmer_id)
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    device = DeviceTokenRepository(db).register(
        payload.farmer_id, payload.token, payload.platform
    )
    return DeviceRegisterResponse(
        farmer_id=device.farmer_id, platform=device.platform
    )


@router.delete("/devices/unregister")
def unregister_device(token: str, db: Session = Depends(get_db)):
    deleted = DeviceTokenRepository(db).delete_by_token(token)
    if not deleted:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"deleted": True}
