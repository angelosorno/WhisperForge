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

# 2) Node.js presente
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js no encontrado. Instálalo desde https://nodejs.org"
  exit 1
fi

# 3) Crear venv en raíz del proyecto
if [ ! -d "env" ]; then
  echo "📦 Creando entorno virtual env/"
  python3 -m venv env
else
  echo "ℹ️  Entorno env/ ya existe"
fi

# 4) Activar venv
# shellcheck disable=SC1091
source env/bin/activate

# 5) Mostrar versiones base
echo "🐍 Python: $(python -V)"
echo "📦 Pip:     $(pip -V)"
echo "📦 Node:    $(node -v)"
echo "📦 NPM:     $(npm -v)"

# 6) Actualizar herramientas básicas
echo "⬆️  Actualizando pip/setuptools/wheel"
pip install -U pip setuptools wheel

# 7) Instalar FFmpeg
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

# 8) Crear estructura de carpetas
echo "📂 Creando estructura de carpetas"
mkdir -p pending processing done failed

# 9) Instalar backend requirements (incluye PyTorch, Whisper, FastAPI, etc.)
echo "📄 Instalando backend/requirements.txt"
pip install -r backend/requirements.txt

# 10) Instalar frontend dependencies
echo "📦 Instalando dependencias del frontend"
cd frontend
npm install
cd ..

# 11) Verificación rápida
echo "🧪 Verificando instalación del backend…"
python - <<'PY'
import sys, platform
try:
    import torch, whisper, fastapi
    print(f"[OK] torch {torch.__version__} | python {platform.python_version()}")
    has_mps = getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()
    print(f"[INFO] MPS available: {bool(has_mps)}")
    print(f"[OK] whisper importado correctamente ({getattr(whisper, '__version__', 'unknown')})")
    print(f"[OK] fastapi {fastapi.__version__}")
except Exception as e:
    print(f"[FAIL] Verificación falló: {e}", file=sys.stderr)
    sys.exit(1)
PY

echo ""
echo "✅ Instalación completa."
echo ""
echo "👉 Para arrancar el backend:"
echo "   source env/bin/activate"
echo "   export PYTORCH_ENABLE_MPS_FALLBACK=1  # Solo en macOS"
echo "   cd backend && python main.py"
echo ""
echo "👉 Para arrancar el frontend (en otra terminal):"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "👉 Accede a la aplicación en: http://localhost:3000"
echo ""
echo "💡 Tip: Los jobs se auto-inician al subirlos. Usa los botones ▶️ ⏹️ 🗑️ para controlarlos."