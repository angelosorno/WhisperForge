"""
Admin panel for managing live translation streams.

This script provides a simple CLI to start/stop streams and monitor listeners.
"""
import requests
import asyncio
import websockets
from pathlib import Path
import sys
import time

API_BASE = "http://localhost:8000/api"

def list_streams():
    """List all active streams."""
    response = requests.get(f"{API_BASE}/live/streams")
    data = response.json()
    
    print("\n📡 Active Streams:")
    print("-" * 60)
    
    if not data["streams"]:
        print("No active streams")
        return
    
    for stream in data["streams"]:
        print(f"🎙️  Stream ID: {stream['stream_id']}")
        print(f"   Church: {stream['church_id']}")
        print(f"   Status: {stream['status']}")
        print(f"   Listeners: {stream['listeners']}")
        print(f"   Created: {time.ctime(stream['created_at'])}")
        print("-" * 60)

def start_stream(church_id: str):
    """Start a new live stream."""
    response = requests.post(
        f"{API_BASE}/live/stream/start",
        params={"church_id": church_id, "source_language": "es"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ Stream started successfully!")
        print(f"Stream ID: {data['stream_id']}")
        print(f"Channels: {', '.join(data['channels'])}")
        return data['stream_id']
    else:
        print(f"\n❌ Failed to start stream: {response.text}")
        return None

def stop_stream(stream_id: str):
    """Stop an active stream."""
    response = requests.post(f"{API_BASE}/live/stream/{stream_id}/stop")
    
    if response.status_code == 200:
        print(f"\n✅ Stream {stream_id} stopped successfully")
    else:
        print(f"\n❌ Failed to stop stream: {response.text}")

def get_stream_info(stream_id: str):
    """Get detailed information about a stream."""
    response = requests.get(f"{API_BASE}/live/stream/{stream_id}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n📊 Stream Information:")
        print(f"Stream ID: {data['stream_id']}")
        print(f"Church: {data['church_id']}")
        print(f"Status: {data['status']}")
        print(f"Total Listeners: {data['listeners']}")
        print(f"\nChannels:")
        for code, channel in data['channels'].items():
            print(f"  {code}: {channel['name']} - {channel['listeners']} listeners")
    else:
        print(f"\n❌ Stream not found")

async def simulate_listener(stream_id: str, language: str, duration: int = 10):
    """Simulate a listener connecting to a channel."""
    uri = f"ws://localhost:8000/api/live/listen/{stream_id}/{language}"
    
    print(f"\n🎧 Connecting to {language} channel...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"✅ Connected! Listening for {duration} seconds...")
            
            start_time = time.time()
            chunks_received = 0
            
            while time.time() - start_time < duration:
                try:
                    audio_chunk = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    chunks_received += 1
                    
                    if chunks_received % 10 == 0:
                        print(f"📥 Received {chunks_received} audio chunks")
                        
                except asyncio.TimeoutError:
                    continue
            
            print(f"\n✅ Test complete! Received {chunks_received} chunks total")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

def show_menu():
    """Show the admin menu."""
    print("\n" + "="*60)
    print("🎙️  WhisperForge Live Translation Admin Panel")
    print("="*60)
    print("\n1. List active streams")
    print("2. Start new stream")
    print("3. Stop stream")
    print("4. Get stream info")
    print("5. Test listener")
    print("6. Exit")
    print("\n" + "="*60)

def main():
    """Main admin panel loop."""
    while True:
        show_menu()
        choice = input("\nSelect option: ").strip()
        
        if choice == "1":
            list_streams()
            
        elif choice == "2":
            church_id = input("Enter church ID (e.g., 'zurich'): ").strip()
            start_stream(church_id)
            
        elif choice == "3":
            stream_id = input("Enter stream ID: ").strip()
            stop_stream(stream_id)
            
        elif choice == "4":
            stream_id = input("Enter stream ID: ").strip()
            get_stream_info(stream_id)
            
        elif choice == "5":
            stream_id = input("Enter stream ID: ").strip()
            language = input("Enter language (de/fr/en/it): ").strip()
            duration = int(input("Duration in seconds (default 10): ").strip() or "10")
            asyncio.run(simulate_listener(stream_id, language, duration))
            
        elif choice == "6":
            print("\n👋 Goodbye!")
            break
            
        else:
            print("\n❌ Invalid option")
        
        input("\nPress Enter to continue...")

if __name__ == "__main__":
    main()
