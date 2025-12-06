import Link from "next/link";
import { Mic, FileText, Activity } from "lucide-react";

export default function HomePage() {
    return (
        <div className="space-y-12 animate-fade-in">
            {/* Hero Section */}
            <section className="text-center space-y-6 py-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm font-medium text-primary">
                    <Activity className="w-4 h-4" />
                    Powered by OpenAI Whisper
                </div>

                <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                    <span className="gradient-text">WhisperForge</span>
                </h1>

                <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                    Forjando transcripciones claras a partir de audios
                </p>

                <div className="flex gap-4 justify-center pt-4">
                    <Link
                        href="/transcribe"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                        <Mic className="w-5 h-5" />
                        Nueva Transcripción
                    </Link>

                    <Link
                        href="/jobs"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
                    >
                        <FileText className="w-5 h-5" />
                        Ver Trabajos
                    </Link>
                </div>
            </section>

            {/* Features Grid */}
            <section className="grid md:grid-cols-3 gap-6">
                <FeatureCard
                    icon={<Mic className="w-8 h-8" />}
                    title="Múltiples Formatos"
                    description="Soporta MP3, WAV, M4A, MP4, FLAC y más de 30 formatos de audio y video"
                />

                <FeatureCard
                    icon={<Activity className="w-8 h-8" />}
                    title="Progreso en Tiempo Real"
                    description="Visualiza el progreso de transcripción en vivo con WebSocket"
                />

                <FeatureCard
                    icon={<FileText className="w-8 h-8" />}
                    title="Alta Precisión"
                    description="Transcripciones de alta fidelidad con modelos Whisper large-v3"
                />
            </section>

            {/* Stats Section */}
            <section className="grid md:grid-cols-4 gap-4 p-8 bg-card rounded-xl border">
                <StatCard label="Modelos Disponibles" value="5+" />
                <StatCard label="Idiomas" value="100+" />
                <StatCard label="Formatos" value="30+" />
                <StatCard label="Precisión" value="95%+" />
            </section>
        </div>
    );
}

function FeatureCard({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="p-6 bg-card rounded-xl border hover:border-primary/50 transition-colors group">
            <div className="text-primary mb-4 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-center">
            <div className="text-3xl font-bold text-primary">{value}</div>
            <div className="text-sm text-muted-foreground mt-1">{label}</div>
        </div>
    );
}
