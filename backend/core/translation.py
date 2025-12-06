"""Translation engine using Meta NLLB-200 model."""
import asyncio
from pathlib import Path
from typing import Optional, Callable, Tuple
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# Language code mapping for NLLB-200
LANGUAGE_CODES = {
    "es": "spa_Latn",  # Spanish
    "fr": "fra_Latn",  # French
    "de": "deu_Latn",  # German
    "it": "ita_Latn",  # Italian
    "en": "eng_Latn",  # English
}

LANGUAGE_NAMES = {
    "es": "Español",
    "fr": "Français",
    "de": "Deutsch",
    "it": "Italiano",
    "en": "English",
}

# Global model cache
_model = None
_tokenizer = None
_device = None


def get_device() -> str:
    """Determine the best available device."""
    if torch.cuda.is_available():
        return "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


async def load_translation_model():
    """Load NLLB-200 model (downloads on first use)."""
    global _model, _tokenizer, _device
    
    if _model is not None:
        return _model, _tokenizer, _device
    
    print("Loading NLLB-200 translation model...")
    print("⚠️  First time: downloading ~2.5GB model. This may take a few minutes.")
    
    model_name = "facebook/nllb-200-distilled-600M"
    _device = get_device()
    
    # Load in separate thread to not block
    loop = asyncio.get_event_loop()
    
    def _load():
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        model = model.to(_device)
        model.eval()  # Set to evaluation mode
        return model, tokenizer
    
    _model, _tokenizer = await loop.run_in_executor(None, _load)
    
    print(f"✓ NLLB-200 model loaded on {_device}")
    return _model, _tokenizer, _device


def chunk_text(text: str, max_length: int = 400) -> list[str]:
    """Split text into chunks for translation."""
    # Split by sentences (simple approach)
    sentences = text.replace("! ", "!|").replace("? ", "?|").replace(". ", ".|").split("|")
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        
        sentence_length = len(sentence.split())
        
        if current_length + sentence_length > max_length and current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk = [sentence]
            current_length = sentence_length
        else:
            current_chunk.append(sentence)
            current_length += sentence_length
    
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return chunks


async def translate_text(
    text: str,
    source_lang: str,
    target_lang: str,
    progress_callback: Optional[Callable[[float, str], None]] = None
) -> str:
    """
    Translate text using NLLB-200.
    
    Args:
        text: Text to translate
        source_lang: Source language code (es, fr, de, it, en)
        target_lang: Target language code (es, fr, de, it, en)
        progress_callback: Optional callback for progress updates
    
    Returns:
        Translated text
    """
    if source_lang not in LANGUAGE_CODES:
        raise ValueError(f"Unsupported source language: {source_lang}")
    if target_lang not in LANGUAGE_CODES:
        raise ValueError(f"Unsupported target language: {target_lang}")
    
    # Load model
    model, tokenizer, device = await load_translation_model()
    
    # Get NLLB language codes
    src_lang_code = LANGUAGE_CODES[source_lang]
    tgt_lang_code = LANGUAGE_CODES[target_lang]
    
    # Split into chunks
    chunks = chunk_text(text)
    total_chunks = len(chunks)
    
    if progress_callback:
        await progress_callback(0, f"Traduciendo {total_chunks} segmentos...")
    
    translated_chunks = []
    
    for i, chunk in enumerate(chunks):
        # Tokenize
        tokenizer.src_lang = src_lang_code
        inputs = tokenizer(chunk, return_tensors="pt", padding=True, truncation=True, max_length=512)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Translate
        loop = asyncio.get_event_loop()
        
        def _translate():
            with torch.no_grad():
                # Get target language token ID
                tgt_lang_token = tokenizer.convert_tokens_to_ids(tgt_lang_code)
                
                generated_tokens = model.generate(
                    **inputs,
                    forced_bos_token_id=tgt_lang_token,
                    max_length=512,
                    num_beams=5,
                    early_stopping=True
                )
            return tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]
        
        translated_chunk = await loop.run_in_executor(None, _translate)
        translated_chunks.append(translated_chunk)
        
        # Progress update
        if progress_callback:
            progress = ((i + 1) / total_chunks) * 100
            await progress_callback(progress, f"Traduciendo segmento {i + 1}/{total_chunks}")
    
    # Join chunks
    translated_text = " ".join(translated_chunks)
    
    if progress_callback:
        await progress_callback(100, "Traducción completada")
    
    return translated_text


def create_side_by_side_comparison(
    original_text: str,
    translated_text: str,
    source_lang: str,
    target_lang: str
) -> str:
    """Create side-by-side comparison in Markdown format."""
    from datetime import datetime
    
    source_name = LANGUAGE_NAMES.get(source_lang, source_lang.upper())
    target_name = LANGUAGE_NAMES.get(target_lang, target_lang.upper())
    
    # Get current timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    comparison = f"""# Comparación de Traducción

**Idioma Original**: {source_name}  
**Idioma Traducido**: {target_name}  
**Fecha de Creación**: {timestamp}

---

## Original ({source_name})

{original_text}

---

## Traducción ({target_name})

{translated_text}

---

## Notas

Este documento fue generado automáticamente por WhisperForge usando el modelo NLLB-200.
Puedes editar este archivo directamente para corregir la traducción.

**Última modificación**: {timestamp}
"""
    return comparison.strip()


def create_bilingual_srt(
    original_srt: str,
    translated_text: str,
    target_lang: str
) -> str:
    """
    Create bilingual SRT with original and translation.
    
    Note: This is a simple implementation that adds translation below each subtitle.
    For production, you'd want more sophisticated alignment.
    """
    # Parse SRT
    import re
    
    # Split into subtitle blocks
    blocks = re.split(r'\n\n+', original_srt.strip())
    
    # Split translated text into sentences
    translated_sentences = [s.strip() for s in re.split(r'[.!?]+', translated_text) if s.strip()]
    
    bilingual_blocks = []
    
    for i, block in enumerate(blocks):
        lines = block.split('\n')
        if len(lines) < 3:
            continue
        
        # Extract components
        index = lines[0]
        timestamp = lines[1]
        original_subtitle = ' '.join(lines[2:])
        
        # Get corresponding translation (simple 1:1 mapping)
        translation = translated_sentences[i] if i < len(translated_sentences) else ""
        
        # Create bilingual subtitle
        bilingual_subtitle = f"{index}\n{timestamp}\n{original_subtitle}\n{translation}\n"
        bilingual_blocks.append(bilingual_subtitle)
    
    return '\n'.join(bilingual_blocks)


async def translate_and_save(
    job_dir: Path,
    job_name: str,
    original_text: str,
    source_lang: str,
    target_lang: str,
    progress_callback: Optional[Callable[[float, str], None]] = None,
    create_srt: bool = False,
    original_srt: Optional[str] = None
) -> Tuple[str, str, Optional[str]]:
    """
    Translate text and save all formats.
    
    Returns:
        Tuple of (translated_text_path, comparison_path, bilingual_srt_path)
    """
    # Translate
    translated_text = await translate_text(
        original_text,
        source_lang,
        target_lang,
        progress_callback
    )
    
    # Save translated text
    translated_path = job_dir / f"{job_name}_{target_lang}.txt"
    with open(translated_path, "w", encoding="utf-8") as f:
        f.write(translated_text)
    
    # Save comparison (as markdown)
    comparison = create_side_by_side_comparison(
        original_text,
        translated_text,
        source_lang,
        target_lang
    )
    comparison_path = job_dir / f"{job_name}_comparison_{source_lang}_{target_lang}.md"
    with open(comparison_path, "w", encoding="utf-8") as f:
        f.write(comparison)
    
    # Save bilingual SRT if requested
    bilingual_srt_path = None
    if create_srt and original_srt:
        bilingual_srt = create_bilingual_srt(original_srt, translated_text, target_lang)
        bilingual_srt_path = job_dir / f"{job_name}_bilingual_{target_lang}.srt"
        with open(bilingual_srt_path, "w", encoding="utf-8") as f:
            f.write(bilingual_srt)
    
    return str(translated_path), str(comparison_path), str(bilingual_srt_path) if bilingual_srt_path else None
