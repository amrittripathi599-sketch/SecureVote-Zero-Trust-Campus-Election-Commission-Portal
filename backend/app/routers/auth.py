from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import check_login_rate_limit, get_client_ip, get_current_user
from app.models import AuditLog, User
from app.schemas import TokenResponse, UserLoginRequest, UserResponse
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: UserLoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Zero-Trust User Authentication:
    1. Checks rate limiting to throttle brute force credential attacks.
    2. Performs parameterized lookup by roll number.
    3. Verifies password hash using constant-time bcrypt verification.
    4. Writes an immutable audit log entry for both successful and failed attempts.
    5. Issues a cryptographically signed JWT with 60-minute lifetime.
    """
    client_ip = get_client_ip(request)
    normalized_roll = payload.roll_number.strip().upper()

    # Step 1: Check login rate limit
    check_login_rate_limit(db, normalized_roll)

    # Step 2: Parameterized query lookup (Prevents SQL injection)
    user = db.execute(
        select(User).where(User.roll_number == normalized_roll)
    ).scalar_one_or_none()

    # Step 3: Verify credentials
    if not user or not verify_password(payload.password, user.password_hash):
        # Audit log failed login attempt
        audit_entry = AuditLog(
            user_id=user.user_id if user else None,
            action="auth.login",
            status="failure",
            timestamp=datetime.utcnow(),
            ip_address=client_ip,
            details=f"Failed login attempt for roll_number='{normalized_roll}'"
        )
        db.add(audit_entry)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid roll number or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Step 4: Audit log successful login attempt
    audit_entry = AuditLog(
        user_id=user.user_id,
        action="auth.login",
        status="success",
        timestamp=datetime.utcnow(),
        ip_address=client_ip,
        details=f"Successful login for roll_number='{normalized_roll}'"
    )
    db.add(audit_entry)
    db.commit()

    # Step 5: Generate JWT token
    token = create_access_token(data={"sub": user.roll_number, "role": user.role.value})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Returns the authenticated user's profile without exposing password hashes."""
    return UserResponse.model_validate(current_user)
