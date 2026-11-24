from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models import ElectionStatus, UserRole


# ---------------------------------------------------------
# User Schemas
# ---------------------------------------------------------
class UserBase(BaseModel):
    roll_number: str = Field(..., min_length=2, max_length=50, description="Unique institutional roll number")
    full_name: str = Field(..., min_length=2, max_length=100, description="Full student or administrator name")


class UserLoginRequest(BaseModel):
    roll_number: str = Field(..., description="Institutional roll number (case-insensitive)")
    password: str = Field(..., min_length=6, description="Account password")


class VoterCreateRequest(BaseModel):
    roll_number: str = Field(..., min_length=2, max_length=50, description="Unique institutional roll number")
    full_name: str = Field(..., min_length=2, max_length=100, description="Full student name")
    password: str = Field(..., min_length=6, max_length=100, description="Initial account password")


class BatchVotersCreateRequest(BaseModel):
    voters: List[VoterCreateRequest] = Field(..., min_length=1, max_length=500)


class UserResponse(UserBase):
    user_id: int
    role: UserRole
    has_voted: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BatchVotersCreateResponse(BaseModel):
    created_count: int
    skipped_count: int
    created_voters: List[UserResponse]
    skipped_roll_numbers: List[str]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------------------------------------------------------
# Election Schemas
# ---------------------------------------------------------
class ElectionCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    start_time: datetime
    end_time: datetime
    status: ElectionStatus = ElectionStatus.draft


class ElectionUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=150)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[ElectionStatus] = None


class ResumeElectionRequest(BaseModel):
    new_end_time: Optional[datetime] = None


class ElectionResponse(BaseModel):
    election_id: int
    title: str
    start_time: datetime
    end_time: datetime
    status: ElectionStatus
    created_by: int
    candidate_count: int = 0
    has_current_user_voted: Optional[bool] = None
    declared_at: Optional[datetime] = None
    winner_candidate_id: Optional[int] = None
    is_declared: bool = False
    winner_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Candidate Schemas
# ---------------------------------------------------------
class CandidateCreateRequest(BaseModel):
    election_id: int
    user_id: int
    position: str = Field("Student Representative", min_length=2, max_length=100)
    slogan: Optional[str] = Field(None, max_length=255)


class CandidateResponse(BaseModel):
    candidate_id: int
    election_id: int
    user_id: int
    full_name: str
    roll_number: str
    position: str
    slogan: Optional[str] = None
    manifesto_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Voting Schemas
# ---------------------------------------------------------
class VoteCastRequest(BaseModel):
    election_id: int
    candidate_id: int


class VoteStatusResponse(BaseModel):
    election_id: int
    has_voted: bool


class VoteConfirmationResponse(BaseModel):
    success: bool = True
    message: str = "Your vote has been securely and immutably recorded."
    timestamp: datetime


# ---------------------------------------------------------
# Audit Log Schemas
# ---------------------------------------------------------
class AuditLogResponse(BaseModel):
    log_id: int
    user_id: Optional[int] = None
    roll_number: Optional[str] = None
    action: str
    status: str
    timestamp: datetime
    ip_address: Optional[str] = None
    details: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedAuditLogsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[AuditLogResponse]


# ---------------------------------------------------------
# Analytics Schemas
# ---------------------------------------------------------
class TurnoutCandidateTally(BaseModel):
    candidate_id: int
    candidate_name: str
    roll_number: str
    position: str
    slogan: Optional[str] = None
    votes_count: int


class DeclaredWinnerInfo(BaseModel):
    candidate_id: Optional[int] = None
    candidate_name: Optional[str] = None
    roll_number: Optional[str] = None
    position: Optional[str] = None
    slogan: Optional[str] = None
    votes_count: int = 0


class DeclareResultResponse(BaseModel):
    election_id: int
    election_title: str
    status: ElectionStatus
    declared_at: datetime
    winner: Optional[DeclaredWinnerInfo] = None
    candidate_tallies: List[TurnoutCandidateTally]
    total_eligible_voters: int
    total_voted: int
    turnout_percentage: float


class TurnoutAnalyticsResponse(BaseModel):
    election_id: int
    election_title: str
    status: ElectionStatus
    total_eligible_voters: int
    total_voted: int
    turnout_percentage: float
    candidate_tallies: List[TurnoutCandidateTally]
    declared_at: Optional[datetime] = None
    winner_candidate_id: Optional[int] = None
    winner: Optional[DeclaredWinnerInfo] = None
    is_declared: bool = False


# ---------------------------------------------------------
# Password Reset Schemas
# ---------------------------------------------------------
class AdminPasswordResetRequest(BaseModel):
    current_password: str = Field(..., description="Current administrator password for verification")
    new_password: str = Field(..., min_length=6, max_length=128, description="New strong password")


class UserPasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128, description="New user password")


class PasswordResetResponse(BaseModel):
    message: str
    roll_number: str
    updated_at: datetime
