import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.farmer import Farmer
from app.models.password_reset import PasswordResetOTP
from app.models.signup_otp import SignupOTP

from app.schemas.auth import (
    SignupRequest,
    LoginRequest,
    ForgotPasswordRequest,
    VerifyOTPRequest,
    ResetPasswordRequest,
    RefreshTokenRequest,
    ProfileResponse,
    ProfileUpdateRequest,
)

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    decode_access_token,
)

from app.core.email import send_otp_email


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


def _ensure_farmer_location(db: Session, farmer_id: int, latitude: float, longitude: float):
    """Register farmer location in farmer_locations if not already present.

    Both auth-service and weather-service share the same database,
    so we can directly insert into farmer_locations from here.
    """
    result = db.execute(
        text("SELECT 1 FROM farmer_locations WHERE farmer_id = :fid"),
        {"fid": farmer_id},
    )
    if result.fetchone() is None:
        db.execute(
            text(
                "INSERT INTO farmer_locations (farmer_id, latitude, longitude) "
                "VALUES (:fid, :lat, :lng)"
            ),
            {"fid": farmer_id, "lat": latitude, "lng": longitude},
        )
        db.commit()


# =========================================================
# SIGNUP
# =========================================================

@router.post("/signup")
async def signup(
    user: SignupRequest,
    db: Session = Depends(get_db)
):

    # ---------------------------------------------------------
    # CHECK EMAIL
    # ---------------------------------------------------------

    existing_email = db.query(Farmer).filter(
        Farmer.email == user.email
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # ---------------------------------------------------------
    # CHECK CNIC
    # ---------------------------------------------------------

    existing_cnic = db.query(Farmer).filter(
        Farmer.cnic == user.cnic
    ).first()

    if existing_cnic:
        raise HTTPException(
            status_code=400,
            detail="CNIC already registered"
        )

    # ---------------------------------------------------------
    # CHECK MOBILE
    # ---------------------------------------------------------

    existing_mobile = db.query(Farmer).filter(
        Farmer.Mobile_Number == user.Mobile_Number
    ).first()

    if existing_mobile:
        raise HTTPException(
            status_code=400,
            detail="Mobile number already registered"
        )

    # ---------------------------------------------------------
    # CREATE FARMER
    # ---------------------------------------------------------

    farmer = Farmer(
        name=user.name,
        email=user.email,
        lastname=user.lastname,
        cnic=user.cnic,
        Mobile_Number=user.Mobile_Number,
        Address=user.Address,
        City=user.City,
        country=user.country,
        latitude=user.latitude,
        longitude=user.longitude,
        password_hash=hash_password(user.password),
        email_verified=False
    )

    db.add(farmer)
    db.commit()
    db.refresh(farmer)

    # ---------------------------------------------------------
    # GENERATE SIGNUP OTP & SAVE TO DB
    # ---------------------------------------------------------

    otp = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    signup_otp_record = SignupOTP(
        email=user.email,
        otp=otp,
        expires_at=expires_at,
        is_used=False
    )
    db.add(signup_otp_record)
    db.commit()

    # ---------------------------------------------------------
    # SEND OTP THROUGH GMAIL
    # ---------------------------------------------------------

    await send_otp_email(
        to_email=user.email,
        otp=otp,
        subject="Kissan Rehnuma - Email Verification OTP",
        purpose="email verification"
    )

    return {
        "message": "Farmer registered successfully. OTP sent to email.",
        "farmer_id": farmer.id,
        "email": farmer.email
    }


# =========================================================
# VERIFY SIGNUP OTP
# =========================================================

@router.post("/verify-signup-otp")
def verify_signup_otp(
    request: VerifyOTPRequest,
    db: Session = Depends(get_db)
):

    # ---------------------------------------------------------
    # FIND OTP IN DB
    # ---------------------------------------------------------

    signup_otp_record = db.query(SignupOTP).filter(
        SignupOTP.email == request.email,
        SignupOTP.otp == request.otp,
        SignupOTP.is_used == False
    ).order_by(SignupOTP.id.desc()).first()

    if not signup_otp_record:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP or already used"
        )

    # ---------------------------------------------------------
    # CHECK EXPIRY
    # ---------------------------------------------------------

    if signup_otp_record.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="OTP has expired"
        )

    # ---------------------------------------------------------
    # FIND FARMER
    # ---------------------------------------------------------

    farmer = db.query(Farmer).filter(
        Farmer.email == request.email
    ).first()

    if not farmer:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # ---------------------------------------------------------
    # MARK EMAIL VERIFIED & OTP USED
    # ---------------------------------------------------------

    farmer.email_verified = True
    signup_otp_record.is_used = True

    db.commit()
    db.refresh(farmer)

    # Register location for weather alerts (uses GPS coords from signup)
    _ensure_farmer_location(db, farmer.id, farmer.latitude, farmer.longitude)

    # Auto-login: issue JWT so the user can start using the app immediately
    token_data = {
        "sub": str(farmer.id),
        "email": farmer.email,
        "name": farmer.name
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return {
        "message": "Email verified successfully.",
        "farmer_id": farmer.id,
        "email": farmer.email,
        "email_verified": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


# =========================================================
# LOGIN
# =========================================================

@router.post("/login")
def login(
    user: LoginRequest,
    db: Session = Depends(get_db)
):

    # ---------------------------------------------------------
    # FIND FARMER
    # ---------------------------------------------------------

    farmer = db.query(Farmer).filter(
        Farmer.email == user.email
    ).first()

    if not farmer:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # ---------------------------------------------------------
    # CHECK PASSWORD
    # ---------------------------------------------------------

    password_valid = verify_password(
        user.password,
        farmer.password_hash
    )

    if not password_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # ---------------------------------------------------------
    # CHECK EMAIL VERIFIED
    # ---------------------------------------------------------

    if not farmer.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before login"
        )

    # ---------------------------------------------------------
    # CHECK ACCOUNT ACTIVE
    # ---------------------------------------------------------

    if not getattr(farmer, 'is_active', True):
        raise HTTPException(
            status_code=403,
            detail="Your account has been disabled by the administrator"
        )

    # Ensure location is registered for weather alerts
    _ensure_farmer_location(db, farmer.id, farmer.latitude, farmer.longitude)

    # ---------------------------------------------------------
    # CREATE ACCESS + REFRESH TOKENS
    # ---------------------------------------------------------

    token_data = {
        "sub": str(farmer.id),
        "email": farmer.email,
        "name": farmer.name
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return {
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


# =========================================================
# FORGOT PASSWORD
# =========================================================

@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):

    # ---------------------------------------------------------
    # FIND FARMER
    # ---------------------------------------------------------

    farmer = db.query(Farmer).filter(
        Farmer.email == request.email
    ).first()

    if not farmer:
        raise HTTPException(
            status_code=404,
            detail="Email not registered"
        )

    # ---------------------------------------------------------
    # GENERATE 6 DIGIT OTP
    # ---------------------------------------------------------

    otp = str(random.randint(100000, 999999))

    # OTP valid for 10 minutes
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # ---------------------------------------------------------
    # SAVE OTP
    # ---------------------------------------------------------

    reset_otp = PasswordResetOTP(
        email=request.email,
        otp=otp,
        expires_at=expires_at
    )

    db.add(reset_otp)
    db.commit()

    # ---------------------------------------------------------
    # SEND OTP THROUGH GMAIL
    # ---------------------------------------------------------

    await send_otp_email(
        to_email=request.email,
        otp=otp,
        subject="Kissan Rehnuma - Password Reset OTP",
        purpose="password reset"
    )

    return {
        "message": "OTP sent successfully to your email"
    }


# =========================================================
# VERIFY PASSWORD RESET OTP
# =========================================================

@router.post("/verify-otp")
def verify_otp(
    request: VerifyOTPRequest,
    db: Session = Depends(get_db)
):

    # ---------------------------------------------------------
    # FIND LATEST OTP
    # ---------------------------------------------------------

    reset_otp = db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == request.email,
        PasswordResetOTP.otp == request.otp
    ).order_by(
        PasswordResetOTP.id.desc()
    ).first()

    if not reset_otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP"
        )

    # ---------------------------------------------------------
    # CHECK OTP EXPIRY
    # ---------------------------------------------------------

    if reset_otp.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="OTP has expired"
        )

    return {
        "message": "OTP verified successfully"
    }


# =========================================================
# RESET PASSWORD
# =========================================================

@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):

    # ---------------------------------------------------------
    # CHECK NEW PASSWORD AND CONFIRM PASSWORD
    # ---------------------------------------------------------

    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match"
        )

    # ---------------------------------------------------------
    # FIND LATEST OTP
    # ---------------------------------------------------------

    reset_otp = db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == request.email,
        PasswordResetOTP.otp == request.otp
    ).order_by(
        PasswordResetOTP.id.desc()
    ).first()

    if not reset_otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP"
        )

    # ---------------------------------------------------------
    # CHECK OTP EXPIRY
    # ---------------------------------------------------------

    if reset_otp.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="OTP has expired"
        )

    # ---------------------------------------------------------
    # FIND FARMER
    # ---------------------------------------------------------

    farmer = db.query(Farmer).filter(
        Farmer.email == request.email
    ).first()

    if not farmer:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # ---------------------------------------------------------
    # UPDATE PASSWORD
    # ---------------------------------------------------------

    farmer.password_hash = hash_password(
        request.new_password
    )

    # ---------------------------------------------------------
    # DELETE USED OTP
    # ---------------------------------------------------------

    db.delete(reset_otp)

    db.commit()

    return {
        "message": "Password reset successfully"
    }


# =========================================================
# REFRESH TOKEN
# =========================================================

@router.post("/refresh")
def refresh_token(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Exchange a valid refresh token for a new access + refresh token pair."""

    # ---------------------------------------------------------
    # VALIDATE REFRESH TOKEN
    # ---------------------------------------------------------

    payload = verify_refresh_token(request.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token"
        )

    # ---------------------------------------------------------
    # FIND FARMER
    # ---------------------------------------------------------

    farmer_id = payload.get("sub")
    farmer = db.query(Farmer).filter(Farmer.id == int(farmer_id)).first()

    if not farmer:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    # ---------------------------------------------------------
    # ISSUE NEW TOKEN PAIR (rotation)
    # ---------------------------------------------------------

    token_data = {
        "sub": str(farmer.id),
        "email": farmer.email,
        "name": farmer.name
    }
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


# =========================================================
# Helper: extract farmer_id from Bearer token
# =========================================================

def _get_farmer_id_from_request(request: Request) -> int:
    """Extract and validate farmer_id from Authorization header."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = auth_header[7:]  # strip "Bearer "
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    farmer_id = payload.get("sub")
    if not farmer_id:
        raise HTTPException(status_code=401, detail="Token missing user ID")
    return int(farmer_id)


# =========================================================
# GET /auth/profile  (protected)
# =========================================================

@router.get("/profile")
def get_profile(
    request: Request,
    db: Session = Depends(get_db),
):
    """Get the authenticated farmer's profile from the database."""
    farmer_id = _get_farmer_id_from_request(request)

    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    return {
        "id": farmer.id,
        "name": farmer.name,
        "lastname": farmer.lastname,
        "email": farmer.email,
        "cnic": farmer.cnic,
        "mobile_number": farmer.Mobile_Number,
        "address": farmer.Address,
        "city": farmer.City,
        "country": farmer.country,
    }


# =========================================================
# PUT /auth/profile  (protected)
# =========================================================

@router.put("/profile")
def update_profile(
    request: Request,
    updates: ProfileUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update the authenticated farmer's profile fields."""
    farmer_id = _get_farmer_id_from_request(request)

    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    # Apply only non-None fields
    if updates.name is not None:
        farmer.name = updates.name
    if updates.lastname is not None:
        farmer.lastname = updates.lastname
    if updates.city is not None:
        farmer.City = updates.city
    if updates.country is not None:
        farmer.country = updates.country
    if updates.address is not None:
        farmer.Address = updates.address
    if updates.mobile_number is not None:
        farmer.Mobile_Number = updates.mobile_number

    db.commit()
    db.refresh(farmer)

    return {
        "message": "Profile updated successfully",
        "id": farmer.id,
        "name": farmer.name,
        "lastname": farmer.lastname,
        "email": farmer.email,
        "city": farmer.City,
        "country": farmer.country,
    }
