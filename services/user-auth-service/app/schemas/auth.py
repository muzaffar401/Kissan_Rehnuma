
from pydantic import BaseModel, EmailStr
from typing import Optional


# =========================================================
# SIGNUP
# =========================================================

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    lastname: str
    cnic: str
    Mobile_Number: str
    Address: str
    City: str
    country: str
    latitude: str
    longitude: str
    password: str


# =========================================================
# LOGIN
# =========================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# =========================================================
# FORGOT PASSWORD
# =========================================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


# =========================================================
# VERIFY OTP
# =========================================================

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


# =========================================================
# RESET PASSWORD
# =========================================================

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str
    confirm_password: str

class VerifySignupOTPRequest(BaseModel):
    email: EmailStr
    otp: str


# =========================================================
# REFRESH TOKEN
# =========================================================

class RefreshTokenRequest(BaseModel):
    refresh_token: str


# =========================================================
# PROFILE
# =========================================================

class ProfileResponse(BaseModel):
    id: int
    name: str
    lastname: str
    email: str
    cnic: str
    mobile_number: str
    address: str
    city: str
    country: str

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    lastname: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    mobile_number: Optional[str] = None
