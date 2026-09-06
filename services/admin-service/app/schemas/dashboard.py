"""Dashboard response schemas."""

from pydantic import BaseModel


class TodayStats(BaseModel):
    new_farmers: int = 0
    crop_scans: int = 0
    animal_scans: int = 0
    voice_sessions: int = 0
    complaints: int = 0


class DashboardResponse(BaseModel):
    total_farmers: int = 0
    total_crop_scans: int = 0
    total_animal_scans: int = 0
    total_voice_sessions: int = 0
    total_complaints: int = 0
    today: TodayStats = TodayStats()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
