import Link from "next/link";
import { Mic, FileText, Activity } from "lucide-react";
import { useTranslations } from "next-intl";

export default function HomePage() {
    const t = useTranslations("HomePage");

    return (
        <div className="space-y-12 animate-fade-in">
            {/* Hero Section */}
            <section className="text-center space-y-6 py-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm font-medium text-primary">
                    <Activity className="w-4 h-4" />
                    Powered by OpenAI Whisper
                </div>

                <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                    {t('title')} <span className="gradient-text">{t('titleHighlight')}</span>
                </h1>

                <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                    {t('description')}
                </p>

                <div className="flex gap-4 justify-center pt-4">
                    <Link
                        href="/transcribe"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                        <Mic className="w-5 h-5" />
                        {t('buttons.newTranscription')}
                    </Link>

                    <Link
                        href="/jobs"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
                    >
                        <FileText className="w-5 h-5" />
                        {t('buttons.viewJobs')}
                    </Link>
                </div>
            </section>

            {/* Features Grid */}
            <section className="grid md:grid-cols-3 gap-6">
                <FeatureCard
                    icon={<Mic className="w-8 h-8" />}
                    title={t("features.formats.title")}
                    description={t("features.formats.description")}
                />

                <FeatureCard
                    icon={<Activity className="w-8 h-8" />}
                    title={t("features.realtime.title")}
                    description={t("features.realtime.description")}
                />

                <FeatureCard
                    icon={<FileText className="w-8 h-8" />}
                    title={t("features.accuracy.title")}
                    description={t("features.accuracy.description")}
                />
            </section>

            {/* Stats Section */}
            <section className="grid md:grid-cols-4 gap-4 p-8 bg-card rounded-xl border">
                <StatCard label={t("stats.models")} value="5+" />
                <StatCard label={t("stats.languages")} value="100+" />
                <StatCard label={t("stats.formats")} value="30+" />
                <StatCard label={t("stats.accuracy")} value="95%+" />
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
