import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_admin_login_success():
    response = client.post(
        "/admin/login",
        json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "super_admin"
    assert "admin_access_token" in response.cookies


def test_admin_login_invalid_credentials():
    response = client.post(
        "/admin/login",
        json={"username": "admin", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


def test_citizen_signup_and_login():
    unique_user = f"citizen_{uuid.uuid4().hex[:6]}"
    
    # Signup test
    signup_res = client.post(
        "/signup",
        json={"username": unique_user, "password": "password123"}
    )
    assert signup_res.status_code == 200
    signup_data = signup_res.json()
    assert signup_data["status"] == "success"
    assert signup_data["user"]["username"] == unique_user
    assert "citizen_access_token" in signup_res.cookies

    # Login test
    login_res = client.post(
        "/login",
        json={"username": unique_user, "password": "password123"}
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["user"]["username"] == unique_user
    assert "citizen_access_token" in login_res.cookies
