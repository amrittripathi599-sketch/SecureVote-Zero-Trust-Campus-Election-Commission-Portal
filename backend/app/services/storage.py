import os
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Tuple
from fastapi import HTTPException, status

from app.config import settings


class StorageService(ABC):
    """Abstract interface for storing and serving candidate PDF manifestos."""

    @abstractmethod
    def upload_manifesto(self, file_bytes: bytes, original_filename: str) -> str:
        """Uploads candidate PDF manifesto and returns access URL."""
        pass

    @abstractmethod
    def read_manifesto(self, filename: str) -> Tuple[bytes, str]:
        """Reads stored manifesto bytes and MIME type."""
        pass


def validate_pdf_content(file_bytes: bytes, original_filename: str):
    """
    Zero-Trust File Integrity and Content Verification:
    1. Enforces strict file size limit (5MB).
    2. Enforces .pdf extension.
    3. Performs magic byte inspection: verifies file begins with '%PDF-' signature.
    """
    if len(file_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Uploaded file exceeds maximum permitted size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB."
        )

    if not original_filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type rejected: Manifesto must be a valid PDF document with a .pdf extension."
        )

    # Magic byte check: Valid PDF starts with %PDF (hex 25 50 44 46)
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content inspection failed: File header does not match genuine PDF magic signature (%PDF-)."
        )


class LocalStorageService(StorageService):
    """Local filesystem storage implementation for offline development."""

    def __init__(self, upload_dir: str = settings.UPLOAD_DIR):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def upload_manifesto(self, file_bytes: bytes, original_filename: str) -> str:
        validate_pdf_content(file_bytes, original_filename)
        sanitized_suffix = Path(original_filename).name.replace(" ", "_")
        unique_name = f"manifesto_{uuid.uuid4().hex[:12]}_{sanitized_suffix}"
        dest_path = self.upload_dir / unique_name

        with open(dest_path, "wb") as f:
            f.write(file_bytes)

        # Returns endpoint URL for local file retrieval
        return f"/uploads/{unique_name}"

    def read_manifesto(self, filename: str) -> Tuple[bytes, str]:
        # Path traversal guard
        safe_path = (self.upload_dir / Path(filename).name).resolve()
        if not str(safe_path).startswith(str(self.upload_dir.resolve())):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Path traversal detected.")
        if not safe_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manifesto file not found.")

        with open(safe_path, "rb") as f:
            return f.read(), "application/pdf"


class AzureBlobStorageService(StorageService):
    """Production cloud storage using Microsoft Azure Blob Storage."""

    def __init__(self, connection_string: str, container_name: str = settings.AZURE_CONTAINER_NAME):
        from azure.storage.blob import BlobServiceClient
        self.blob_service = BlobServiceClient.from_connection_string(connection_string)
        self.container_name = container_name
        # Ensure container exists
        container_client = self.blob_service.get_container_client(container_name)
        if not container_client.exists():
            container_client.create_container()

    def upload_manifesto(self, file_bytes: bytes, original_filename: str) -> str:
        from azure.storage.blob import ContentSettings
        validate_pdf_content(file_bytes, original_filename)

        sanitized_suffix = Path(original_filename).name.replace(" ", "_")
        unique_blob_name = f"manifestos/{uuid.uuid4().hex[:12]}_{sanitized_suffix}"

        blob_client = self.blob_service.get_blob_client(
            container=self.container_name,
            blob=unique_blob_name
        )
        blob_client.upload_blob(
            file_bytes,
            overwrite=True,
            content_settings=ContentSettings(content_type="application/pdf")
        )
        return blob_client.url

    def read_manifesto(self, filename: str) -> Tuple[bytes, str]:
        blob_client = self.blob_service.get_blob_client(
            container=self.container_name,
            blob=filename
        )
        if not blob_client.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manifesto file not found.")
        stream = blob_client.download_blob()
        return stream.readall(), "application/pdf"


def get_storage_service() -> StorageService:
    """Factory creating AzureBlobStorageService or LocalStorageService transparently."""
    if settings.AZURE_STORAGE_CONNECTION_STRING:
        return AzureBlobStorageService(
            connection_string=settings.AZURE_STORAGE_CONNECTION_STRING,
            container_name=settings.AZURE_CONTAINER_NAME
        )
    if settings.ENVIRONMENT.lower() == "production":
        raise ValueError(
            "FATAL ZERO-TRUST CONFIGURATION: Azure Blob Storage is required in production! "
            "AZURE_STORAGE_CONNECTION_STRING must be configured via environment variable or Azure Key Vault."
        )
    return LocalStorageService(upload_dir=settings.UPLOAD_DIR)
