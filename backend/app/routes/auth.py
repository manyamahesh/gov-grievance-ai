from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.auth_service import authenticate_admin, create_access_token

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/admin/login")
def admin_login(request: LoginRequest):

    if not authenticate_admin(request.username, request.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": request.username})

    return {
        "access_token": token,
        "token_type": "bearer"
    }