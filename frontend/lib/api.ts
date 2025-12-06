import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/ws";

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Types
export interface TranscriptionConfig {
    model: string;
    language: string;
    temperature: number;
    beam_size: number;
    normalize_audio: boolean;
    initial_prompt?: string;
}

export interface JobMetadata {
    job_name: string;
    start_time?: string;
    end_time?: string;
    elapsed_sec?: number;
    audio_duration_sec?: number;
    elapsed_hms?: string;
    audio_duration_hms?: string;
    rtf?: number;
    coverage_ratio?: number;
    model: string;
    device: string;
    fp16: boolean;
    language: string;
    beam_size: number;
    temperature: number;
    normalized_16k: boolean;
    input_original_name: string;
    chars?: number;
    words?: number;
    segments?: number;
}

export interface Job {
    job_id: string;
    status: "pending" | "processing" | "completed" | "failed";
    filename: string;
    created_at: string;
    updated_at: string;
    config: TranscriptionConfig;
    metadata?: JobMetadata;
    transcript?: string;
    error?: string;
    progress: number;
}

export interface ProgressUpdate {
    job_id: string;
    status: string;
    progress: number;
    message: string;
    timestamp: string;
}

// API Functions
export async function uploadFile(
    file: File,
    config?: Partial<TranscriptionConfig>
): Promise<Job> {
    const formData = new FormData();
    formData.append("file", file);

    const params = new URLSearchParams();
    if (config?.model) params.append("model", config.model);
    if (config?.language) params.append("language", config.language);
    if (config?.temperature !== undefined)
        params.append("temperature", config.temperature.toString());
    if (config?.beam_size) params.append("beam_size", config.beam_size.toString());
    if (config?.normalize_audio !== undefined)
        params.append("normalize_audio", config.normalize_audio.toString());
    if (config?.initial_prompt)
        params.append("initial_prompt", config.initial_prompt);

    const response = await api.post(`/upload?${params.toString()}`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });

    return response.data;
}

export async function startTranscription(jobId: string): Promise<Job> {
    const response = await api.post(`/transcribe/${jobId}`);
    return response.data;
}

export async function getJob(jobId: string): Promise<Job> {
    const response = await api.get(`/jobs/${jobId}`);
    return response.data;
}

export async function listJobs(): Promise<{ jobs: Job[]; total: number }> {
    const response = await api.get("/jobs");
    return response.data;
}

export async function deleteJob(jobId: string): Promise<void> {
    await api.delete(`/jobs/${jobId}`);
}

export async function cancelJob(jobId: string): Promise<void> {
    await api.post(`/jobs/${jobId}/cancel`);
}

export async function downloadTranscript(jobId: string): Promise<Blob> {
    const response = await api.get(`/jobs/${jobId}/download`, {
        responseType: "blob",
    });
    return response.data;
}

export async function checkHealth(): Promise<{
    status: string;
    version: string;
    whisper_available: boolean;
    device: string;
}> {
    const response = await api.get("/health");
    return response.data;
}

// WebSocket Helper
export function connectToJobProgress(
    jobId: string,
    onProgress: (update: ProgressUpdate) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
): WebSocket {
    const ws = new WebSocket(`${WS_URL}/${jobId}`);

    ws.onmessage = (event) => {
        try {
            const update: ProgressUpdate = JSON.parse(event.data);
            onProgress(update);
        } catch (error) {
            console.error("Failed to parse progress update:", error);
        }
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (onError) onError(error);
    };

    ws.onclose = () => {
        console.log("WebSocket closed");
        if (onClose) onClose();
    };

    return ws;
}

// Translation API Functions
export interface Translation {
    language: string;
    language_name: string;
    translated_file: string;
    comparison_file: string;
    bilingual_srt_file: string | null;
    created_at: string;
}

export async function translateJob(
    jobId: string,
    targetLanguage: string,
    createBilingualSRT: boolean = false
): Promise<{
    job_id: string;
    source_language: string;
    target_language: string;
    translated_text: string;
    comparison_file: string;
    translated_file: string;
    bilingual_srt_file: string | null;
}> {
    const response = await api.post(`/jobs/${jobId}/translate`, {
        target_language: targetLanguage,
        create_bilingual_srt: createBilingualSRT,
    });
    return response.data;
}

export async function getTranslations(jobId: string): Promise<{
    job_id: string;
    source_language: string;
    translations: Translation[];
}> {
    const response = await api.get(`/jobs/${jobId}/translations`);
    return response.data;
}

export function downloadTranslation(
    jobId: string,
    language: string,
    format: "translation" | "comparison" | "bilingual-srt"
): void {
    const url = `${API_URL}/jobs/${jobId}/download/${format}/${language}`;
    window.open(url, "_blank");
}
