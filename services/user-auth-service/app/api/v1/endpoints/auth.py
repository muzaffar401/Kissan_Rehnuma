import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.farmer import Farmer
from app.models.password_reset import PasswordResetOTP

from app.schemas.auth import (
    SignupRequest,
    LoginRequest,
    ForgotPasswordRequest,
    VerifyOTPRequest,
    ResetPasswordRequest
)

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# =========================================================
# SIGNUP OTP - TEMPORARY STORAGE
# =========================================================

signup_otps = {}


# =========================================================
# SIGNUP
# =========================================================

@router.post("/signup")
def signup(
    user: SignupRequest,
    db: Session = Depends(get_db)
):

    existing_email = db.query(Farmer).filter(
        Farmer.email == user.email
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    existing_cnic = db.query(Farmer).filter(
        Farmer.cnic == user.cnic
    ).first()

    if existing_cnic:
        raise HTTPException(
            status_code=400,
            detail="CNIC already registered"
        )

    existing_mobile = db.query(Farmer).filter(
        Farmer.Mobile_Number == user.Mobile_Number
    ).first()

    if existing_mobile:
        raise HTTPException(
            status_code=400,
            detail="Mobile number already registered"
        )

    # Create farmer
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

        password_hash=hash_password(user.password),

        # Email initially NOT verified
        email_verified=False
    )

    db.add(farmer)
    db.commit()
    db.refresh(farmer)

    # Generate signup OTP
    otp = str(random.randint(100000, 999999))

    # OTP valid for 10 minutes
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    signup_otps[user.email] = {
        "otp": otp,
        "expires_at": expires_at
    }

    # TEMPORARY
    # Later we will send this through email
    print(f"================================")
    print(f"SIGNUP OTP FOR {user.email}: {otp}")
    print(f"================================")

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

    otp_data = signup_otps.get(request.email)

    if not otp_data:
        raise HTTPException(
            status_code=400,
            detail="OTP not found or expired"
        )

    # Check expiry
    if otp_data["expires_at"] < datetime.utcnow():

        del signup_otps[request.email]

        raise HTTPException(
            status_code=400,
            detail="OTP has expired"
        )

    # Check OTP
    if otp_data["otp"] != request.otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP"
        )

    # Find farmer
    farmer = db.query(Farmer).filter(
        Farmer.email == request.email
    ).first()

    if not farmer:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Mark email verified
    farmer.email_verified = True

    db.commit()
    db.refresh(farmer)

    # Delete OTP after successful verification
    del signup_otps[request.email]

    return {
        "message": "Email verified successfully. You can now login.",
        "email": farmer.email,
        "email_verified": True
    }


# =========================================================
# LOGIN
# =========================================================

@router.post("/login")
def login(
    user: LoginRequest,
    db: Session = Depends(get_db)
):

    farmer = db.query(Farmer).filter(
        Farmer.email == user.email
    ).first()

    if not farmer:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    password_valid = verify_password(
        user.password,
        farmer.password_hash
    )

    if not password_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Email verification check
    if not farmer.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before login"
        )

    access_token = create_access_token({
        "sub": str(farmer.id),
        "email": farmer.email
    })

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer"
    }


# =========================================================
# FORGOT PASSWORD
# =========================================================

@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):

    farmer = db.query(Farmer).filter(
        Farmer.email == request.email
    ).first()

    if not farmer:
        raise HTTPException(
            status_code=404,
            detail="Email not registered"
        )

    # Generate 6 digit OTP
    otp = str(random.randint(100000, 999999))

    # OTP valid for 10 minutes
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    reset_otp = PasswordResetOTP(
        email=request.email,
        otp=otp,
        expires_at=expires_at
    )

    db.add(reset_otp)
    db.commit()

    # TEMPORARY
    # Later this OTP will be sent through email
    print(f"PASSWORD RESET OTP: {otp}")

    return {
        "message": "OTP generated successfully"
    }


# =========================================================
# VERIFY PASSWORD RESET OTP
# =========================================================

@router.post("/verify-otp")
def verify_otp(
    request: VerifyOTPRequest,
    db: Session = Depends(get_db)
):

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

    # Check new password and confirm password
    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match"
        )

    # Find latest OTP
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

    # Check OTP expiry
    if reset_otp.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="OTP has expired"
        )

    # Find farmer
    farmer = db.query(Farmer).filter(
        Farmer.email == request.email
    ).first()

    if not farmer:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Update password
    farmer.password_hash = hash_password(
        request.new_password
    )

    # Delete used OTP
    db.delete(reset_otp)

    db.commit()

    return {
        "message": "Password reset successfully"
    }