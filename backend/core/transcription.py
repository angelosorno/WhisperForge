"""Core transcription logic integrating Whisper pipeline."""
import os
import re
import unicodedata
import shutil
import datetime
import time
import json
import hashlib
import subprocess
import traceback
from pathlib import Path
from typing import Optional, Callable
from functools import lru_cache

import torch
import whisper
from whisper.tokenizer import get_tokenizer

from core.config import settings
from models.schemas import TranscriptionConfig, JobMetadata


# Enable MPS fallback for unsupported operations
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

# Audio file extensions
AUDIO_EXTS = {
    ".wav", ".m4a", ".mp3", ".flac", ".ogg", ".oga", ".ogx", ".opus",
    ".aac", ".wma", ".caf", ".aiff", ".aif", ".aifc", ".amr", ".alaw",
    ".ulaw", ".ac3", ".eac3", ".dts", ".mp4", ".m4v", ".mov", ".mkv",
    ".mka", ".webm", ".weba", ".avi", ".3gp", ".3g2", ".flv", ".ts",
    ".mp2", ".mp1"
}

# Tokenizer for prompt handling
Tokenizer = get_tokenizer(multilingual=True)

# Default style sample and glossary
StyleSample = (
    "Hermanos, continuamos con la enseñanza de manera clara y pausada. "
    "Leemos la Escritura según la Reina-Valera 1960 y citamos así: [Juan 3:16]. "
    "Gloria a Dios, seguimos con la explicación de la doctrina sin alterar el sentido de las palabras."
)

Glossary = [
    "Iglesia de Dios Ministerial de Jesucristo Internacional",
    "Hna. María Luisa",
    "Espíritu Santo",
    "Señor Jesucristo",
    "Reina-Valera 1960",
    "Antiguo Testamento",
    "Nuevo Testamento",
    "Biblia",
    "Doctrina",
    "Enseñanza",
    "Don de la Profecía",
    "Gloria a Dios",
    "Hechos 2:17",
]


def select_candidates():
    """Select available device candidates in priority order."""
    cands = []
    if torch.cuda.is_available():
        cands.append(("cuda", True))
    if settings.allow_mps and getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        cands.append(("mps", False))
    cands.append(("cpu", False))
    return cands


def load_whisper_with_backoff(model_name: str):
    """Load Whisper model with automatic device fallback."""
    last_err = None
    for dev, fp16 in select_candidates():
        try:
            print(f"Loading Whisper '{model_name}' on '{dev}' fp16={fp16}...")
            model = whisper.load_model(model_name, device=dev)
            extra = ""
            if dev == "cuda":
                try:
                    extra = f" | GPU: {torch.cuda.get_device_name(0)}"
                except Exception:
                    pass
            print(f"[HW] device={dev} fp16={fp16} torch={torch.__version__}{extra}")
            return model, dev, fp16
        except (NotImplementedError, RuntimeError) as e:
            msg = str(e)
            if ("MPS" in msg) or ("CUDA" in msg):
                print(f"[WARN] Backend {dev} failed, trying next option...")
                last_err = e
                continue
            raise
    raise last_err if last_err else RuntimeError("Could not load model on any backend")


@lru_cache(maxsize=3)
def get_whisper_model(model_name: str):
    """Get cached Whisper model."""
    return load_whisper_with_backoff(model_name)


def nfc(s: str) -> str:
    """Normalize Unicode string."""
    return unicodedata.normalize("NFC", s)


def slugify(filename: str) -> str:
    """Create URL-safe slug from filename."""
    base = Path(filename).stem
    base = unicodedata.normalize("NFC", base).strip().casefold()
    base = re.sub(r"[.\s]+", "-", base)
    base = re.sub(r"[^\w\-.]+", "-", base)
    base = re.sub(r"-{2,}", "-", base).strip("-")
    return base or "audio"


def make_job_name(audio_path: Path, model_name: str) -> str:
    """Generate unique job name."""
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    model_tag = slugify(model_name)
    return f"{ts}-{model_tag}-{slugify(audio_path.name)}"


def ffprobe_duration(path: Path) -> Optional[float]:
    """Get audio duration using ffprobe."""
    try:
        out = subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path)
        ], text=True).strip()
        val = float(out)
        return val if val > 0 else None
    except Exception:
        return None


def sha1_file(path: Path) -> str:
    """Calculate SHA1 hash of file."""
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sec_to_min(x: Optional[float]) -> Optional[float]:
    """Convert seconds to minutes."""
    return round(x / 60.0, 2) if x is not None else None


def fmt_hms(seconds: Optional[float]) -> Optional[str]:
    """Format seconds as HH:MM:SS or MM:SS."""
    if seconds is None:
        return None
    seconds = int(round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return f"{h:d}:{m:02d}:{s:02d}"
    return f"{m:d}:{s:02d}"


def to_wav_16k(in_path: Path, out_path: Path) -> Path:
    """Convert audio to WAV PCM 16kHz mono."""
    cmd = [
        "ffmpeg", "-y", "-i", str(in_path),
        "-vn",
        "-ac", "1",
        "-af", "aresample=resampler=soxr:precision=33",
        "-ar", "16000",
        "-c:a", "pcm_s16le",
        str(out_path)
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return out_path


def prepare_audio_for_whisper(src_path: Path, job_dir: Path, enabled: bool) -> Path:
    """Prepare audio file for Whisper (normalize if enabled)."""
    if not enabled:
        return src_path
    target = job_dir / "input.16k.wav"
    return to_wav_16k(src_path, target)


def build_glossary_sentence(terms: list[str]) -> str:
    """Build glossary sentence from terms."""
    terms = [t.strip() for t in terms if t and t.strip()]
    return (" En esta charla se mencionan: " + ", ".join(terms) + ".") if terms else ""


def trim_to_224_tokens(text: str) -> str:
    """Trim text to last 224 tokens (Whisper limit)."""
    toks = Tokenizer.encode(text)
    toks = toks[-224:]
    return Tokenizer.decode(toks)


def build_prompt_for_whisper(style_sample: str, glossary: list[str]) -> str:
    """Build initial prompt for Whisper."""
    prompt = (style_sample.strip() + build_glossary_sentence(glossary)).strip()
    return trim_to_224_tokens(prompt)


async def transcribe_audio(
    audio_path: Path,
    config: TranscriptionConfig,
    progress_callback: Optional[Callable[[float, str], None]] = None
) -> tuple[str, JobMetadata]:
    """
    Transcribe audio file using Whisper.
    
    Args:
        audio_path: Path to audio file
        config: Transcription configuration
        progress_callback: Optional callback for progress updates (progress, message)
    
    Returns:
        Tuple of (transcript_text, metadata)
    """
    # Load model
    if progress_callback:
        await progress_callback(5.0, "Loading Whisper model...")
    
    model, device, fp16 = get_whisper_model(config.model)
    
    # Create job directory
    processing_dir = settings.get_absolute_path(settings.processing_dir)
    job_name = make_job_name(audio_path, config.model)
    job_dir = processing_dir / job_name
    job_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy audio to job directory
    audio_tmp = job_dir / audio_path.name
    shutil.copy2(str(audio_path), str(audio_tmp))
    
    start_wall = datetime.datetime.now()
    start_perf = time.perf_counter()
    
    # Prepare audio
    if progress_callback:
        await progress_callback(10.0, "Preparing audio...")
    
    try:
        src_for_whisper = prepare_audio_for_whisper(
            audio_tmp, job_dir, config.normalize_audio
        )
        normalized = (src_for_whisper != audio_tmp)
    except Exception as prep_err:
        src_for_whisper = audio_tmp
        normalized = False
        print(f"Audio preparation failed, using original: {prep_err}")
    
    # Build prompt
    initial_prompt = config.initial_prompt
    if not initial_prompt:
        initial_prompt = build_prompt_for_whisper(StyleSample, Glossary)
    
    # Transcribe with simulated progress
    if progress_callback:
        await progress_callback(20.0, "Transcribing audio...")
    
    # Start transcription in a separate thread with progress simulation
    import asyncio
    import threading
    
    result_container = {}
    error_container = {}
    
    def transcribe_thread():
        try:
            res = model.transcribe(
                str(src_for_whisper),
                language=config.language,
                task="transcribe",
                temperature=config.temperature,
                beam_size=config.beam_size,
                patience=1.0,
                condition_on_previous_text=True,
                initial_prompt=initial_prompt if initial_prompt.strip() else None,
                fp16=fp16
            )
            result_container['result'] = res
        except Exception as e:
            error_container['error'] = e
    
    # Start transcription thread
    thread = threading.Thread(target=transcribe_thread, daemon=True)
    thread.start()
    
    # Simulate progress while transcribing
    current_progress = 20.0
    messages = [
        "Analizando audio...",
        "Procesando con IA...",
        "Transcribiendo segmentos...",
        "Generando texto...",
        "Refinando transcripción...",
        "Casi terminando..."
    ]
    message_idx = 0
    
    while thread.is_alive():
        await asyncio.sleep(2)  # Update every 2 seconds
        
        if current_progress < 85:
            # Increment progress slowly
            current_progress += 5
            if progress_callback:
                msg = messages[message_idx % len(messages)]
                await progress_callback(current_progress, msg)
                message_idx += 1
    
    # Check for errors
    if 'error' in error_container:
        raise error_container['error']
    
    result = result_container.get('result')
    if not result:
        raise RuntimeError("Transcription failed without error")
    
    if progress_callback:
        await progress_callback(90.0, "Processing results...")
    
    # Extract and clean text
    text = nfc(result.get("text", "")).strip()
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s+\n", "\n", text).strip() + "\n"
    
    # Calculate metrics
    end_wall = datetime.datetime.now()
    elapsed = datetime.timedelta(seconds=(time.perf_counter() - start_perf))
    
    audio_duration = ffprobe_duration(Path(src_for_whisper))
    rtf = (elapsed.total_seconds() / audio_duration) if (audio_duration and audio_duration > 0) else None
    
    # Get last segment end time
    last_end = None
    try:
        segs = result.get("segments")
        if isinstance(segs, list) and segs:
            last_end = float(segs[-1].get("end", 0.0))
    except Exception:
        pass
    
    coverage_ratio = (last_end / audio_duration) if (last_end and audio_duration and audio_duration > 0) else None
    
    elapsed_sec_val = elapsed.total_seconds()
    audio_dur_sec_val = audio_duration if (audio_duration and audio_duration > 0) else None
    
    # Build metadata
    metadata = JobMetadata(
        job_name=job_name,
        start_time=start_wall,
        end_time=end_wall,
        elapsed_sec=round(elapsed_sec_val, 3),
        audio_duration_sec=round(audio_dur_sec_val, 3) if audio_dur_sec_val else None,
        elapsed_min=sec_to_min(elapsed_sec_val),
        audio_duration_min=sec_to_min(audio_dur_sec_val),
        elapsed_hms=fmt_hms(elapsed_sec_val),
        audio_duration_hms=fmt_hms(audio_dur_sec_val),
        rtf=round(rtf, 3) if rtf else None,
        coverage_ratio=round(coverage_ratio, 4) if coverage_ratio else None,
        model=config.model,
        device=device,
        fp16=fp16,
        language=config.language,
        beam_size=config.beam_size,
        temperature=config.temperature,
        normalized_16k=normalized,
        input_original_name=audio_path.name,
        chars=len(text),
        words=len(text.split()),
        segments=len(result.get("segments", [])) if isinstance(result.get("segments"), list) else None
    )
    
    # Save results to done directory
    done_dir = settings.get_absolute_path(settings.done_dir)
    final_dir = done_dir / job_name
    
    # Save transcript
    out_txt = job_dir / f"{job_name}.txt"
    out_txt.write_text(text, encoding="utf-8")
    
    # Save metadata
    meta_dict = metadata.model_dump(mode='json')
    meta_file = job_dir / "meta.json"
    meta_file.write_text(json.dumps(meta_dict, ensure_ascii=False, indent=2), encoding="utf-8")
    
    # Move to done
    shutil.move(str(job_dir), str(final_dir))
    
    if progress_callback:
        await progress_callback(100.0, "Transcription complete!")
    
    return text, metadata
