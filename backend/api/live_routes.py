"""API routes for live translation streaming."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from typing import Optional

from core.live_translation import live_manager
from api.auth import get_current_user

router = APIRouter()


@router.post("/live/stream/start")
async def start_live_stream(
    church_id: str, 
    source_language: str = "es",
    # current_user: dict = Depends(get_current_user) # Auth disabled
):
    """
    Start a new live translation stream.
    
    Args:
        church_id: Unique identifier for the church/location
        source_language: Source language code (default: Spanish)
    
    Returns:
        Stream information including stream_id and available channels
    """
    stream_id = await live_manager.start_stream(church_id, source_language)
    
    return {
        "stream_id": stream_id,
        "church_id": church_id,
        "channels": ["de", "fr", "en", "it"],
        "status": "active"
    }


@router.post("/live/stream/{stream_id}/stop")
async def stop_live_stream(
    stream_id: str,
    # current_user: dict = Depends(get_current_user) # Auth disabled
):
    """Stop an active live translation stream."""
    success = await live_manager.stop_stream(stream_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    return {"status": "stopped", "stream_id": stream_id}


@router.get("/live/streams")
async def list_active_streams():
    """List all active live translation streams."""
    streams = live_manager.get_active_streams()
    
    return {
        "streams": streams,
        "total": len(streams)
    }


@router.get("/live/stream/{stream_id}")
async def get_stream_info(stream_id: str):
    """Get information about a specific stream."""
    stream = live_manager.get_stream(stream_id)
    
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    return {
        "stream_id": stream.stream_id,
        "church_id": stream.church_id,
        "source_language": stream.source_language,  # Include source language
        "status": stream.status,
        "listeners": stream.get_total_listeners(),
        "channels": {
            code: {
                "name": channel.name,
                "listeners": channel.get_listener_count(),
                "is_original": channel.is_original  # Indicate if this is the original
            }
            for code, channel in stream.channels.items()
        }
    }


@router.websocket("/live/stream/{stream_id}/input")
async def stream_audio_input(websocket: WebSocket, stream_id: str):
    """
    WebSocket endpoint for receiving audio input from sound console.
    
    The audio should be sent as binary chunks (PCM/WAV format).
    """
    stream = live_manager.get_stream(stream_id)
    
    if not stream:
        await websocket.close(code=404, reason="Stream not found")
        return
    
    await websocket.accept()
    print(f"🎤 Audio input connected for stream: {stream_id}")
    
    try:
        while stream.status == "active":
            # Receive audio chunk from sound console
            audio_chunk = await websocket.receive_bytes()
            
            # Process and translate to all languages
            await live_manager.process_audio_chunk(stream_id, audio_chunk)
            
    except WebSocketDisconnect:
        print(f"🎤 Audio input disconnected for stream: {stream_id}")
    except Exception as e:
        print(f"❌ Error in audio input: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass


@router.websocket("/live/listen/{stream_id}/{language}")
async def listen_to_channel(websocket: WebSocket, stream_id: str, language: str):
    """
    WebSocket endpoint for users to listen to a specific language channel.
    
    Args:
        stream_id: The stream identifier
        language: Language code (de, fr, en, it)
    """
    stream = live_manager.get_stream(stream_id)
    
    if not stream:
        await websocket.close(code=404, reason="Stream not found")
        return
    
    channel = stream.channels.get(language)
    
    if not channel:
        await websocket.close(code=404, reason="Language channel not found")
        return
    
    print(f"🎧 New listener for {channel.name} channel in stream {stream_id}")
    
    # Add listener to channel (this will handle the WebSocket connection)
    await channel.add_listener(websocket)
