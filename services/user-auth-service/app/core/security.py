import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from pwdlib import PasswordHash
from jose import jwt

load_dotenv()

password_hash = PasswordHash.recommended()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-key")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRY_MINUTES = int(os.getenv("JWT_EXPIRY_MINUTES", "1440"))


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(minutes=EXPIRY_MINUTES)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

