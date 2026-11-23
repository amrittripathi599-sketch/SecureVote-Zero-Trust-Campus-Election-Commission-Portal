from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_client_ip, get_current_user
from app.models import ElectionParticipation, User, UserRole
from app.schemas import VoteCastRequest, VoteConfirmationResponse, VoteStatusResponse
from app.services.voting import cast_vote

router = APIRouter(prefix="/api/votes", tags=["Voting"])


@router.post("", response_model=VoteConfirmationResponse)
def submit_ballot(
    payload: VoteCastRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits an immutable ballot under zero-trust privacy and concurrency control:
    - Restricts action strictly to users with role='voter'.
    - Runs cast_vote transaction: locks user, verifies timeline, prevents double-voting,
      inserts into votes_ledger (without user_id) and election_participation atomically.
    - Preserves ballot secrecy by returning only confirmation metadata (NO candidate choice returned).
    """
    if current_user.role != UserRole.voter:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered voters may cast ballots."
        )

    client_ip = get_client_ip(request)

    timestamp = cast_vote(
        db=db,
        user_id=current_user.user_id,
        election_id=payload.election_id,
        candidate_id=payload.candidate_id,
        ip_address=client_ip
    )

    return VoteConfirmationResponse(
        success=True,
        message="Your vote has been securely, anonymously, and immutably recorded.",
        timestamp=timestamp
    )


@router.get("/status/{election_id}", response_model=VoteStatusResponse)
def check_voting_status(
    election_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Checks whether the current user has cast a ballot in the specified election.
    ZERO-TRUST PRIVACY GUARANTEE: Returns a boolean status only; NEVER reveals the candidate choice.
    """
    participation = db.execute(
        select(ElectionParticipation).where(
            ElectionParticipation.user_id == current_user.user_id,
            ElectionParticipation.election_id == election_id
        )
    ).scalar_one_or_none()

    return VoteStatusResponse(
        election_id=election_id,
        has_voted=participation is not None
    )
