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

from app.core.email import send_otp_email


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

        password_hash=hash_password(user.password),

        # Email initially NOT verified
        email_verified=False
    )

    db.add(farmer)
    db.commit()
    db.refresh(farmer)

    # ---------------------------------------------------------
    # GENERATE SIGNUP OTP
    # ---------------------------------------------------------

    otp = str(random.randint(100000, 999999))

    # OTP valid for 10 minutes
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    signup_otps[user.email] = {
        "otp": otp,
        "expires_at": expires_at
    }

    # ---------------------------------------------------------
    # SEND OTP THROUGH GMAIL
    # ---------------------------------------------------------

    await send_otp_email(
        to_email=user.email,
        otp=otp,
        subject="Kissan Rehnuma - Email Verification OTP",
        purpose="email verification"
    )

    # TEMPORARY DEBUG
    # You can remove these prints later.
    print("================================")
    print(f"SIGNUP OTP FOR {user.email}: {otp}")
    print("================================")

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
    # GET OTP
    # ---------------------------------------------------------

    otp_data = signup_otps.get(request.email)

    if not otp_data:
        raise HTTPException(
            status_code=400,
            detail="OTP not found or expired"
        )

    # ---------------------------------------------------------
    # CHECK EXPIRY
    # ---------------------------------------------------------

    if otp_data["expires_at"] < datetime.utcnow():

        del signup_otps[request.email]

        raise HTTPException(
            status_code=400,
            detail="OTP has expired"
        )

    # ---------------------------------------------------------
    # CHECK OTP
    # ---------------------------------------------------------

    if otp_data["otp"] != request.otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP"
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
    # MARK EMAIL VERIFIED
    # ---------------------------------------------------------

    farmer.email_verified = True

    db.commit()
    db.refresh(farmer)

    # ---------------------------------------------------------
    # DELETE OTP
    # ---------------------------------------------------------

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
    # CREATE ACCESS TOKEN
    # ---------------------------------------------------------

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

    # TEMPORARY DEBUG
    # You can remove this later.
    print("================================")
    print(f"PASSWORD RESET OTP FOR {request.email}: {otp}")
    print("================================")

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