#!/usr/bin/env bash
set -euo pipefail

echo "⚒️ WhisperForge Installer — macOS / Linux"
echo "-----------------------------------------"

OS="$(uname -s)"
ARCH="$(uname -m)"
echo "Detected OS: $OS  | Arch: $ARCH"

# 1) Python3 presente
if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ Python3 no encontrado. Instálalo y vuelve a correr este script."
  exit 1
fi

# 2) Crear venv
if [ ! -d "env" ]; then
  echo "📦 Creando entorno virtual env/"
  python3 -m venv env
else
  echo "ℹ️  Entorno env/ ya existe"
fi

# 3) Activar venv
# shellcheck disable=SC1091
source env/bin/activate

# 4) Mostrar versiones base
echo "🐍 Python: $(python -V)"
echo "📦 Pip:     $(pip -V)"

# 5) Actualizar herramientas básicas
echo "⬆️  Actualizando pip/setuptools/wheel"
pip install -U pip setuptools wheel

# 6) Instalar FFmpeg
if [ "$OS" = "Darwin" ]; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "🍺 Homebrew no encontrado. Instálalo desde https://brew.sh o instala ffmpeg manualmente."
  else
    echo "🍺 Instalando ffmpeg con Homebrew (si no está ya)"
    brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg
  fi
elif [ "$OS" = "Linux" ]; then
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

# 7) Instalar PyTorch (según plataforma)
echo "🧱 Instalando PyTorch…"
if [ "$OS" = "Darwin" ]; then
  # En macOS (Intel o Apple Silicon) basta PyPI; MPS viene con las ruedas CPU modernas
  pip install --upgrade torch torchvision torchaudio
elif [ "$OS" = "Linux" ]; then
  if command -v nvidia-smi >/dev/null 2>&1; then
    echo "🟢 NVIDIA GPU detectada — ruedas CUDA 12.1"
    pip install --upgrade torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
  else
    echo "⚪ Sin NVIDIA — ruedas CPU"
    pip install --upgrade torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
  fi
else
  echo "⚪ Fallback CPU"
  pip install --upgrade torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

# 8) Instalar Whisper
echo "📥 Instalando OpenAI Whisper"
# Preferible usar el paquete de PyPI (estable); tu script importa 'whisper'
pip install --upgrade openai-whisper

# 9) (Opcional) Jupyter solo si lo necesitas
# echo "📓 Instalando Jupyter Notebook"
# pip install notebook

# 10) Crear estructura de carpetas
echo "📂 Creando estructura de carpetas"
mkdir -p pending processing done failed

# 11) Instalar requirements.txt si existe
if [ -f "requirements.txt" ]; then
  echo "📄 Instalando requirements.txt"
  pip install -r requirements.txt
fi

# 12) Verificación rápida en tiempo real (torch + whisper)
echo "🧪 Verificando instalación…"
python - <<'PY'
import sys, platform
try:
    import torch, whisper
    print(f"[OK] torch {torch.__version__} | python {platform.python_version()}")
    has_mps = getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()
    print(f"[INFO] MPS available: {bool(has_mps)}")
    print(f"[OK] whisper importado correctamente ({getattr(whisper, '__version__', 'unknown')})")
except Exception as e:
    print(f"[FAIL] Verificación falló: {e}", file=sys.stderr)
    sys.exit(1)
PY

echo "✅ Instalación completa."
echo "👉 Activa el entorno cuando lo necesites:  source env/bin/activate"
echo "👉 En macOS puedes usar MPS fallback:     export PYTORCH_ENABLE_MPS_FALLBACK=1"
echo "👉 Coloca audios en 'pending/' y ejecuta: python WhisperLoop.py"