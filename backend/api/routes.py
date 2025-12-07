"""API routes for WhisperForge backend."""
import asyncio
from pathlib import Path
from typing import List
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Request
from fastapi.responses import FileResponse, JSONResponse

from core.config import settings
from core.job_manager import job_manager, Job
from core.transcription import transcribe_audio, AUDIO_EXTS
from core.translation import (
    translate_and_save,
    LANGUAGE_CODES,
    LANGUAGE_NAMES
)
from models.schemas import (
    JobResponse, JobListResponse, JobStatus, TranscriptionConfig,
    ProgressUpdate, HealthResponse, TranslationRequest, TranslationResponse,
    TranslationListResponse, TranslationListItem
)

import torch
import whisper

from api import auth
from api.auth import get_current_user

router = APIRouter()
router.include_router(auth.router, prefix="/auth")


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    try:
        whisper_available = True
        device = "cpu"
        if torch.cuda.is_available():
            device = "cuda"
        elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            device = "mps"
    except Exception:
        whisper_available = False
        device = "unknown"
    
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        whisper_available=whisper_available,
        device=device
    )


@router.post("/upload", response_model=JobResponse)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model: str = "large-v3",
    language: str = "es",
    temperature: float = 0.0,
    beam_size: int = 8,
    normalize_audio: bool = True,
    initial_prompt: str = None,
    auto_start: bool = True
):
    """
    Upload an audio file for transcription.
    
    Creates a new job and optionally starts transcription automatically.
    """
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in AUDIO_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}. Supported: {', '.join(sorted(AUDIO_EXTS))}"
        )
    
    # Check file size
    content = await file.read()
    if len(content) > settings.max_upload_size:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.max_upload_size / 1_000_000}MB"
        )
    
    # Save file to upload directory
    upload_dir = settings.get_absolute_path(settings.upload_dir)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    safe_filename = f"{timestamp}-{file.filename}"
    file_path = upload_dir / safe_filename
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Create transcription config
    config = TranscriptionConfig(
        model=model,
        language=language,
        temperature=temperature,
        beam_size=beam_size,
        normalize_audio=normalize_audio,
        initial_prompt=initial_prompt
    )
    
    # Create job
    job = await job_manager.create_job(
        filename=file.filename,
        file_path=file_path,
        config=config
    )
    
    # Auto-start transcription if enabled
    if auto_start:
        background_tasks.add_task(process_transcription, job)
        await job_manager.update_job_status(job.job_id, JobStatus.PROCESSING)
    
    return job.to_response()


@router.post("/transcribe/{job_id}", response_model=JobResponse)
async def start_transcription(job_id: str, background_tasks: BackgroundTasks):
    """
    Start transcription for a job.
    
    The transcription runs in the background and updates can be received via WebSocket.
    """
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Job already {job.status.value}"
        )
    
    # Start transcription in background
    background_tasks.add_task(process_transcription, job)
    
    # Update status to processing
    await job_manager.update_job_status(job_id, JobStatus.PROCESSING)
    
    return job.to_response()


async def process_transcription(job: Job):
    """Background task to process transcription."""
    try:
        # Progress callback with cancellation check
        async def progress_callback(progress: float, message: str):
            # Check if job was cancelled
            if job.cancelled:
                raise Exception("Job cancelled by user")
            job.update_progress(progress, message)
        
        # Transcribe
        transcript, metadata = await transcribe_audio(
            job.file_path,
            job.config,
            progress_callback
        )
        
        # Final check before completing
        if job.cancelled:
            return
        
        # Update job
        await job_manager.update_job_status(
            job.job_id,
            JobStatus.COMPLETED,
            transcript=transcript,
            metadata=metadata,
            progress=100.0
        )
        
    except Exception as e:
        # Don't update if already cancelled (status already set to FAILED)
        if not job.cancelled:
            # Update job with error
            await job_manager.update_job_status(
                job.job_id,
                JobStatus.FAILED,
                error=str(e),
                progress=0.0
            )
        print(f"Transcription failed for job {job.job_id}: {e}")


@router.get("/jobs", response_model=JobListResponse)
async def list_jobs():
    """List all jobs."""
    jobs = await job_manager.get_all_jobs()
    return JobListResponse(
        jobs=[job.to_response() for job in jobs],
        total=len(jobs)
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """Get job details."""
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job.to_response()


@router.get("/jobs/{job_id}/download")
async def download_transcript(job_id: str):
    """Download transcript file."""
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Job not completed yet"
        )
    
    # Find transcript file in done directory
    done_dir = settings.get_absolute_path(settings.done_dir)
    if job.metadata:
        job_dir = done_dir / job.metadata.job_name
        txt_file = job_dir / f"{job.metadata.job_name}.txt"
        
        if txt_file.exists():
            return FileResponse(
                path=txt_file,
                filename=f"{job.filename}.txt",
                media_type="text/plain"
            )
    
    raise HTTPException(status_code=404, detail="Transcript file not found")


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job."""
    success = await job_manager.delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {"message": "Job deleted successfully"}


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running or pending job."""
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status not in [JobStatus.PENDING, JobStatus.PROCESSING]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status: {job.status.value}"
        )
    
    success = await job_manager.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to cancel job")
    
    return {"message": "Job cancelled successfully"}


@router.websocket("/ws/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time progress updates.
    
    Sends progress updates as JSON messages with format:
    {
        "job_id": "...",
        "status": "processing",
        "progress": 45.5,
        "message": "Transcribing audio...",
        "timestamp": "2024-01-01T12:00:00"
    }
    """
    await websocket.accept()
    
    job = await job_manager.get_job(job_id)
    if not job:
        await websocket.send_json({"error": "Job not found"})
        await websocket.close()
        return
    
    # Register progress callback
    async def send_progress(job_id: str, progress: float, message: str):
        try:
            update = ProgressUpdate(
                job_id=job_id,
                status=job.status,
                progress=progress,
                message=message
            )
            await websocket.send_json(update.model_dump(mode='json'))
        except Exception as e:
            print(f"Error sending progress: {e}")
    
    await job_manager.register_progress_callback(job_id, send_progress)
    
    try:
        # Send initial status
        await send_progress(job_id, job.progress, f"Job {job.status.value}")
        
        # Keep connection alive and send updates
        while True:
            # Check if job is complete or failed
            current_job = await job_manager.get_job(job_id)
            if not current_job:
                break
            
            if current_job.status in [JobStatus.COMPLETED, JobStatus.FAILED]:
                # Send final update
                await send_progress(
                    job_id,
                    current_job.progress,
                    f"Job {current_job.status.value}"
                )
                break
            
            # Wait a bit before next check
            await asyncio.sleep(0.5)
            
            # Check for client messages (ping/pong)
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
            except asyncio.TimeoutError:
                pass
    
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for job {job_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@router.post("/jobs/{job_id}/translate", response_model=TranslationResponse)
async def translate_job(
    job_id: str,
    request: TranslationRequest,
    background_tasks: BackgroundTasks
):
    """
    Translate a completed transcription job.
    
    Supported target languages: fr (French), de (German), it (Italian), en (English)
    """
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Job must be completed before translation"
        )
    
    if not job.transcript:
        raise HTTPException(status_code=400, detail="No transcript available")
    
    # Validate target language
    if request.target_language not in LANGUAGE_CODES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {request.target_language}. Supported: {', '.join(LANGUAGE_CODES.keys())}"
        )
    
    # Get source language from job config
    source_lang = job.config.language
    
    if source_lang == request.target_language:
        raise HTTPException(
            status_code=400,
            detail="Source and target languages cannot be the same"
        )
    
    # Get job directory
    done_dir = settings.get_absolute_path(settings.done_dir)
    if not job.metadata:
        raise HTTPException(status_code=500, detail="Job metadata not available")
    
    job_dir = done_dir / job.metadata.job_name
    
    # Check if translation already exists
    translated_file = job_dir / f"{job.metadata.job_name}_{request.target_language}.txt"
    if translated_file.exists():
        # Return existing translation
        comparison_file = job_dir / f"{job.metadata.job_name}_comparison_{source_lang}_{request.target_language}.txt"
        bilingual_srt_file = job_dir / f"{job.metadata.job_name}_bilingual_{request.target_language}.srt"
        
        with open(translated_file, "r", encoding="utf-8") as f:
            translated_text = f.read()
        
        return TranslationResponse(
            job_id=job_id,
            source_language=source_lang,
            target_language=request.target_language,
            translated_text=translated_text,
            comparison_file=str(comparison_file),
            translated_file=str(translated_file),
            bilingual_srt_file=str(bilingual_srt_file) if bilingual_srt_file.exists() else None
        )
    
    # Start translation in background
    async def translate_task():
        try:
            # Get original SRT if exists
            original_srt = None
            if request.create_bilingual_srt:
                srt_file = job_dir / f"{job.metadata.job_name}.srt"
                if srt_file.exists():
                    with open(srt_file, "r", encoding="utf-8") as f:
                        original_srt = f.read()
            
            # Translate
            await translate_and_save(
                job_dir=job_dir,
                job_name=job.metadata.job_name,
                original_text=job.transcript,
                source_lang=source_lang,
                target_lang=request.target_language,
                create_srt=request.create_bilingual_srt,
                original_srt=original_srt
            )
            print(f"✓ Translation completed: {job_id} -> {request.target_language}")
        except Exception as e:
            print(f"✗ Translation failed: {job_id} -> {request.target_language}: {e}")
    
    background_tasks.add_task(translate_task)
    
    return TranslationResponse(
        job_id=job_id,
        source_language=source_lang,
        target_language=request.target_language,
        translated_text="Translation in progress...",
        comparison_file=str(job_dir / f"{job.metadata.job_name}_comparison_{source_lang}_{request.target_language}.txt"),
        translated_file=str(translated_file),
        bilingual_srt_file=str(job_dir / f"{job.metadata.job_name}_bilingual_{request.target_language}.srt") if request.create_bilingual_srt else None
    )


@router.get("/jobs/{job_id}/translations", response_model=TranslationListResponse)
async def list_translations(job_id: str):
    """List all available translations for a job."""
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if not job.metadata:
        raise HTTPException(status_code=500, detail="Job metadata not available")
    
    done_dir = settings.get_absolute_path(settings.done_dir)
    job_dir = done_dir / job.metadata.job_name
    
    if not job_dir.exists():
        return TranslationListResponse(
            job_id=job_id,
            source_language=job.config.language,
            translations=[]
        )
    
    # Find all translation files
    translations = []
    for lang_code, lang_name in LANGUAGE_NAMES.items():
        if lang_code == job.config.language:
            continue  # Skip source language
        
        translated_file = job_dir / f"{job.metadata.job_name}_{lang_code}.txt"
        if translated_file.exists():
            comparison_file = job_dir / f"{job.metadata.job_name}_comparison_{job.config.language}_{lang_code}.txt"
            bilingual_srt_file = job_dir / f"{job.metadata.job_name}_bilingual_{lang_code}.srt"
            
            translations.append(TranslationListItem(
                language=lang_code,
                language_name=lang_name,
                translated_file=str(translated_file),
                comparison_file=str(comparison_file),
                bilingual_srt_file=str(bilingual_srt_file) if bilingual_srt_file.exists() else None,
                created_at=datetime.fromtimestamp(translated_file.stat().st_mtime)
            ))
    
    return TranslationListResponse(
        job_id=job_id,
        source_language=job.config.language,
        translations=translations
    )


@router.get("/jobs/{job_id}/download/translation/{language}")
async def download_translation(job_id: str, language: str):
    """Download translated text file."""
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if not job.metadata:
        raise HTTPException(status_code=500, detail="Job metadata not available")
    
    done_dir = settings.get_absolute_path(settings.done_dir)
    job_dir = done_dir / job.metadata.job_name
    translated_file = job_dir / f"{job.metadata.job_name}_{language}.txt"
    
    if not translated_file.exists():
        raise HTTPException(status_code=404, detail="Translation not found")
    
    return FileResponse(
        path=translated_file,
        filename=f"{job.filename}_{language}.txt",
        media_type="text/plain"
    )


@router.get("/jobs/{job_id}/download/comparison/{language}")
async def download_comparison(job_id: str, language: str):
    """Download side-by-side comparison file."""
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if not job.metadata:
        raise HTTPException(status_code=500, detail="Job metadata not available")
    
    done_dir = settings.get_absolute_path(settings.done_dir)
    job_dir = done_dir / job.metadata.job_name
    comparison_file = job_dir / f"{job.metadata.job_name}_comparison_{job.config.language}_{language}.txt"
    
    if not comparison_file.exists():
        raise HTTPException(status_code=404, detail="Comparison file not found")
    
    return FileResponse(
        path=comparison_file,
        filename=f"{job.filename}_comparison_{language}.txt",
        media_type="text/plain"
    )


@router.get("/jobs/{job_id}/download/bilingual-srt/{language}")
async def download_bilingual_srt(job_id: str, language: str):
    """Download bilingual SRT file."""
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if not job.metadata:
        raise HTTPException(status_code=500, detail="Job metadata not available")
    
    done_dir = settings.get_absolute_path(settings.done_dir)
    job_dir = done_dir / job.metadata.job_name
    bilingual_srt_file = job_dir / f"{job.metadata.job_name}_bilingual_{language}.srt"
    
    if not bilingual_srt_file.exists():
        raise HTTPException(status_code=404, detail="Bilingual SRT file not found")


@router.put("/jobs/{job_id}/comparison/{language}")
async def update_comparison(
    job_id: str,
    language: str,
    request: Request
):
    """Update comparison markdown file with edited content."""
    from core.translation import LANGUAGE_CODES
    
    if language not in LANGUAGE_CODES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")
    
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job not completed yet")
    
    # Get request body
    body = await request.json()
    original_text = body.get("original_text", "")
    translated_text = body.get("translated_text", "")
    
    if not original_text or not translated_text:
        raise HTTPException(status_code=400, detail="Missing original_text or translated_text")
    
    # Find job directory
    done_dir = settings.get_absolute_path(settings.done_dir)
    if not job.metadata:
        raise HTTPException(status_code=404, detail="Job metadata not found")
    
    job_dir = done_dir / job.metadata.job_name
    source_lang = job.config.language
    
    # Update comparison file
    from core.translation import create_side_by_side_comparison
    from datetime import datetime
    
    comparison = create_side_by_side_comparison(
        original_text,
        translated_text,
        source_lang,
        language
    )
    
    # Add edit timestamp
    comparison += f"\n\n---\n\n**Editado por usuario**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    
    comparison_path = job_dir / f"{job.metadata.job_name}_comparison_{source_lang}_{language}.md"
    
    try:
        with open(comparison_path, "w", encoding="utf-8") as f:
            f.write(comparison)
        
        return {
            "success": True,
            "comparison_path": str(comparison_path),
            "updated_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update comparison: {str(e)}")


@router.get("/stats")
async def get_stats():
    """Get system statistics and analytics."""
    from core.database import db_manager
    
    try:
        stats = db_manager.get_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.get("/jobs/{job_id}/logs")
async def get_job_logs(job_id: str, limit: int = 100):
    """Get progress logs for a specific job."""
    from core.database import db_manager
    
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    try:
        logs = db_manager.get_progress_logs(job_id, limit=limit)
        return {"job_id": job_id, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {str(e)}")


@router.get("/analytics/recent-activity")
async def get_recent_activity(limit: int = 20):
    """Get recent activity across all jobs."""
    from core.database import db_manager
    
    try:
        recent_jobs = db_manager.list_jobs(limit=limit, order_by="updated_at DESC")
        return {"activity": recent_jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get activity: {str(e)}")
