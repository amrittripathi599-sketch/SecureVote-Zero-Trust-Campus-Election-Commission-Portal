import pytest
from sqlalchemy import select
from app.models import ElectionParticipation, User, VotesLedger
from app.services.voting import cast_vote


def test_cast_vote_success(client, voter_token):
    """
    Verifies that a voter can cast a ballot:
    - Receives confirmation message.
    - Preserves ballot secrecy (no candidate choice in response).
    - Updates voting status to true.
    """
    res = client.post(
        "/api/votes",
        json={"election_id": 1, "candidate_id": 1},
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "recorded" in data["message"]
    # Verify secrecy: NO candidate information leaked in response
    assert "candidate_id" not in data
    assert "candidate" not in data

    # Check status endpoint
    status_res = client.get("/api/votes/status/1", headers={"Authorization": f"Bearer {voter_token}"})
    assert status_res.status_code == 200
    assert status_res.json()["has_voted"] is True


def test_prevent_double_voting(client, voter_token):
    """
    Zero-Trust Integrity: A voter cannot vote twice in the same election.
    Subsequent attempt must be rejected with 409 Conflict.
    """
    # 1st vote
    res1 = client.post(
        "/api/votes",
        json={"election_id": 1, "candidate_id": 1},
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert res1.status_code == 200

    # 2nd vote attempt
    res2 = client.post(
        "/api/votes",
        json={"election_id": 1, "candidate_id": 2},
        headers={"Authorization": f"Bearer {voter_token}"}
    )
    assert res2.status_code == 409
    assert "already participated" in res2.json()["detail"]


def test_admin_cannot_vote(client, admin_token):
    """Verifies that non-voters (admins) cannot cast ballots."""
    res = client.post(
        "/api/votes",
        json={"election_id": 1, "candidate_id": 1},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 403


def test_vote_transaction_atomicity_and_rollback(db_session):
    """
    CRITICAL TRANSACTION ATOMICITY TEST:
    Simulates a sudden failure in the middle of the cast_vote transaction.
    Proves that the transaction rolls back completely:
    - 0 rows inserted into votes_ledger
    - 0 rows inserted into election_participation
    - user.has_voted remains False
    """
    # Verify pre-conditions
    initial_votes = db_session.execute(select(VotesLedger)).scalars().all()
    assert len(initial_votes) == 0

    user = db_session.execute(select(User).where(User.roll_number == "STU002")).scalar_one()
    assert user.has_voted is False

    # Execute vote with simulated mid-transaction failure
    with pytest.raises(Exception):
        cast_vote(
            db=db_session,
            user_id=user.user_id,
            election_id=1,
            candidate_id=2,
            _simulate_failure_before_commit=True
        )

    # Prove ACID guarantee: rollback ensured NO partial records persisted
    remaining_votes = db_session.execute(select(VotesLedger)).scalars().all()
    assert len(remaining_votes) == 0, "Zero-Trust Violation: Phantom vote left in votes_ledger after rollback!"

    participations = db_session.execute(
        select(ElectionParticipation).where(
            ElectionParticipation.user_id == user.user_id,
            ElectionParticipation.election_id == 1
        )
    ).scalars().all()
    assert len(participations) == 0, "Zero-Trust Violation: Phantom participation record persisted!"

    # Refresh user
    db_session.refresh(user)
    assert user.has_voted is False, "User flag was mutated despite transaction failure!"
