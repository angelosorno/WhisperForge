"use client";

import { useEffect, useState } from "react";
import { BarChart3, FileText, CheckCircle2, Languages, Clock, TrendingUp, Activity } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface Stats {
    total_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    processing_jobs: number;
    total_translations: number;
    total_audio_minutes: number;
    total_processing_minutes: number;
    average_rtf: number;
    models_distribution: Array<{ model: string; count: number }>;
    languages_distribution: Array<{ language: string; count: number }>;
    jobs_by_day: Array<{ date: string; count: number }>;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
        // Refresh every 30 seconds
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        try {
            setError(null);
            const response = await fetch(`${API_URL}/stats`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error("Error loading stats:", error);
            setError(error instanceof Error ? error.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Cargando estadísticas...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-4">
                    <p className="text-red-500 font-semibold">Error al cargar estadísticas</p>
                    <p className="text-muted-foreground text-sm">{error}</p>
                    <button
                        onClick={loadStats}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-muted-foreground">No hay datos disponibles</p>
            </div>
        );
    }

    const completionRate = stats.total_jobs > 0
        ? Math.round((stats.completed_jobs / stats.total_jobs) * 100)
        : 0;

    return (
        <div className="container mx-auto p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold flex items-center gap-3">
                        <BarChart3 className="w-10 h-10 text-primary" />
                        Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Estadísticas y análisis de WhisperForge
                    </p>
                </div>
                <button
                    onClick={loadStats}
                    className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                >
                    Actualizar
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Trabajos"
                    value={stats.total_jobs}
                    icon={<FileText className="w-6 h-6" />}
                    color="blue"
                />
                <StatCard
                    title="Completados"
                    value={stats.completed_jobs}
                    subtitle={`${completionRate}% tasa de éxito`}
                    icon={<CheckCircle2 className="w-6 h-6" />}
                    color="green"
                />
                <StatCard
                    title="Traducciones"
                    value={stats.total_translations}
                    icon={<Languages className="w-6 h-6" />}
                    color="purple"
                />
                <StatCard
                    title="Tiempo Total"
                    value={`${Math.round(stats.total_processing_minutes / 60)}h`}
                    subtitle={`${stats.total_audio_minutes.toFixed(1)}min de audio`}
                    icon={<Clock className="w-6 h-6" />}
                    color="orange"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Models Distribution */}
                <div className="bg-card rounded-xl border p-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Modelos Usados
                    </h3>
                    {stats.models_distribution.length > 0 ? (
                        <div className="space-y-3">
                            {stats.models_distribution.map((item) => {
                                const percentage = stats.total_jobs > 0
                                    ? Math.round((item.count / stats.total_jobs) * 100)
                                    : 0;
                                return (
                                    <div key={item.model}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium">{item.model}</span>
                                            <span className="text-muted-foreground">
                                                {item.count} ({percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-secondary rounded-full h-2">
                                            <div
                                                className="bg-primary h-2 rounded-full transition-all"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">
                            No hay datos disponibles
                        </p>
                    )}
                </div>

                {/* Languages Distribution */}
                <div className="bg-card rounded-xl border p-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Languages className="w-5 h-5 text-primary" />
                        Idiomas Traducidos
                    </h3>
                    {stats.languages_distribution.length > 0 ? (
                        <div className="space-y-3">
                            {stats.languages_distribution.map((item) => {
                                const percentage = stats.total_translations > 0
                                    ? Math.round((item.count / stats.total_translations) * 100)
                                    : 0;
                                const languageNames: Record<string, string> = {
                                    fr: "Francés",
                                    de: "Alemán",
                                    it: "Italiano",
                                    en: "Inglés",
                                };
                                return (
                                    <div key={item.language}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium">
                                                {languageNames[item.language] || item.language}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {item.count} ({percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-secondary rounded-full h-2">
                                            <div
                                                className="bg-purple-600 h-2 rounded-full transition-all"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">
                            No hay traducciones aún
                        </p>
                    )}
                </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-card rounded-xl border p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Métricas de Rendimiento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <MetricCard
                        label="RTF Promedio"
                        value={stats.average_rtf.toFixed(3)}
                        description="Real-Time Factor (menor es mejor)"
                    />
                    <MetricCard
                        label="Audio Procesado"
                        value={`${stats.total_audio_minutes.toFixed(1)} min`}
                        description="Tiempo total de audio transcrito"
                    />
                    <MetricCard
                        label="Tiempo de Procesamiento"
                        value={`${stats.total_processing_minutes.toFixed(1)} min`}
                        description="Tiempo total de computación"
                    />
                </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-card rounded-xl border p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Actividad Reciente (Últimos 30 días)
                </h3>
                {stats.jobs_by_day.length > 0 ? (
                    <div className="space-y-2">
                        {stats.jobs_by_day.slice(0, 10).map((item) => (
                            <div
                                key={item.date}
                                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                            >
                                <span className="text-sm font-medium">{item.date}</span>
                                <span className="text-sm text-muted-foreground">
                                    {item.count} trabajo{item.count !== 1 ? "s" : ""}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-8">
                        No hay actividad reciente
                    </p>
                )}
            </div>
        </div>
    );
}

interface StatCardProps {
    title: string;
    value: number | string;
    subtitle?: string;
    icon: React.ReactNode;
    color: "blue" | "green" | "purple" | "orange";
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
    const colorClasses = {
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        green: "bg-green-500/10 text-green-600 dark:text-green-400",
        purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    };

    return (
        <div className="bg-card rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
            </div>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
    );
}

interface MetricCardProps {
    label: string;
    value: string;
    description: string;
}

function MetricCard({ label, value, description }: MetricCardProps) {
    return (
        <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
    );
}
