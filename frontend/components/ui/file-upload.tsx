"use client";

import { useCallback, useState } from "react";
import { Upload, FileAudio, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface FileUploadProps {
    onFileSelect: (file: File) => void;
}

export function FileUpload({ onFileSelect }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                onFileSelect(files[0]);
            }
        },
        [onFileSelect]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                onFileSelect(files[0]);
            }
        },
        [onFileSelect]
    );

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                "relative border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer",
                isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-secondary/50"
            )}
        >
            <input
                type="file"
                onChange={handleFileInput}
                accept="audio/*,video/*,.mp3,.wav,.m4a,.flac,.ogg,.aac,.wma,.mp4,.mov,.avi,.mkv"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-primary" />
                </div>

                <div>
                    <p className="text-lg font-medium mb-1">
                        Arrastra un archivo aquí o haz clic para seleccionar
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Soporta MP3, WAV, M4A, MP4, FLAC y más
                    </p>
                </div>

                <p className="text-xs text-muted-foreground">
                    Tamaño máximo: 500 MB
                </p>
            </div>
        </div>
    );
}
