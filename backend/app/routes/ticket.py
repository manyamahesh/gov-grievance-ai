from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional

from app.database.connection import tickets_collection
from app.dependencies.auth_dependency import verify_token

router = APIRouter()


class StatusUpdateRequest(BaseModel):
    status: str


# =========================
# UPDATE TICKET STATUS (PROTECTED)
# =========================
@router.put("/ticket/{ticket_id}/status")
def update_ticket_status(
    ticket_id: str,
    request: StatusUpdateRequest,
    username: str = Depends(verify_token)
):

    valid_statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"]

    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status value")

    result = tickets_collection.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"status": request.status}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return {
        "ticket_id": ticket_id,
        "updated_status": request.status,
        "message": "Ticket status updated successfully"
    }


# =========================
# GET ALL TICKETS (PROTECTED + PAGINATED)
# =========================
@router.get("/tickets")
def get_all_tickets(
    skip: int = 0,
    limit: int = 10,
    status: Optional[str] = Query(None),
    username: str = Depends(verify_token)
):

    query = {}

    if status:
        query["status"] = status

    tickets = list(
        tickets_collection.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    total_count = tickets_collection.count_documents(query)

    return {
        "total_tickets": total_count,
        "returned": len(tickets),
        "tickets": tickets
    }