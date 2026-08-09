

# WhisperForge Web Application 🎙️

Una aplicación web profesional para transcripción de audio con **Next.js 14** y **FastAPI**, potenciada por **OpenAI Whisper**.

## 🌟 Características

- ✅ **Interfaz Moderna**: UI premium con Next.js 14, TypeScript y Tailwind CSS
- ✅ **Progreso en Tiempo Real**: WebSocket para actualizaciones en vivo
- ✅ **Múltiples Formatos**: Soporta MP3, WAV, M4A, MP4, FLAC y más de 30 formatos
- ✅ **Alta Precisión**: Modelos Whisper large-v3 para transcripciones de alta fidelidad
- ✅ **Drag & Drop**: Carga de archivos intuitiva
- ✅ **Métricas Detalladas**: RTF, duración, palabras, segmentos, etc.
- ✅ **Configuración Flexible**: Personaliza modelo, idioma, prompt y más
- ✅ **Dark Mode**: Soporte completo para tema oscuro

## 📋 Requisitos Previos

- **Python 3.12+**
- **Node.js 18+** y npm
- **FFmpeg** (para procesamiento de audio)
- **Entorno virtual Python** (recomendado)

## 🚀 Instalación

### 1. Backend (FastAPI)

```bash
# Navegar al directorio backend
cd backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Copiar y configurar variables de entorno
cp .env.example .env
# Editar .env según tus necesidades
```

### 2. Frontend (Next.js)

```bash
# Navegar al directorio frontend
cd frontend

# Instalar dependencias
npm install

# Copiar y configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local si es necesario
```

## ▶️ Ejecución

### Iniciar Backend

```bash
cd backend
source venv/bin/activate  # Activar entorno virtual
python main.py
```

El backend estará disponible en: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/health`

### Iniciar Frontend

```bash
cd frontend
npm run dev
```

El frontend estará disponible en: `http://localhost:3000`

## 📖 Uso

1. **Accede a la aplicación** en `http://localhost:3000`
2. **Navega a "Transcribir"** desde el menú
3. **Arrastra un archivo de audio/video** o haz clic para seleccionar
4. **Configura las opciones** (modelo, idioma, etc.)
5. **Haz clic en "Iniciar Transcripción"**
6. **Observa el progreso en tiempo real** en la página del trabajo
7. **Descarga la transcripción** cuando esté completa

## 🏗️ Estructura del Proyecto

```
WhisperForge/
├── backend/                 # FastAPI application
│   ├── api/                # API routes
│   ├── core/               # Core logic (transcription, job manager)
│   ├── models/             # Pydantic schemas
│   ├── main.py             # Application entry point
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # Next.js application
│   ├── app/               # App Router pages
│   │   ├── jobs/         # Jobs list and detail pages
│   │   ├── transcribe/   # Transcription page
│   │   └── page.tsx      # Homepage
│   ├── components/        # React components
│   ├── lib/              # Utilities and API client
│   └── package.json      # Node dependencies
│
├── pending/               # Upload directory
├── processing/            # Processing directory
├── done/                  # Completed jobs
└── failed/                # Failed jobs
```

## 🔧 Configuración

### Backend (.env)

```env
# Whisper Configuration
WHISPER_MODEL=large-v3
WHISPER_LANGUAGE=es
WHISPER_TEMPERATURE=0.0
WHISPER_BEAM_SIZE=8
NORMALIZE_AUDIO=true

# Server
HOST=0.0.0.0
PORT=8000

# CORS
CORS_ORIGINS=http://localhost:3000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/ws
```

## 📡 API Endpoints

### REST API

- `GET /api/health` - Health check
- `POST /api/upload` - Upload audio file
- `POST /api/transcribe/{job_id}` - Start transcription
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/{job_id}` - Get job details
- `GET /api/jobs/{job_id}/download` - Download transcript
- `DELETE /api/jobs/{job_id}` - Delete job

### WebSocket

- `WS /api/ws/{job_id}` - Real-time progress updates

## 🎨 Tecnologías

### Backend
- **FastAPI** - Modern Python web framework
- **OpenAI Whisper** - Speech-to-text model
- **PyTorch** - ML framework
- **WebSockets** - Real-time communication
- **Pydantic** - Data validation

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS
- **React Query** - Data fetching and caching
- **Axios** - HTTP client
- **Lucide React** - Icon library
- **next-intl** - Internationalization and localization framework

## 🐛 Troubleshooting

### Backend

**Error: `ffmpeg` no encontrado**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg
```

**Error: MPS no soportado**
```bash
export PYTORCH_ENABLE_MPS_FALLBACK=1
```

### Frontend

**Error: Node.js no encontrado**
```bash
# Instalar Node.js desde https://nodejs.org/
# O usar nvm:
nvm install 18
nvm use 18
```

**Error de conexión con backend**
- Verifica que el backend esté corriendo en `http://localhost:8000`
- Revisa las variables de entorno en `.env.local`

## 📝 Notas

- **Modelos Whisper disponibles**: `base`, `small`, `medium`, `large-v2`, `large-v3`
- **Idiomas soportados**: 100+ idiomas (español, inglés, francés, etc.)
- **Tamaño máximo de archivo**: 500 MB (configurable)
- **Formatos soportados**: MP3, WAV, M4A, MP4, FLAC, OGG, AAC, WMA, MOV, AVI, MKV, y más

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📜 Licencia

MIT License - Ver archivo LICENSE para más detalles

---

**WhisperForge** - *Forjando transcripciones claras a partir de audios* 🔥




- Version CLI

# ⚒️ WhisperForge

**Forjando transcripciones claras a partir de audios**  
Un pipeline automatizado con [OpenAI Whisper](https://github.com/openai/whisper) para convertir grabaciones en texto organizado, con carpetas limpias, logs de ejecución y métricas de trazabilidad.  
Diseñado para la transcripción automática de audio a texto con alta fidelidad. Soporta múltiples formatos (MP3, WAV, M4A, MP4, FLAC, CAF, AIFF, MOV, entre otros).

### Casos de uso:
- 🎙️ Transcripción de **podcasts** y **entrevistas** para publicación en blogs o medios digitales.  
- 📚 Generación de **notas de conferencias, clases o cursos en línea**.  
- 🎧 Procesamiento de **grabaciones personales** (dictados, ideas, reuniones).  
- 📰 Creación de **subtítulos o documentación** a partir de archivos de audio y video.  

> Con soporte para **español e idiomas internacionales**, WhisperForge ofrece un flujo simple: coloca un archivo en la carpeta `pending/` y el sistema lo transforma en texto preciso, organizado y listo para usar.  

---

## 📥 Clona el repositorio desde GitHub

```bash
git clone git@github.com:angelosorno/WhisperForge.git
cd WhisperForge
```

---

## 📦 Instalación rápida (Recomendada)

Ejecuta el instalador automático (macOS / Linux):

```bash
chmod +x Install.sh && ./Install.sh
```

El script hará lo siguiente por ti:

- Crea un **entorno virtual** `env/`.  
- Instala **FFmpeg** (Homebrew en macOS, APT en Debian/Ubuntu).  
- Instala **PyTorch** según tu sistema (Apple Silicon, NVIDIA GPU o CPU).  
- Instala **Whisper** desde el repo oficial.  
- Crea la estructura de carpetas: `pending/`, `processing/`, `done/`, `failed/`.  

> En **Windows**, usa WSL2 o instala manualmente (ver sección “Instalación manual”).  

---

## 📖 Descripción

**WhisperForge** es un sistema local en Python que organiza y transcribe automáticamente archivos de audio.  
Deja un archivo en **`pending/`**, y el sistema lo **forja** 🔥 en texto con Whisper, depositándolo en **`done/`** con su `.txt` y un `meta.json` con métricas de ejecución.  

👉 El cuaderno principal para ejecutar el sistema es:  

**`WhisperLoop.ipynb`**  

También se incluye:  
- **`WhisperBase.ipynb`** → versión básica para transcribir un solo audio rápidamente.  

---

## 📂 Estructura de carpetas

```
WhisperForge/
│
├── pending/       # Aquí dejas los audios sin procesar
├── processing/    # Usado internamente durante el trabajo
├── done/          # Resultados finales (audio + txt + meta.json)
├── failed/        # Jobs con error (contienen audio + error.log)
│
├── pipeline.log   # Log global con todas las ejecuciones
├── Install.sh     # Instalador automático
├── requirements.txt # Dependencias
├── WhisperLoop.ipynb # Cuaderno principal
└── WhisperBase.ipynb # Cuaderno básico
```

---

## ▶️ Uso básico

1. Activa el entorno:
   ```bash
   source env/bin/activate        # macOS / Linux
   ```

2. Coloca los audios en **`pending/`**. Formatos aceptados:
   ```
   .m4a .wav .mp3 .flac .ogg .aac .wma .mkv .mp4 .caf .aiff .aif .mov
   ```

3. Ejecuta el cuaderno principal:
   ```bash
   jupyter notebook WhisperLoop.ipynb
   ```

4. Cada audio genera en **`done/`**:
   - 🎵 Audio original  
   - 📝 `<timestamp>-<model>-<slug>.txt`  
   - 📑 `meta.json` con métricas  

Si algo falla:  
- El audio se **mantiene en `pending/`** o  
- Se mueve a **`failed/`** con su `error.log` para diagnóstico.  

---

## ⚙️ Configuración recomendada

En tu `WhisperLoop.ipynb`, puedes configurar el modelo, idioma y prompt:

```python
MODEL_NAME = "large-v3"
LANG = "es"
INITIAL_PROMPT = (
    "Transcripción fiel en español de un archivo de audio. "
    "Usar ortografía y gramática correctas, con buena puntuación. "
    "Contexto: discurso, conferencia o grabación personal. "
    "Palabras clave: claridad, precisión, coherencia, fidelidad."
)
```

Además:  
- `NORMALIZE_AUDIO = True` → Normaliza a **WAV 16kHz mono (PCM16)** antes de transcribir.  
- `NORMALIZE_AUDIO = False` → Usa directamente el archivo original.  

---

## 📋 Instalación con requirements.txt

```bash
pip install -r requirements.txt
```

Incluye:

```
torch
torchaudio
torchvision
git+https://github.com/openai/whisper.git
```

---

## 📊 Métricas y trazabilidad

Cada job guarda un `meta.json` con información como:  

- ⏱️ `elapsed_sec` → tiempo total de ejecución.  
- 🎵 `audio_duration_sec` → duración real del audio procesado.  
- ⚡ `rtf` → Real Time Factor (relación entre tiempo de ejecución y duración del audio).  
- 📈 `coverage_ratio` → hasta dónde llegó la transcripción respecto al audio.  
- 🔧 Configuración usada: modelo, device, beam_size, temperature, prompt.  
- ✅ Si el audio fue **normalizado** o no.  
- 🔑 Hash SHA1 de los archivos para verificación de integridad.  

Al final de cada ejecución, el sistema imprime un **informe en consola** con:  
- Número total de jobs.  
- Exitosos / fallidos.  
- Duración promedio de audios.  
- Tiempo promedio de ejecución.  
- RTF promedio.  

---

## 🧪 Instalación manual (Si no usas el script)

```bash
python3 -m venv env
source env/bin/activate
pip install -U pip setuptools wheel
pip install torch torchvision torchaudio
pip install git+https://github.com/openai/whisper.git
brew install ffmpeg   # macOS
sudo apt-get -y install ffmpeg   # Linux
```

> Ajusta PyTorch según tu hardware (CUDA/MPS/CPU).  

---

## 🧯 Troubleshooting rápido

- **MPS (Apple Silicon) falla con operator no soportado**  
  ```bash
  export PYTORCH_ENABLE_MPS_FALLBACK=1
  ```  
- **`ffmpeg` no encontrado** → instala con Homebrew o APT.  
- **Memoria insuficiente con `large-v3`** → usa `medium` o procesa audios más cortos.  
- **Archivos con puntos/espacios en el nombre** → el sistema los normaliza automáticamente (slugify).  

---

## 🤝 Contribuir

1. Haz un fork 🍴  
2. Crea una rama  
3. Envía un PR  

Issues bienvenidos: rendimiento, compatibilidad, documentación.  

---

## 📜 Licencia

**MIT**. Usa y adapta libremente.  

---

> **WhisperForge**: *“Convierte cualquier audio en texto claro, con métricas y control total.”*
