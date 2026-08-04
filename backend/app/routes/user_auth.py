from fastapi import APIRouter, HTTPException, Response, Request, Depends, status
from pydantic import BaseModel, Field
from typing import Optional

from app.services.user_service import (
    create_citizen_user,
    verify_password,
    get_user_by_username
)
from app.services.auth_service import (
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.dependencies.user_dependency import get_current_citizen
from app.config import COOKIE_SAMESITE, COOKIE_SECURE


router = APIRouter()


class CitizenRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique citizen username")
    password: str = Field(..., min_length=6, max_length=100, description="Account password")


class CitizenLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=100)


@router.post("/signup", summary="Citizen Signup", description="Registers a new citizen user account and sets httpOnly authentication cookie.")
def citizen_signup(request: CitizenRegisterRequest, response: Response):
    try:
        user_info = create_citizen_user(request.username, request.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    token_data = {
        "sub": user_info["username"],
        "user_id": user_info["user_id"],
        "username": user_info["username"],
        "role": "citizen"
    }

    citizen_token = create_access_token(token_data)

    response.set_cookie(
        key="citizen_access_token",
        value=citizen_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE
    )


    return {
        "status": "success",
        "message": "Citizen registered successfully",
        "user": {
            "user_id": user_info["user_id"],
            "username": user_info["username"],
            "role": "citizen"
        },
        "token": citizen_token
    }


@router.post("/login", summary="Citizen Login", description="Authenticates citizen and sets httpOnly citizen_access_token cookie.")
def citizen_login(request: CitizenLoginRequest, response: Response):
    user_doc = get_user_by_username(request.username)
    if not user_doc or not verify_password(request.password, user_doc.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    token_data = {
        "sub": user_doc["username"],
        "user_id": user_doc["user_id"],
        "username": user_doc["username"],
        "role": "citizen"
    }

    citizen_token = create_access_token(token_data)

    response.set_cookie(
        key="citizen_access_token",
        value=citizen_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE
    )


    return {
        "status": "success",
        "user": {
            "user_id": user_doc["user_id"],
            "username": user_doc["username"],
            "role": "citizen"
        },
        "token": citizen_token
    }


@router.post("/logout", summary="Citizen Logout", description="Clears citizen authentication cookie.")
def citizen_logout(response: Response):
    response.delete_cookie("citizen_access_token")
    return {"message": "Logged out successfully"}


@router.get("/me", summary="Current Citizen Profile", description="Returns authenticated citizen user profile.")
def get_current_citizen_profile(current_user: dict = Depends(get_current_citizen)):
    return current_user
