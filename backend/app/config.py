import logging
import os
from typing import Any, Dict, Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("securevote.config")


def fetch_key_vault_secrets(vault_url: str) -> Dict[str, str]:
    """
    Loads sensitive connection strings and secrets from Azure Key Vault
    using DefaultAzureCredential (Managed Identity in App Service, Azure CLI locally).
    Supports standard Key Vault naming patterns (hyphenated or underscored).
    """
    secrets: Dict[str, str] = {}
    try:
        from azure.identity import DefaultAzureCredential
        from azure.keyvault.secrets import SecretClient

        logger.info(f"Connecting to Azure Key Vault at {vault_url} via DefaultAzureCredential...")
        credential = DefaultAzureCredential()
        client = SecretClient(vault_url=vault_url, credential=credential)

        # Mapping of setting name -> candidate secret names in Azure Key Vault
        mappings = {
            "DATABASE_URL": ["DATABASE-URL", "database-url", "DATABASE_URL"],
            "JWT_SECRET": ["JWT-SECRET", "jwt-secret", "JWT_SECRET"],
            "AZURE_STORAGE_CONNECTION_STRING": [
                "AZURE-STORAGE-CONNECTION-STRING",
                "azure-storage-connection-string",
                "AZURE_STORAGE_CONNECTION_STRING"
            ]
        }

        for setting_key, candidates in mappings.items():
            for secret_name in candidates:
                try:
                    val = client.get_secret(secret_name).value
                    if val:
                        secrets[setting_key] = val
                        logger.info(f"Successfully loaded '{setting_key}' from Key Vault secret '{secret_name}'.")
                        break
                except Exception:
                    continue

    except Exception as exc:
        logger.warning(f"Unable to load secrets from Azure Key Vault ({vault_url}): {exc}")

    return secrets


class Settings(BaseSettings):
    """Application configuration and zero-trust security settings."""

    PROJECT_NAME: str = "SecureVote"
    ENVIRONMENT: str = "development"  # development | production | test
    PORT: int = 8000
    DATABASE_URL: str = "sqlite:///./securevote.db"

    # Azure Key Vault (Optional: if set, retrieves DATABASE_URL, JWT_SECRET, AZURE_STORAGE_CONNECTION_STRING)
    KEY_VAULT_URL: Optional[str] = None

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

    @model_validator(mode="before")
    @classmethod
    def load_from_key_vault_if_configured(cls, data: Any) -> Any:
        """If KEY_VAULT_URL is configured, fetches secrets from Azure Key Vault before validation."""
        vault_url = None
        if isinstance(data, dict):
            vault_url = data.get("KEY_VAULT_URL") or os.environ.get("KEY_VAULT_URL")
        else:
            vault_url = os.environ.get("KEY_VAULT_URL")

        if vault_url:
            kv_secrets = fetch_key_vault_secrets(vault_url)
            if isinstance(data, dict):
                for k, v in kv_secrets.items():
                    if v:
                        data[k] = v
            else:
                for k, v in kv_secrets.items():
                    if v and k not in os.environ:
                        os.environ[k] = v

        return data

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """Zero-trust validation for production deployments."""
        if self.ENVIRONMENT.lower() == "production":
            # 1. Reject insecure or weak JWT Secret
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
                    "Set a secure JWT_SECRET with at least 32 characters in your environment or Key Vault."
                )

            # 2. Reject SQLite in production (PostgreSQL is required)
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError(
                    "FATAL ZERO-TRUST CHECK: Production requires PostgreSQL. SQLite is strictly permitted for local development only. "
                    "Please configure a valid PostgreSQL DATABASE_URL in your environment or Key Vault."
                )

            # 3. Require Azure Blob Storage in production
            if not self.AZURE_STORAGE_CONNECTION_STRING:
                raise ValueError(
                    "FATAL ZERO-TRUST CHECK: Azure Blob Storage is required in production! "
                    "Please configure AZURE_STORAGE_CONNECTION_STRING via environment variable or Azure Key Vault."
                )

        return self


settings = Settings()
