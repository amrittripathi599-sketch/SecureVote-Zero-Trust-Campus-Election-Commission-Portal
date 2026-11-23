from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_client_ip, require_admin
from app.models import AuditLog, Candidate, Election, ElectionParticipation, ElectionStatus, User, UserRole, VotesLedger
from app.schemas import (
    AuditLogResponse,
    BatchVotersCreateRequest,
    BatchVotersCreateResponse,
    CandidateCreateRequest,
    CandidateResponse,
    DeclareResultResponse,
    DeclaredWinnerInfo,
    ElectionCreateRequest,
    ElectionResponse,
    ElectionUpdateRequest,
    PaginatedAuditLogsResponse,
    ResumeElectionRequest,
    TurnoutCandidateTally,
    UserResponse,
    VoterCreateRequest,
)
from app.security import hash_password
from app.services.storage import get_storage_service

router = APIRouter(prefix="/api/admin", tags=["Admin Portal"])


@router.post("/elections", response_model=ElectionResponse)
def create_election(
    payload: ElectionCreateRequest,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin-only: Initializes a new campus election."""
    if payload.end_time <= payload.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Election end time must be chronologically after the start time."
        )

    election = Election(
        title=payload.title,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status=payload.status,
        created_by=admin_user.user_id
    )
    db.add(election)
    db.flush()

    # Audit log
    audit_entry = AuditLog(
        user_id=admin_user.user_id,
        action="admin.election.create",
        status="success",
        timestamp=datetime.utcnow(),
        ip_address=get_client_ip(request),
        details=f"Created election '{election.title}' (ID: {election.election_id}, status: {election.status.value})"
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(election)

    res = ElectionResponse.model_validate(election)
    res.candidate_count = 0
    return res


@router.patch("/elections/{election_id}", response_model=ElectionResponse)
def update_election(
    election_id: int,
    payload: ElectionUpdateRequest,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin-only: Opens, closes, or reschedules an election."""
    election = db.execute(
        select(Election).where(Election.election_id == election_id)
    ).scalar_one_or_none()

    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Election ID {election_id} not found."
        )

    changes = []
    if payload.title is not None:
        changes.append(f"title: '{election.title}' -> '{payload.title}'")
        election.title = payload.title
    if payload.start_time is not None:
        changes.append(f"start_time: {payload.start_time}")
        election.start_time = payload.start_time
    if payload.end_time is not None:
        changes.append(f"end_time: {payload.end_time}")
        election.end_time = payload.end_time
    if payload.status is not None:
        changes.append(f"status: '{election.status.value}' -> '{payload.status.value}'")
        election.status = payload.status
        if payload.status == ElectionStatus.open and election.declared_at is not None:
            election.declared_at = None
            election.winner_candidate_id = None
            changes.append("revoked premature declaration")

    if election.end_time <= election.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Election end time must be chronologically after the start time."
        )

    # Audit log
    audit_entry = AuditLog(
        user_id=admin_user.user_id,
        action="admin.election.update",
        status="success",
        timestamp=datetime.utcnow(),
        ip_address=get_client_ip(request),
        details=f"Updated election ID {election_id}: {', '.join(changes)}"
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(election)

    cand_count = db.execute(
        select(func.count(Candidate.candidate_id)).where(Candidate.election_id == election_id)
    ).scalar() or 0

    res = ElectionResponse.model_validate(election)
    res.candidate_count = cand_count
    return res


@router.post("/elections/{election_id}/declare-result", response_model=DeclareResultResponse)
def declare_election_result(
    election_id: int,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Officially declares the election result.
    - Rejects with 403 if non-admin (enforced by require_admin).
    - Rejects with 409 Conflict if result is already declared.
    - Sets election status to 'closed'.
    - Computes final tally per candidate from votes_ledger (anonymous aggregates).
    - Determines winner candidate, persists declared_at and winner_candidate_id on election.
    - Writes an immutable audit log entry with action 'declare_result'.
    - Returns winner, per-candidate tallies, and turnout percentage.
    """
    election = db.execute(
        select(Election).where(Election.election_id == election_id)
    ).scalar_one_or_none()

    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Election ID {election_id} not found."
        )

    # 409 Conflict if already declared
    if election.declared_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Result already declared."
        )

    now = datetime.utcnow()

    # a) Set election status to 'closed'
    election.status = ElectionStatus.closed

    # b) Compute final tallies from votes_ledger (aggregate counts only, no voter IDs)
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

    total_eligible = db.execute(
        select(func.count(User.user_id)).where(User.role == UserRole.voter)
    ).scalar() or 0

    total_voted = db.execute(
        select(func.count(ElectionParticipation.user_id)).where(
            ElectionParticipation.election_id == election_id
        )
    ).scalar() or 0

    turnout_pct = round((total_voted / total_eligible * 100), 2) if total_eligible > 0 else 0.0

    candidate_tallies = []
    winner_cand = None
    max_votes = -1

    for cand, cand_user in candidates:
        votes = vote_counts.get(cand.candidate_id, 0)
        tally = TurnoutCandidateTally(
            candidate_id=cand.candidate_id,
            candidate_name=cand_user.full_name,
            roll_number=cand_user.roll_number,
            position=cand.position,
            slogan=cand.slogan,
            votes_count=votes
        )
        candidate_tallies.append(tally)

        if votes > max_votes:
            max_votes = votes
            winner_cand = cand

    # c) Store the result (declared_at and winner_candidate_id)
    election.declared_at = now
    if winner_cand and max_votes > 0:
        election.winner_candidate_id = winner_cand.candidate_id
    else:
        election.winner_candidate_id = winner_cand.candidate_id if winner_cand else None

    # d) Write audit log entry with action "declare_result"
    winner_name = winner_cand.user.full_name if (winner_cand and winner_cand.user) else "None"
    audit_entry = AuditLog(
        user_id=admin_user.user_id,
        action="declare_result",
        status="success",
        timestamp=now,
        ip_address=get_client_ip(request),
        details=f"Result declared for election '{election.title}' (ID {election_id}). Winner: {winner_name} with {max(0, max_votes)} votes. Turnout: {turnout_pct}%."
    )
    db.add(audit_entry)

    # Commit all changes in one database transaction
    db.commit()
    db.refresh(election)

    # Construct winner response info
    winner_info = None
    if winner_cand:
        winner_user = winner_cand.user
        winner_info = DeclaredWinnerInfo(
            candidate_id=winner_cand.candidate_id,
            candidate_name=winner_user.full_name if winner_user else "",
            roll_number=winner_user.roll_number if winner_user else "",
            position=winner_cand.position,
            slogan=winner_cand.slogan,
            votes_count=max(0, max_votes)
        )

    return DeclareResultResponse(
        election_id=election.election_id,
        election_title=election.title,
        status=election.status,
        declared_at=now,
        winner=winner_info,
        candidate_tallies=candidate_tallies,
        total_eligible_voters=total_eligible,
        total_voted=total_voted,
        turnout_percentage=turnout_pct
    )


@router.post("/elections/{election_id}/resume", response_model=ElectionResponse)
def resume_election(
    election_id: int,
    request: Request,
    payload: Optional[ResumeElectionRequest] = None,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Resumes an election if the result was accidentally declared or prematurely closed.
    - Requires role 'admin' (403 Forbidden for non-admins).
    - Validates that the election exists (404 Not Found).
    - If already open and not declared, returns 400 Bad Request.
    - Revokes declaration: sets declared_at = None, winner_candidate_id = None.
    - Sets election.status = ElectionStatus.open.
    - End time handling:
      - If payload and payload.new_end_time: validates new_end_time > now and new_end_time > start_time,
        then updates election.end_time.
      - If no new_end_time provided and election.end_time <= now: automatically extends end_time by 24 hours
        so voters can cast ballots without being blocked by an expired deadline.
    - Preserves all previously cast votes in votes_ledger and participation records.
    - Writes an immutable audit log entry with action="resume_election".
    - Returns updated ElectionResponse.
    """
    election = db.execute(
        select(Election).where(Election.election_id == election_id)
    ).scalar_one_or_none()

    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Election ID {election_id} not found."
        )

    if election.status == ElectionStatus.open and election.declared_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Election is already open and not declared."
        )

    now = datetime.utcnow()

    # End time adjustment if provided or if expired
    if payload and payload.new_end_time is not None:
        if payload.new_end_time <= now or payload.new_end_time <= election.start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New end time must be in the future and chronologically after start time."
            )
        election.end_time = payload.new_end_time
    elif election.end_time <= now:
        # Extend by 24 hours so voters can vote without being blocked by expired end_time
        election.end_time = now + timedelta(hours=24)

    was_declared = election.declared_at is not None
    election.status = ElectionStatus.open
    election.declared_at = None
    election.winner_candidate_id = None

    # Write immutable audit log
    audit_entry = AuditLog(
        user_id=admin_user.user_id,
        action="resume_election",
        status="success",
        timestamp=now,
        ip_address=get_client_ip(request),
        details=(
            f"Election '{election.title}' (ID {election_id}) resumed by admin. "
            f"Premature result declaration revoked: {was_declared}. "
            f"Status set to open. Voting active until {election.end_time.isoformat()}."
        )
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(election)

    cand_count = db.execute(
        select(func.count(Candidate.candidate_id)).where(Candidate.election_id == election_id)
    ).scalar() or 0

    res = ElectionResponse.model_validate(election)
    res.candidate_count = cand_count
    res.is_declared = False
    res.winner_name = None
    return res


@router.post("/candidates", response_model=CandidateResponse)
def add_candidate(
    payload: CandidateCreateRequest,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin-only: Registers an approved student candidate for an election."""
    election = db.execute(
        select(Election).where(Election.election_id == payload.election_id)
    ).scalar_one_or_none()
    if not election:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found.")

    voter_user = db.execute(
        select(User).where(User.user_id == payload.user_id)
    ).scalar_one_or_none()
    if not voter_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student user not found.")

    # Unique candidacy constraint check
    existing = db.execute(
        select(Candidate).where(
            Candidate.election_id == payload.election_id,
            Candidate.user_id == payload.user_id
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Student is already registered as a candidate for this election."
        )

    candidate = Candidate(
        election_id=payload.election_id,
        user_id=payload.user_id,
        position=payload.position,
        slogan=payload.slogan
    )
    db.add(candidate)
    db.flush()

    audit_entry = AuditLog(
        user_id=admin_user.user_id,
        action="admin.candidate.add",
        status="success",
        timestamp=datetime.utcnow(),
        ip_address=get_client_ip(request),
        details=f"Nominated user '{voter_user.roll_number}' as candidate ID {candidate.candidate_id} in election {payload.election_id}"
    )
    db.add(audit_entry)
    db.commit()

    return CandidateResponse(
        candidate_id=candidate.candidate_id,
        election_id=candidate.election_id,
        user_id=candidate.user_id,
        position=candidate.position,
        slogan=candidate.slogan,
        manifesto_url=candidate.manifesto_url,
        full_name=voter_user.full_name,
        roll_number=voter_user.roll_number
    )


@router.post("/candidates/{candidate_id}/manifesto", response_model=CandidateResponse)
async def upload_candidate_manifesto(
    candidate_id: int,
    file: UploadFile = File(...),
    request: Request = None,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Uploads candidate manifesto PDF to Azure Blob Storage or local storage.
    Enforces size verification, file extension, and %PDF magic bytes check.
    """
    candidate = db.execute(
        select(Candidate).where(Candidate.candidate_id == candidate_id)
    ).scalar_one_or_none()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate ID {candidate_id} not found."
        )

    file_bytes = await file.read()
    storage = get_storage_service()

    manifesto_url = storage.upload_manifesto(
        file_bytes=file_bytes,
        original_filename=file.filename or "manifesto.pdf"
    )

    candidate.manifesto_url = manifesto_url

    audit_entry = AuditLog(
        user_id=admin_user.user_id,
        action="admin.manifesto.upload",
        status="success",
        timestamp=datetime.utcnow(),
        ip_address=get_client_ip(request) if request else None,
        details=f"Uploaded manifesto for candidate ID {candidate_id}: {manifesto_url}"
    )
    db.add(audit_entry)
    db.commit()

    user = db.execute(select(User).where(User.user_id == candidate.user_id)).scalar_one()

    return CandidateResponse(
        candidate_id=candidate.candidate_id,
        election_id=candidate.election_id,
        user_id=candidate.user_id,
        position=candidate.position,
        slogan=candidate.slogan,
        manifesto_url=candidate.manifesto_url,
        full_name=user.full_name,
        roll_number=user.roll_number
    )


@router.get("/audit-logs", response_model=PaginatedAuditLogsResponse)
def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter by event action"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by event status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Query the tamper-evident audit logs with filtering and pagination.
    """
    query = select(AuditLog, User.roll_number).outerjoin(User, AuditLog.user_id == User.user_id)

    if action:
        query = query.where(AuditLog.action == action)
    if status_filter:
        query = query.where(AuditLog.status == status_filter)

    total_count = db.execute(
        select(func.count(AuditLog.log_id)).where(
            *([AuditLog.action == action] if action else []),
            *([AuditLog.status == status_filter] if status_filter else [])
        )
    ).scalar() or 0

    query = query.order_by(AuditLog.timestamp.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = db.execute(query).all()

    items = []
    for log, roll in rows:
        items.append(
            AuditLogResponse(
                log_id=log.log_id,
                user_id=log.user_id,
                roll_number=roll,
                action=log.action,
                status=log.status,
                timestamp=log.timestamp,
                ip_address=log.ip_address,
                details=log.details
            )
        )

    return PaginatedAuditLogsResponse(
        total=total_count,
        page=page,
        page_size=page_size,
        items=items
    )


@router.get("/users", response_model=List[UserResponse])
def list_users(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Lists all registered students and administrators.
    Displays user metadata and has_voted status.
    ZERO-TRUST REQUIREMENT: Never exposes password_hash.
    """
    users = db.execute(select(User).order_by(User.roll_number.asc())).scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("/voters", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_voter(
    payload: VoterCreateRequest,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Registers a new eligible student voter.
    - Requires role 'admin' (403 Forbidden for non-admins).
    - Checks for roll number uniqueness (case-insensitive) -> 409 Conflict if duplicate.
    - Hashes password securely via bcrypt (password never stored or transmitted plaintext).
    - Persists with role='voter', has_voted=False.
    - Records an immutable audit log entry (action='admin.voter.create').
    - Returns UserResponse with password_hash strictly omitted.
    """
    roll_clean = payload.roll_number.strip().upper()
    name_clean = payload.full_name.strip()

    existing = db.execute(
        select(User).where(func.upper(User.roll_number) == roll_clean)
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with roll number '{roll_clean}' already exists."
        )

    now = datetime.utcnow()
    new_voter = User(
        roll_number=roll_clean,
        password_hash=hash_password(payload.password),
        full_name=name_clean,
        role=UserRole.voter,
        has_voted=False,
        created_at=now
    )
    db.add(new_voter)
    db.flush()

    audit_entry = AuditLog(
        user_id=admin_user.user_id,
        action="admin.voter.create",
        status="success",
        timestamp=now,
        ip_address=get_client_ip(request),
        details=f"Admin registered eligible student voter '{name_clean}' (Roll: {roll_clean}, User ID: {new_voter.user_id})."
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(new_voter)

    return UserResponse.model_validate(new_voter)


@router.post("/voters/batch", response_model=BatchVotersCreateResponse, status_code=status.HTTP_201_CREATED)
def batch_create_voters(
    payload: BatchVotersCreateRequest,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Bulk register student voters.
    - Creates eligible voters in batch.
    - Gracefully skips existing roll numbers.
    - Writes an immutable audit entry for the batch creation.
    """
    now = datetime.utcnow()
    created_voters = []
    skipped_rolls = []

    for item in payload.voters:
        roll_clean = item.roll_number.strip().upper()
        name_clean = item.full_name.strip()

        existing = db.execute(
            select(User).where(func.upper(User.roll_number) == roll_clean)
        ).scalar_one_or_none()

        if existing:
            skipped_rolls.append(roll_clean)
            continue

        voter = User(
            roll_number=roll_clean,
            password_hash=hash_password(item.password),
            full_name=name_clean,
            role=UserRole.voter,
            has_voted=False,
            created_at=now
        )
        db.add(voter)
        db.flush()
        created_voters.append(UserResponse.model_validate(voter))

    if created_voters:
        audit_entry = AuditLog(
            user_id=admin_user.user_id,
            action="admin.voter.batch_create",
            status="success",
            timestamp=now,
            ip_address=get_client_ip(request),
            details=f"Admin batch-registered {len(created_voters)} voters. Skipped {len(skipped_rolls)} duplicates."
        )
        db.add(audit_entry)

    db.commit()

    return BatchVotersCreateResponse(
        created_count=len(created_voters),
        skipped_count=len(skipped_rolls),
        created_voters=created_voters,
        skipped_roll_numbers=skipped_rolls
    )
