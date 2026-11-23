import os
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, init_db
from app.models import (
    Candidate,
    Election,
    ElectionStatus,
    User,
    UserRole,
)
from app.security import hash_password


def generate_sample_pdf(candidate_name: str, position: str, vision: str) -> bytes:
    """Generates a genuine compliant PDF file with valid header and typography stream."""
    stream_content = f"""BT
/F1 20 Tf
50 720 Td
(CAMPUS ELECTION 2026 - CANDIDATE MANIFESTO) Tj
/F1 14 Tf
0 -40 Td
(Candidate: {candidate_name}) Tj
0 -25 Td
(Position: {position}) Tj
0 -40 Td
(Vision & Key Initiatives:) Tj
/F1 11 Tf
0 -25 Td
({vision}) Tj
0 -25 Td
(- 24/7 Library & Maker-space access with high-speed internet) Tj
0 -20 Td
(- Transparent budgeting for campus clubs and student hackathons) Tj
0 -20 Td
(- Carbon-neutral campus initiatives and subsidized meal programs) Tj
0 -40 Td
(Vote for integrity, zero-trust fairness, and student progress!) Tj
ET"""

    stream_bytes = stream_content.encode("latin-1")
    stream_len = len(stream_bytes)

    pdf_text = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length {stream_len} >>
stream
{stream_content}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000350 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
450
%%EOF
"""
    return pdf_text.encode("latin-1")


def seed_database(db: Session = None):
    """
    Populates database with initial demonstration accounts, demo election,
    and nominated candidates if the database is currently empty.
    """
    close_db = False
    if db is None:
        init_db()
        db = SessionLocal()
        close_db = True

    try:
        # Check if users already exist
        existing_user = db.execute(select(User).limit(1)).scalar_one_or_none()
        if existing_user is not None:
            print("Database already contains data. Skipping initial seeding.")
            return

        print("Seeding demo database for SecureVote...")

        # 1. Create 1 Admin
        admin_user = User(
            roll_number="ADMIN001",
            password_hash=hash_password("Admin@123"),
            full_name="Dr. Eleanor Vance (Chief Election Officer)",
            role=UserRole.admin,
            has_voted=False,
            created_at=datetime.utcnow()
        )
        db.add(admin_user)
        db.flush()

        # 2. Create 5 Voters (STU001 to STU005)
        voters_data = [
            ("STU001", "Aarav Sharma"),
            ("STU002", "Bhavna Patel"),
            ("STU003", "Chirag Verma"),
            ("STU004", "Divya Nair"),
            ("STU005", "Eshan Gupta"),
        ]

        voter_records = []
        for roll, name in voters_data:
            voter = User(
                roll_number=roll,
                password_hash=hash_password("Voter@123"),
                full_name=name,
                role=UserRole.voter,
                has_voted=False,
                created_at=datetime.utcnow()
            )
            db.add(voter)
            voter_records.append(voter)
        db.flush()

        # 3. Create 1 Demo Election "Student Council 2026"
        now = datetime.utcnow()
        demo_election = Election(
            title="Student Council 2026",
            start_time=now - timedelta(days=1),
            end_time=now + timedelta(days=7),
            status=ElectionStatus.open,
            created_by=admin_user.user_id
        )
        db.add(demo_election)
        db.flush()

        # 4. Prepare local uploads directory for manifesto PDFs
        upload_dir = Path(settings.UPLOAD_DIR)
        upload_dir.mkdir(parents=True, exist_ok=True)

        candidates_meta = [
            (
                voter_records[0],
                "Council President",
                "Progress through Transparency and Student Empowerment",
                "Championing student rights, open budget governance, and 24/7 lab facilities.",
                "manifesto_aarav_sharma.pdf"
            ),
            (
                voter_records[1],
                "Vice President",
                "Innovation, Inclusivity, and Modern Campus Life",
                "Driving research innovation, women in STEM hackathons, and wellness programs.",
                "manifesto_bhavna_patel.pdf"
            ),
            (
                voter_records[2],
                "General Secretary",
                "Efficient Operations and Dynamic Student Activities",
                "Promoting inter-college sports, streamlined club funding, and sustainability.",
                "manifesto_chirag_verma.pdf"
            ),
        ]

        for voter, position, slogan, vision, filename in candidates_meta:
            pdf_bytes = generate_sample_pdf(voter.full_name, position, vision)
            file_path = upload_dir / filename
            with open(file_path, "wb") as f:
                f.write(pdf_bytes)

            manifesto_url = f"/uploads/{filename}"

            candidate = Candidate(
                election_id=demo_election.election_id,
                user_id=voter.user_id,
                position=position,
                slogan=slogan,
                manifesto_url=manifesto_url
            )
            db.add(candidate)

        db.commit()
        print("Database successfully seeded with demo accounts and election!")

    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    seed_database()
