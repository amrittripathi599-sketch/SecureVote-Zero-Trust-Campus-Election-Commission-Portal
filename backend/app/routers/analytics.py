from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import (
    Candidate,
    Election,
    ElectionParticipation,
    User,
    UserRole,
    VotesLedger,
)
from app.schemas import TurnoutAnalyticsResponse, TurnoutCandidateTally

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/turnout/{election_id}", response_model=TurnoutAnalyticsResponse)
def get_election_turnout_analytics(
    election_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only Turnout & Election Analytics:
    - Calculates total eligible voters (users with role='voter').
    - Calculates total participation for the specified election.
    - Computes turnout percentage.
    - Tallies candidate votes in aggregate from votes_ledger.
      ZERO-TRUST PRIVACY NOTE: Tallies are strictly anonymous aggregates.
      Votes are grouped by candidate_id without any linkage to individual voter records.
    """
    election = db.execute(
        select(Election).where(Election.election_id == election_id)
    ).scalar_one_or_none()

    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Election ID {election_id} not found."
        )

    # Total eligible voters in the institution
    total_eligible = db.execute(
        select(func.count(User.user_id)).where(User.role == UserRole.voter)
    ).scalar() or 0

    # Total ballots cast for this specific election
    total_voted = db.execute(
        select(func.count(ElectionParticipation.user_id)).where(
            ElectionParticipation.election_id == election_id
        )
    ).scalar() or 0

    turnout_pct = round((total_voted / total_eligible * 100), 2) if total_eligible > 0 else 0.0

    # Aggregate candidate tallies from votes_ledger
    candidates = db.execute(
        select(Candidate, User)
        .join(User, Candidate.user_id == User.user_id)
        .where(Candidate.election_id == election_id)
        .order_by(Candidate.candidate_id.asc())
    ).all()

    vote_counts = dict(
        db.execute(
            select(VotesLedger.candidate_id, func.count(VotesLedger.vote_id))
            .where(VotesLedger.election_id == election_id)
            .group_by(VotesLedger.candidate_id)
        ).all()
    )

    candidate_tallies = []
    for cand, cand_user in candidates:
        candidate_tallies.append(
            TurnoutCandidateTally(
                candidate_id=cand.candidate_id,
                candidate_name=cand_user.full_name,
                roll_number=cand_user.roll_number,
                position=cand.position,
                slogan=cand.slogan,
                votes_count=vote_counts.get(cand.candidate_id, 0)
            )
        )

    return TurnoutAnalyticsResponse(
        election_id=election.election_id,
        election_title=election.title,
        status=election.status,
        total_eligible_voters=total_eligible,
        total_voted=total_voted,
        turnout_percentage=turnout_pct,
        candidate_tallies=candidate_tallies
    )
