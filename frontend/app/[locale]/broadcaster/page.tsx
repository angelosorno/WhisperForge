'use client';

import { useState, useEffect, useRef } from 'react';
import { Radio, Mic, MicOff, Settings, Users, Play, Square, Loader2, CheckCircle, Volume2 } from 'lucide-react';
import { AudioVisualizer } from '@/components/audio-visualizer';

interface Stream {
    stream_id: string;
    church_id: string;
    status: string;
    listeners: number;
    source_language: string; // Added source language
}

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';


export default function BroadcasterPage() {
    const t = useTranslations('Broadcaster');
    const tLang = useTranslations('Languages');

    const [selectedChurch, setSelectedChurch] = useState('zurich');
    const [selectedSourceLanguage, setSelectedSourceLanguage] = useState('es'); // Source language
    const [isStreaming, setIsStreaming] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [activeStream, setActiveStream] = useState<Stream | null>(null);
    const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedInputDevice, setSelectedInputDevice] = useState('');
    const [selectedOutputDevice, setSelectedOutputDevice] = useState('');
    const [listenerCount, setListenerCount] = useState(0);
    const [error, setError] = useState('');
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [analyser, setAnalyser] = useState<AnalyserNode | undefined>(undefined);

    const wsRef = useRef<WebSocket | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const sourceLanguages = [
        { code: 'es', name: tLang('es'), flag: '🇪🇸' },
        { code: 'en', name: tLang('en'), flag: '🇬🇧' },
        { code: 'de', name: tLang('de'), flag: '🇩🇪' },
        { code: 'fr', name: tLang('fr'), flag: '🇫🇷' },
        { code: 'it', name: tLang('it'), flag: '🇮🇹' },
        { code: 'pt', name: tLang('pt'), flag: '🇵🇹' }
    ];

    // Get available audio devices
    useEffect(() => {
        async function getDevices() {
            try {
                // 1. Try to enumerate first without forcing permission (avoids ducking if already granted)
                let devices = await navigator.mediaDevices.enumerateDevices();
                let audioInputs = devices.filter(d => d.kind === 'audioinput');
                let audioOutputs = devices.filter(d => d.kind === 'audiooutput');

                // 2. Check if we have labels (permission granted)
                const hasLabels = audioInputs.length > 0 && audioInputs[0].label.length > 0;

                if (!hasLabels) {
                    try {
                        // 3. Request permission ONLY if needed
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                        // 4. Update list with labels
                        devices = await navigator.mediaDevices.enumerateDevices();
                        audioInputs = devices.filter(d => d.kind === 'audioinput');
                        audioOutputs = devices.filter(d => d.kind === 'audiooutput');

                        // 5. STOP the stream immediately to stop audio ducking
                        stream.getTracks().forEach(t => t.stop());
                    } catch (permErr) {
                        console.warn('Microphone permission denied', permErr);
                    }
                }

                setAudioInputDevices(audioInputs);
                setAudioOutputDevices(audioOutputs);

                // ... rest of selection logic
                if (audioInputs.length > 0 && !selectedInputDevice) {
                    setSelectedInputDevice(audioInputs[0].deviceId);
                }

                if (audioOutputs.length > 0 && !selectedOutputDevice) {
                    setSelectedOutputDevice(audioOutputs[0].deviceId);
                }
            } catch (err) {
                console.error('Error getting devices:', err);
            }
        }

        getDevices();

        // Listen for device changes
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', getDevices);
        };
    }, []);

    const router = useRouter(); // Import useRouter

    // Auth check on mount
    useEffect(() => {
        // Auth check temporarily disabled
        setIsLoading(false);
        // const token = localStorage.getItem('token');
        // if (!token) {
        //     router.push('/login');
        // }
    }, [router]);

    // ... (keep existing effects)

    const startBroadcast = async () => {
        setIsConnecting(true);
        setError('');

        try {
            // const token = localStorage.getItem('token');
            // if (!token) {
            //     router.push('/login');
            //     return;
            // }

            // 1. Start stream on backend
            const response = await fetch(
                `http://localhost:8000/api/live/stream/start?church_id=${selectedChurch}&source_language=${selectedSourceLanguage}`,
                {
                    method: 'POST',
                    headers: {
                        // 'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.status === 401) {
                // router.push('/login');
                throw new Error('Sesión expirada');
            }

            if (!response.ok) {
                throw new Error('Failed to start stream');
            }

            const streamData = await response.json();
            setActiveStream(streamData);

            // 2. Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedInputDevice ? { exact: selectedInputDevice } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000
                }
            });

            mediaStreamRef.current = stream;

            // 3. Connect to WebSocket
            const ws = new WebSocket(
                `ws://localhost:8000/api/live/stream/${streamData.stream_id}/input`
            );

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsStreaming(true);
                setIsConnecting(false);

                // Start sending audio
                startAudioCapture(stream, ws);
            };

            ws.onerror = (err) => {
                console.error('WebSocket error:', err);
                setError('Error de conexión WebSocket');
                setIsConnecting(false);
            };

            ws.onclose = () => {
                console.log('WebSocket closed');
                setIsStreaming(false);
            };

            wsRef.current = ws;

        } catch (err: any) {
            console.error('Error starting broadcast:', err);
            setError(err.message || 'Error al iniciar transmisión');
            setIsConnecting(false);
        }
    };

    const startAudioCapture = (stream: MediaStream, ws: WebSocket) => {
        // Don't specify sample rate - let it match the MediaStream automatically
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        // Create analyser for visualization
        const audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 2048;
        source.connect(audioAnalyser);
        setAnalyser(audioAnalyser);

        processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) {
                const inputData = e.inputBuffer.getChannelData(0);

                // Convert to Int16
                const int16Data = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                }

                // Send to server
                ws.send(int16Data.buffer);
            }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
    };

    const stopBroadcast = async () => {
        // ... (cleanup logic)

        // Stop stream on backend
        if (activeStream) {
            try {
                // const token = localStorage.getItem('token');
                // if (token) {
                await fetch(
                    `http://localhost:8000/api/live/stream/${activeStream.stream_id}/stop`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            // 'Authorization': `Bearer ${token}`
                        }
                    }
                );
                // }
            } catch (err) {
                console.error('Error stopping stream:', err);
            }
        }

        setIsStreaming(false);
        setActiveStream(null);
        setListenerCount(0);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-4 sm:py-6 lg:py-8">
            <div className="container mx-auto px-4 max-w-5xl">
                {/* Header - Tablet Optimized */}
                <div className="text-center mb-6 lg:mb-8">
                    <div className="flex items-center justify-center gap-3 mb-2 lg:mb-4">
                        <Radio className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                            {t('title')}
                        </h1>
                    </div>
                    <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
                        {t('subtitle')}
                    </p>
                </div>

                {/* Status Card - Tablet Optimized */}
                {isStreaming && activeStream && (
                    <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 border-2 border-green-500/30 rounded-xl p-4 sm:p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full animate-pulse" />
                                <div>
                                    <div className="font-semibold text-base sm:text-lg">{t('status.streaming')}</div>
                                    <div className="text-xs sm:text-sm text-muted-foreground break-all">
                                        {t('status.streamId')}: {activeStream.stream_id}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xl sm:text-2xl font-bold">
                                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                                {listenerCount}
                            </div>
                        </div>
                    </div>
                )}

                {/* Configuration - Tablet Optimized 2-Col Grid */}
                <div className="bg-card rounded-xl border p-4 sm:p-6 shadow-lg space-y-6 mb-6">
                    <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        {t('configuration')}
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column: Church & Language */}
                        <div className="space-y-6">
                            {/* Church Selection */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    {t('church.label')}
                                </label>
                                <select
                                    value={selectedChurch}
                                    onChange={(e) => setSelectedChurch(e.target.value)}
                                    disabled={isStreaming}
                                    className="w-full px-3 py-3 sm:px-4 sm:py-3 rounded-lg border bg-background disabled:opacity-50 text-base"
                                >
                                    <option value="zurich">{t('church.zurich')}</option>
                                    <option value="geneva">{t('church.geneva')}</option>
                                    <option value="bern">{t('church.bern')}</option>
                                </select>
                            </div>

                            {/* Source Language Selection */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    🌍 {t('sourceLanguage.label')}
                                </label>
                                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                    {sourceLanguages.map(lang => (
                                        <button
                                            key={lang.code}
                                            onClick={() => setSelectedSourceLanguage(lang.code)}
                                            disabled={isStreaming}
                                            className={`p-2 sm:p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center min-h-[70px] ${selectedSourceLanguage === lang.code
                                                ? 'border-primary bg-primary/10 shadow-md'
                                                : 'border-border hover:border-primary/50'
                                                } ${isStreaming && 'opacity-50 cursor-not-allowed'}`}
                                        >
                                            <div className="text-2xl sm:text-3xl mb-1">{lang.flag}</div>
                                            <div className="text-xs font-medium">{lang.name}</div>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    💡 {t('sourceLanguage.hint')}
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Audio Inputs & Outputs */}
                        <div className="space-y-6">
                            {/* Microphone Selection */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    🎤 {t('input.label')}
                                </label>
                                <select
                                    value={selectedInputDevice}
                                    onChange={(e) => setSelectedInputDevice(e.target.value)}
                                    disabled={isStreaming}
                                    className="w-full px-3 py-3 sm:px-4 sm:py-3 rounded-lg border bg-background disabled:opacity-50 text-base"
                                >
                                    {audioInputDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Micrófono ${device.deviceId.slice(0, 8)}`}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-2">
                                    💡 {t('input.hint')}
                                </p>
                            </div>

                            {/* Audio Visualizer */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    📊 Monitor de Entrada
                                </label>
                                <div className="h-24 bg-black/5 rounded-lg border overflow-hidden">
                                    {isStreaming && analyser ? (
                                        <AudioVisualizer analyser={analyser} height={96} color="#5e07a0ff" />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                            {isStreaming ? 'Iniciando visualización...' : 'Microphone inactivo'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Speaker Selection */}

                        {/* Speaker Selection */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                🔊 {t('output.label')}
                            </label>
                            <select
                                value={selectedOutputDevice}
                                onChange={(e) => setSelectedOutputDevice(e.target.value)}
                                className="w-full px-3 py-3 sm:px-4 sm:py-3 rounded-lg border bg-background text-base"
                            >
                                {audioOutputDevices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Altavoz ${device.deviceId.slice(0, 8)}`}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground mt-2">
                                💡 {t('output.hint')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Languages Info */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 sm:p-4">
                    <div className="font-medium mb-2 text-sm sm:text-base">{t('activeLanguages')}</div>
                    <div className="flex gap-2 sm:gap-3 flex-wrap">
                        <span className="px-2 py-1 sm:px-3 sm:py-1 bg-blue-500/20 rounded-full text-xs sm:text-sm">🇩🇪 {tLang('de')}</span>
                        <span className="px-2 py-1 sm:px-3 sm:py-1 bg-blue-500/20 rounded-full text-xs sm:text-sm">🇫🇷 {tLang('fr')}</span>
                        <span className="px-2 py-1 sm:px-3 sm:py-1 bg-blue-500/20 rounded-full text-xs sm:text-sm">🇬🇧 {tLang('en')}</span>
                        <span className="px-2 py-1 sm:px-3 sm:py-1 bg-blue-500/20 rounded-full text-xs sm:text-sm">🇮🇹 {tLang('it')}</span>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-600 mb-6">
                    {error}
                </div>
            )}

            {/* Control Buttons - Mobile First */}
            <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 sm:static sm:bg-transparent sm:border-0 sm:p-0 z-50">
                <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-xl sm:border-2 border-primary/20 sm:p-10 text-center sm:shadow-xl max-w-5xl mx-auto">
                    {!isStreaming ? (
                        <button
                            onClick={startBroadcast}
                            disabled={isConnecting || !selectedInputDevice}
                            className="w-full sm:w-auto px-8 py-4 sm:px-12 sm:py-6 bg-green-500 text-white rounded-xl font-semibold text-lg sm:text-xl hover:bg-green-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mx-auto min-h-[60px]"
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
                                    {t('buttons.connecting')}
                                </>
                            ) : (
                                <>
                                    <Play className="w-6 h-6 sm:w-7 sm:h-7" />
                                    {t('buttons.start')}
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={stopBroadcast}
                            className="w-full sm:w-auto px-8 py-4 sm:px-12 sm:py-6 bg-red-500 text-white rounded-xl font-semibold text-lg sm:text-xl hover:bg-red-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 mx-auto min-h-[60px]"
                        >
                            <Square className="w-6 h-6 sm:w-7 sm:h-7" />
                            {t('buttons.stop')}
                        </button>
                    )}
                </div>
            </div>

            {/* Spacer for fixed bottom bar on mobile */}
            <div className="h-24 sm:hidden"></div>

            {/* Instructions - Tablet Optimized */}
            <div className="bg-card rounded-xl border p-4 sm:p-6 mb-6">
                <h3 className="font-semibold text-base sm:text-lg mb-4">📋 {t('instructions.title')}</h3>
                <ol className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex gap-3">
                        <span className="font-bold text-primary">1.</span>
                        <span>{t('instructions.steps.0')}</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="font-bold text-primary">2.</span>
                        <span>{t('instructions.steps.1')}</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="font-bold text-primary">3.</span>
                        <span>{t('instructions.steps.2')}</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="font-bold text-primary">4.</span>
                        <span>{t('instructions.steps.3')}</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="font-bold text-primary">5.</span>
                        <span>{t('instructions.steps.4')}</span>
                    </li>
                </ol>

                <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="font-medium text-yellow-600 mb-2">⚠️ {t('instructions.virtualAudio.title')}</div>
                    <p className="text-sm text-muted-foreground">
                        {t('instructions.virtualAudio.text')}
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        <li>• <strong>macOS:</strong> BlackHole o Loopback</li>
                        <li>• <strong>Windows:</strong> VB-Audio Virtual Cable</li>
                        <li>• <strong>Linux:</strong> PulseAudio Loopback</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

