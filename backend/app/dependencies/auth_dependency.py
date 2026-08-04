from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.services.auth_service import decode_jwt_token

security = HTTPBearer(auto_error=False)

def verify_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Verify admin access token exclusively from admin_access_token httpOnly cookie or Bearer header."""
    token = request.cookies.get("admin_access_token")
    
    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication token missing"
        )

    try:
        payload = decode_jwt_token(token)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )

        role = payload.get("role")
        if role not in ["super_admin", "department_admin"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token role for admin authentication"
            )

        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims"
            )

        return {
            "username": username,
            "role": role,
            "department": payload.get("department", "All")
        }

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin token"
        )


def require_super_admin(user: dict = Depends(verify_token)) -> dict:
    """Dependency ensuring caller has super_admin role."""
    if user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires super admin privileges"
        )
    return user