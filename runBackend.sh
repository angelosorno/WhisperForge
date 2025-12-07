#!/bin/bash

# Quick Start Script for WhisperForge Backend
# Simplified version - let Python handle .env parsing

echo "🚀 Starting WhisperForge Backend..."
echo ""

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo "❌ Error: Run this from WhisperForge root directory"
    exit 1
fi

# Use the system Python with all dependencies
echo "🐍 Using Python: $(which python)"
echo "📦 Python version: $(python --version)"
echo ""

# Set environment variables
export PYTORCH_ENABLE_MPS_FALLBACK=1

# Start backend (Python will load .env automatically)
echo "🔧 Starting backend server..."
echo ""
python backend/main.py
