def test_list_elections(client, voter_token):
    """Verifies listing active campus elections."""
    res = client.get("/api/elections", headers={"Authorization": f"Bearer {voter_token}"})
    assert res.status_code == 200
    elections = res.json()
    assert len(elections) >= 1
    assert elections[0]["title"] == "Campus Council Election 2026"
    assert elections[0]["candidate_count"] == 2
    assert elections[0]["has_current_user_voted"] is False


def test_get_election_detail(client, voter_token):
    """Verifies fetching details of an election."""
    res = client.get("/api/elections/1", headers={"Authorization": f"Bearer {voter_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["election_id"] == 1
    assert data["status"] == "open"


def test_get_election_candidates(client, voter_token):
    """Verifies candidates list for an election."""
    res = client.get("/api/elections/1/candidates", headers={"Authorization": f"Bearer {voter_token}"})
    assert res.status_code == 200
    candidates = res.json()
    assert len(candidates) == 2
    assert candidates[0]["position"] == "President"
    assert candidates[0]["manifesto_url"] == "/uploads/manifesto1.pdf"
    assert candidates[0]["full_name"] == "Student One"
