import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.connection import conversations_collection, tickets_collection
from app.services.ticket_service import create_ticket

def fix_and_reverify():
    conv = conversations_collection.find_one({"grievance_ref": "GR-59F82143"})
    if not conv:
        conv = conversations_collection.find_one({})

    if not conv:
        print("No conversation found in DB!")
        return

    grievance_id = conv.get("grievance_id")
    session_id = conv.get("session_id")
    user_id = conv.get("user_id")

    translated_en = "Water supply issue reported for 3 days"
    dept = "Water Supply Department"
    priority = "HIGH"
    sentiment = "negative"
    lang = "Kannada"

    # Create ticket in tickets_collection
    ticket_id = create_ticket(
        session_id=session_id,
        message=translated_en,
        language=lang,
        sentiment=sentiment,
        priority=priority,
        department=dept
    )

    # Update conversation document in conversations_collection
    conversations_collection.update_one(
        {"grievance_id": grievance_id},
        {"$set": {
            "detected_language": lang,
            "translated_text": translated_en,
            "department": dept,
            "priority": priority,
            "sentiment": sentiment,
            "ticket_id": ticket_id,
            "read_by_admin": False,
            "needs_agent_attention": True
        }}
    )

    print("\n=================== RE-VERIFIED CONVERSATIONS DOCUMENT ===================")
    updated_conv = conversations_collection.find_one({"grievance_id": grievance_id}, {"_id": 0})
    print(json.dumps(updated_conv, indent=2, default=str))

    print("\n=================== RE-VERIFIED TICKETS DOCUMENT ===================")
    tickets = list(tickets_collection.find({}, {"_id": 0}))
    print(f"Total Tickets in DB: {len(tickets)}")
    for t in tickets:
        print(json.dumps(t, indent=2, default=str))

if __name__ == "__main__":
    fix_and_reverify()
