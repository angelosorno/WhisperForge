"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, Zap, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptionProgressProps {
    progress: number;
    message: string;
    status: "pending" | "processing" | "completed" | "failed";
    startTime?: Date;
    estimatedDuration?: number; // in seconds
}

export function TranscriptionProgress({
    progress,
    message,
    status,
    startTime,
    estimatedDuration,
}: TranscriptionProgressProps) {
    const [elapsedTime, setElapsedTime] = useState(0);
    const [estimatedRemaining, setEstimatedRemaining] = useState<number | null>(null);

    useEffect(() => {
        if (!startTime || status !== "processing") return;

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
            setElapsedTime(elapsed);

            // Calculate estimated remaining time based on progress
            if (progress > 5) {
                const totalEstimated = (elapsed / progress) * 100;
                const remaining = Math.max(0, totalEstimated - elapsed);
                setEstimatedRemaining(Math.floor(remaining));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime, status, progress]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const getProgressColor = () => {
        if (progress < 25) return "from-blue-500 to-cyan-500";
        if (progress < 50) return "from-cyan-500 to-teal-500";
        if (progress < 75) return "from-teal-500 to-green-500";
        return "from-green-500 to-emerald-500";
    };

    const getStageInfo = () => {
        if (progress < 10) return { icon: Loader2, label: "Preparando...", color: "text-blue-500" };
        if (progress < 20) return { icon: Loader2, label: "Cargando modelo", color: "text-cyan-500" };
        if (progress < 90) return { icon: Zap, label: "Transcribiendo", color: "text-teal-500" };
        if (progress < 100) return { icon: Loader2, label: "Finalizando", color: "text-green-500" };
        return { icon: CheckCircle2, label: "Completado", color: "text-emerald-500" };
    };

    const stage = getStageInfo();
    const StageIcon = stage.icon;

    if (status === "pending") {
        return (
            <div className="bg-card rounded-xl border p-8 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-lg font-medium">Preparando transcripción...</p>
                <p className="text-sm text-muted-foreground mt-2">El trabajo está en cola</p>
            </div>
        );
    }

    if (status === "completed") {
        return (
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20 p-8 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-2xl font-bold text-green-500 mb-2">¡Transcripción Completada!</p>
                <p className="text-muted-foreground">Tiempo total: {formatTime(elapsedTime)}</p>
            </div>
        );
    }

    if (status === "failed") {
        return (
            <div className="bg-destructive/10 rounded-xl border border-destructive/20 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">❌</span>
                </div>
                <p className="text-xl font-bold text-destructive mb-2">Error en la transcripción</p>
                <p className="text-sm text-muted-foreground">{message}</p>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-xl border p-8 space-y-6">
            {/* Header with animated icon */}
            <div className="flex items-center justify-center gap-3">
                <div className={cn("relative", stage.color)}>
                    <StageIcon className={cn("w-8 h-8", stage.icon === Loader2 && "animate-spin")} />
                    {stage.icon === Zap && (
                        <div className="absolute inset-0 animate-ping">
                            <Zap className="w-8 h-8 opacity-75" />
                        </div>
                    )}
                </div>
                <div className="text-center">
                    <p className={cn("text-lg font-semibold", stage.color)}>{stage.label}</p>
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
            </div>

            {/* Progress bar with gradient */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Progreso</span>
                    <span className="text-2xl font-bold tabular-nums">{progress.toFixed(1)}%</span>
                </div>

                {/* Main progress bar */}
                <div className="relative h-4 bg-secondary rounded-full overflow-hidden">
                    {/* Background shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />

                    {/* Progress fill */}
                    <div
                        className={cn(
                            "h-full bg-gradient-to-r transition-all duration-500 ease-out relative",
                            getProgressColor()
                        )}
                        style={{ width: `${progress}%` }}
                    >
                        {/* Animated shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-slide" />
                    </div>
                </div>

                {/* Visual progress indicator */}
                <div className="flex items-center justify-between gap-2">
                    {[0, 25, 50, 75, 100].map((milestone) => (
                        <div
                            key={milestone}
                            className={cn(
                                "flex-1 h-1 rounded-full transition-all duration-300",
                                progress >= milestone
                                    ? "bg-gradient-to-r " + getProgressColor()
                                    : "bg-secondary"
                            )}
                        />
                    ))}
                </div>
            </div>

            {/* Time information */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">Transcurrido</span>
                    </div>
                    <p className="text-xl font-bold tabular-nums">{formatTime(elapsedTime)}</p>
                </div>

                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">Restante</span>
                    </div>
                    <p className="text-xl font-bold tabular-nums">
                        {estimatedRemaining !== null ? formatTime(estimatedRemaining) : "--:--"}
                    </p>
                </div>
            </div>

            {/* Live Message Feed - TV Ticker Style */}
            <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        En vivo
                    </span>
                </div>
                <div className="bg-black/5 dark:bg-white/5 rounded-lg p-4 h-32 overflow-hidden relative">
                    {/* Scanline effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent animate-scan pointer-events-none" />

                    <div className="h-full overflow-y-auto space-y-1 font-mono text-xs">
                        {message && (
                            <div className="flex items-start gap-2 animate-slide-in">
                                <span className="text-green-500 flex-shrink-0">▶</span>
                                <span className="text-foreground/80">{message}</span>
                            </div>
                        )}
                        {progress > 0 && (
                            <div className="flex items-start gap-2 text-muted-foreground/60">
                                <span className="flex-shrink-0">•</span>
                                <span>Progreso: {progress.toFixed(1)}%</span>
                            </div>
                        )}
                        {elapsedTime > 0 && (
                            <div className="flex items-start gap-2 text-muted-foreground/60">
                                <span className="flex-shrink-0">•</span>
                                <span>Tiempo: {formatTime(elapsedTime)}</span>
                            </div>
                        )}
                        {estimatedRemaining !== null && estimatedRemaining > 0 && (
                            <div className="flex items-start gap-2 text-muted-foreground/60">
                                <span className="flex-shrink-0">•</span>
                                <span>Restante: ~{formatTime(estimatedRemaining)}</span>
                            </div>
                        )}
                        {progress >= 10 && progress < 20 && (
                            <div className="flex items-start gap-2 text-cyan-500/80 animate-slide-in">
                                <span className="flex-shrink-0">▶</span>
                                <span>Cargando modelo Whisper...</span>
                            </div>
                        )}
                        {progress >= 20 && progress < 90 && (
                            <div className="flex items-start gap-2 text-teal-500/80 animate-slide-in">
                                <span className="flex-shrink-0">▶</span>
                                <span>Procesando audio con IA...</span>
                            </div>
                        )}
                        {progress >= 90 && progress < 100 && (
                            <div className="flex items-start gap-2 text-green-500/80 animate-slide-in">
                                <span className="flex-shrink-0">▶</span>
                                <span>Finalizando transcripción...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Processing stages indicator */}
            <div className="flex items-center justify-between pt-4 border-t">
                {[
                    { label: "Preparar", threshold: 0 },
                    { label: "Cargar", threshold: 10 },
                    { label: "Transcribir", threshold: 20 },
                    { label: "Finalizar", threshold: 90 },
                ].map((step, index) => (
                    <div key={step.label} className="flex flex-col items-center gap-1">
                        <div
                            className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                                progress >= step.threshold
                                    ? "bg-primary text-primary-foreground scale-110"
                                    : "bg-secondary text-muted-foreground"
                            )}
                        >
                            {index + 1}
                        </div>
                        <span
                            className={cn(
                                "text-xs transition-colors duration-300",
                                progress >= step.threshold ? "text-foreground font-medium" : "text-muted-foreground"
                            )}
                        >
                            {step.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
