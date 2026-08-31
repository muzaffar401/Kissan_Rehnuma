from pydantic import BaseModel


class DeviceRegisterRequest(BaseModel):
    farmer_id: int
    token: str          # FCM registration token from the mobile app
    platform: str = "android"


class DeviceRegisterResponse(BaseModel):
    farmer_id: int
    platform: str
    registered: bool = True
