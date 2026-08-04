import uuid
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import bcrypt

from app.database.connection import users_collection

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Hash password using bcrypt directly."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Fetch user document by username."""
    if hasattr(users_collection, "find_one"):
        return users_collection.find_one({"username": username.strip()})
    return None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch user document by user_id."""
    if hasattr(users_collection, "find_one"):
        return users_collection.find_one({"user_id": user_id})
    return None


def create_citizen_user(username: str, password: str) -> Dict[str, Any]:
    """Create new citizen user record."""
    clean_username = username.strip()
    existing = get_user_by_username(clean_username)
    if existing:
        raise ValueError("Username already registered")

    user_id = str(uuid.uuid4())
    password_hash = hash_password(password)
    now = datetime.utcnow()

    user_doc = {
        "user_id": user_id,
        "username": clean_username,
        "password_hash": password_hash,
        "role": "citizen",
        "created_at": now
    }

    users_collection.insert_one(user_doc)
    
    return {
        "user_id": user_id,
        "username": clean_username,
        "role": "citizen",
        "created_at": now
    }
