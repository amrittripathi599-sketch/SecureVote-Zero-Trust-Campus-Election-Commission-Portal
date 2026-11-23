import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routers import admin, analytics, auth, candidates, elections, votes
from app.seed import seed_database

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s"
)
logger = logging.getLogger("securevote")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager handling database initialization and demo data seeding."""
    logger.info("Initializing SecureVote database and registering immutability triggers...")
    init_db()

    # Ensure uploads folder exists
    upload_path = Path(settings.UPLOAD_DIR)
    upload_path.mkdir(parents=True, exist_ok=True)

    # Seed demo data if database is fresh
    seed_database()

    yield
    logger.info("SecureVote service shutting down...")


app = FastAPI(
    title="SecureVote API",
    description=(
        "Zero-Trust Campus Election & Audit Portal. Built with FastAPI, SQLAlchemy 2.0, "
        "and strict 3NF ballot secrecy with immutable audit logs."
    ),
    version="1.0.0",
    lifespan=lifespan
)

# ---------------------------------------------------------------------------
# Zero-Trust Security Headers Middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """
    Injects critical HTTP security headers according to OWASP Top 10 guidelines:
    - X-Content-Type-Options: nosniff prevents MIME type sniffing
    - X-Frame-Options: DENY prevents clickjacking in iframes
    - Strict-Transport-Security: enforces TLS in production
    - Referrer-Policy: prevents leaking URLs to third parties
    """
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ---------------------------------------------------------------------------
# Strict CORS Policy (Explicit Allowed Origins from Config)
# ---------------------------------------------------------------------------
cors_origins = [orig.strip() for orig in settings.FRONTEND_ORIGIN.split(",") if orig.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static Manifesto Downloads (Local Storage fallback)
# ---------------------------------------------------------------------------
uploads_dir = Path(settings.UPLOAD_DIR).resolve()
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# ---------------------------------------------------------------------------
# API Routers Registration
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(elections.router)
app.include_router(candidates.router)
app.include_router(votes.router)
app.include_router(admin.router)
app.include_router(analytics.router)


@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint for container orchestrators and monitoring probes."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "port": settings.PORT
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=(settings.ENVIRONMENT == "development")
    )
