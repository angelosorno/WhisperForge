"""
Real-time translation engine using Whisper + GPT-4 + TTS.

This module handles the actual translation pipeline:
1. Speech-to-Text (Whisper)
2. Translation (GPT-4)
3. Text-to-Speech (gTTS)
"""
import asyncio
import io
import os
from pathlib import Path
from typing import Optional
import numpy as np
import soundfile as sf
from gtts import gTTS
import whisper
from openai import AsyncOpenAI

# Language mappings
LANGUAGE_NAMES = {
    "de": "German",
    "fr": "French",
    "en": "English",
    "it": "Italian",
    "es": "Spanish"
}

class TranslationEngine:
    """Handles real-time audio translation."""
    
    def __init__(self):
        self.whisper_model = None
        self.openai_client = None
        self.sample_rate = 16000
        
        # Audio buffer for accumulating chunks
        self.audio_buffers = {}  # stream_id -> buffer
        self.buffer_duration = 3.0  # seconds
        
        print("🔧 Initializing Translation Engine...")
        
    async def initialize(self):
        """Initialize models."""
        # Load Whisper model
        print("📥 Loading Whisper model...")
        self.whisper_model = whisper.load_model("base")  # Use base for speed
        print("✅ Whisper model loaded")
        
        # Initialize OpenAI client
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            self.openai_client = AsyncOpenAI(api_key=api_key)
            print("✅ OpenAI client initialized")
        else:
            print("⚠️  OPENAI_API_KEY not set - translation will be limited")
    
    def add_to_buffer(self, stream_id: str, audio_chunk: bytes):
        """Add audio chunk to buffer."""
        if stream_id not in self.audio_buffers:
            self.audio_buffers[stream_id] = bytearray()
        
        self.audio_buffers[stream_id].extend(audio_chunk)
    
    def get_buffered_audio(self, stream_id: str) -> Optional[np.ndarray]:
        """Get buffered audio if enough has accumulated."""
        if stream_id not in self.audio_buffers:
            return None
        
        buffer = self.audio_buffers[stream_id]
        
        # Check if we have enough audio (3 seconds)
        bytes_needed = int(self.sample_rate * self.buffer_duration * 2)  # 2 bytes per sample (int16)
        
        if len(buffer) < bytes_needed:
            return None
        
        # Extract audio
        audio_bytes = bytes(buffer[:bytes_needed])
        
        # Remove from buffer
        self.audio_buffers[stream_id] = buffer[bytes_needed:]
        
        # Convert to numpy array
        audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
        audio_float = audio_array.astype(np.float32) / 32768.0
        
        return audio_float
    
    async def transcribe(self, audio: np.ndarray) -> str:
        """Transcribe audio to text using Whisper."""
        try:
            # Whisper expects audio at 16kHz
            result = await asyncio.to_thread(
                self.whisper_model.transcribe,
                audio,
                language="es",  # Source language is Spanish
                fp16=False
            )
            
            text = result["text"].strip()
            return text
            
        except Exception as e:
            print(f"❌ Transcription error: {e}")
            return ""
    
    async def translate_text(self, text: str, target_lang: str) -> str:
        """Translate text using GPT-4 or GPT-3.5-turbo."""
        if not self.openai_client:
            # Fallback: return original text
            return f"[{target_lang}] {text}"
        
        try:
            target_language = LANGUAGE_NAMES.get(target_lang, target_lang)
            
            # Read model from environment, default to gpt-4
            model = os.getenv("OPENAI_MODEL", "gpt-4")
            
            response = await self.openai_client.chat.completions.create(
                model=model,  # Use environment variable
                messages=[
                    {
                        "role": "system",
                        "content": f"You are a professional translator. Translate the following Spanish text to {target_language}. Provide ONLY the translation, no explanations."
                    },
                    {
                        "role": "user",
                        "content": text
                    }
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            translated = response.choices[0].message.content.strip()
            print(f"✅ Translation successful using {model}")
            return translated
            
        except Exception as e:
            print(f"❌ Translation error: {e}")
            return f"[Translation error] {text}"
    
    async def text_to_speech(self, text: str, lang: str) -> bytes:
        """Convert text to speech using gTTS."""
        try:
            # Create TTS
            tts = gTTS(text=text, lang=lang, slow=False)
            
            # Save to bytes
            audio_fp = io.BytesIO()
            await asyncio.to_thread(tts.write_to_fp, audio_fp)
            audio_fp.seek(0)
            
            # Read MP3 data
            mp3_data = audio_fp.read()
            
            return mp3_data
            
        except Exception as e:
            print(f"❌ TTS error: {e}")
            return b""
    
    async def translate_audio(
        self,
        audio: np.ndarray,
        target_lang: str
    ) -> bytes:
        """
        Complete translation pipeline:
        1. Transcribe Spanish audio to text
        2. Translate text to target language
        3. Convert translated text to speech
        """
        # Step 1: Transcribe
        spanish_text = await self.transcribe(audio)
        if not spanish_text:
            return b""
        
        print(f"📝 Transcribed: {spanish_text[:50]}...")
        
        # Step 2: Translate
        translated_text = await self.translate_text(spanish_text, target_lang)
        print(f"🌍 Translated to {target_lang}: {translated_text[:50]}...")
        
        # Step 3: Text-to-Speech
        audio_data = await self.text_to_speech(translated_text, target_lang)
        
        return audio_data


# Global instance
translation_engine = TranslationEngine()
