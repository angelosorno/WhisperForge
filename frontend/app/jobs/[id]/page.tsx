"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    Download,
    ArrowLeft,
    Loader2,
    CheckCircle,
    XCircle,
    Clock,
} from "lucide-react";
import {
    getJob,
    downloadTranscript,
    connectToJobProgress,
    type Job,
    type ProgressUpdate,
} from "@/lib/api";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import { TranscriptionProgress } from "@/components/transcription-progress";
import { TranslationPanel } from "@/components/translation-panel";

export default function JobDetailPage() {
    const params = useParams();
    const router = useRouter();
    const jobId = params.id as string;

    const [progressUpdate, setProgressUpdate] = useState<ProgressUpdate | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(null);

    const { data: job, isLoading, error, refetch } = useQuery({
        queryKey: ["job", jobId],
        queryFn: () => getJob(jobId),
        refetchInterval: (query) => {
            // Stop refetching if job is completed or failed
            if (query.state.data?.status === "completed" || query.state.data?.status === "failed") {
                return false;
            }
            return 2000;
        },
    });


    // Set start time when job starts processing
    useEffect(() => {
        if (job?.status === "processing" && !startTime) {
            setStartTime(new Date());
        }
    }, [job?.status, startTime]);

    // WebSocket connection for real-time progress
    useEffect(() => {
        if (!jobId || job?.status === "completed" || job?.status === "failed") {
            return;
        }

        const ws = connectToJobProgress(
            jobId,
            (update) => {
                setProgressUpdate(update);
                // Refetch job data when status changes
                if (update.status === "completed" || update.status === "failed") {
                    refetch();
                }
            },
            (error) => {
                console.error("WebSocket error:", error);
            }
        );

        return () => {
            ws.close();
        };
    }, [jobId, job?.status, refetch]);

    const handleDownload = async () => {
        if (!job) return;

        try {
            const blob = await downloadTranscript(jobId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${job.filename}.txt`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Error downloading transcript:", error);
            alert("Error al descargar la transcripción");
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="max-w-4xl mx-auto text-center py-12">
                <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Trabajo no encontrado</h2>
                <p className="text-muted-foreground mb-6">
                    El trabajo solicitado no existe o ha sido eliminado
                </p>
                <button
                    onClick={() => router.push("/jobs")}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Volver a Trabajos
                </button>
            </div>
        );
    }

    const currentProgress = progressUpdate?.progress ?? job.progress;
    const currentMessage = progressUpdate?.message ?? "";

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.push("/jobs")}
                    className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold">{job.filename}</h1>
                    <p className="text-muted-foreground">
                        Creado {formatRelativeTime(job.created_at)}
                    </p>
                </div>
            </div>

            {/* Progress Display */}
            <TranscriptionProgress
                progress={currentProgress}
                message={currentMessage}
                status={job.status}
                startTime={startTime || undefined}
            />

            {job.error && (
                <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive font-mono">{job.error}</p>
                </div>
            )}

            {/* Configuration */}
            <div className="bg-card rounded-xl border p-6 space-y-4">
                <h2 className="text-xl font-semibold">Configuración</h2>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <ConfigItem label="Modelo" value={job.config.model} />
                    <ConfigItem label="Idioma" value={job.config.language} />
                    <ConfigItem label="Beam Size" value={job.config.beam_size.toString()} />
                    <ConfigItem
                        label="Temperature"
                        value={job.config.temperature.toString()}
                    />
                    <ConfigItem
                        label="Normalización"
                        value={job.config.normalize_audio ? "Sí" : "No"}
                    />
                </div>
            </div>

            {/* Metadata */}
            {job.metadata && (
                <div className="bg-card rounded-xl border p-6 space-y-4">
                    <h2 className="text-xl font-semibold">Métricas</h2>
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                        {job.metadata.audio_duration_hms && (
                            <ConfigItem
                                label="Duración Audio"
                                value={job.metadata.audio_duration_hms}
                            />
                        )}
                        {job.metadata.elapsed_hms && (
                            <ConfigItem
                                label="Tiempo Procesamiento"
                                value={job.metadata.elapsed_hms}
                            />
                        )}
                        {job.metadata.rtf && (
                            <ConfigItem label="RTF" value={job.metadata.rtf.toFixed(3)} />
                        )}
                        {job.metadata.words && (
                            <ConfigItem
                                label="Palabras"
                                value={job.metadata.words.toLocaleString()}
                            />
                        )}
                        {job.metadata.chars && (
                            <ConfigItem
                                label="Caracteres"
                                value={job.metadata.chars.toLocaleString()}
                            />
                        )}
                        {job.metadata.segments && (
                            <ConfigItem
                                label="Segmentos"
                                value={job.metadata.segments.toString()}
                            />
                        )}
                        <ConfigItem label="Dispositivo" value={job.metadata.device} />
                        <ConfigItem
                            label="Normalizado"
                            value={job.metadata.normalized_16k ? "Sí" : "No"}
                        />
                    </div>
                </div>
            )}

            {/* Transcript */}
            {job.transcript && (
                <div className="bg-card rounded-xl border p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Transcripción</h2>
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Descargar
                        </button>
                    </div>
                    <div className="p-4 bg-secondary rounded-lg max-h-96 overflow-y-auto">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {job.transcript}
                        </p>
                    </div>
                </div>
            )}

            {/* Translation Section - Only show when completed */}
            {job.status === "completed" && job.transcript && (
                <TranslationPanel
                    jobId={job.job_id}
                    sourceLanguage={job.config.language}
                    transcript={job.transcript}
                />
            )}
        </div>
    );
}

function StatusDisplay({ status }: { status: Job["status"] }) {
    const config = {
        pending: {
            icon: Clock,
            color: "text-yellow-500",
            bg: "bg-yellow-500/10",
            label: "Pendiente",
            description: "El trabajo está en cola esperando ser procesado",
        },
        processing: {
            icon: Loader2,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            label: "Procesando",
            description: "Transcribiendo el audio con Whisper...",
        },
        completed: {
            icon: CheckCircle,
            color: "text-green-500",
            bg: "bg-green-500/10",
            label: "Completado",
            description: "La transcripción se completó exitosamente",
        },
        failed: {
            icon: XCircle,
            color: "text-red-500",
            bg: "bg-red-500/10",
            label: "Fallido",
            description: "Ocurrió un error durante la transcripción",
        },
    };

    const { icon: Icon, color, bg, label, description } = config[status];

    return (
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${bg}`}>
                <Icon
                    className={`w-6 h-6 ${color} ${status === "processing" ? "animate-spin" : ""
                        }`}
                />
            </div>
            <div>
                <h3 className={`text-lg font-semibold ${color}`}>{label}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-muted-foreground">{label}</div>
            <div className="font-medium">{value}</div>
        </div>
    );
}
