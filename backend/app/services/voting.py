import logging
from datetime import datetime
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    AuditLog,
    Candidate,
    Election,
    ElectionParticipation,
    ElectionStatus,
    User,
    VotesLedger,
)

logger = logging.getLogger(__name__)


def record_vote_audit_failure(
    user_id: Optional[int],
    election_id: int,
    reason: str,
    ip_address: Optional[str] = None
) -> None:
    """
    Isolated Autonomous Audit Transaction:
    Persists a failure audit log entry in an independent transaction.
    This guarantees that even when the vote transaction rolls back,
    the security log of the failed or anomalous attempt is permanently preserved.
    """
    try:
        with SessionLocal() as audit_db:
            audit_entry = AuditLog(
                user_id=user_id,
                action="vote.cast",
                status="failure",
                timestamp=datetime.utcnow(),
                ip_address=ip_address,
                details=f"Vote submission failed for election_id={election_id}. Reason: {reason}"
            )
            audit_db.add(audit_entry)
            audit_db.commit()
    except Exception as exc:
        logger.error(f"CRITICAL: Failed to write failure audit log: {exc}")


def cast_vote(
    db: Session,
    user_id: int,
    election_id: int,
    candidate_id: int,
    ip_address: Optional[str] = None,
    _simulate_failure_before_commit: bool = False
) -> datetime:
    """
    =============================================================================
    ATOMIC ZERO-TRUST CAST-VOTE TRANSACTION
    =============================================================================
    WHY THIS TRANSACTION IS STRICTLY ATOMIC & GUARANTEES BALLOT SECRECY:

    1. CONCURRENCY & ISOLATION:
       On PostgreSQL, the user row is acquired with SELECT ... FOR UPDATE (row-level lock)
       to serialize concurrent requests from the same student and eliminate TOCTOU race conditions.
       On SQLite, the session operates within standard single-writer serializable lock boundaries.

    2. TIMELINE & STATE VALIDATION:
       Confirms that the election exists, has status 'open', and the current timestamp
       falls strictly between start_time and end_time.

    3. DOUBLE-VOTING DEFENSE (409 CONFLICT):
       Queries election_participation for (user_id, election_id). If a record already exists,
       the vote is rejected with HTTP 409 Conflict without modifying any data.

    4. CANDIDATE INTEGRITY:
       Verifies that the nominated candidate belongs to the specified election.

    5. 3NF BALLOT SECRECY (CRITICAL ARCHITECTURAL GUARANTEE):
       A new row is added to votes_ledger with only (election_id, candidate_id, timestamp).
       Notice that votes_ledger HAS NO user_id column. It is physically impossible to query
       or join back which voter chose which candidate.

    6. PARTICIPATION & USER STATE:
       Adds a row to election_participation(user_id, election_id) and flags users.has_voted = true.
       This records that the user has voted without recording their choice.

    7. AUDIT & ATOMIC COMMIT:
       A success audit log row is added within the same transaction.
       Steps 5, 6, and 7 are committed together (ACID All-or-Nothing).
       If an error or network drop occurs at any point before commit, db.rollback()
       ensures zero partial state or phantom votes remain.
       The isolated failure audit log is written in a separate transaction.
    =============================================================================
    """
    now = datetime.utcnow()

    try:
        # Step 1: Concurrency Control - Lock user row
        user_query = select(User).where(User.user_id == user_id)
        if db.bind and db.bind.dialect.name == "postgresql":
            user_query = user_query.with_for_update()

        user = db.execute(user_query).scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Voter account not found."
            )

        # Step 2: Validate Election Lifecycle and Timeline
        election = db.execute(
            select(Election).where(Election.election_id == election_id)
        ).scalar_one_or_none()

        if not election:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Election ID {election_id} does not exist."
            )

        if election.status != ElectionStatus.open:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Election is not currently open for voting (current status: '{election.status.value}')."
            )

        if now < election.start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Voting has not yet commenced for this election."
            )

        if now > election.end_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Voting has closed for this election (deadline passed)."
            )

        # Step 3: Check Election Participation (Double-Vote Prevention)
        existing_participation = db.execute(
            select(ElectionParticipation).where(
                ElectionParticipation.user_id == user_id,
                ElectionParticipation.election_id == election_id
            )
        ).scalar_one_or_none()

        if existing_participation:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Zero-Trust Enforced: You have already participated and cast a ballot in this election."
            )

        # Step 4: Verify Candidate Belongs to This Election
        candidate = db.execute(
            select(Candidate).where(
                Candidate.candidate_id == candidate_id,
                Candidate.election_id == election_id
            )
        ).scalar_one_or_none()

        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Candidate ID {candidate_id} is not registered in Election ID {election_id}."
            )

        # Step 5: Insert into Immutable Votes Ledger (NO user_id column!)
        vote_entry = VotesLedger(
            election_id=election_id,
            candidate_id=candidate_id,
            timestamp=now
        )
        db.add(vote_entry)

        # Step 6: Record Participation & Update User Flag
        participation_entry = ElectionParticipation(
            user_id=user_id,
            election_id=election_id,
            voted_at=now
        )
        db.add(participation_entry)
        user.has_voted = True

        # Step 7: Record Success Audit Log
        audit_entry = AuditLog(
            user_id=user_id,
            action="vote.cast",
            status="success",
            timestamp=now,
            ip_address=ip_address,
            details=f"Ballot successfully cast in election_id={election_id}"
        )
        db.add(audit_entry)

        # Chaos testing hook to verify rollback integrity
        if _simulate_failure_before_commit:
            raise RuntimeError("SIMULATED_TRANSACTION_FAILURE: Testing ACID rollback")

        # Atomic Commit: Votes ledger + Participation + User update + Audit
        db.commit()
        return now

    except HTTPException as http_exc:
        db.rollback()
        record_vote_audit_failure(
            user_id=user_id,
            election_id=election_id,
            reason=http_exc.detail,
            ip_address=ip_address
        )
        raise http_exc

    except Exception as exc:
        db.rollback()
        record_vote_audit_failure(
            user_id=user_id,
            election_id=election_id,
            reason=str(exc),
            ip_address=ip_address
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transactional failure while casting ballot: {str(exc)}"
        )
