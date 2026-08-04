import uuid
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.auth_service import create_access_token

client = TestClient(app)


@patch("app.routes.chat.analyze_grievance_async")
def test_chat_endpoint_mocked_llm(mock_llm):
    unique_user = f"chatuser_{uuid.uuid4().hex[:6]}"
    signup_res = client.post(
        "/signup",
        json={"username": unique_user, "password": "password123"}
    )
    assert signup_res.status_code == 200

    mock_llm.return_value = {
        "detected_language": "Hindi",
        "translated_text": "Water leakage in sector 5",
        "sentiment": "negative",
        "priority": "high",
        "department": "Water Supply Department",
        "needs_followup": False,
        "followup_question": None,
        "reply_to_citizen": "आपका पानी का रिसाव शिकायत दर्ज कर लिया गया है।"
    }

    response = client.post(
        "/chat",
        json={"message": "सेक्टर 5 में पानी का रिसाव हो रहा है"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["detected_language"] == "Hindi"
    assert data["priority"] == "HIGH"
    assert data["department"] == "Water Supply Department"
    assert data["needs_followup"] is False
    assert "session_id" in data
    assert "user_id" in data


@patch("app.routes.chat.translate_text_async")
@patch("app.routes.chat.analyze_grievance_async")
def test_agent_handoff_and_admin_reply(mock_analyze, mock_translate):
    mock_analyze.return_value = {
        "detected_language": "Hindi",
        "translated_text": "Severe water outage",
        "sentiment": "negative",
        "priority": "high",
        "department": "Water Supply Department",
        "needs_followup": False,
        "followup_question": None,
        "reply_to_citizen": "आपका शिकायत दर्ज कर लिया गया है।"
    }
    mock_translate.return_value = "हमारी टीम आपके क्षेत्र में पाइपलाइन की मरम्मत कर रही है।"

    # Step 1: Citizen submits complaint
    c_user = f"cit_{uuid.uuid4().hex[:6]}"
    client.post("/signup", json={"username": c_user, "password": "password123"})
    chat_res = client.post("/chat", json={"message": "पानी की भारी किल्लत है"})
    session_id = chat_res.json()["session_id"]

    # Step 2: Admin sends reply via /admin/reply
    admin_token = create_access_token({"sub": "admin", "role": "super_admin", "department": "All"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    reply_res = client.post(
        "/admin/reply",
        json={"session_id": session_id, "message": "Our team is repairing the pipeline in your area now."},
        headers=headers
    )
    assert reply_res.status_code == 200
    reply_data = reply_res.json()
    assert reply_data["agent_engaged"] is True
    assert reply_data["assigned_agent"] == "admin"
    
    # Verify handoff system message and agent message are present
    messages = reply_data["messages"]
    system_msgs = [m for m in messages if m.get("role") == "system"]
    agent_msgs = [m for m in messages if m.get("role") == "agent"]
    assert len(system_msgs) >= 1
    assert system_msgs[0]["content"] is not None and len(system_msgs[0]["content"]) > 0
    assert len(agent_msgs) >= 1
    assert agent_msgs[0]["content"] == "Our team is repairing the pipeline in your area now."


@patch("app.routes.chat.translate_text_async")
@patch("app.routes.chat.analyze_grievance_async")
def test_continue_chat_on_completed_grievance(mock_analyze, mock_translate):
    mock_analyze.return_value = {
        "detected_language": "English",
        "translated_text": "Pothole on Main St",
        "sentiment": "negative",
        "priority": "high",
        "department": "Public Works Department",
        "needs_followup": False,
        "followup_question": None,
        "reply_to_citizen": "Your pothole complaint has been logged."
    }
    mock_translate.side_effect = lambda text, target_language, source_language: f"ACK: {text}"

    # Step 1: Initial complaint intake
    c_user = f"cit_{uuid.uuid4().hex[:6]}"
    client.post("/signup", json={"username": c_user, "password": "password123"})
    res1 = client.post("/chat", json={"message": "Pothole on Main St"})
    assert res1.status_code == 200
    session_id = res1.json()["session_id"]
    assert res1.json()["conversation_state"] == "COMPLETED"

    # Reset mock call counts to verify analyze_grievance_async is NOT called again on follow-up!
    mock_analyze.reset_mock()

    # Step 2: Citizen clicks "Continue chat" and sends a follow-up
    res2 = client.post("/chat", json={"session_id": session_id, "message": "When is this going to get resolved?"})
    assert res2.status_code == 200
    data2 = res2.json()

    # Verify intake classification was NOT re-invoked
    mock_analyze.assert_not_called()

    # Verify flag and reply acknowledgement text
    assert data2["needs_agent_attention"] is True
    assert "flagged this for a support agent" in data2["reply"]
    assert data2["conversation_state"] == "COMPLETED"
