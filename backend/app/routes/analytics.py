from fastapi import APIRouter
from app.database.connection import conversations_collection, tickets_collection
from app.dependencies.auth_dependency import verify_token
from fastapi import Depends
router = APIRouter()


@router.get("/analytics/overview")
def analytics_overview(user: str = Depends(verify_token)):

    total_complaints = conversations_collection.count_documents({})

    high_priority_count = conversations_collection.count_documents(
        {"priority": "HIGH"}
    )

    # Department breakdown
    department_pipeline = [
    {
        "$group": {
            "_id": {
                "$ifNull": ["$department", "Unassigned"]
            },
            "count": {"$sum": 1}
        }
    }
]
    department_stats = list(
        conversations_collection.aggregate(department_pipeline)
    )

    # Ticket status breakdown
    status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_stats = list(
        tickets_collection.aggregate(status_pipeline)
    )

    return {
        "total_complaints": total_complaints,
        "high_priority_complaints": high_priority_count,
        "complaints_by_department": department_stats,
        "tickets_by_status": status_stats
    }