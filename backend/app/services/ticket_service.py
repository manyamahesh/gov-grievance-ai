from datetime import datetime, timedelta
import uuid
from typing import Optional

from app.database.connection import tickets_collection
from app.services.email_service import send_email_notification


def compute_sla_deadline(priority: str, created_at: datetime) -> datetime:
    """Compute SLA deadline based on priority."""
    p_upper = priority.upper()
    if p_upper == "HIGH":
        return created_at + timedelta(hours=24)
    elif p_upper == "MEDIUM":
        return created_at + timedelta(hours=48)
    else:
        return created_at + timedelta(hours=72)


def create_ticket(
    session_id: str,
    message: str,
    language: str,
    sentiment: str,
    priority: str,
    department: str
) -> str:
    ticket_id = str(uuid.uuid4())
    now = datetime.utcnow()
    sla_deadline = compute_sla_deadline(priority, now)

    ticket_data = {
        "ticket_id": ticket_id,
        "session_id": session_id,
        "message": message,
        "language": language,
        "sentiment": sentiment,
        "priority": priority.upper(),
        "department": department,
        "status": "OPEN",
        "is_escalated": False,
        "created_at": now,
        "sla_deadline": sla_deadline
    }

    tickets_collection.insert_one(ticket_data)

    # Notify admin via email
    send_email_notification(
        to_email=f"admin-{department.lower().replace(' ', '')}@gov-grievance.gov",
        subject=f"🚨 New High Priority Ticket Created: #{ticket_id[:8]} ({department})",
        body=f"A new high priority ticket has been created.\n\nTicket ID: {ticket_id}\nDepartment: {department}\nMessage: {message}\nSLA Deadline: {sla_deadline.isoformat()}"
    )

    return ticket_id


def check_and_update_sla_escalations():
    """Background helper to flag tickets past SLA deadline as ESCALATED."""
    now = datetime.utcnow()
    overdue_tickets = tickets_collection.find({
        "status": {"$in": ["OPEN", "IN_PROGRESS"]},
        "sla_deadline": {"$lt": now},
        "is_escalated": {"$ne": True}
    })

    escalated_count = 0
    for ticket in overdue_tickets:
        tickets_collection.update_one(
            {"ticket_id": ticket["ticket_id"]},
            {"$set": {"is_escalated": True, "status": "ESCALATED"}}
        )
        escalated_count += 1

    return escalated_count
