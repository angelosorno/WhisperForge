"""Live Translation Manager for real-time multi-language audio streaming."""
import asyncio
import time
from typing import Dict, Set
from pathlib import Path
import numpy as np
import soundfile as sf

from fastapi import WebSocket

from core.translation_engine import translation_engine


class AudioChannel:
    """Manages a single language audio channel with multiple listeners."""
    
    def __init__(self, lang_code: str, name: str, is_original: bool = False):
        self.lang_code = lang_code
        self.name = name
        self.is_original = is_original  # True if this is the source language (no translation)
        self.listeners: Set[WebSocket] = set()
        self.is_active = True
    
    async def add_listener(self, websocket: WebSocket):
        """Add a listener to this channel."""
        await websocket.accept()
        self.listeners.add(websocket)
        print(f"✓ New listener added to {self.name} channel. Total: {len(self.listeners)}")
        
        try:
            # Keep connection alive and monitor for disconnects
            # We don't expect data from the client, but reading waits for the close event
            while self.is_active:
                await websocket.receive_bytes()  # Just wait for data or disconnect
        except Exception:
            # Normal usage: receives disconnect or error
            pass
        finally:
            self.listeners.discard(websocket)
            print(f"✗ Listener removed from {self.name} channel. Remaining: {len(self.listeners)}")
    
    async def broadcast(self, audio_chunk: bytes):
        """Broadcast audio chunk to all listeners."""
        # Send to active listeners directly (Push model)
        if not self.listeners:
            return

        dead_listeners = set()
        for listener in self.listeners:
            try:
                await listener.send_bytes(audio_chunk)
            except Exception:
                dead_listeners.add(listener)
        
        # Clean up disconnected listeners
        self.listeners -= dead_listeners
    
    def get_listener_count(self) -> int:
        """Get number of active listeners."""
        return len(self.listeners)


class LiveStream:
    """Represents a live translation stream for a specific church/location."""
    
    def __init__(self, stream_id: str, church_id: str, source_language: str = "es"):
        self.stream_id = stream_id
        self.church_id = church_id
        self.source_language = source_language  # Language of original audio
        self.status = "active"
        self.channels: Dict[str, AudioChannel] = {}
        self.created_at = asyncio.get_event_loop().time()
        
        # Create channels for different languages
        # Don't create a channel for the source language (it's the original)
        target_languages = {
            "de": "German",
            "fr": "French",
            "en": "English",
            "it": "Italian",
            "es": "Spanish",
            "pt": "Portuguese"
        }
        
        for code, name in target_languages.items():
            if code != source_language:  # Skip source language
                self.channels[code] = AudioChannel(code, name)
        
        # Always add source language channel for original audio
        source_name = target_languages.get(source_language, "Original")
        self.channels[source_language] = AudioChannel(source_language, source_name, is_original=True)
    
    def get_total_listeners(self) -> int:
        """Get total number of listeners across all channels."""
        return sum(channel.get_listener_count() for channel in self.channels.values())
    
    async def stop(self):
        """Stop the stream and close all channels."""
        self.status = "stopped"
        for channel in self.channels.values():
            channel.is_active = False


class LiveTranslationManager:
    """Manages all active live translation streams."""
    
    def __init__(self):
        self.active_streams: Dict[str, LiveStream] = {}
        self._lock = asyncio.Lock()
        
        # TODO: Initialize SeamlessM4T model
        # For MVP, we'll use a placeholder
        self.translator = None
        print("⚠️  Live Translation Manager initialized (SeamlessM4T not loaded yet)")
    
    async def start_stream(self, church_id: str, source_lang: str = "spa") -> str:
        """Start a new live translation stream."""
        async with self._lock:
            stream_id = f"{church_id}_{int(time.time())}"
            
            stream = LiveStream(stream_id, church_id, source_lang)
            self.active_streams[stream_id] = stream
            
            print(f"🎙️  Started live stream: {stream_id} for {church_id}")
            return stream_id
    
    async def stop_stream(self, stream_id: str) -> bool:
        """Stop a live translation stream."""
        async with self._lock:
            stream = self.active_streams.get(stream_id)
            if not stream:
                return False
            
            await stream.stop()
            del self.active_streams[stream_id]
            
            print(f"🛑 Stopped live stream: {stream_id}")
            return True
    
    def get_stream(self, stream_id: str) -> LiveStream | None:
        """Get a stream by ID."""
        return self.active_streams.get(stream_id)
    
    def get_active_streams(self) -> list:
        """Get list of all active streams."""
        return [
            {
                "stream_id": stream.stream_id,
                "church_id": stream.church_id,
                "status": stream.status,
                "listeners": stream.get_total_listeners(),
                "created_at": stream.created_at
            }
            for stream in self.active_streams.values()
        ]
    
    async def process_audio_chunk(self, stream_id: str, audio_data: bytes):
        """
        Process incoming audio chunk and translate to all languages.
        
        Pipeline:
        1. Buffer audio chunks (need ~3 seconds for good transcription)
        2. Transcribe with Whisper
        3. Translate text with GPT-4
        4. Convert to speech with TTS
        5. Broadcast to channels
        """
        stream = self.get_stream(stream_id)
        if not stream:
            return
        
        # Add to buffer
        translation_engine.add_to_buffer(stream_id, audio_data)
        
        # Check if we have enough audio to process
        buffered_audio = translation_engine.get_buffered_audio(stream_id)
        
        if buffered_audio is not None:
            # Process translation for all languages concurrently
            tasks = []
            for lang_code, channel in stream.channels.items():
                # On-Demand Translation Logic:
                # 1. Always process original language channel (no cost, pass-through)
                # 2. For translated channels, ONLY process if there are active listeners
                # This prevents wasted API tokens on empty channels.
                
                if channel.is_original or channel.get_listener_count() > 0:
                    task = self._translate_and_broadcast(
                        buffered_audio,
                        lang_code,
                        channel
                    )
                    tasks.append(task)
            
            # Run active translations concurrently
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _translate_and_broadcast(
        self,
        audio: np.ndarray,
        target_lang: str,
        channel: 'AudioChannel'
    ):
        """Translate audio and broadcast to channel."""
        try:
            # If this is the original language channel, pass through without translation
            if channel.is_original:
                # Convert numpy array to bytes for broadcasting
                # Assuming audio is float32, convert to int16 PCM
                audio_int16 = (audio * 32767).astype(np.int16)
                audio_bytes = audio_int16.tobytes()
                
                # Broadcast original audio directly
                await channel.broadcast(audio_bytes)
                print(f"✅ Original audio passed through to {channel.name} channel")
            else:
                # Translate audio for other languages
                translated_audio = await translation_engine.translate_audio(
                    audio,
                    target_lang
                )
                
                if translated_audio:
                    # Broadcast to all listeners on this channel
                    await channel.broadcast(translated_audio)
                
        except Exception as e:
            print(f"❌ Translation error for {target_lang}: {e}")


# Global instance
live_manager = LiveTranslationManager()
