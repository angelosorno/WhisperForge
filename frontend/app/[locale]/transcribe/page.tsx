"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Settings, Loader2 } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { ConfigLabel } from "@/components/ui/tooltip";
import { uploadFile, startTranscription, type TranscriptionConfig } from "@/lib/api";

export default function TranscribePage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [config, setConfig] = useState<Partial<TranscriptionConfig>>({
        model: "large-v3",
        language: "es",
        temperature: 0.0,
        beam_size: 8,
        normalize_audio: true,
    });

    const handleFileSelect = (selectedFile: File) => {
        setFile(selectedFile);
    };

    const handleSubmit = async () => {
        if (!file) return;

        try {
            setIsUploading(true);

            // Upload file
            const job = await uploadFile(file, config);

            // Start transcription
            await startTranscription(job.job_id);

            // Redirect to job page
            router.push(`/jobs/${job.job_id}`);
        } catch (error) {
            console.error("Error uploading file:", error);
            alert("Error al subir el archivo. Por favor intenta de nuevo.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold">Nueva Transcripción</h1>
                <p className="text-muted-foreground">
                    Sube un archivo de audio o video para transcribir
                </p>
            </div>

            {/* File Upload */}
            <div className="bg-card rounded-xl border p-8">
                <FileUpload onFileSelect={handleFileSelect} />

                {file && (
                    <div className="mt-6 p-4 bg-secondary rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium">{file.name}</div>
                                <div className="text-sm text-muted-foreground">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                            </div>
                            <button
                                onClick={() => setFile(null)}
                                className="text-sm text-destructive hover:underline"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Configuration */}
            <div className="bg-card rounded-xl border p-8 space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold">
                    <Settings className="w-5 h-5" />
                    Configuración
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <ConfigLabel
                            label="Modelo de Whisper"
                            tooltip="El modelo determina la precisión de la transcripción. Large V3 es el más preciso pero más lento. Small y Base son más rápidos pero menos precisos."
                        />
                        <select
                            value={config.model}
                            onChange={(e) => setConfig({ ...config, model: e.target.value })}
                            className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="large-v3">Large V3 - Máxima precisión (Recomendado)</option>
                            <option value="large-v2">Large V2 - Alta precisión</option>
                            <option value="medium">Medium - Equilibrado</option>
                            <option value="small">Small - Rápido</option>
                            <option value="base">Base - Muy rápido</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                            Modelos más grandes = mayor precisión pero más tiempo de procesamiento
                        </p>
                    </div>

                    <div className="space-y-2">
                        <ConfigLabel
                            label="Idioma"
                            tooltip="Selecciona el idioma del audio. Whisper detecta automáticamente el idioma, pero especificarlo mejora la precisión."
                        />
                        <select
                            value={config.language}
                            onChange={(e) => setConfig({ ...config, language: e.target.value })}
                            className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="es">Español</option>
                            <option value="en">English</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                            <option value="it">Italiano</option>
                            <option value="pt">Português</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <ConfigLabel
                            label="Beam Size (Búsqueda)"
                            tooltip="Controla cuántas alternativas considera el modelo. Valores más altos (5-10) dan mejor precisión pero son más lentos. Valor recomendado: 8"
                        />
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={config.beam_size}
                            onChange={(e) =>
                                setConfig({ ...config, beam_size: parseInt(e.target.value) })
                            }
                            className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground">
                            Rango: 1-10 (más alto = más preciso pero más lento)
                        </p>
                    </div>

                    <div className="space-y-2">
                        <ConfigLabel
                            label="Temperature (Creatividad)"
                            tooltip="Controla la aleatoriedad del modelo. 0 = más determinista y preciso (recomendado para transcripciones). Valores más altos (0.5-1.0) permiten más variación."
                        />
                        <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={config.temperature}
                            onChange={(e) =>
                                setConfig({ ...config, temperature: parseFloat(e.target.value) })
                            }
                            className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground">
                            Rango: 0-1 (0 = más preciso, 1 = más creativo)
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
                    <input
                        type="checkbox"
                        id="normalize"
                        checked={config.normalize_audio}
                        onChange={(e) =>
                            setConfig({ ...config, normalize_audio: e.target.checked })
                        }
                        className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <div className="flex-1">
                        <label htmlFor="normalize" className="text-sm font-medium cursor-pointer">
                            Normalizar audio a 16kHz WAV (Recomendado)
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                            Convierte el audio al formato óptimo para Whisper, mejorando la precisión y velocidad de transcripción
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <ConfigLabel
                        label="Prompt Personalizado (Opcional)"
                        tooltip="Proporciona contexto al modelo sobre el contenido del audio. Por ejemplo: 'Conferencia religiosa sobre fe y esperanza'. Esto ayuda a mejorar la precisión de términos específicos."
                    />
                    <textarea
                        value={config.initial_prompt || ""}
                        onChange={(e) =>
                            setConfig({ ...config, initial_prompt: e.target.value })
                        }
                        placeholder="Ej: Transcripción de una conferencia religiosa sobre la fe..."
                        rows={3}
                        className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                        Describe brevemente el contenido del audio para mejorar la precisión
                    </p>
                </div>
            </div>

            {/* Submit Button */}
            <button
                onClick={handleSubmit}
                disabled={!file || isUploading}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isUploading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Procesando...
                    </>
                ) : (
                    <>
                        <Upload className="w-5 h-5" />
                        Iniciar Transcripción
                    </>
                )}
            </button>
        </div>
    );
}
