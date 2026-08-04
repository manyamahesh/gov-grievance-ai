from fastapi import APIRouter, Depends
from app.database.connection import users_collection, conversations_collection
from app.dependencies.auth_dependency import verify_token

router = APIRouter()


@router.get("/admin/users", summary="Get Registered Citizens", description="Admin endpoint listing registered citizens and their grievance complaint counts.")
def get_registered_citizens(admin_user: dict = Depends(verify_token)):
    if not hasattr(users_collection, "find"):
        return {"total_users": 0, "users": []}

    users_list = list(users_collection.find({}, {"_id": 0, "password_hash": 0}))

    result = []
    for u in users_list:
        user_id = u.get("user_id")
        # Count complaints owned by this citizen
        count = conversations_collection.count_documents({"user_id": user_id}) if user_id else 0
        result.append({
            "user_id": user_id,
            "username": u.get("username"),
            "role": u.get("role", "citizen"),
            "created_at": u.get("created_at"),
            "complaint_count": count
        })

    return {
        "total_users": len(result),
        "users": result
    }
