from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AuditLog, User, UserRole
from app.security import decode_access_token

security_scheme = HTTPBearer(auto_error=True)


def get_client_ip(request: Request) -> str:
    """Extracts client IP address respecting reverse proxies and forwarded headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates the JWT access token and loads the authenticated user.
    Uses parameterized query via SQLAlchemy ORM (prevents SQL injection).
    """
    token = credentials.credentials
    payload = decode_access_token(token)

    roll_number: Optional[str] = payload.get("sub")
    if not roll_number:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject identity claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Parameterized ORM lookup
    user = db.execute(select(User).where(User.roll_number == roll_number.upper())).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account associated with this token no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Role-Based Access Control (RBAC) dependency.
    Restricts access strictly to users with role='admin'.
    Voters receive a strict 403 Forbidden.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrative privileges required for this action."
        )
    return current_user


def check_login_rate_limit(db: Session, roll_number: str):
    """
    Zero-Trust Brute-Force Protection:
    Enforces a strict rate limit of 5 failed attempts per roll number in a 10-minute sliding window.
    Throws 429 Too Many Requests if threshold is exceeded.
    """
    threshold_time = datetime.utcnow() - timedelta(minutes=settings.LOGIN_RATE_LIMIT_WINDOW_MINUTES)
    normalized_roll = roll_number.strip().upper()

    # Parameterized query against immutable audit logs
    failed_attempts = db.execute(
        select(AuditLog)
        .where(
            AuditLog.action == "auth.login",
            AuditLog.status == "failure",
            AuditLog.details.like(f"%roll_number='{normalized_roll}'%"),
            AuditLog.timestamp >= threshold_time
        )
    ).scalars().all()

    if len(failed_attempts) >= settings.LOGIN_RATE_LIMIT_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Zero-trust alert: Excessive failed login attempts for roll number '{normalized_roll}'. "
                   f"Account is temporarily throttled. Please try again after {settings.LOGIN_RATE_LIMIT_WINDOW_MINUTES} minutes."
        )
