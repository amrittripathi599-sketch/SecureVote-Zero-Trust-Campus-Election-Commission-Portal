from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_client_ip, require_admin
from app.models import AuditLog, Candidate, Election, ElectionParticipation, User, UserRole
from app.schemas import (
    AuditLogResponse,
    CandidateCreateRequest,
    CandidateResponse,
    ElectionCreateRequest,
    ElectionResponse,
    ElectionUpdateRequest,
    PaginatedAuditLogsResponse,
    UserResponse,
)
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
