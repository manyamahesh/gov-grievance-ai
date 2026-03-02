from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime
import uuid

from app.database.connection import conversations_collection
from app.services.language_service import detect_language
from app.services.sentiment_service import analyze_sentiment
from app.services.priority_service import assign_priority
from app.services.department_service import assign_department
from app.services.ticket_service import create_ticket

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


@router.post("/chat")
def chat_endpoint(request: ChatRequest):

    session_id = request.session_id or str(uuid.uuid4())

    language = detect_language(request.message)
    sentiment = analyze_sentiment(request.message)
    priority = assign_priority(sentiment)
    department = assign_department(request.message)

    conversation_data = {
        "session_id": session_id,
        "message": request.message,
        "language": language,
        "sentiment": sentiment,
        "priority": priority,
        "department": department,
        "timestamp": datetime.utcnow()
    }

    conversations_collection.insert_one(conversation_data)

    ticket_id = None

    if priority == "HIGH":
        ticket_id = create_ticket(
            session_id=session_id,
            message=request.message,
            language=language,
            sentiment=sentiment,
            priority=priority,
            department=department
        )

    return {
        "session_id": session_id,
        "detected_language": language,
        "sentiment": sentiment,
        "priority": priority,
        "department": department,
        "ticket_id": ticket_id,
        "reply": "Complaint received. We are reviewing your grievance."
    }


@router.get("/conversation/{session_id}")
def get_conversation(session_id: str):

    conversations = list(
        conversations_collection.find(
            {"session_id": session_id},
            {"_id": 0}
        ).sort("timestamp", 1)
    )

    return {
        "session_id": session_id,
        "total_messages": len(conversations),
        "conversations": conversations
    }
