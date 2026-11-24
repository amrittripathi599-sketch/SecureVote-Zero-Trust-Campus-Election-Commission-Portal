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


def test_resume_election_lifecycle_and_security(client, admin_token, voter_token, voter2_token):
    """
    Verifies the Resume Election feature:
    1. Voter casts vote in open election.
    2. Admin declares result (status becomes closed, declared_at set).
    3. Voter attempts to resume election -> 403 Forbidden.
    4. Admin resumes election -> status becomes 'open', declared_at/winner_candidate_id cleared.
    5. Second voter casts vote in the resumed election -> 200 OK.
    6. Double-voting is still prevented for the first voter -> 409 Conflict.
    7. Resuming an already open and undeclared election returns 400 Bad Request.
    8. Audit log records 'resume_election' action.
    9. Admin can re-declare result -> tally reflects both voters.
    """
    # 1. Voter 1 casts vote
    v1_res = client.post(
        "/api/votes",
        json={"election_id": 1, "candidate_id": 1},
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert v1_res.status_code == 200

    # 2. Admin declares result
    dec_res = client.post(
        "/api/admin/elections/1/declare-result",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert dec_res.status_code == 200
    assert dec_res.json()["status"] == "closed"

    # 3. Voter tries to resume election -> 403 Forbidden
    voter_resume = client.post(
        "/api/admin/elections/1/resume",
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert voter_resume.status_code == 403

    # 4. Admin resumes election -> 200 OK
    admin_resume = client.post(
        "/api/admin/elections/1/resume",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_resume.status_code == 200
    resumed_data = admin_resume.json()
    assert resumed_data["status"] == "open"
    assert resumed_data["declared_at"] is None
    assert resumed_data["winner_candidate_id"] is None
    assert resumed_data["is_declared"] is False

    # 5. Voter 2 can now cast vote in the resumed election
    v2_res = client.post(
        "/api/votes",
        json={"election_id": 1, "candidate_id": 2},
        headers={"Authorization": f"Bearer {voter2_token}"}
    )
    assert v2_res.status_code == 200

    # 6. Double voting check: Voter 1 cannot vote again in the resumed election
    v1_repeat = client.post(
        "/api/votes",
        json={"election_id": 1, "candidate_id": 1},
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert v1_repeat.status_code == 409

    # 7. Resuming already open and undeclared election returns 400 Bad Request
    already_open_resume = client.post(
        "/api/admin/elections/1/resume",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert already_open_resume.status_code == 400
    assert "already open" in already_open_resume.json()["detail"].lower()

    # 8. Check audit log has 'resume_election'
    audit_res = client.get(
        "/api/admin/audit-logs?action=resume_election",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert audit_res.status_code == 200
    logs = audit_res.json()["items"]
    assert len(logs) >= 1
    assert logs[0]["action"] == "resume_election"
    assert logs[0]["status"] == "success"

    # 9. Admin can re-declare result after resumed voting period
    re_declare = client.post(
        "/api/admin/elections/1/declare-result",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert re_declare.status_code == 200
    re_declared_data = re_declare.json()
    assert re_declared_data["status"] == "closed"
    assert re_declared_data["total_voted"] == 2


def test_admin_create_voter_lifecycle_and_security(client, admin_token, voter_token):
    """
    Verifies the Add Voter feature:
    1. Non-admin voter receives 403 Forbidden.
    2. Admin registers new student voter (STU099, Kabir Sharma).
    3. Password hash is never exposed in response.
    4. Newly created voter can immediately log in with provided credentials.
    5. Duplicate roll number registration returns 409 Conflict.
    6. Audit log entry is recorded with action='admin.voter.create'.
    """
    # 1. Voter cannot create another voter
    voter_attempt = client.post(
        "/api/admin/voters",
        json={"roll_number": "STU099", "full_name": "Unauthorized Attempt", "password": "Password@123"},
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert voter_attempt.status_code == 403

    # 2. Admin creates voter
    admin_create = client.post(
        "/api/admin/voters",
        json={"roll_number": "STU099", "full_name": "Kabir Sharma", "password": "SecurePassword@123"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_create.status_code == 201
    voter_data = admin_create.json()
    assert voter_data["roll_number"] == "STU099"
    assert voter_data["full_name"] == "Kabir Sharma"
    assert voter_data["role"] == "voter"
    assert voter_data["has_voted"] is False
    assert "password_hash" not in voter_data

    # 3. New voter logs in successfully
    login_res = client.post(
        "/api/auth/login",
        json={"roll_number": "STU099", "password": "SecurePassword@123"}
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # 4. Duplicate registration returns 409 Conflict
    dup_res = client.post(
        "/api/admin/voters",
        json={"roll_number": "STU099", "full_name": "Kabir Duplicate", "password": "AnotherPassword@123"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"].lower()

    # 5. Audit log check
    audit_res = client.get(
        "/api/admin/audit-logs?action=admin.voter.create",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert audit_res.status_code == 200
    logs = audit_res.json()["items"]
    assert len(logs) >= 1
    assert "STU099" in logs[0]["details"]


def test_admin_batch_create_voters(client, admin_token):
    """Verifies batch voter provisioning and duplicate roll number skipping."""
    batch_res = client.post(
        "/api/admin/voters/batch",
        json={
            "voters": [
                {"roll_number": "STU081", "full_name": "Student Eighty One", "password": "Voter@123"},
                {"roll_number": "STU082", "full_name": "Student Eighty Two", "password": "Voter@123"},
                {"roll_number": "STU081", "full_name": "Student Eighty One Duplicate", "password": "Voter@123"},
            ]
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert batch_res.status_code == 201
    data = batch_res.json()
    assert data["created_count"] == 2
    assert data["skipped_count"] == 1
    assert "STU081" in data["skipped_roll_numbers"]


def test_admin_reset_own_password(client, admin_token):
    """Verifies that an administrator can securely reset their own master password."""
    # 1. Invalid current password -> 401
    bad_res = client.post(
        "/api/admin/reset-my-password",
        json={"current_password": "WrongPassword!123", "new_password": "NewAdminPassword@456"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert bad_res.status_code == 401
    assert "verification failed" in bad_res.json()["detail"].lower()

    # 2. Identical new password -> 400
    same_res = client.post(
        "/api/admin/reset-my-password",
        json={"current_password": "Admin@123", "new_password": "Admin@123"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert same_res.status_code == 400

    # 3. Successful password reset
    good_res = client.post(
        "/api/admin/reset-my-password",
        json={"current_password": "Admin@123", "new_password": "NewAdminPassword@456"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert good_res.status_code == 200
    assert "successfully updated" in good_res.json()["message"].lower()

    # 4. Verify login with the new password
    login_res = client.post(
        "/api/auth/login",
        json={"roll_number": "ADMIN001", "password": "NewAdminPassword@456"}
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # 5. Restore original password for other tests
    new_token = login_res.json()["access_token"]
    restore_res = client.post(
        "/api/admin/reset-my-password",
        json={"current_password": "NewAdminPassword@456", "new_password": "Admin@123"},
        headers={"Authorization": f"Bearer {new_token}"}
    )
    assert restore_res.status_code == 200


def test_admin_reset_voter_password(client, admin_token, voter_token):
    """Verifies that an administrator can reset any user's password, while voters are blocked."""
    # 1. Non-admin voter blocked -> 403
    forbidden_res = client.post(
        "/api/admin/users/2/reset-password",
        json={"new_password": "NewVoterPassword@789"},
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert forbidden_res.status_code == 403

    # 2. Admin resets user password (user_id 2 = STU001)
    reset_res = client.post(
        "/api/admin/users/2/reset-password",
        json={"new_password": "NewVoterPassword@789"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert reset_res.status_code == 200
    assert "successfully reset" in reset_res.json()["message"].lower()

    # 3. User can login with new password
    user_login = client.post(
        "/api/auth/login",
        json={"roll_number": "STU001", "password": "NewVoterPassword@789"}
    )
    assert user_login.status_code == 200
    assert "access_token" in user_login.json()
