from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Election, ElectionParticipation, User
from app.schemas import ElectionResponse

router = APIRouter(prefix="/api/elections", tags=["Elections"])


@router.get("", response_model=List[ElectionResponse])
def list_elections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists all campus elections with live candidate counts and user-specific voting status.
    All authenticated roles (voters and admins) can access this endpoint.
    """
    elections = db.execute(
        select(Election).order_by(Election.start_time.desc())
    ).scalars().all()

    # Pre-fetch candidate counts
    candidate_counts = dict(
        db.execute(
            select(Candidate.election_id, func.count(Candidate.candidate_id))
            .group_by(Candidate.election_id)
        ).all()
    )

    # Pre-fetch current user's participated elections
    voted_elections = set(
        db.execute(
            select(ElectionParticipation.election_id)
            .where(ElectionParticipation.user_id == current_user.user_id)
        ).scalars().all()
    )

    result = []
    for election in elections:
        res = ElectionResponse.model_validate(election)
        res.candidate_count = candidate_counts.get(election.election_id, 0)
        res.has_current_user_voted = election.election_id in voted_elections
        result.append(res)

    return result


@router.get("/{election_id}", response_model=ElectionResponse)
def get_election(
    election_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves detailed configuration and status for a specific election."""
    election = db.execute(
        select(Election).where(Election.election_id == election_id)
    ).scalar_one_or_none()

    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Election ID {election_id} not found."
        )

    cand_count = db.execute(
        select(func.count(Candidate.candidate_id)).where(Candidate.election_id == election_id)
    ).scalar() or 0

    has_voted = db.execute(
        select(ElectionParticipation).where(
            ElectionParticipation.election_id == election_id,
            ElectionParticipation.user_id == current_user.user_id
        )
    ).scalar_one_or_none() is not None

    res = ElectionResponse.model_validate(election)
    res.candidate_count = cand_count
    res.has_current_user_voted = has_voted
    return res
