"""
Test script for live translation streaming.

This script simulates an audio input source and tests the live translation pipeline.
"""
import asyncio
import websockets
import numpy as np
import soundfile as sf
from pathlib import Path
import sys

async def test_audio_streaming():
    """Test the live translation system by streaming audio."""
    
    # 1. Start a live stream
    import requests
    
    print("🎬 Starting live stream...")
    response = requests.post(
        "http://localhost:8000/api/live/stream/start",
        params={"church_id": "zurich", "source_language": "es"}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to start stream: {response.text}")
        return
    
    stream_data = response.json()
    stream_id = stream_data["stream_id"]
    print(f"✅ Stream started: {stream_id}")
    
    # 2. Generate test audio (sine wave)
    print("🎵 Generating test audio...")
    sample_rate = 16000
    duration = 10  # 10 seconds
    frequency = 440  # A4 note
    
    t = np.linspace(0, duration, int(sample_rate * duration))
    audio = np.sin(2 * np.pi * frequency * t) * 0.3
    
    # Convert to bytes
    audio_int16 = (audio * 32767).astype(np.int16)
    
    # 3. Connect to WebSocket and stream audio
    print("📡 Connecting to WebSocket...")
    uri = f"ws://localhost:8000/api/live/stream/{stream_id}/input"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected! Streaming audio...")
            
            # Send audio in chunks (100ms each)
            chunk_size = int(sample_rate * 0.1)  # 100ms chunks
            
            for i in range(0, len(audio_int16), chunk_size):
                chunk = audio_int16[i:i+chunk_size]
                await websocket.send(chunk.tobytes())
                await asyncio.sleep(0.1)  # Real-time streaming
                
                if i % (sample_rate * 2) == 0:  # Every 2 seconds
                    print(f"📤 Streamed {i/sample_rate:.1f}s / {duration}s")
            
            print("✅ Audio streaming complete!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # 4. Stop the stream
    print("🛑 Stopping stream...")
    response = requests.post(f"http://localhost:8000/api/live/stream/{stream_id}/stop")
    
    if response.status_code == 200:
        print("✅ Stream stopped successfully")
    else:
        print(f"⚠️  Failed to stop stream: {response.text}")


async def test_listener():
    """Test listening to a channel."""
    
    # Get active streams
    import requests
    response = requests.get("http://localhost:8000/api/live/streams")
    streams = response.json()["streams"]
    
    if not streams:
        print("❌ No active streams found. Run test_audio_streaming first.")
        return
    
    stream_id = streams[0]["stream_id"]
    language = "de"  # German channel
    
    print(f"🎧 Connecting to {language} channel...")
    uri = f"ws://localhost:8000/api/live/listen/{stream_id}/{language}"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected! Receiving audio...")
            
            received_chunks = 0
            while received_chunks < 50:  # Receive 50 chunks (~5 seconds)
                audio_chunk = await websocket.recv()
                received_chunks += 1
                
                if received_chunks % 10 == 0:
                    print(f"📥 Received {received_chunks} chunks")
            
            print("✅ Test complete!")
            
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "listen":
        asyncio.run(test_listener())
    else:
        asyncio.run(test_audio_streaming())
