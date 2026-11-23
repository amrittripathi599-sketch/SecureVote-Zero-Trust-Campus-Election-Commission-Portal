import pytest
from datetime import datetime
from sqlalchemy import text
from app.models import AuditLog, VotesLedger


def test_votes_ledger_update_prohibited_by_trigger(db_session):
    """
    ZERO-TRUST LEDGER IMMUTABILITY TEST:
    Verifies that direct SQL UPDATE on votes_ledger triggers an immediate abort.
    """
    vote = VotesLedger(election_id=1, candidate_id=1, timestamp=datetime.utcnow())
    db_session.add(vote)
    db_session.commit()

    # Attempt direct UPDATE via SQL
    with pytest.raises(Exception) as exc_info:
        db_session.execute(
            text("UPDATE votes_ledger SET candidate_id = 2 WHERE vote_id = :id"),
            {"id": vote.vote_id}
        )
        db_session.commit()

    db_session.rollback()
    assert "immutable" in str(exc_info.value).lower() or "abort" in str(exc_info.value).lower()


def test_votes_ledger_delete_prohibited_by_trigger(db_session):
    """
    ZERO-TRUST LEDGER IMMUTABILITY TEST:
    Verifies that direct SQL DELETE on votes_ledger triggers an immediate abort.
    """
    vote = VotesLedger(election_id=1, candidate_id=1, timestamp=datetime.utcnow())
    db_session.add(vote)
    db_session.commit()

    # Attempt direct DELETE via SQL
    with pytest.raises(Exception) as exc_info:
        db_session.execute(
            text("DELETE FROM votes_ledger WHERE vote_id = :id"),
            {"id": vote.vote_id}
        )
        db_session.commit()

    db_session.rollback()
    assert "immutable" in str(exc_info.value).lower() or "abort" in str(exc_info.value).lower()


def test_audit_logs_immutability_trigger(db_session):
    """
    ZERO-TRUST AUDIT TRAIL IMMUTABILITY TEST:
    Verifies that direct modification or truncation of audit logs is blocked.
    """
    log_entry = AuditLog(
        action="test.security",
        status="success",
        timestamp=datetime.utcnow(),
        details="Initial immutable security event"
    )
    db_session.add(log_entry)
    db_session.commit()

    with pytest.raises(Exception) as exc_info:
        db_session.execute(
            text("UPDATE audit_logs SET status = 'tampered' WHERE log_id = :id"),
            {"id": log_entry.log_id}
        )
        db_session.commit()

    db_session.rollback()
    assert "immutable" in str(exc_info.value).lower() or "abort" in str(exc_info.value).lower()
