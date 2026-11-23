import io
from datetime import datetime, timedelta
from app.models import ElectionStatus


def test_voter_blocked_from_admin_endpoints(client, voter_token):
    """RBAC check: Non-admin voters receive 403 Forbidden on administrative endpoints."""
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {voter_token}"})
    assert res.status_code == 403

    res_users = client.get("/api/admin/users", headers={"Authorization": f"Bearer {voter_token}"})
    assert res_users.status_code == 403

    res_create = client.post(
        "/api/admin/elections",
        json={
            "title": "Unauthorized Election",
            "start_time": datetime.utcnow().isoformat(),
            "end_time": (datetime.utcnow() + timedelta(days=1)).isoformat()
        },
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert res_create.status_code == 403


def test_admin_create_and_update_election(client, admin_token):
    """Verifies election lifecycle management by admin."""
    now = datetime.utcnow()
    payload = {
        "title": "Engineering Faculty Senate 2026",
        "start_time": (now + timedelta(days=1)).isoformat(),
        "end_time": (now + timedelta(days=3)).isoformat(),
        "status": "draft"
    }
    create_res = client.post("/api/admin/elections", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert create_res.status_code == 200
    election_data = create_res.json()
    assert election_data["title"] == payload["title"]
    assert election_data["status"] == "draft"

    # Admin updates status to open
    patch_res = client.patch(
        f"/api/admin/elections/{election_data['election_id']}",
        json={"status": "open"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "open"


def test_admin_add_candidate_and_upload_manifesto(client, admin_token):
    """Verifies candidate nomination and manifesto upload with PDF magic byte verification."""
    # Register candidate
    cand_payload = {
        "election_id": 1,
        "user_id": 3,
        "position": "Treasurer",
        "slogan": "Fiscal Integrity"
    }
    # User 3 is STU002, already candidate 2 in seed; try adding new user or check conflict
    # Attempting duplicate candidate returns 409
    dup_res = client.post("/api/admin/candidates", json=cand_payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert dup_res.status_code == 409

    # Valid PDF upload (starts with %PDF)
    valid_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    upload_res = client.post(
        "/api/admin/candidates/1/manifesto",
        files={"file": ("manifesto.pdf", io.BytesIO(valid_pdf), "application/pdf")},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert upload_res.status_code == 200
    assert "uploads" in upload_res.json()["manifesto_url"] or "manifesto" in upload_res.json()["manifesto_url"]

    # Invalid upload rejected (lacks %PDF magic byte)
    fake_pdf = b"NOT_A_PDF_FILE_HEADER"
    bad_upload = client.post(
        "/api/admin/candidates/1/manifesto",
        files={"file": ("fake.pdf", io.BytesIO(fake_pdf), "application/pdf")},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert bad_upload.status_code == 400
    assert "inspection failed" in bad_upload.json()["detail"]


def test_admin_audit_logs_and_users_list(client, admin_token):
    """Verifies audit trail retrieval and safe user list without password hashes."""
    # Audit logs
    logs_res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert logs_res.status_code == 200
    logs_data = logs_res.json()
    assert "items" in logs_data
    assert "total" in logs_data

    # Users list
    users_res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert users_res.status_code == 200
    users = users_res.json()
    assert len(users) >= 3
    for user in users:
        assert "password_hash" not in user
        assert "roll_number" in user
        assert "has_voted" in user


def test_admin_turnout_analytics(client, admin_token, voter_token):
    """Verifies calculation of turnout percentage and aggregate candidate tallies."""
    # Cast a vote first
    client.post(
        "/api/votes",
        json={"election_id": 1, "candidate_id": 1},
        headers={"Authorization": f"Bearer {voter_token}"}
    )

    analytics_res = client.get("/api/analytics/turnout/1", headers={"Authorization": f"Bearer {admin_token}"})
    assert analytics_res.status_code == 200
    data = analytics_res.json()
    assert data["election_id"] == 1
    assert data["total_eligible_voters"] >= 2
    assert data["total_voted"] == 1
    assert data["turnout_percentage"] > 0
    assert len(data["candidate_tallies"]) == 2
    # Verify candidate 1 tally
    tally_c1 = next(c for c in data["candidate_tallies"] if c["candidate_id"] == 1)
    assert tally_c1["votes_count"] == 1


def test_declare_result_lifecycle_and_security(client, admin_token, voter_token, voter2_token):
    """
    Verifies the Declare Result feature:
    1. Voter gets 403 Forbidden when attempting to declare result.
    2. Admin successfully declares result -> status becomes 'closed', returns winner and tallies.
    3. Declaring result twice returns 409 Conflict ('Result already declared.').
    4. Votes cast after declaring result are rejected (election is closed).
    5. Audit log entry is written with action='declare_result'.
    """
    # 1. Cast a vote first so there is a winner
    vote_res = client.post(
        "/api/votes",
        json={"election_id": 1, "candidate_id": 1},
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert vote_res.status_code == 200

    # 2. Voter attempts to declare result -> must receive 403 Forbidden
    voter_declare = client.post(
        "/api/admin/elections/1/declare-result",
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert voter_declare.status_code == 403

    # 3. Admin declares result -> 200 OK
    admin_declare = client.post(
        "/api/admin/elections/1/declare-result",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_declare.status_code == 200
    declared_data = admin_declare.json()
    assert declared_data["status"] == "closed"
    assert declared_data["declared_at"] is not None
    assert declared_data["winner"] is not None
    assert declared_data["winner"]["candidate_id"] == 1
    assert declared_data["winner"]["candidate_name"] == "Student One"
    assert declared_data["winner"]["votes_count"] == 1
    assert declared_data["turnout_percentage"] > 0

    # 4. Declaring twice gives 409 Conflict
    dup_declare = client.post(
        "/api/admin/elections/1/declare-result",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert dup_declare.status_code == 409
    assert "Result already declared" in dup_declare.json()["detail"]

    # 5. Subsequent vote attempts after declaring are rejected because election is closed
    late_vote = client.post(
        "/api/votes",
        json={"election_id": 1, "candidate_id": 2},
        headers={"Authorization": f"Bearer {voter2_token}"}
    )
    assert late_vote.status_code == 400
    assert "closed" in late_vote.json()["detail"].lower()

    # 6. Verify audit logs record the declare_result action
    logs_res = client.get(
        "/api/admin/audit-logs?action=declare_result",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert logs_res.status_code == 200
    items = logs_res.json()["items"]
    assert len(items) >= 1
    assert items[0]["action"] == "declare_result"
    assert items[0]["status"] == "success"
    assert "Student One" in items[0]["details"]
