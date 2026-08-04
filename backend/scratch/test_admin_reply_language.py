import sys
import os
import uuid
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.services.auth_service import create_access_token

client = TestClient(app)

def test_kannada_admin_reply():
    print("=== LIVE TEST: ADMIN REPLY & AI ASSISTANT IN KANNADA ===")
    
    unique_user = f"k_citizen_{uuid.uuid4().hex[:6]}"
    signup_res = client.post("/signup", json={"username": unique_user, "password": "password123"})
    assert signup_res.status_code == 200, f"Signup failed: {signup_res.text}"
    
    # Citizen submits complaint with selected_language = "Kannada"
    chat_res = client.post(
        "/chat",
        json={
            "message": "ಮೂರು ದಿನಗಳಿಂದ ನೀರಿನ ಸಮಸ್ಯೆ ಇದೆ",
            "selected_language": "Kannada"
        },
        cookies=signup_res.cookies
    )
    
    assert chat_res.status_code == 200, f"Chat endpoint failed: {chat_res.text}"
    chat_data = chat_res.json()
    session_id = chat_data["session_id"]
    print("✅ Grievance created successfully:")
    print("   Session ID:", session_id)
    print("   Selected Language:", chat_data.get("selected_language"))
    print("   Detected Language:", chat_data.get("detected_language"))
    print("   Department:", chat_data.get("department"))

    # Admin sends reply in English
    admin_token = create_access_token({"sub": "admin", "role": "super_admin", "department": "All"})
    reply_res = client.post(
        "/admin/reply",
        json={
            "session_id": session_id,
            "message": "We are looking into the issue and will be resolved in an hour."
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert reply_res.status_code == 200, f"Admin reply failed: {reply_res.text}"
    reply_data = reply_res.json()
    agent_msg = [m for m in reply_data["messages"] if m.get("role") == "agent"][-1]
    system_msg = [m for m in reply_data["messages"] if m.get("role") == "system"][-1]
    assistant_msg = [m for m in reply_data["messages"] if m.get("role") == "assistant"][0]

    print("\n✅ Execution Results:")
    print("   AI Assistant Message (Kannada):", repr(assistant_msg.get("content")))
    print("   System Handoff Message (Kannada):", repr(system_msg.get("content")))
    print("   Original Admin Reply (EN):", repr(agent_msg["content"]))
    print("   Translated Admin Reply (Kannada):", repr(agent_msg.get("translated_content")))
    print("   Translation Status:", repr(agent_msg.get("translation_status")))
    
    assert assistant_msg.get("content") != assistant_msg.get("original_english_content")
    assert agent_msg.get("translated_content") is not None
    assert agent_msg.get("translated_content") != agent_msg["content"]
    assert agent_msg.get("translation_status") == "success"
    print("\n🎉 Live verification test passed cleanly!")

if __name__ == "__main__":
    test_kannada_admin_reply()
