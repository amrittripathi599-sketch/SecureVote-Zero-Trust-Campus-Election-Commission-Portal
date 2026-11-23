import pytest
from app.models import AuditLog


def test_login_success(client):
    """Verifies that legitimate credentials yield a JWT and user profile."""
    res = client.post("/api/auth/login", json={"roll_number": "STU001", "password": "Voter@123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["roll_number"] == "STU001"
    assert "password_hash" not in data["user"]


def test_login_invalid_password(client):
    """Verifies that invalid password returns 401 Unauthorized."""
    res = client.post("/api/auth/login", json={"roll_number": "STU001", "password": "WrongPassword"})
    assert res.status_code == 401
    assert "Invalid roll number or password" in res.json()["detail"]


def test_get_current_user_profile(client, voter_token):
    """Verifies /api/auth/me resolves the authenticated voter."""
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {voter_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["roll_number"] == "STU001"
    assert data["role"] == "voter"


def test_get_current_user_unauthorized(client):
    """Verifies request without authorization header is rejected."""
    res = client.get("/api/auth/me")
    assert res.status_code == 403 or res.status_code == 401


def test_login_rate_limiting(client):
    """
    Zero-Trust Defense: After 5 failed login attempts for a roll number,
    the 6th attempt must be rejected with HTTP 429 Too Many Requests.
    """
    roll = "STU001"
    for i in range(5):
        res = client.post("/api/auth/login", json={"roll_number": roll, "password": f"BadPass{i}"})
        assert res.status_code == 401

    # 6th attempt should be blocked by rate limiter
    res_blocked = client.post("/api/auth/login", json={"roll_number": roll, "password": "BadPass5"})
    assert res_blocked.status_code == 429
    assert "temporarily throttled" in res_blocked.json()["detail"]
