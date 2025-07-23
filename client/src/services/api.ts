import axios from "axios";
import type { AxiosInstance, AxiosResponse } from "axios";

interface UploadResponse {
  jobId: string;
  queueName: string;
  resolution: number;
  srcUrl: string;
}

interface JobStatusResponse {
  jobId: string;
  queueName: string;
  state: string;
  progress: number | object;
  result?: unknown;
  error?: string;
  data?: unknown;
}

export function getApiBaseURL(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) {
    return envUrl.replace(/\/+$/, ""); 
  }
  return "";
}

export const api: AxiosInstance = axios.create({
  baseURL: getApiBaseURL(),
  withCredentials: true, 
  headers: {
    "X-Requested-With": "XMLHttpRequest",
  },
});

export function uploadVideo(
  file: File,
  resolution: 360 | 480 | 720,
  onUploadProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<AxiosResponse<UploadResponse>> {
  const form = new FormData();
  form.append("file", file);
  form.append("resolution", String(resolution));

  return api.post<UploadResponse>("/api/upload", form, {
    signal,
    onUploadProgress: (event) => {
      if (event.total) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onUploadProgress?.(percent);
      }
    },
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

export function getJobStatus(
  resolution: 360 | 480 | 720 | 1080,
  jobId: string
): Promise<AxiosResponse<JobStatusResponse>> {
  return api.get<JobStatusResponse>(`/api/jobs/${resolution}/${jobId}`);
}

export function getJobStatusAny(
  jobId: string
): Promise<AxiosResponse<JobStatusResponse>> {
  return api.get<JobStatusResponse>(`/api/jobs/any/${jobId}`);
}
