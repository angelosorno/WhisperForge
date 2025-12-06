"use client";

import { useState } from "react";
import { Download, Languages, Loader2, FileText, FileCheck, Eye } from "lucide-react";
import { ComparisonEditor } from "./comparison-editor";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface TranslationPanelProps {
    jobId: string;
    sourceLanguage: string;
    transcript: string;
}

const LANGUAGES = [
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "it", name: "Italiano", flag: "🇮🇹" },
    { code: "en", name: "English", flag: "🇬🇧" },
];

interface Translation {
    language: string;
    language_name: string;
    translated_file: string;
    comparison_file: string;
    bilingual_srt_file: string | null;
    created_at: string;
}

export function TranslationPanel({ jobId, sourceLanguage, transcript }: TranslationPanelProps) {
    const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [translations, setTranslations] = useState<Translation[]>([]);
    const [translatedText, setTranslatedText] = useState<string | null>(null);
    const [createBilingualSRT, setCreateBilingualSRT] = useState(false);
    const [showComparison, setShowComparison] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [editorLanguage, setEditorLanguage] = useState<string | null>(null);

    // Load existing translations
    const loadTranslations = async () => {
        try {
            const response = await fetch(`${API_URL}/jobs/${jobId}/translations`);
            const data = await response.json();
            setTranslations(data.translations || []);
        } catch (error) {
            console.error("Error loading translations:", error);
        }
    };

    // Translate to selected language
    const handleTranslate = async (language: string) => {
        setSelectedLanguage(language);
        setIsTranslating(true);
        setTranslatedText(null);

        try {
            const response = await fetch(`${API_URL}/jobs/${jobId}/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_language: language,
                    create_bilingual_srt: createBilingualSRT,
                })
            });

            // Poll for completion (translation runs in background)
            const pollInterval = setInterval(async () => {
                try {
                    const translationsResponse = await fetch(`${API_URL}/jobs/${jobId}/translations`);
                    const translationsData = await translationsResponse.json();
                    const translation = translationsData.translations.find(
                        (t: Translation) => t.language === language
                    );

                    if (translation) {
                        clearInterval(pollInterval);
                        setTranslations(translationsData.translations);

                        // Load translated text
                        const textResponse = await fetch(
                            `${API_URL}/jobs/${jobId}/download/translation/${language}`
                        );
                        const textData = await textResponse.text();
                        setTranslatedText(textData);
                        setIsTranslating(false);
                    }
                } catch (error) {
                    console.error("Error polling translation:", error);
                }
            }, 2000);

            // Stop polling after 5 minutes
            setTimeout(() => clearInterval(pollInterval), 300000);
        } catch (error) {
            console.error("Error starting translation:", error);
            setIsTranslating(false);
            alert("Error al iniciar la traducción");
        }
    };

    // Download file
    const handleDownload = (language: string, type: "translation" | "comparison" | "bilingual-srt") => {
        const url = `${API_URL}/jobs/${jobId}/download/${type}/${language}`;
        window.open(url, "_blank");
    };

    // Get existing translation
    const getExistingTranslation = (language: string) => {
        return translations.find((t) => t.language === language);
    };

    // Filter available languages (exclude source language)
    const availableLanguages = LANGUAGES.filter((lang) => lang.code !== sourceLanguage);

    return (
        <div className="bg-card rounded-xl border p-8 space-y-6">
            <div className="flex items-center gap-3">
                <Languages className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Traducción</h2>
            </div>

            <p className="text-muted-foreground">
                Traduce la transcripción a otros idiomas usando IA (NLLB-200)
            </p>

            {/* Language Selection */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {availableLanguages.map((lang) => {
                    const existing = getExistingTranslation(lang.code);
                    const isSelected = selectedLanguage === lang.code;

                    return (
                        <button
                            key={lang.code}
                            onClick={() => {
                                if (existing) {
                                    setSelectedLanguage(lang.code);
                                    setTranslatedText(null);
                                    // Load existing translation
                                    fetch(`${API_URL}/jobs/${jobId}/download/translation/${lang.code}`)
                                        .then((response) => response.text())
                                        .then((data) => setTranslatedText(data));
                                } else {
                                    handleTranslate(lang.code);
                                }
                            }}
                            disabled={isTranslating}
                            className={`
                p-4 rounded-lg border-2 transition-all
                ${isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}
                ${existing ? "bg-green-500/10 border-green-500/50" : ""}
                ${isTranslating && isSelected ? "opacity-50 cursor-not-allowed" : ""}
              `}
                        >
                            <div className="text-3xl mb-2">{lang.flag}</div>
                            <div className="font-medium">{lang.name}</div>
                            {existing && (
                                <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center justify-center gap-1">
                                    <FileCheck className="w-3 h-3" />
                                    Disponible
                                </div>
                            )}
                            {isTranslating && isSelected && (
                                <div className="text-xs text-primary mt-1 flex items-center justify-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Traduciendo...
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Bilingual SRT Option */}
            {!isTranslating && !selectedLanguage && (
                <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
                    <input
                        type="checkbox"
                        id="bilingual-srt"
                        checked={createBilingualSRT}
                        onChange={(e) => setCreateBilingualSRT(e.target.checked)}
                        className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <div className="flex-1">
                        <label htmlFor="bilingual-srt" className="text-sm font-medium cursor-pointer">
                            Crear SRT bilingüe (opcional)
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                            Genera un archivo de subtítulos con el texto original y la traducción
                        </p>
                    </div>
                </div>
            )}

            {/* Translation Display */}
            {selectedLanguage && translatedText && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">
                            Traducción a {LANGUAGES.find((l) => l.code === selectedLanguage)?.name}
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowComparison(!showComparison)}
                                className="px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                            >
                                {showComparison ? "Ver Solo Traducción" : "Ver Comparación"}
                            </button>
                        </div>
                    </div>

                    {/* Side-by-side or single view */}
                    {showComparison ? (
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-muted-foreground">Original (Español)</div>
                                <div className="p-4 bg-secondary/50 rounded-lg max-h-96 overflow-y-auto whitespace-pre-wrap text-sm">
                                    {transcript}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-muted-foreground">
                                    Traducción ({LANGUAGES.find((l) => l.code === selectedLanguage)?.name})
                                </div>
                                <div className="p-4 bg-primary/10 rounded-lg max-h-96 overflow-y-auto whitespace-pre-wrap text-sm">
                                    {translatedText}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-primary/10 rounded-lg max-h-96 overflow-y-auto whitespace-pre-wrap text-sm">
                            {translatedText}
                        </div>
                    )}

                    {/* Download Options */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => handleDownload(selectedLanguage, "translation")}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Descargar Traducción
                        </button>
                        <button
                            onClick={() => handleDownload(selectedLanguage, "comparison")}
                            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            Descargar Comparación
                        </button>
                        {getExistingTranslation(selectedLanguage)?.bilingual_srt_file && (
                            <button
                                onClick={() => handleDownload(selectedLanguage, "bilingual-srt")}
                                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                            >
                                <FileText className="w-4 h-4" />
                                Descargar SRT Bilingüe
                            </button>
                        )}

                        {/* Open Editor Button */}
                        <button
                            onClick={() => {
                                setEditorLanguage(selectedLanguage);
                                setShowEditor(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            <Eye className="w-4 h-4" />
                            Editar Comparación
                        </button>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isTranslating && (
                <div className="text-center py-8">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-lg font-medium">Traduciendo...</p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Esto puede tomar algunos minutos. La primera traducción descargará el modelo (~2.5GB).
                    </p>
                </div>
            )}

            {/* Comparison Editor Modal */}
            {showEditor && editorLanguage && translatedText && (
                <ComparisonEditor
                    jobId={jobId}
                    sourceLanguage={sourceLanguage}
                    targetLanguage={editorLanguage}
                    originalText={transcript}
                    translatedText={translatedText}
                    onClose={() => {
                        setShowEditor(false);
                        setEditorLanguage(null);
                    }}
                />
            )}
        </div>
    );
}
