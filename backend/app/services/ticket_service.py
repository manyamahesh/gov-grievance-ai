from datetime import datetime
import uuid

from app.database.connection import tickets_collection


def create_ticket(
    session_id: str,
    message: str,
    language: str,
    sentiment: str,
    priority: str,
    department: str
) -> str:
    
    ticket_id = str(uuid.uuid4())

    ticket_data = {
        "ticket_id": ticket_id,
        "session_id": session_id,
        "message": message,
        "language": language,
        "sentiment": sentiment,
        "priority": priority,
        "department": department,
        "status": "OPEN",
        "created_at": datetime.utcnow()
    }

    tickets_collection.insert_one(ticket_data)

    return ticket_id
