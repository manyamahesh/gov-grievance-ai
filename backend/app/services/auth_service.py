from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt, JWTError
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey_change_in_production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7))

# Known Admin Users & Roles
ADMIN_USERS = {
    "admin": {"password": "admin123", "role": "super_admin", "department": "All"},
    "water_admin": {"password": "admin123", "role": "department_admin", "department": "Water Supply Department"},
    "elec_admin": {"password": "admin123", "role": "department_admin", "department": "Electricity Board"},
    "pwd_admin": {"password": "admin123", "role": "department_admin", "department": "Public Works Department"},
    "san_admin": {"password": "admin123", "role": "department_admin", "department": "Sanitation Department"}
}


def authenticate_admin(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate admin username/password and return user details."""
    user = ADMIN_USERS.get(username)
    if user and user["password"] == password:
        return {
            "username": username,
            "role": user["role"],
            "department": user["department"]
        }
    return None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create short-lived JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create long-lived JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_jwt_token(token: str) -> Dict[str, Any]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid or expired token: {e}")
