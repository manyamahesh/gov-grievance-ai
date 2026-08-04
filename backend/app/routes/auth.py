from fastapi import APIRouter, HTTPException, Response, Request, Depends, status
from pydantic import BaseModel, Field
from typing import Optional

from app.services.auth_service import (
    authenticate_admin,
    create_access_token,
    create_refresh_token,
    decode_jwt_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS
)
from app.dependencies.auth_dependency import verify_token
from app.config import COOKIE_SAMESITE, COOKIE_SECURE

router = APIRouter()




class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=100)


@router.post("/admin/login", summary="Admin Login", description="Authenticates admin user and sets httpOnly admin_access_token and admin_refresh_token cookies.")
def admin_login(request: LoginRequest, response: Response):
    user_info = authenticate_admin(request.username, request.password)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    token_data = {
        "sub": user_info["username"],
        "role": user_info["role"],
        "department": user_info["department"]
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Set distinct httpOnly admin cookies
    response.set_cookie(
        key="admin_access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE
    )

    response.set_cookie(
        key="admin_refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE
    )


    return {
        "status": "success",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_info
    }


@router.post("/admin/refresh", summary="Refresh Admin Access Token", description="Uses httpOnly admin_refresh_token cookie to issue a new admin_access_token.")
def refresh_token(request: Request, response: Response):
    refresh_tok = request.cookies.get("admin_refresh_token")
    if not refresh_tok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin refresh token missing"
        )

    try:
        payload = decode_jwt_token(refresh_tok)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )

        token_data = {
            "sub": payload["sub"],
            "role": payload.get("role", "super_admin"),
            "department": payload.get("department", "All")
        }

        new_access_token = create_access_token(token_data)

        response.set_cookie(
            key="admin_access_token",
            value=new_access_token,
            httponly=True,
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            samesite=COOKIE_SAMESITE,
            secure=COOKIE_SECURE
        )


        return {"status": "success", "access_token": new_access_token}

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin refresh token"
        )


@router.get("/admin/me", summary="Get Current Admin Profile", description="Returns current authenticated admin profile.")
def get_current_user(user: dict = Depends(verify_token)):
    return user


@router.post("/admin/logout", summary="Admin Logout", description="Clears admin authentication cookies.")
def admin_logout(response: Response):
    response.delete_cookie("admin_access_token")
    response.delete_cookie("admin_refresh_token")
    return {"message": "Admin logged out successfully"}