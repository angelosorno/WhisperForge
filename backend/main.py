"""WhisperForge Backend Server"""
import os
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Add FFmpeg to PATH from imageio-ffmpeg
try:
    import imageio_ffmpeg
    ffmpeg_path = Path(imageio_ffmpeg.get_ffmpeg_exe()).parent
    os.environ['PATH'] = f"{ffmpeg_path}:{os.environ.get('PATH', '')}"
    print(f"✓ FFmpeg available at: {imageio_ffmpeg.get_ffmpeg_exe()}")
except Exception as e:
    print(f"⚠️  FFmpeg not found: {e}")

import uvicorn
from core.config import settings
from api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print(f"🚀 Starting {settings.app_name} v{settings.app_version}")
    print(f"📁 Upload dir: {settings.get_absolute_path(settings.upload_dir)}")
    print(f"⚙️  Whisper model: {settings.whisper_model}")
    
    # Initialize translation engine
    from core.translation_engine import translation_engine
    await translation_engine.initialize()
    
    yield
    
    # Shutdown
    print("👋 Shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Professional audio transcription API powered by OpenAI Whisper",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api")

# Include live translation routes
from api.live_routes import router as live_router
app.include_router(live_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower()
    )
