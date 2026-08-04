import asyncio
import uuid
from app.database.connection import conversations_collection, tickets_collection
from app.routes.chat import chat_endpoint, admin_reply, ChatRequest, AdminReplyRequest

async def test():
    # 1. Create a session via chat_endpoint or direct insert
    session_id = f"test_sess_{uuid.uuid4().hex[:6]}"
    grievance_id = str(uuid.uuid4())
    
    doc = {
        "grievance_id": grievance_id,
        "session_id": session_id,
        "user_id": "test_user_1",
        "messages": [
            {"role": "user", "content": "Water pipeline broken", "language": "English"},
            {"role": "assistant", "content": "Logged complaint", "language": "English"}
        ],
        "detected_language": "English",
        "conversation_state": "COMPLETED",
        "agent_engaged": False
    }
    conversations_collection.insert_one(doc)
    
    print("BEFORE REPLY:")
    d_before = conversations_collection.find_one({"session_id": session_id})
    print("Messages count:", len(d_before["messages"]))

    # 2. Simulate admin reply
    body = AdminReplyRequest(session_id=session_id, message="We are working on it.")
    admin_user = {"username": "admin1", "role": "super_admin", "department": "All"}
    res = await admin_reply(body, admin_user)
    
    print("\nADMIN REPLY RES:")
    print("Status:", res["status"])
    print("Returned messages count:", len(res["messages"]))
    
    print("\nAFTER REPLY DB CHECK:")
    d_after = conversations_collection.find_one({"session_id": session_id})
    print("DB messages count:", len(d_after["messages"]))
    for m in d_after["messages"]:
        print("  - Role:", m.get("role"), "| Content:", m.get("content"), "| Translated:", m.get("translated_content"))

if __name__ == "__main__":
    asyncio.run(test())
