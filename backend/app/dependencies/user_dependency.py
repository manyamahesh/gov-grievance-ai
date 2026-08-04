from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import os
from dotenv import load_dotenv

from app.services.auth_service import SECRET_KEY, ALGORITHM, decode_jwt_token

security = HTTPBearer(auto_error=False)


def get_current_citizen(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Dependency validating citizen JWT from httpOnly cookie or Authorization header."""
    token = request.cookies.get("citizen_access_token")
    
    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Citizen login required to perform this action"
        )

    try:
        payload = decode_jwt_token(token)
        if payload.get("role") != "citizen":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token role for citizen authentication"
            )

        user_id = payload.get("user_id") or payload.get("sub")
        username = payload.get("username") or payload.get("sub")

        if not user_id or not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims"
            )

        return {
            "user_id": user_id,
            "username": username,
            "role": "citizen"
        }

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please log in again."
        )
