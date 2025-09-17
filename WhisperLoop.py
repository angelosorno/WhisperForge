# Habilita fallback CPU para ops no soportadas
import os
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import re, unicodedata, shutil, datetime, traceback, time
import platform, torch, whisper
import subprocess, json, hashlib
from pathlib import Path
from functools import lru_cache
from whisper.tokenizer import get_tokenizer

# Model Selector
# > turbo, base, small, medium, large, large-v2, turbo, large-v3-turbo, large-v3

MODEL_NAME = "large-v3"

# CPU 

# DEVICE = "cpu"
# FP16 = False  # en CPU no uses fp16

# CUDA (GPU con CUDA)

# DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
# FP16 = (DEVICE == "cuda")  # en GPU con CUDA sí conviene usar fp16

# Apple Silicon MPS (Mac con chip Apple)

# if torch.backends.mps.is_available():
#     DEVICE = "mps"
#     FP16 = False
# else:
#     DEVICE = "cpu"
#     FP16 = False

# Detectar Hardware: CUDA > MPS > CPU
# --- Autoselección de backend y carga con backoff ---
ALLOW_MPS = False  # pon True si quieres probar MPS

def select_candidates():
    cands = []
    if torch.cuda.is_available():
        cands.append(("cuda", True))       # CUDA con fp16=True
    if ALLOW_MPS and getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        cands.append(("mps", False))       # MPS con fp16=False (más estable)
    cands.append(("cpu", False))           # CPU con fp16=False
    return cands

def load_whisper_with_backoff(model_name: str):
    logger = globals().get("log_line", print)
    last_err = None
    for dev, fp16 in select_candidates():
        try:
            logger(f"Cargando Whisper '{model_name}' en '{dev}' fp16={fp16}…")
            model = whisper.load_model(model_name, device=dev)
            extra = ""
            if dev == "cuda":
                try:
                    extra = f" | GPU: {torch.cuda.get_device_name(0)} cap={torch.cuda.get_device_capability(0)}"
                except Exception:
                    pass
            logger(f"[HW] device={dev} fp16={fp16} torch={torch.__version__} os={platform.system()} {platform.release()}{extra}")
            return model, dev, fp16
        except (NotImplementedError, RuntimeError) as e:
            msg = str(e)
            head = msg.splitlines()[0] if msg else e.__class__.__name__
            # MPS no soporta cierto operador
            if ("MPS" in msg) or ("SparseMPS" in msg) or ("aten::_sparse_coo_tensor_with_dims_and_tensors" in msg):
                logger(f"[WARN] Backend {dev} falló: {head}. Probando siguiente opción…")
                last_err = e
                continue
            # CUDA sin inicializar / sin GPU
            if ("CUDA error" in msg) or ("no CUDA GPUs are available" in msg) or ("CUDA initialization" in msg):
                logger(f"[WARN] Backend {dev} falló: {head}. Probando siguiente opción…")
                last_err = e
                continue
            raise
    raise last_err if last_err else RuntimeError("No fue posible cargar el modelo en ningún backend")

@lru_cache(maxsize=3)  # Hasta 3 modelos distintos por sesión
def get_whisper_model(model_name: str):
    return load_whisper_with_backoff(model_name)  # -> (model, device, fp16)

# Config del pipeline

WORKDIR = Path.cwd()
PENDING     = WORKDIR / "pending"
PROCESSING  = WORKDIR / "processing"
DONE        = WORKDIR / "done"
FAILED      = WORKDIR / "failed"
LOGFILE     = WORKDIR / "pipeline.log"

# Preparar Folders
for d in (PENDING, PROCESSING, DONE, FAILED): d.mkdir(parents=True, exist_ok=True)

# Helper Prompt

# "long" = YYYYMMDD-HHMMSS-name, "short" = MMDDHHMM-name
NAME_STYLE = "long"
LANG       = "es"
# Normalización de audio (WAV 16 kHz mono PCM16)
TEMPERATURE = 0.0
BEAM_SIZE   = 8

#  Extensiones de audio permitidas
AUDIO_EXTS = {".wav", ".m4a", ".mp3", ".flac", ".ogg", ".oga", ".ogx", ".opus", ".aac", ".wma", ".caf", ".aiff", ".aif", ".aifc", ".amr", ".alaw", ".ulaw", ".ac3", ".eac3", ".dts", ".mp4", ".m4v", ".mov", ".mkv", ".mka", ".webm", ".weba", ".avi", ".3gp", ".3g2", ".flv", ".ts", ".mp2", ".mp1"}

# False si quieres desactivarlo y procesar los archivos tal cual sin normalizar
NORMALIZE_AUDIO = True  

# Tokenizer multilingüe de Whisper
Tokenizer = get_tokenizer(multilingual=True)

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

# Funciones utilitarias

def nfc(s: str) -> str: return unicodedata.normalize("NFC", s)
def slugify(filename: str) -> str:
    base = Path(filename).stem
    base = unicodedata.normalize("NFC", base).strip().casefold()
    base = re.sub(r"[.\s]+", "-", base)
    base = re.sub(r"[^\w\-.]+", "-", base)
    base = re.sub(r"-{2,}", "-", base).strip("-")
    return base or "audio"
def ts_long() -> str: return datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
def ts_short() -> str: return datetime.datetime.now().strftime("%m%d%H%M")
def make_job_name(audio_path: Path) -> str:
    ts = ts_long() if NAME_STYLE == "long" else ts_short()
    model_tag = slugify(MODEL_NAME)
    return f"{ts}-{model_tag}-{slugify(audio_path.name)}"
def list_audios(pending_dir: Path):
    def has_allowed_ext(p: Path) -> bool:
        return any(ext.lower() in AUDIO_EXTS for ext in p.suffixes)
    files = []
    for p in pending_dir.iterdir():
        if p.is_file():
            if has_allowed_ext(p):
                files.append(p)
            else:
                log_line(f"[SKIP] {p.name} (Extensión no permitida)")
    return sorted(files, key=lambda p: p.stat().st_ctime)
def log_line(msg: str):
    LOGFILE.parent.mkdir(parents=True, exist_ok=True)
    with LOGFILE.open("a", encoding="utf-8") as f:
        f.write(f"{datetime.datetime.now().isoformat()}  {msg}\n")
    print(msg)

# RTF (Real-Time Factor)

def ffprobe_duration(path: str | Path) -> float | None:
    try:
        out = subprocess.check_output(
            ["ffprobe","-v","error","-show_entries","format=duration",
             "-of","default=noprint_wrappers=1:nokey=1", str(path)],
            text=True
        ).strip()
        val = float(out)
        return val if val > 0 else None
    except Exception:
        return None
def sha1_file(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1<<20), b""):
            h.update(chunk)
    return h.hexdigest()

# Pasa de Segundos a Minutos

def sec_to_min(x: float | None) -> float | None:
    return round(x / 60.0, 2) if (x is not None) else None

def fmt_hms(seconds: float | None) -> str | None:
    if seconds is None:
        return None
    seconds = int(round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return f"{h:d}:{m:02d}:{s:02d}"
    return f"{m:d}:{s:02d}"

# Normalización de audio (WAV 16 kHz mono PCM16)

def to_wav_16k(in_path: Path, out_path: Path) -> Path:
    """
    Convierte cualquier entrada (audio o video) a WAV PCM 16 kHz mono.
    -vn fuerza a ignorar video; aresample=soxr mejora la calidad del remuestreo.
    """
    cmd = [
        "ffmpeg", "-y", "-i", str(in_path),
        "-vn",
        "-ac", "1",
        "-af", "aresample=resampler=soxr:precision=33",
        "-ar", "16000",
        "-c:a", "pcm_s16le",
        str(out_path)
    ]
    # Capturamos stdout/stderr para que el notebook no se llene de logs de ffmpeg
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return out_path
def prepareAudioforWhisper(src_path: Path, job_dir: Path, enabled: bool) -> Path:
    """
    Si enabled=True → genera job_dir/'input.16k.wav' y lo devuelve.
    Si enabled=False → devuelve el path original sin tocar.
    """
    if not enabled:
        return src_path
    target = job_dir / "input.16k.wav"
    return to_wav_16k(src_path, target)

# Construcción del Prompt Inicial para Whisper
def BuildGlossarySentence(terms: list[str]) -> str:
    terms = [t.strip() for t in terms if t and t.strip()]
    return (" En esta charla se mencionan: " + ", ".join(terms) + ".") if terms else ""

def TrimTo224Tokens(text: str) -> str:
    toks = Tokenizer.encode(text)
    toks = toks[-224:]  # Whisper solo atiende a los ÚLTIMOS 224 tokens
    return Tokenizer.decode(toks)

def BuildPromptForWhisper(styleSample: str, glossary: list[str]) -> str:
    prompt = (styleSample.strip() + BuildGlossarySentence(glossary)).strip()
    return TrimTo224Tokens(prompt)
# ÚNICA fuente de verdad del prompt
INITIAL_PROMPT = BuildPromptForWhisper(StyleSample, Glossary)

# Reporte de cuántos tokens quedaron
try:
    prompt_tokens = len(Tokenizer.encode(INITIAL_PROMPT))
    log_line(f"[PROMPT] tokens={prompt_tokens}")
except Exception:
    pass


# Carga del Modelo (Cacheada)
model, DEVICE, FP16 = get_whisper_model(MODEL_NAME)
print(f"Modelo '{MODEL_NAME}' listo en {DEVICE} fp16={FP16}")
# log_line(f"[MODEL] Modelo '{MODEL_NAME}' cargado en {DEVICE} fp16={FP16}")


# Bucle Procesador de Audios
audios = list_audios(PENDING)
if not audios:
    print("No hay audios en la carpeta ./pending.")
else:
    total_jobs = 0
    ok_jobs = 0
    failed_jobs = 0
    total_elapsed = datetime.timedelta()
    total_audio_dur = 0.0
    normalized_count = 0
    rtfs = []

    for audio_in in audios:
        job_name = make_job_name(audio_in)
        job_dir = PROCESSING / job_name
        job_dir.mkdir(parents=True, exist_ok=True)

        audio_tmp = job_dir / audio_in.name
        shutil.copy2(str(audio_in), str(audio_tmp))

        start_wall = datetime.datetime.now()
        start_perf = time.perf_counter()

        # Preparación con fallback
        try:
            src_for_whisper = prepareAudioforWhisper(audio_tmp, job_dir, enabled=NORMALIZE_AUDIO)
            if src_for_whisper != audio_tmp:
                log_line(f"[AUDIO] Normalizado a 16k WAV: {src_for_whisper.name}")
                normalized_count += 1
            else:
                log_line(f"[AUDIO] Sin normalizar (usando original): {audio_tmp.name}")
        except Exception as prep_err:
            src_for_whisper = audio_tmp
            log_line(f"[AUDIO] Preparación falló, uso original: {audio_tmp.name} :: {prep_err}")

        log_line(f"[START] {audio_in.name} -> {job_dir.name} [model={MODEL_NAME}, device={DEVICE}, fp16={FP16}]")

        try:
            # Transcripción
            result = model.transcribe(
                str(src_for_whisper),
                language=LANG,
                task="transcribe",
                temperature=TEMPERATURE,
                beam_size=BEAM_SIZE,
                patience=1.0,
                condition_on_previous_text=True,
                initial_prompt=INITIAL_PROMPT if INITIAL_PROMPT.strip() else None,
                fp16=FP16
            )

            # Texto
            text = nfc(result.get("text", "")).strip()
            text = re.sub(r"[ \t]+", " ", text)
            text = re.sub(r"\s+\n", "\n", text).strip() + "\n"

            out_txt = job_dir / f"{job_name}.txt"
            out_txt.write_text(text, encoding="utf-8")

            # Métricas
            end_wall = datetime.datetime.now()
            elapsed = datetime.timedelta(seconds=(time.perf_counter() - start_perf))

            audio_used_path = Path(src_for_whisper)
            try:
                audio_duration = ffprobe_duration(audio_used_path)
            except Exception as e:
                audio_duration = None
                log_line(f"[WARN] ffprobe falló para {audio_used_path.name}: {e}")

            rtf = (elapsed.total_seconds() / audio_duration) if (audio_duration and audio_duration > 0) else None

            last_end = None
            try:
                segs = result.get("segments")
                if isinstance(segs, list) and segs:
                    last_end = float(segs[-1].get("end", 0.0))
            except Exception:
                last_end = None

            coverage_ratio = (last_end / audio_duration) if (last_end is not None and audio_duration and audio_duration > 0) else None

            elapsed_sec_val = elapsed.total_seconds()
            audio_dur_sec_val = audio_duration if (audio_duration and audio_duration > 0) else None

            elapsed_min = sec_to_min(elapsed_sec_val)
            audio_duration_min = sec_to_min(audio_dur_sec_val)
            elapsed_hms = fmt_hms(elapsed_sec_val)
            audio_duration_hms = fmt_hms(audio_dur_sec_val)

            try:
                prompt_tokens = len(Tokenizer.encode(INITIAL_PROMPT))
                log_line(f"[PROMPT] tokens={prompt_tokens} preview={INITIAL_PROMPT[:120]!r}")
            except Exception:
                prompt_tokens = None
            # Metadatos
            meta = {
                "job_name": job_name,
                "start_time": start_wall.isoformat(),
                "end_time": end_wall.isoformat(),
                "elapsed_sec": round(elapsed_sec_val, 3),
                "audio_duration_sec": round(audio_dur_sec_val, 3) if audio_dur_sec_val is not None else None,
                "elapsed_min": elapsed_min,
                "audio_duration_min": audio_duration_min,
                "elapsed_hms": elapsed_hms,
                "audio_duration_hms": audio_duration_hms,
                "rtf": round(rtf, 3) if rtf is not None else None,
                "coverage_last_segment_end_sec": round(last_end, 3) if last_end is not None else None,
                "coverage_ratio": round(coverage_ratio, 4) if coverage_ratio is not None else None,
                "model": MODEL_NAME,
                "device": DEVICE,
                "fp16": FP16,
                "language": LANG,
                "beam_size": BEAM_SIZE,
                "temperature": (list(TEMPERATURE) if isinstance(TEMPERATURE, tuple) else TEMPERATURE),
                "initial_prompt_len_chars": len(INITIAL_PROMPT.strip()),
                "initial_prompt_len_tokens": prompt_tokens,
                "normalized_16k": bool(NORMALIZE_AUDIO and audio_used_path.name.endswith("input.16k.wav")),
                "input_original_name": audio_in.name,
                "input_original_sha1": sha1_file(audio_in),
                "input_used_name": audio_used_path.name,
                "input_used_sha1": sha1_file(audio_used_path),
                "output_txt": out_txt.name,
                "chars": len(text),
                "words": len(text.split()),
                "segments": (len(result.get("segments", [])) if isinstance(result.get("segments"), list) else None),
                "whisper_version": getattr(whisper, "__version__", "git"),
                "torch_version": torch.__version__,
                "os": f"{platform.system()} {platform.release()}",
            }

            # meta.json atómico
            tmp_meta = job_dir / "meta.json.tmp"
            tmp_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            tmp_meta.replace(job_dir / "meta.json")

            # Mover a done
            final_dir = DONE / job_name
            shutil.move(str(job_dir), str(final_dir))
            audio_in.unlink(missing_ok=False)

            log_line(f"[DONE]  {audio_in.name} -> {final_dir} "
                     f"(dur={elapsed_hms} ≈ {elapsed_min} min, "
                     f"audio={audio_duration_hms} ≈ {audio_duration_min} min, "
                     f"RTF={meta['rtf']})")

            total_jobs += 1
            ok_jobs += 1
            total_elapsed += elapsed
            if audio_dur_sec_val is not None:
                total_audio_dur += audio_dur_sec_val
            if rtf is not None:
                rtfs.append(rtf)

        except Exception as e:
            failed_jobs += 1
            total_jobs += 1
            tb = traceback.format_exc()
            log_line(f"[FAIL]  {audio_in.name} :: {e}")
            (job_dir / "error.log").write_text(tb, encoding="utf-8")
            failed_dir = (WORKDIR / "failed" / job_name)
            failed_dir.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(job_dir), str(failed_dir))
            continue

    # Informe
    print("\n===== 📊 Informe de Ejecución =====")
    print(f"Total procesados: {total_jobs}")
    print(f"  ✅ Exitosos: {ok_jobs}")
    print(f"  ❌ Fallidos: {failed_jobs}")
    if total_jobs > 0:
        print(f"Normalizados: {normalized_count}/{total_jobs} ({(100.0*normalized_count/total_jobs):.1f}%)")
    if ok_jobs > 0:
        if total_audio_dur > 0:
            avg_audio = total_audio_dur / ok_jobs
            print(f"Duración promedio de audio: {avg_audio:.1f} s")
        else:
            print("Duración promedio de audio: N/A")
        avg_elapsed = total_elapsed / ok_jobs
        print(f"Tiempo promedio de ejecución: {avg_elapsed}")
        if rtfs:
            avg_rtf = sum(rtfs) / len(rtfs)
            print(f"RTF Promedio: {avg_rtf:.3f}")
        else:
            print("RTF Promedio: N/A")
    else:
        print("No hubo jobs exitosos.")
    print("===================================")
    print("\nTerminado. Revisa ./done para los finalizados y ./pending para los no procesados.")