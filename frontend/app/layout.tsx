import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navigation } from "@/components/navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "WhisperForge - Professional Audio Transcription",
    description: "Transform audio into accurate text with OpenAI Whisper",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className={inter.className}>
                <Providers>
                    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
                        <Navigation />
                        <main className="container mx-auto px-4 py-8">
                            {children}
                        </main>
                    </div>
                </Providers>
            </body>
        </html>
    );
}
