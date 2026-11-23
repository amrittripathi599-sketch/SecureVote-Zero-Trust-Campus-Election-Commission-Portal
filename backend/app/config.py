from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration and zero-trust security settings."""

    PROJECT_NAME: str = "SecureVote"
    ENVIRONMENT: str = "development"  # development | production | test
    DATABASE_URL: str = "sqlite:///./securevote.db"

    # JWT Settings (60 minutes expiry default)
    JWT_SECRET: str = "INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # Storage Settings (Local Disk vs Azure Blob Storage)
    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = None
    AZURE_CONTAINER_NAME: str = "manifestos"
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB

    # Login Rate Limiting (5 failed attempts per roll number in 10 minutes)
    LOGIN_RATE_LIMIT_ATTEMPTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_MINUTES: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """Refuse to run in production if the JWT secret is a known insecure placeholder."""
        if self.ENVIRONMENT.lower() == "production":
            insecure_defaults = {
                "INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION",
                "your-secret-key-here",
                "secret",
                "changeme",
                "default",
            }
            if self.JWT_SECRET in insecure_defaults or len(self.JWT_SECRET) < 32:
                raise ValueError(
                    "FATAL ZERO-TRUST CHECK: Refusing to start in production with default or weak JWT_SECRET! "
                    "Set a secure JWT_SECRET with at least 32 characters in your environment."
                )
        return self


settings = Settings()
