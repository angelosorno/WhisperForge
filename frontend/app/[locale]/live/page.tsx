'use client';

import { useState, useEffect, useRef } from 'react';
import { Radio, Globe, Users, Play, Square, Loader2, Volume2, Settings, Mic } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AudioVisualizer } from '@/components/audio-visualizer';

interface Church {
    id: string;
    name: string;
    active: boolean;
}

interface Language {
    code: string;
    name: string;
    flag: string;
}

interface ActiveStream {
    stream_id: string;
    church_id: string;
    status: string;
    listeners: number;
}

export default function LiveTranslationPage() {
    const t = useTranslations('Live');
    const [churches] = useState<Church[]>([
        { id: 'zurich', name: 'Iglesia de Zúrich', active: true },
        { id: 'geneva', name: 'Iglesia de Ginebra', active: false },
        { id: 'bern', name: 'Iglesia de Berna', active: false }
    ]);

    const [selectedChurch, setSelectedChurch] = useState('zurich');
    const [selectedLanguage, setSelectedLanguage] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);
    const [listenerCount, setListenerCount] = useState(0);
    const [error, setError] = useState('');
    const [analyser, setAnalyser] = useState<AnalyserNode | undefined>(undefined);

    // Audio devices
    const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedOutputDevice, setSelectedOutputDevice] = useState('');
    const [volume, setVolume] = useState(100);
    const [showDeviceSettings, setShowDeviceSettings] = useState(true); // Show by default
    const [permissionGranted, setPermissionGranted] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);

    const languages: Language[] = [
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'de', name: 'Alemán', flag: '🇩🇪' },
        { code: 'fr', name: 'Francés', flag: '🇫🇷' },
        { code: 'en', name: 'Inglés', flag: '🇬🇧' },
        { code: 'it', name: 'Italiano', flag: '🇮🇹' }
    ];

    // Get available audio output devices
    // This assumes permission is already granted or not needed for basic count
    const getAudioDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

            // Check if we have labels
            const hasLabels = audioOutputs.length > 0 && audioOutputs[0].label.length > 0;
            setPermissionGranted(hasLabels);

            setAudioOutputDevices(audioOutputs);

            if (audioOutputs.length > 0 && !selectedOutputDevice) {
                // Determine default device
                const defaultDevice = audioOutputs.find(d => d.deviceId === 'default') || audioOutputs[0];
                setSelectedOutputDevice(defaultDevice.deviceId);
            }
        } catch (err) {
            console.error('Error getting devices:', err);
        }
    };

    // Explicitly request permission - called by button
    const requestPermission = async () => {
        try {
            console.log('Requesting audio permission...');
            // Force request permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // If successful, we have permission. Enumerate again to get labels.
            console.log('Permission granted, refreshing devices...');
            await getAudioDevices();

            // Stop stream
            stream.getTracks().forEach(track => track.stop());
            setPermissionGranted(true);
        } catch (err) {
            console.error('Permission denied:', err);
            // Verify if it was dismissed or denied
            alert('Por favor, permite el acceso al micrófono en la barra de dirección del navegador para ver tus altavoces.');
        }
    };

    // Request permission and load devices on mount
    useEffect(() => {
        // Auto-request on page load
        getAudioDevices();

        // Listen for device changes
        const handleDeviceChange = () => {
            getAudioDevices();
        };

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, []);

    // Update listener count
    useEffect(() => {
        if (!activeStream) return;

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`http://localhost:8000/api/live/stream/${activeStream.stream_id}`);
                const data = await response.json();
                setListenerCount(data.listeners);
            } catch (err) {
                console.error('Error updating listener count:', err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [activeStream]);

    // Change output device
    const changeOutputDevice = async (deviceId: string) => {
        setSelectedOutputDevice(deviceId);

        if (audioElementRef.current && 'setSinkId' in audioElementRef.current) {
            try {
                await (audioElementRef.current as any).setSinkId(deviceId);
                console.log(`Audio output changed to: ${deviceId}`);
            } catch (err) {
                console.error('Error changing output device:', err);
            }
        }
    };

    // Update volume
    const updateVolume = (newVolume: number) => {
        setVolume(newVolume);
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = newVolume / 100;
        }
        if (audioElementRef.current) {
            audioElementRef.current.volume = newVolume / 100;
        }
    };

    // Check for active streams on mount
    useEffect(() => {
        checkActiveStreams();
        const interval = setInterval(checkActiveStreams, 5000);
        return () => clearInterval(interval);
    }, [selectedChurch]);

    const checkActiveStreams = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/live/streams');
            const data = await response.json();

            const stream = data.streams.find((s: ActiveStream) => s.church_id === selectedChurch);
            setActiveStream(stream || null);

            if (stream) {
                setListenerCount(stream.listeners);
            }
        } catch (err) {
            console.error('Error checking streams:', err);
        }
    };

    const startListening = async () => {
        if (!selectedLanguage) {
            setError('Por favor selecciona un idioma');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Check if there's an active stream
            if (!activeStream) {
                setError('No hay transmisión activa en esta iglesia');
                setIsLoading(false);
                return;
            }

            // Set output device if supported
            // Note: with Web Audio API, strict output selection is harder than HTML5 Audio, 
            // but we use the Context destination.
            if (audioContextRef.current && 'setSinkId' in audioContextRef.current) {
                // @ts-ignore
                try { await audioContextRef.current.setSinkId(selectedOutputDevice); } catch (e) { }
            }

            // Connect to WebSocket
            const ws = new WebSocket(
                `ws://localhost:8000/api/live/listen/${activeStream.stream_id}/${selectedLanguage}`
            );

            // Create persistent audio graph
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            // Create gain node
            const gainNode = audioContext.createGain();
            gainNode.gain.value = volume / 100;
            gainNodeRef.current = gainNode;

            // Create analyser node ONCE
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8; // Smooth out the data
            setAnalyser(analyser); // Set state once

            // Connect persistent graph: Analyser -> Gain -> Destination
            analyser.connect(gainNode);
            gainNode.connect(audioContext.destination);

            ws.onopen = () => {
                console.log('Connected to live stream');
                setIsListening(true);
                setIsLoading(false);
            };

            ws.onmessage = async (event) => {
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }

                // Receive audio chunk
                const arrayBuffer = await event.data.arrayBuffer();
                const int16Data = new Int16Array(arrayBuffer);
                const float32Data = new Float32Array(int16Data.length);

                // Manual conversion from Int16 to Float32
                for (let i = 0; i < int16Data.length; i++) {
                    float32Data[i] = int16Data[i] / 32768.0;
                }

                // Create AudioBuffer
                const audioBuffer = audioContext.createBuffer(1, float32Data.length, 16000); // 16kHz sample rate
                audioBuffer.getChannelData(0).set(float32Data);

                // Create source
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;

                // Connect source to the existing analyser (input of the graph)
                source.connect(analyser);

                // Play
                source.start();
            };

            ws.onerror = (err) => {
                console.error('WebSocket error:', err);
                setError('Error de conexión');
                setIsLoading(false);
            };

            ws.onclose = () => {
                console.log('Disconnected from live stream');
                setIsListening(false);
                setIsLoading(false);
            };

            wsRef.current = ws;

        } catch (err: any) {
            console.error('Error starting stream:', err);
            setError(err.message || 'Error al conectar');
            setIsLoading(false);
        }
    };

    const stopListening = () => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current = null;
        }

        setIsListening(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-4 sm:py-6 lg:py-8">
            <div className="container mx-auto px-3 sm:px-4 lg:px-6 max-w-6xl">
                {/* Header - Mobile Optimized */}
                <div className="text-center mb-6 sm:mb-8">
                    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <Radio className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                            En Vivo
                        </h1>
                    </div>
                    <p className="text-sm sm:text-base lg:text-lg text-muted-foreground px-4">
                        Escucha las conferencias en tu idioma preferido
                    </p>
                </div>

                {/* Audio Settings */}
                <div className={`
                    bg-card rounded-xl border p-4 sm:p-6 mb-6 transition-all duration-300 overflow-hidden
                    ${showDeviceSettings ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 p-0 mb-0 border-0'}
                `}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Volume2 className="w-5 h-5 text-primary" />
                            <h2 className="font-semibold text-base sm:text-lg">{t('audio.title')}</h2>
                        </div>
                        <button
                            onClick={() => setShowDeviceSettings(false)}
                            className="text-sm text-primary hover:underline"
                        >
                            {t('audio.hide')}
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                <div className="flex items-center gap-2">
                                    <Volume2 className="w-4 h-4" />
                                    {t('audio.outputLabel')}
                                </div>
                            </label>

                            {!permissionGranted ? (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                                    <p className="text-sm text-yellow-600 mb-3 block">
                                        ⚠️ {t('audio.permissionWarning')}
                                    </p>
                                    <button
                                        onClick={requestPermission}
                                        className="w-full sm:w-auto px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Mic className="w-4 h-4" />
                                        Conceder Permiso
                                    </button>
                                </div>
                            ) : (
                                <select
                                    value={selectedOutputDevice}
                                    onChange={(e) => setSelectedOutputDevice(e.target.value)}
                                    className="w-full px-3 py-3 sm:px-4 sm:py-3 rounded-lg border bg-background text-base"
                                >
                                    {audioOutputDevices.length === 0 ? (
                                        <option value="">Cargando dispositivos...</option>
                                    ) : (
                                        audioOutputDevices.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Altavoz ${device.deviceId.slice(0, 8)}`}
                                            </option>
                                        ))
                                    )}
                                </select>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('audio.volumeLabel')}: {volume}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={volume}
                                onChange={(e) => updateVolume(Number(e.target.value))}
                                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary touch-target"
                            />
                        </div>
                    </div>
                </div>

                {/* Church Selector - Mobile Optimized */}
                <div className="bg-card rounded-xl border p-4 sm:p-6 shadow-lg mb-4 sm:mb-6">
                    <label className="block text-sm sm:text-base font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                        <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        Selecciona la Sede
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {churches.map(church => (
                            <button
                                key={church.id}
                                onClick={() => setSelectedChurch(church.id)}
                                disabled={!church.active || isListening}
                                className={`p-4 sm:p-5 rounded-xl border-2 transition-all min-h-[60px] sm:min-h-[80px] ${selectedChurch === church.id
                                    ? 'border-primary bg-primary/10 shadow-md scale-105'
                                    : 'border-border hover:border-primary/50 active:scale-95'
                                    } ${(!church.active || isListening) && 'opacity-50 cursor-not-allowed'}`}
                            >
                                <div className="font-semibold text-base sm:text-lg">{church.name}</div>
                                {church.active ? (
                                    <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-green-600 mt-2">
                                        <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                                        En vivo
                                    </div>
                                ) : (
                                    <div className="text-xs sm:text-sm text-muted-foreground mt-2">
                                        Sin transmisión
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Language Selector - Mobile Optimized */}
                <div className="bg-card rounded-xl border p-4 sm:p-6 shadow-lg mb-4 sm:mb-6">
                    <label className="block text-sm sm:text-base font-semibold mb-2">
                        Selecciona tu Idioma
                    </label>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                        🇪🇸 <strong>Español:</strong> Audio original | 🌍 <strong>Otros:</strong> Traducción
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                        {languages.map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => setSelectedLanguage(lang.code)}
                                disabled={isListening}
                                className={`p-4 sm:p-6 lg:p-8 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 min-h-[100px] sm:min-h-[120px] ${selectedLanguage === lang.code
                                    ? 'border-primary bg-primary/10 shadow-lg scale-105'
                                    : 'border-border hover:border-primary/50'
                                    } ${isListening && 'opacity-50 cursor-not-allowed'}`}
                            >
                                <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">{lang.flag}</div>
                                <div className="font-medium text-sm sm:text-base">{lang.name}</div>
                                {lang.code === 'es' && (
                                    <div className="text-xs text-primary mt-1">Original</div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Player Control - Mobile Optimized */}
                <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-xl border-2 border-primary/20 p-6 sm:p-8 lg:p-10 text-center shadow-xl mb-4 sm:mb-6">
                    {error && (
                        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm sm:text-base">
                            {error}
                        </div>
                    )}

                    {isListening ? (
                        <div className="space-y-4 sm:space-y-6">
                            <div className="flex items-center justify-center gap-2 sm:gap-3 text-green-600">
                                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-600 rounded-full animate-pulse" />
                                <span className="text-lg sm:text-xl font-semibold">Escuchando en vivo</span>
                            </div>

                            {activeStream && (
                                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-sm sm:text-base lg:text-lg">{listenerCount} oyentes</span>
                                </div>
                            )}

                            {analyser && (
                                <div className="h-24 mx-auto max-w-md bg-black/5 rounded-lg border overflow-hidden">
                                    <AudioVisualizer analyser={analyser} height={96} color="#5e07a0ff" />
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                                <button
                                    onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                                    className="w-full sm:w-auto px-6 py-3 sm:py-4 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/90 transition-all flex items-center justify-center gap-2 min-h-[48px]"
                                >
                                    <Settings className="w-5 h-5" />
                                    Audio
                                </button>

                                <button
                                    onClick={stopListening}
                                    className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-red-500 text-white rounded-xl font-semibold text-base sm:text-lg hover:bg-red-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 sm:gap-3 min-h-[56px]"
                                >
                                    <Square className="w-5 h-5 sm:w-6 sm:h-6" />
                                    Detener
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={startListening}
                            disabled={!selectedLanguage || isLoading || !activeStream}
                            className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-primary text-primary-foreground rounded-xl font-semibold text-base sm:text-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 mx-auto min-h-[56px]"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                                    Conectando...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                                    Comenzar a Escuchar
                                </>
                            )}
                        </button>
                    )}

                    {!activeStream && !isListening && (
                        <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
                            No hay transmisión activa en este momento
                        </p>
                    )}
                </div>

                {/* Info Box - Mobile Optimized */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 sm:p-6">
                    <h3 className="font-semibold text-base sm:text-lg mb-2 text-blue-600">ℹ️ Cómo funciona</h3>
                    <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
                        <li>• Selecciona la sede de tu iglesia</li>
                        <li>• Elige el idioma en el que quieres escuchar</li>
                        <li>• Presiona "Comenzar a Escuchar"</li>
                        <li>• Ajusta el volumen y altavoz desde el panel de audio</li>
                        <li>• Puedes cambiar el altavoz durante la transmisión</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
