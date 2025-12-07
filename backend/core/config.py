"""Application configuration using Pydantic settings."""
import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    
    # Security Settings
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Simple Admin Credentials (Single User Strategy)
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"  # Change in production via env var
    
    # CORS settings
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Whisper configuration
    whisper_model: str = "large-v3"
    whisper_language: str = "es"
    whisper_temperature: float = 0.0
    whisper_beam_size: int = 8
    normalize_audio: bool = True
    allow_mps: bool = False
    
    # File storage paths (relative to project root)
    upload_dir: Path = Path("../pending")
    processing_dir: Path = Path("../processing")
    done_dir: Path = Path("../done")
    failed_dir: Path = Path("../failed")
    max_upload_size: int = 500_000_000  # 500MB
    
    # Logging
    log_level: str = "INFO"
    log_file: Path = Path("../pipeline.log")
    
    # API metadata
    app_name: str = "WhisperForge API"
    app_version: str = "1.0.0"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    def get_absolute_path(self, path: Path) -> Path:
        """Convert relative path to absolute path from backend directory."""
        backend_dir = Path(__file__).parent.parent
        abs_path = (backend_dir / path).resolve()
        abs_path.mkdir(parents=True, exist_ok=True)
        return abs_path


# Global settings instance
settings = Settings()
