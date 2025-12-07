import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navigation } from "@/components/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "WhisperForge - Professional Audio Transcription",
    description: "Transform audio into accurate text with OpenAI Whisper",
    viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
};

export default async function RootLayout({
    children,
    params: { locale }
}: Readonly<{
    children: React.ReactNode;
    params: { locale: string };
}>) {
    const messages = await getMessages();
    return (
        <html lang={locale} suppressHydrationWarning>
            <body className={inter.className} suppressHydrationWarning>
                <NextIntlClientProvider messages={messages}>
                    <Providers>
                        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
                            <Navigation />
                            <main className="container mx-auto px-4 py-8">
                                {children}
                            </main>
                        </div>
                    </Providers>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
