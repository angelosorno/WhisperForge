"""Pydantic models for API request/response schemas."""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    """Job status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TranscriptionConfig(BaseModel):
    """Configuration for transcription job."""
    model: str = Field(default="large-v3", description="Whisper model to use")
    language: str = Field(default="es", description="Language code")
    temperature: float = Field(default=0.0, ge=0.0, le=1.0)
    beam_size: int = Field(default=8, ge=1, le=10)
    normalize_audio: bool = Field(default=True, description="Normalize audio to 16kHz WAV")
    initial_prompt: Optional[str] = Field(default=None, description="Custom prompt for Whisper")


class JobCreate(BaseModel):
    """Request model for creating a new job."""
    filename: str
    config: Optional[TranscriptionConfig] = None


class JobMetadata(BaseModel):
    """Metadata about transcription job."""
    job_name: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    elapsed_sec: Optional[float] = None
    audio_duration_sec: Optional[float] = None
    elapsed_min: Optional[float] = None
    audio_duration_min: Optional[float] = None
    elapsed_hms: Optional[str] = None
    audio_duration_hms: Optional[str] = None
    rtf: Optional[float] = None
    coverage_ratio: Optional[float] = None
    model: str
    device: str
    fp16: bool
    language: str
    beam_size: int
    temperature: float
    normalized_16k: bool
    input_original_name: str
    chars: Optional[int] = None
    words: Optional[int] = None
    segments: Optional[int] = None


class JobResponse(BaseModel):
    """Response model for job information."""
    job_id: str
    status: JobStatus
    filename: str
    created_at: datetime
    updated_at: datetime
    config: TranscriptionConfig
    metadata: Optional[JobMetadata] = None
    transcript: Optional[str] = None
    error: Optional[str] = None
    progress: Optional[float] = Field(default=0.0, ge=0.0, le=100.0)


class JobListResponse(BaseModel):
    """Response model for list of jobs."""
    jobs: list[JobResponse]
    total: int


class ProgressUpdate(BaseModel):
    """WebSocket progress update message."""
    job_id: str
    status: JobStatus
    progress: float = Field(ge=0.0, le=100.0)
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    whisper_available: bool
    device: str


class TranslationRequest(BaseModel):
    """Request model for translation."""
    target_language: str = Field(..., description="Target language code (fr, de, it, en)")
    create_bilingual_srt: bool = Field(default=False, description="Create bilingual SRT file")


class TranslationResponse(BaseModel):
    """Response model for translation."""
    job_id: str
    source_language: str
    target_language: str
    translated_text: str
    comparison_file: str
    translated_file: str
    bilingual_srt_file: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class TranslationListItem(BaseModel):
    """Translation metadata for listing."""
    language: str
    language_name: str
    translated_file: str
    comparison_file: str
    bilingual_srt_file: Optional[str] = None
    created_at: datetime


class TranslationListResponse(BaseModel):
    """Response model for list of translations."""
    job_id: str
    source_language: str
    translations: list[TranslationListItem]
