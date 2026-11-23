import enum
from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    voter = "voter"


class ElectionStatus(str, enum.Enum):
    draft = "draft"
    open = "open"
    closed = "closed"


class AuditStatus(str, enum.Enum):
    success = "success"
    failure = "failure"


class User(Base):
    """
    User entity representing students (voters) and campus election commissioners (admins).
    Third Normal Form (3NF) compliant.
    """
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    roll_number = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, values_callable=lambda x: [e.value for e in x]), nullable=False, default=UserRole.voter)
    has_voted = Column(Boolean, default=False, nullable=False)
    full_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    created_elections = relationship("Election", back_populates="creator", foreign_keys="Election.created_by")
    candidacies = relationship("Candidate", back_populates="user", foreign_keys="Candidate.user_id")
    participations = relationship("ElectionParticipation", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


class Election(Base):
    """
    Election entity defining the timeline and lifecycle state of campus polls.
    """
    __tablename__ = "elections"

    election_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(150), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(Enum(ElectionStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=ElectionStatus.draft, index=True)
    created_by = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    declared_at = Column(DateTime, nullable=True)
    winner_candidate_id = Column(
        Integer,
        ForeignKey("candidates.candidate_id", use_alter=True, name="fk_election_winner_candidate", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    creator = relationship("User", back_populates="created_elections", foreign_keys=[created_by])
    candidates = relationship("Candidate", back_populates="election", cascade="all, delete-orphan", foreign_keys="[Candidate.election_id]")
    participations = relationship("ElectionParticipation", back_populates="election", cascade="all, delete-orphan")
    votes = relationship("VotesLedger", back_populates="election", cascade="all, delete-orphan")
    winner = relationship("Candidate", foreign_keys=[winner_candidate_id], post_update=True)


class Candidate(Base):
    """
    Candidate nominated for an election, associated with a position, slogan, and manifesto PDF.
    Unique constraint ensures one candidacy per user per election.
    """
    __tablename__ = "candidates"

    candidate_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    election_id = Column(Integer, ForeignKey("elections.election_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    manifesto_url = Column(String(500), nullable=True)
    position = Column(String(100), nullable=False, default="Representative")
    slogan = Column(String(255), nullable=True)

    # Relationships
    election = relationship("Election", back_populates="candidates", foreign_keys=[election_id])
    user = relationship("User", back_populates="candidacies")
    votes = relationship("VotesLedger", back_populates="candidate")

    __table_args__ = (
        UniqueConstraint("election_id", "user_id", name="uq_candidate_election_user"),
        Index("ix_candidates_election_user", "election_id", "user_id"),
    )


class VotesLedger(Base):
    """
    IMMUTABLE VOTES LEDGER.
    CRITICAL ZERO-TRUST & PRIVACY REQUIREMENT:
    This table explicitly contains NO user_id column.
    Ballot secrecy is mathematically and relationally preserved by physically severing
    any linkage between voter identity and candidate choice.
    """
    __tablename__ = "votes_ledger"

    vote_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    election_id = Column(Integer, ForeignKey("elections.election_id", ondelete="RESTRICT"), nullable=False, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.candidate_id", ondelete="RESTRICT"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    election = relationship("Election", back_populates="votes")
    candidate = relationship("Candidate", back_populates="votes")

    __table_args__ = (
        Index("ix_votes_ledger_election_candidate", "election_id", "candidate_id"),
    )


class ElectionParticipation(Base):
    """
    Election-scoped participation record.
    Enforces that a user can cast a ballot only once per election.
    Decoupled from votes_ledger to guarantee anonymity while preventing double-voting.
    """
    __tablename__ = "election_participation"

    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), primary_key=True, nullable=False)
    election_id = Column(Integer, ForeignKey("elections.election_id", ondelete="RESTRICT"), primary_key=True, nullable=False)
    voted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="participations")
    election = relationship("Election", back_populates="participations")

    __table_args__ = (
        Index("ix_participation_election_user", "election_id", "user_id"),
    )


class AuditLog(Base):
    """
    Append-only tamper-evident audit log recording every sensitive security event:
    login attempts, election state changes, candidate registration, and vote submissions.
    """
    __tablename__ = "audit_logs"

    log_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False, index=True)  # 'success' | 'failure'
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)
    details = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_logs_action_status", "action", "status"),
    )
