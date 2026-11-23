import os
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Force test environment for fast bcrypt rounds and isolated config
os.environ["ENVIRONMENT"] = "test"

import app.database as app_db
from app.config import settings
settings.ENVIRONMENT = "test"

from app.database import Base, get_db, install_db_triggers
from app.main import app
from app.models import (
    Candidate,
    Election,
    ElectionStatus,
    User,
    UserRole,
)
from app.security import create_access_token, hash_password

# StaticPool ensures all threads/sessions share the same in-memory SQLite database
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Rebind app's default SessionLocal and engine to test_engine
app_db.engine = test_engine
app_db.SessionLocal = TestingSessionLocal


@pytest.fixture(autouse=True)
def setup_and_seed_test_db():
    """Drops, recreates, and seeds fresh tables with triggers for every test."""
    with test_engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys = OFF"))
        conn.commit()
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    install_db_triggers(test_engine)
    with test_engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys = ON"))
        conn.commit()

    session = TestingSessionLocal()
    try:
        admin = User(
            user_id=1,
            roll_number="ADMIN001",
            full_name="Mr. Amrit Tripathi",
            password_hash=hash_password("Admin@123"),
            role=UserRole.admin,
            has_voted=False,
            created_at=datetime.utcnow()
        )
        voter1 = User(
            user_id=2,
            roll_number="STU001",
            full_name="Student One",
            password_hash=hash_password("Voter@123"),
            role=UserRole.voter,
            has_voted=False,
            created_at=datetime.utcnow()
        )
        voter2 = User(
            user_id=3,
            roll_number="STU002",
            full_name="Student Two",
            password_hash=hash_password("Voter@123"),
            role=UserRole.voter,
            has_voted=False,
            created_at=datetime.utcnow()
        )
        session.add_all([admin, voter1, voter2])
        session.commit()

        now = datetime.utcnow()
        election = Election(
            election_id=1,
            title="Campus Council Election 2026",
            start_time=now - timedelta(hours=2),
            end_time=now + timedelta(hours=24),
            status=ElectionStatus.open,
            created_by=admin.user_id
        )
        session.add(election)
        session.commit()

        candidate1 = Candidate(
            candidate_id=1,
            election_id=election.election_id,
            user_id=voter1.user_id,
            position="President",
            slogan="Empowering Students",
            manifesto_url="/uploads/manifesto1.pdf"
        )
        candidate2 = Candidate(
            candidate_id=2,
            election_id=election.election_id,
            user_id=voter2.user_id,
            position="Vice President",
            slogan="Action through Unity",
            manifesto_url="/uploads/manifesto2.pdf"
        )
        session.add_all([candidate1, candidate2])
        session.commit()
    finally:
        session.close()

    yield


@pytest.fixture
def db_session():
    """Yields a database session bound to the test database."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """Provides a FastAPI TestClient configured for the test environment."""
    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token():
    return create_access_token({"sub": "ADMIN001", "role": "admin"})


@pytest.fixture
def voter_token():
    return create_access_token({"sub": "STU001", "role": "voter"})


@pytest.fixture
def voter2_token():
    return create_access_token({"sub": "STU002", "role": "voter"})
