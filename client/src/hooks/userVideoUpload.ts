import { useState, useCallback, useEffect, useRef } from "react";
import { uploadVideo as apiUploadVideo } from "../services/api";
import { socketService } from "../services/socket";
import { useToast } from "../components/ui/ToastProvider";

export interface ProcessingStatus {
  stage: "downloading" | "processing" | "uploading" | "completed";
  message: string;
  progress: number;
}

export type AllowedResolution = 360 | 480 | 720;

// WebSocket payload types
interface JobCompletedPayload {
  jobId: string;
  queueName: string;
  resizedUrl: string;
  target: AllowedResolution;
}
interface JobProgressPayload {
  jobId: string;
  queueName: string;
  progress: number | ProcessingStatus;
}
interface JobFailedPayload {
  jobId: string;
  queueName: string;
  failedReason: string;
}

// The public interface of our custom hook
export interface UseVideoUploadReturn {
  uploadVideo: (file: File, resolution: AllowedResolution) => Promise<void>;
  uploadProgress: number;
  processingProgress: number;
  processingMessage: string; // The new dynamic message for the UI
  videoUrl: string | null;
  status: "idle" | "uploading" | "processing" | "completed" | "failed";
  jobResolution: AllowedResolution | null;
  cancel: () => void;
  reset: () => void;
}

export function userVideoUpload(): UseVideoUploadReturn {
  const [status, setStatus] = useState<UseVideoUploadReturn["status"]>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [jobResolution, setJobResolution] = useState<AllowedResolution | null>(
    null
  );

  // This new state holds the rich progress object from the backend.
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    stage: "downloading",
    message: "Preparing...",
    progress: 0,
  });

  const { showToast } = useToast();
  const jobDetails = useRef<{ jobId: string; queueName: string } | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // This effect handles all WebSocket event listening.
  useEffect(() => {
    if (status !== "processing" || !jobDetails.current) {
      return;
    }

    const socket = socketService.get();
    const { jobId, queueName } = jobDetails.current;

    const onProgress = (payload: JobProgressPayload) => {
      if (payload.jobId === jobId && payload.queueName === queueName) {
        // Handle the rich status object from the backend worker.
        if (typeof payload.progress === "object" && payload.progress !== null) {
          const newStatus = payload.progress as ProcessingStatus;
          setProcessingStatus(newStatus);
        }
      }
    };

    const onCompleted = (payload: JobCompletedPayload) => {
      if (payload.jobId === jobId && payload.queueName === queueName) {
        setVideoUrl(payload.resizedUrl);
        setJobResolution(payload.target);
        setStatus("completed");
        showToast("Video processed successfully!", { variant: "success" });
        jobDetails.current = null;
      }
    };

    const onFailed = (payload: JobFailedPayload) => {
      if (payload.jobId === jobId && payload.queueName === queueName) {
        const reason =
          payload.failedReason || "Processing failed for an unknown reason.";
        showToast(reason, { variant: "error" });
        setStatus("failed");
        jobDetails.current = null;
      }
    };

    socket.on("job:progress", onProgress);
    socket.on("job:completed", onCompleted);
    socket.on("job:failed", onFailed);

    return () => {
      socket.off("job:progress", onProgress);
      socket.off("job:completed", onCompleted);
      socket.off("job:failed", onFailed);
    };
  }, [status, showToast]);

  // A dedicated function to reset the hook's state to its initial values.
  const reset = useCallback(() => {
    abortController.current?.abort(); // Cancel any ongoing upload
    setStatus("idle");
    setUploadProgress(0);
    setVideoUrl(null);
    setJobResolution(null);
    setProcessingStatus({ stage: "downloading", message: "", progress: 0 });
    jobDetails.current = null;
  }, []);

  const cancel = useCallback(() => {
    reset();
    showToast("Operation cancelled.", { variant: "info" });
  }, [reset, showToast]);

  const uploadVideo = useCallback(
    async (file: File, resolution: AllowedResolution) => {
      reset(); // Use reset to ensure a clean state before starting
      setStatus("uploading");

      try {
        abortController.current = new AbortController();
        const uploadRes = await apiUploadVideo(
          file,
          resolution,
          setUploadProgress,
          abortController.current.signal
        );

        const { jobId, queueName } = uploadRes.data;
        jobDetails.current = { jobId, queueName };
        setStatus("processing"); // This triggers the useEffect to start listening for job updates
      } catch (err: any) {
        if (err.name === "CanceledError" || err.name === "AbortError") {
          console.log("Upload cancelled by user.");
          return;
        }
        const errorMsg =
          err?.response?.data?.error || "An unknown upload error occurred.";
        showToast(errorMsg, { variant: "error" });
        setStatus("failed");
      }
    },
    [reset, showToast]
  );

  return {
    uploadVideo,
    uploadProgress,
    processingProgress: processingStatus.progress,
    processingMessage: processingStatus.message,
    videoUrl,
    status,
    jobResolution,
    cancel,
    reset,
  };
}
