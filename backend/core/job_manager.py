"""Job queue and state management for transcription tasks."""
import asyncio
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Callable, Any
from collections import OrderedDict

from models.schemas import JobStatus, JobResponse, TranscriptionConfig, JobMetadata


class Job:
    """Represents a transcription job."""
    
    def __init__(
        self,
        job_id: str,
        filename: str,
        file_path: Path,
        config: TranscriptionConfig
    ):
        self.job_id = job_id
        self.filename = filename
        self.file_path = file_path
        self.config = config
        self.status = JobStatus.PENDING
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.completed_at: Optional[datetime] = None
        self.progress: float = 0.0
        self.metadata: Optional[JobMetadata] = None
        self.transcript: Optional[str] = None
        self.error: Optional[str] = None
        self.progress_callbacks: list[Callable] = []
        self.cancelled: bool = False
        self.cancel_event: asyncio.Event = asyncio.Event()
    
    def update_progress(self, progress: float, message: str = ""):
        """Update progress and call callbacks."""
        self.progress = progress
        for callback in self.progress_callbacks:
            # Call with job_id, progress, message for websocket compatibility
            callback(self.job_id, progress, message)
    
    def to_response(self) -> JobResponse:
        """Convert to API response model."""
        return JobResponse(
            job_id=self.job_id,
            filename=self.filename,
            status=self.status,
            created_at=self.created_at,
            updated_at=self.updated_at,
            config=self.config,
            error=self.error,
            metadata=self.metadata,
            progress=self.progress
        )


class JobManager:
    """Manages transcription jobs with persistence."""
    
    def __init__(self, max_jobs: int = 100):
        self.jobs: dict[str, Job] = {}
        self.websockets: dict[str, list] = {}
        self.max_jobs = max_jobs
        self._lock = asyncio.Lock()
        
        # Database integration
        from core.database import db_manager
        from core.config import settings
        self.db = db_manager
        
        # Migrate from JSON if exists (in project root)
        backend_dir = Path(__file__).parent.parent
        jobs_json = backend_dir.parent / "jobs_state.json"
        if jobs_json.exists():
            print("📦 Migrating jobs from JSON to database...")
            self.db.migrate_from_json(jobs_json)
        
        # Load recent jobs from database into memory
        self._load_recent_jobs()
    
    def _load_recent_jobs(self):
        """Load recent jobs from database into memory."""
        try:
            recent_jobs = self.db.list_jobs(limit=self.max_jobs)
            for job_data in recent_jobs:
                try:
                    # Reconstruct Job object from database
                    job = Job(
                        job_id=job_data['job_id'],
                        filename=job_data['filename'],
                        file_path=Path(job_data['file_path']),
                        config=TranscriptionConfig(
                            model=job_data['model'],
                            language=job_data['language'],
                            temperature=job_data['temperature'],
                            beam_size=job_data['beam_size'],
                            normalize_audio=bool(job_data['normalize_audio']),
                            initial_prompt=job_data['initial_prompt']
                        )
                    )
                    job.status = JobStatus(job_data['status'])
                    job.created_at = datetime.fromisoformat(job_data['created_at'])
                    job.updated_at = datetime.fromisoformat(job_data['updated_at'])
                    job.progress = job_data.get('progress', 0.0)
                    job.error = job_data.get('error_message')
                    
                    self.jobs[job.job_id] = job
                except Exception as e:
                    print(f"⚠️  Error loading job {job_data.get('job_id')}: {e}")
                    continue
            
            if len(self.jobs) > 0:
                print(f"✓ Loaded {len(self.jobs)} recent job(s) from database")
        except Exception as e:
            print(f"⚠️  Could not load jobs from database: {e}")
    
    # Database methods (old JSON methods removed)
    async def create_job(
        self,
        filename: str,
        file_path: Path,
        config: Optional[TranscriptionConfig] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Job:
        """Create a new transcription job."""
        async with self._lock:
            job_id = str(uuid.uuid4())
            
            if config is None:
                config = TranscriptionConfig()
            
            job = Job(
                job_id=job_id,
                filename=filename,
                file_path=file_path,
                config=config
            )
            
            self.jobs[job_id] = job
            
            # Save to database
            try:
                self.db.create_job({
                    'job_id': job_id,
                    'filename': filename,
                    'file_path': str(file_path),
                    'status': job.status.value,
                    'created_at': job.created_at.isoformat(),
                    'updated_at': job.updated_at.isoformat(),
                    'model': config.model,
                    'language': config.language,
                    'temperature': config.temperature,
                    'beam_size': config.beam_size,
                    'normalize_audio': config.normalize_audio,
                    'initial_prompt': config.initial_prompt,
                    'client_ip': client_ip,
                    'user_agent': user_agent
                })
            except Exception as e:
                print(f"⚠️  Failed to save job to database: {e}")
            
            return job
    
    async def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID."""
        return self.jobs.get(job_id)
    
    async def get_all_jobs(self) -> list[Job]:
        """Get all jobs."""
        return list(self.jobs.values())
    
    async def update_job_status(
        self,
        job_id: str,
        status: JobStatus,
        progress: Optional[float] = None,
        error: Optional[str] = None,
        transcript: Optional[str] = None,
        metadata: Optional[JobMetadata] = None
    ) -> Optional[Job]:
        """Update job status and persist to database."""
        job = await self.get_job(job_id)
        if not job:
            return None
        
        job.status = status
        job.updated_at = datetime.now()
        
        if progress is not None:
            job.progress = progress
        if error is not None:
            job.error = error
        if transcript is not None:
            job.transcript = transcript
        if metadata is not None:
            job.metadata = metadata
        
        # Mark as completed if status is completed
        if status == JobStatus.COMPLETED:
            job.completed_at = datetime.now()
        
        # Update database
        try:
            updates = {
                'status': status.value,
                'updated_at': job.updated_at.isoformat(),
                'progress': job.progress
            }
            
            if error:
                updates['error_message'] = error
            if transcript:
                # Save preview (first 500 chars)
                updates['transcript_preview'] = transcript[:500]
                updates['word_count'] = len(transcript.split())
                updates['char_count'] = len(transcript)
            if metadata:
                updates.update({
                    'audio_duration_sec': metadata.audio_duration_sec,
                    'audio_duration_hms': metadata.audio_duration_hms,
                    'file_size_bytes': metadata.file_size_bytes,
                    'device': metadata.device,
                    'fp16': metadata.fp16,
                    'elapsed_sec': metadata.elapsed_sec,
                    'elapsed_hms': metadata.elapsed_hms,
                    'rtf': metadata.rtf,
                    'segment_count': metadata.segments
                })
            if status == JobStatus.COMPLETED:
                updates['completed_at'] = job.completed_at.isoformat()
            
            self.db.update_job(job_id, updates)
        except Exception as e:
            print(f"⚠️  Failed to update job in database: {e}")
        
        return job
    
    async def delete_job(self, job_id: str) -> bool:
        """Delete a job."""
        async with self._lock:
            if job_id in self.jobs:
                del self.jobs[job_id]
                return True
            return False
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running or pending job."""
        async with self._lock:
            if job_id not in self.jobs:
                return False
            
            job = self.jobs[job_id]
            
            # Can only cancel pending or processing jobs
            if job.status not in [JobStatus.PENDING, JobStatus.PROCESSING]:
                return False
            
            # Mark as cancelled
            job.cancelled = True
            job.cancel_event.set()
            
            # Update status to failed with cancellation message
            await self.update_job_status(
                job_id,
                JobStatus.FAILED,
                error="Cancelled by user"
            )
            
            return True
    
    async def register_progress_callback(
        self,
        job_id: str,
        callback: Callable
    ) -> bool:
        """Register a progress callback for a job."""
        job = await self.get_job(job_id)
        if job:
            job.progress_callbacks.append(callback)
            return True
        return False
    
    async def send_progress(self, job_id: str, progress: float, message: str, stage: str = "processing"):
        """Send progress update to WebSocket clients and log to database."""
        from models.schemas import ProgressUpdate
        
        update = ProgressUpdate(
            job_id=job_id,
            status=JobStatus.PROCESSING,
            progress=progress,
            message=message,
            timestamp=datetime.now()
        )
        
        # Log to database
        try:
            self.db.log_progress(job_id, progress, message, stage)
        except Exception as e:
            print(f"⚠️  Failed to log progress to database: {e}")
        
        # Send to WebSocket clients
        if job_id in self.websockets:
            for ws in self.websockets[job_id]:
                try:
                    await ws.send_json(update.model_dump(mode='json'))
                except Exception:
                    # Silently ignore send errors (connection may be closed)
                    pass


# Global job manager instance
job_manager = JobManager()
