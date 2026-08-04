from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File, status
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.database.connection import tickets_collection, conversations_collection
from app.dependencies.auth_dependency import verify_token
from app.services.ticket_service import check_and_update_sla_escalations
from app.services.email_service import send_email_notification
from app.services.upload_service import save_evidence_file

router = APIRouter()


class StatusUpdateRequest(BaseModel):
    status: str = Field(..., description="New status (OPEN, IN_PROGRESS, RESOLVED, REJECTED, ESCALATED)")
    notes: Optional[str] = Field(None, max_length=500, description="Optional status change notes")


class FeedbackRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Satisfaction rating from 1 to 5")
    comment: Optional[str] = Field(None, max_length=1000, description="Optional citizen comment")
    session_id: Optional[str] = Field(None, description="Session ID of the conversation")


@router.put("/ticket/{ticket_id}/status", summary="Update Ticket Status", description="Update status of a ticket with RBAC department checks and email notification.")
def update_ticket_status(
    ticket_id: str,
    request: StatusUpdateRequest,
    user: dict = Depends(verify_token)
):
    valid_statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED", "ESCALATED"]
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status value")

    ticket = tickets_collection.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # RBAC Enforcement: department admins can only update tickets in their department
    if user.get("role") == "department_admin" and user.get("department") != "All":
        if ticket.get("department") != user.get("department"):
            raise HTTPException(
                status_code=403,
                detail=f"Not authorized to update tickets outside '{user.get('department')}'"
            )

    update_payload = {
        "status": request.status,
        "updated_at": datetime.utcnow(),
        "updated_by": user.get("username")
    }
    if request.notes:
        update_payload["notes"] = request.notes

    tickets_collection.update_one(
        {"ticket_id": ticket_id},
        {"$set": update_payload}
    )

    # Notify via email
    send_email_notification(
        to_email="citizen-notify@gov-grievance.gov",
        subject=f"Ticket #{ticket_id[:8]} Status Updated to {request.status}",
        body=f"Your ticket #{ticket_id} status has been updated to: {request.status}."
    )

    return {
        "ticket_id": ticket_id,
        "updated_status": request.status,
        "message": "Ticket status updated successfully"
    }


@router.get("/tickets", summary="Get All Tickets", description="Retrieve paginated tickets with department filtering based on admin role and SLA check.")
def get_all_tickets(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    user: dict = Depends(verify_token)
):
    # Run SLA escalation check on dashboard query
    check_and_update_sla_escalations()

    query = {}

    # Role-based restriction: Department admin only sees their department
    if user.get("role") == "department_admin" and user.get("department") != "All":
        query["department"] = user.get("department")
    elif department:
        query["department"] = department

    if status:
        query["status"] = status

    tickets = list(
        tickets_collection.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    # Check SLA escalation flag on returned items dynamically
    now = datetime.utcnow()
    for t in tickets:
        if t.get("sla_deadline") and isinstance(t.get("sla_deadline"), datetime):
            if now > t["sla_deadline"] and t.get("status") in ["OPEN", "IN_PROGRESS"]:
                t["is_escalated"] = True

    total_count = tickets_collection.count_documents(query)

    return {
        "total_tickets": total_count,
        "returned": len(tickets),
        "tickets": tickets
    }


@router.post("/ticket/{ticket_id}/feedback", summary="Submit Citizen Feedback", description="Allows citizens to post 1-5 rating & feedback for resolved tickets.")
def submit_ticket_feedback(ticket_id: str, request: FeedbackRequest):
    ticket = tickets_collection.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    feedback_data = {
        "rating": request.rating,
        "comment": request.comment,
        "submitted_at": datetime.utcnow()
    }

    tickets_collection.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"feedback": feedback_data}}
    )

    if request.session_id:
        conversations_collection.update_one(
            {"session_id": request.session_id},
            {"$set": {"feedback": feedback_data}}
        )

    return {"message": "Feedback recorded successfully", "feedback": feedback_data}


@router.post("/upload/evidence", summary="Upload Photo or File Evidence", description="Uploads file evidence for complaints and returns file URL.")
async def upload_evidence(file: UploadFile = File(...)):
    url = await save_evidence_file(file)
    return {"filename": file.filename, "url": url}