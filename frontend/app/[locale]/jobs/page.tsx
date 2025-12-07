"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FileText, Clock, CheckCircle, XCircle, Loader2, Trash2, Play, StopCircle } from "lucide-react";
import { listJobs, deleteJob, cancelJob, startTranscription, type Job } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { useState } from "react";

export default function JobsPage() {
    const queryClient = useQueryClient();
    const { data, isLoading, error } = useQuery({
        queryKey: ["jobs"],
        queryFn: listJobs,
        refetchInterval: 5000, // Refetch every 5 seconds
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Error al cargar trabajos</h2>
                <p className="text-muted-foreground">
                    {error instanceof Error ? error.message : "Error desconocido"}
                </p>
            </div>
        );
    }

    const jobs = data?.jobs || [];

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold">Trabajos</h1>
                    <p className="text-muted-foreground mt-2">
                        {jobs.length} trabajo{jobs.length !== 1 ? "s" : ""} en total
                    </p>
                </div>

                <Link
                    href="/transcribe"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                    Nueva Transcripción
                </Link>
            </div>

            {jobs.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No hay trabajos</h2>
                    <p className="text-muted-foreground mb-6">
                        Comienza creando tu primera transcripción
                    </p>
                    <Link
                        href="/transcribe"
                        className="inline-flex px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                        Nueva Transcripción
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4">
                    {jobs.map((job) => (
                        <JobCard key={job.job_id} job={job} />
                    ))}
                </div>
            )}
        </div>
    );
}

function JobCard({ job }: { job: Job }) {
    const queryClient = useQueryClient();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const deleteMutation = useMutation({
        mutationFn: () => deleteJob(job.job_id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
        },
    });

    const startMutation = useMutation({
        mutationFn: () => startTranscription(job.job_id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
        },
    });

    const cancelMutation = useMutation({
        mutationFn: () => cancelJob(job.job_id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
        },
    });

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }

        await deleteMutation.mutateAsync();
    };

    const statusConfig = {
        pending: {
            icon: Clock,
            color: "text-yellow-500",
            bg: "bg-yellow-500/10",
            label: "Pendiente",
        },
        processing: {
            icon: Loader2,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            label: "Procesando",
        },
        completed: {
            icon: CheckCircle,
            color: "text-green-500",
            bg: "bg-green-500/10",
            label: "Completado",
        },
        failed: {
            icon: XCircle,
            color: "text-red-500",
            bg: "bg-red-500/10",
            label: "Fallido",
        },
    };

    const config = statusConfig[job.status];
    const Icon = config.icon;

    return (
        <Link href={`/jobs/${job.job_id}`}>
            <div className="p-6 bg-card rounded-xl border hover:border-primary/50 transition-colors group">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${config.bg}`}>
                                <Icon
                                    className={`w-5 h-5 ${config.color} ${job.status === "processing" ? "animate-spin" : ""
                                        }`}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                                    {job.filename}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {formatRelativeTime(job.created_at)}
                                </p>
                            </div>
                        </div>

                        {/* Progress bar for processing jobs */}
                        {job.status === "processing" && (
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Progreso</span>
                                    <span className="font-medium tabular-nums">{job.progress.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden relative">
                                    {/* Animated shimmer background */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                                    {/* Progress fill */}
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500 relative"
                                        style={{ width: `${job.progress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-slide" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pending status message */}
                        {job.status === "pending" && (
                            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Esperando para iniciar...
                                </p>
                            </div>
                        )}

                        {/* Failed status message */}
                        {job.status === "failed" && job.error && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-sm text-red-600 dark:text-red-400 font-mono">
                                    {job.error}
                                </p>
                            </div>
                        )}

                        {job.metadata && (
                            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                                {job.metadata.audio_duration_hms && (
                                    <div>
                                        <span className="font-medium">Duración:</span>{" "}
                                        {job.metadata.audio_duration_hms}
                                    </div>
                                )}
                                {job.metadata.rtf && (
                                    <div>
                                        <span className="font-medium">RTF:</span>{" "}
                                        {job.metadata.rtf.toFixed(3)}
                                    </div>
                                )}
                                {job.metadata.words && (
                                    <div>
                                        <span className="font-medium">Palabras:</span>{" "}
                                        {job.metadata.words.toLocaleString()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color}`}>
                            {config.label}
                        </div>

                        {/* Start button for pending jobs */}
                        {job.status === "pending" && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    startMutation.mutate();
                                }}
                                disabled={startMutation.isPending}
                                className="p-2 rounded-lg transition-colors bg-green-500/10 text-green-600 hover:bg-green-500/20 disabled:opacity-50"
                                title="Iniciar transcripción"
                            >
                                {startMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Play className="w-4 h-4" />
                                )}
                            </button>
                        )}

                        {/* Cancel button for processing jobs */}
                        {job.status === "processing" && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    cancelMutation.mutate();
                                }}
                                disabled={cancelMutation.isPending}
                                className="p-2 rounded-lg transition-colors bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 disabled:opacity-50"
                                title="Cancelar transcripción"
                            >
                                {cancelMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <StopCircle className="w-4 h-4" />
                                )}
                            </button>
                        )}

                        {/* Delete button */}
                        <button
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                            className={`p-2 rounded-lg transition-colors ${showDeleteConfirm
                                ? "bg-red-500 text-white hover:bg-red-600"
                                : "hover:bg-secondary text-muted-foreground hover:text-destructive"
                                } disabled:opacity-50`}
                            title={showDeleteConfirm ? "Confirmar eliminación" : "Eliminar trabajo"}
                        >
                            {deleteMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Link>
    );
}
