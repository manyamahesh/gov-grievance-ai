import json
import logging
from fastapi import APIRouter, Depends
from app.database.connection import conversations_collection, tickets_collection, redis_client
from app.dependencies.auth_dependency import verify_token

router = APIRouter()
logger = logging.getLogger(__name__)

ANALYTICS_CACHE_KEY = "analytics:overview_data"
CACHE_TTL_SECONDS = 60


@router.get("/analytics/overview", summary="Analytics Overview", description="Provides aggregated system statistics with Redis 60-second caching.")
def analytics_overview(user: dict = Depends(verify_token)):
    # Department filtering for department admins
    user_dept = user.get("department")
    dept_filter = {}
    if user.get("role") == "department_admin" and user_dept and user_dept != "All":
        dept_filter = {"department": user_dept}

    cache_key = f"{ANALYTICS_CACHE_KEY}:{user_dept or 'all'}"

    # Try reading from Redis cache
    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                logger.info("Serving analytics from Redis cache")
                return json.loads(cached_data)
        except Exception as e:
            logger.warning(f"Redis get failed: {e}")

    # Compute MongoDB aggregation statistics
    total_complaints = conversations_collection.count_documents(dept_filter)

    high_priority_filter = {"priority": "HIGH"}
    high_priority_filter.update(dept_filter)
    high_priority_count = conversations_collection.count_documents(high_priority_filter)

    # Department breakdown
    dept_match = {"$match": dept_filter} if dept_filter else {"$match": {}}
    department_pipeline = [
        dept_match,
        {
            "$group": {
                "_id": {"$ifNull": ["$department", "Unclassified"]},
                "count": {"$sum": 1}
            }
        }
    ]
    department_stats = list(conversations_collection.aggregate(department_pipeline))

    # Priority breakdown
    priority_pipeline = [
        dept_match,
        {
            "$group": {
                "_id": {"$ifNull": ["$priority", "MEDIUM"]},
                "count": {"$sum": 1}
            }
        }
    ]
    priority_stats = list(conversations_collection.aggregate(priority_pipeline))

    # Ticket status breakdown
    ticket_match = {"$match": {"department": user_dept}} if (dept_filter and user_dept) else {"$match": {}}
    status_pipeline = [
        ticket_match,
        {"$group": {"_id": {"$ifNull": ["$status", "OPEN"]}, "count": {"$sum": 1}}}
    ]
    status_stats = list(tickets_collection.aggregate(status_pipeline))

    result = {
        "total_complaints": total_complaints,
        "high_priority_complaints": high_priority_count,
        "complaints_by_department": department_stats,
        "complaints_by_priority": priority_stats,
        "tickets_by_status": status_stats,
        "cached": False
    }

    # Store result in Redis cache
    if redis_client:
        try:
            cache_payload = result.copy()
            cache_payload["cached"] = True
            redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(cache_payload))
        except Exception as e:
            logger.warning(f"Redis set failed: {e}")

    return result