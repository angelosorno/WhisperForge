#!/bin/bash

# WhisperForge - Quick Start Script
# This script starts both backend and frontend servers

echo "🚀 Starting WhisperForge..."
echo ""

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo "❌ Error: Please run this script from the WhisperForge root directory"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    echo "📦 Installing dependencies..."
    pip install -r backend/requirements.txt
else
    source venv/bin/activate
fi

# Start backend in background
echo "🔧 Starting backend server..."
cd backend
export PYTORCH_ENABLE_MPS_FALLBACK=1
python main.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Start frontend
echo "🎨 Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ WhisperForge is running!"
echo ""
echo "📍 Access the application at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo ""
echo "🎙️  Live Translation:"
echo "   Broadcaster: http://localhost:3000/broadcaster"
echo "   Listener:    http://localhost:3000/live"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for Ctrl+C
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit 0" INT
wait
