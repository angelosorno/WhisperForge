"use client";

import { useState, useEffect, useRef } from "react";
import { X, Save, Download, Loader2, Check } from "lucide-react";

interface ComparisonEditorProps {
    jobId: string;
    sourceLanguage: string;
    targetLanguage: string;
    originalText: string;
    translatedText: string;
    onClose: () => void;
}

export function ComparisonEditor({
    jobId,
    sourceLanguage,
    targetLanguage,
    originalText,
    translatedText,
    onClose,
}: ComparisonEditorProps) {
    const [original, setOriginal] = useState(originalText);
    const [translated, setTranslated] = useState(translatedText);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [hasChanges, setHasChanges] = useState(false);

    const originalRef = useRef<HTMLTextAreaElement>(null);
    const translatedRef = useRef<HTMLTextAreaElement>(null);

    // Track changes
    useEffect(() => {
        const changed = original !== originalText || translated !== translatedText;
        setHasChanges(changed);
    }, [original, translated, originalText, translatedText]);

    // Sync scroll between textareas
    const handleScroll = (source: "original" | "translated") => {
        if (source === "original" && originalRef.current && translatedRef.current) {
            const scrollPercentage = originalRef.current.scrollTop / (originalRef.current.scrollHeight - originalRef.current.clientHeight);
            translatedRef.current.scrollTop = scrollPercentage * (translatedRef.current.scrollHeight - translatedRef.current.clientHeight);
        } else if (source === "translated" && originalRef.current && translatedRef.current) {
            const scrollPercentage = translatedRef.current.scrollTop / (translatedRef.current.scrollHeight - translatedRef.current.clientHeight);
            originalRef.current.scrollTop = scrollPercentage * (originalRef.current.scrollHeight - originalRef.current.clientHeight);
        }
    };

    // Save changes
    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus("saving");

        try {
            const response = await fetch(`http://localhost:8000/api/jobs/${jobId}/comparison/${targetLanguage}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    original_text: original,
                    translated_text: translated,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to save");
            }

            setSaveStatus("saved");
            setHasChanges(false);

            // Reset status after 3 seconds
            setTimeout(() => {
                setSaveStatus("idle");
            }, 3000);
        } catch (error) {
            console.error("Error saving:", error);
            setSaveStatus("error");
            setTimeout(() => {
                setSaveStatus("idle");
            }, 3000);
        } finally {
            setIsSaving(false);
        }
    };

    // Download markdown
    const handleDownload = () => {
        const content = `# Comparación de Traducción

**Idioma Original**: ${sourceLanguage.toUpperCase()}  
**Idioma Traducido**: ${targetLanguage.toUpperCase()}  
**Fecha**: ${new Date().toLocaleString()}

---

## Original (${sourceLanguage.toUpperCase()})

${original}

---

## Traducción (${targetLanguage.toUpperCase()})

${translated}

---

**Editado por usuario**
`;

        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `comparison_${sourceLanguage}_${targetLanguage}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+S or Ctrl+S to save
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                if (hasChanges) {
                    handleSave();
                }
            }
            // Escape to close
            if (e.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [hasChanges, onClose]);

    const wordCount = (text: string) => text.trim().split(/\s+/).length;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-7xl h-[90vh] rounded-xl border shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-secondary rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold">
                                Comparación {sourceLanguage.toUpperCase()} → {targetLanguage.toUpperCase()}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Edita el texto directamente y guarda los cambios
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Save Status */}
                        {saveStatus === "saved" && (
                            <div className="flex items-center gap-2 text-green-500 text-sm">
                                <Check className="w-4 h-4" />
                                Guardado
                            </div>
                        )}
                        {saveStatus === "error" && (
                            <div className="text-red-500 text-sm">Error al guardar</div>
                        )}

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Guardar
                                </>
                            )}
                        </button>

                        {/* Download Button */}
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Descargar
                        </button>
                    </div>
                </div>

                {/* Editor Panels */}
                <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden">
                    {/* Original Text */}
                    <div className="flex flex-col gap-2 h-full">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg">
                                📝 {sourceLanguage.toUpperCase()} (Original)
                            </h3>
                            <span className="text-sm text-muted-foreground">
                                {wordCount(original).toLocaleString()} palabras
                            </span>
                        </div>
                        <textarea
                            ref={originalRef}
                            value={original}
                            onChange={(e) => setOriginal(e.target.value)}
                            onScroll={() => handleScroll("original")}
                            className="flex-1 w-full p-4 bg-secondary/50 rounded-lg border focus:border-primary focus:outline-none resize-none font-mono text-sm"
                            placeholder="Texto original..."
                        />
                    </div>

                    {/* Translated Text */}
                    <div className="flex flex-col gap-2 h-full">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg">
                                🌐 {targetLanguage.toUpperCase()} (Traducción)
                            </h3>
                            <span className="text-sm text-muted-foreground">
                                {wordCount(translated).toLocaleString()} palabras
                            </span>
                        </div>
                        <textarea
                            ref={translatedRef}
                            value={translated}
                            onChange={(e) => setTranslated(e.target.value)}
                            onScroll={() => handleScroll("translated")}
                            className="flex-1 w-full p-4 bg-secondary/50 rounded-lg border focus:border-primary focus:outline-none resize-none font-mono text-sm"
                            placeholder="Texto traducido..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-secondary/20">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div>
                            {hasChanges && (
                                <span className="text-orange-500">● Cambios sin guardar</span>
                            )}
                        </div>
                        <div>
                            Atajos: <kbd className="px-2 py-1 bg-secondary rounded text-xs">Cmd+S</kbd> Guardar · <kbd className="px-2 py-1 bg-secondary rounded text-xs">Esc</kbd> Cerrar
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
