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
chmod +x install.sh && ./install.sh
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
├── install.sh     # Instalador automático
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
