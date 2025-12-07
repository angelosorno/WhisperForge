# 🚀 Guía Rápida de Inicio - WhisperForge

## Estado Actual

✅ **Backend:** Corriendo en http://localhost:8000
❌ **Frontend:** No está corriendo (por eso el 404)

## Iniciar el Sistema Completo

### Terminal 1: Backend (Ya está corriendo ✅)

```bash
./runBackend.sh
```

**Esperado:**
```
✅ Whisper model loaded
✅ OPENAI_API_KEY configured
INFO: Application startup complete
```

### Terminal 2: Frontend (Necesitas iniciar)

```bash
cd frontend
npm run dev
```

**Esperado:**
```
▲ Next.js 14.2.0
- Local:        http://localhost:3000
- Ready in 2.3s
```

## Acceder a las Páginas

Una vez que ambos estén corriendo:

- **Broadcaster:** http://localhost:3000/broadcaster
- **Listener:** http://localhost:3000/live
- **Dashboard:** http://localhost:3000

## Probar la Traducción en Vivo

### 1. Broadcaster (Emisor)

1. Abre: http://localhost:3000/broadcaster
2. Selecciona:
   - 🎤 Micrófono (o BlackHole si usas Meet/Zoom)
   - 🔊 Altavoz (para monitoreo)
   - 🏛️ Iglesia (ej: Zürich)
3. Click **"Iniciar Transmisión"**
4. Habla en español

### 2. Listener (Oyente)

1. Abre: http://localhost:3000/live (nueva pestaña)
2. Selecciona:
   - 🏛️ Iglesia (la misma que el broadcaster)
   - 🌍 Idioma (Alemán, Francés, Inglés, Italiano)
   - 🔊 Altavoz (tus auriculares)
3. Click **"Comenzar a Escuchar"**
4. Deberías oír la traducción

## Verificar que Funciona

**En la consola del backend verás:**
```
📝 Transcribed: Bienvenidos a la conferencia...
✅ Translation successful using gpt-3.5-turbo
🌍 Translated to de: Willkommen zur Konferenz...
```

## Troubleshooting

### "404 This page could not be found"

**Causa:** Frontend no está corriendo

**Solución:**
```bash
cd frontend
npm run dev
```

### "Error de conexión WebSocket"

**Causa:** Backend no está corriendo

**Solución:**
```bash
./runBackend.sh
```

### "No se escucha audio"

**Checklist:**
- [ ] Backend corriendo
- [ ] Frontend corriendo
- [ ] Broadcaster transmitiendo
- [ ] Listener conectado a la misma iglesia
- [ ] Altavoz seleccionado correctamente
- [ ] Volumen no en 0%

## Comandos Útiles

### Ver logs del backend
```bash
# En la terminal donde corre el backend
# Los logs aparecen automáticamente
```

### Reiniciar todo
```bash
# Terminal 1: Ctrl+C, luego
./runBackend.sh

# Terminal 2: Ctrl+C, luego
cd frontend && npm run dev
```

### Test de OpenAI
```bash
cd backend
python test_openai.py
```

## Configuración Actual

✅ **OpenAI API Key:** Configurada
✅ **Modelo:** gpt-3.5-turbo (económico)
✅ **Whisper:** large-v3
✅ **Idioma fuente:** Español
✅ **Idiomas destino:** Alemán, Francés, Inglés, Italiano

---

**Instalación:** Inicia el frontend con `cd frontend && npm run dev` 🚀
