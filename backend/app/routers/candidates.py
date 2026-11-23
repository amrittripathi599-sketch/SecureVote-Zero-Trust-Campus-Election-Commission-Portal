from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Election, User
from app.schemas import CandidateResponse

router = APIRouter(prefix="/api/elections", tags=["Candidates"])


@router.get("/{election_id}/candidates", response_model=List[CandidateResponse])
def get_election_candidates(
    election_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists all nominated candidates for a specific election.
    Includes candidate name, slogan, position, and manifesto download link.
    """
    election = db.execute(
        select(Election).where(Election.election_id == election_id)
    ).scalar_one_or_none()

    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Election ID {election_id} not found."
        )

    # Parameterized join between Candidate and User
    query = (
        select(
            Candidate.candidate_id,
            Candidate.election_id,
            Candidate.user_id,
            Candidate.position,
            Candidate.slogan,
            Candidate.manifesto_url,
            User.full_name,
            User.roll_number,
        )
        .join(User, Candidate.user_id == User.user_id)
        .where(Candidate.election_id == election_id)
        .order_by(Candidate.candidate_id.asc())
    )

    rows = db.execute(query).all()

    candidates = [
        CandidateResponse(
            candidate_id=r.candidate_id,
            election_id=r.election_id,
            user_id=r.user_id,
            position=r.position,
            slogan=r.slogan,
            manifesto_url=r.manifesto_url,
            full_name=r.full_name,
            roll_number=r.roll_number,
        )
        for r in rows
    ]

    return candidates
