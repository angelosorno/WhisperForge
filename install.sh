#!/usr/bin/env bash
set -euo pipefail

echo "⚒️ WhisperForge Installer — macOS / Linux"
echo "-----------------------------------------"

# Detect OS
OS="$(uname -s)"
echo "Detected OS: $OS"

# Ensure Python3
if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ Python3 no encontrado. Instálalo y vuelve a correr este script."
  exit 1
fi

# Create venv
if [ ! -d "env" ]; then
  echo "📦 Creando entorno virtual env/"
  python3 -m venv env
else
  echo "ℹ️  Entorno env/ ya existe"
fi

# Activate venv
# shellcheck disable=SC1091
source env/bin/activate

# Upgrade basics
echo "⬆️  Actualizando pip/setuptools/wheel"
pip install -U pip setuptools wheel

# Install FFmpeg
if [ "$OS" = "Darwin" ]; then
  # macOS
  if ! command -v brew >/dev/null 2>&1; then
    echo "🍺 Homebrew no encontrado. Instálalo desde https://brew.sh o instala ffmpeg manualmente."
  else
    echo "🍺 Instalando ffmpeg con Homebrew (si no está ya)"
    brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg
  fi
elif [ "$OS" = "Linux" ]; then
  # Linux (Debian/Ubuntu)
  if command -v apt-get >/dev/null 2>&1; then
    echo "🐧 Instalando ffmpeg con APT"
    sudo apt-get update -y
    sudo apt-get install -y ffmpeg
  else
    echo "⚠️  No se detectó APT. Instala ffmpeg con el gestor de tu distro."
  fi
else
  echo "⚠️  Sistema no reconocido para instalación automática de ffmpeg. Instálalo manualmente."
fi

# Install PyTorch
if [ "$OS" = "Darwin" ]; then
  echo "🍎 Instalando PyTorch (macOS, con soporte MPS si Apple Silicon)"
  pip install torch torchvision torchaudio
elif [ "$OS" = "Linux" ]; then
  if command -v nvidia-smi >/dev/null 2>&1; then
    echo "🟢 NVIDIA GPU detectada — instalando ruedas CUDA 12.1"
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
  else
    echo "⚪ Instalando ruedas CPU de PyTorch (sin CUDA)"
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
  fi
else
  echo "⚪ Instalando ruedas CPU (fallback)"
  pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

# Install Whisper
echo "📥 Instalando OpenAI Whisper desde el repositorio oficial"
pip install git+https://github.com/openai/whisper.git

# Create folders
echo "📂 Creando estructura de carpetas"
mkdir -p pending processing done failed

echo "✅ Instalación completa."
echo "👉 Activa el entorno con:  source env/bin/activate"
echo "👉 Coloca audios en 'pending/' y ejecuta tu script (p. ej. 'python transcriber.py')."
