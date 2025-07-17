import React, { useState, useRef, useCallback } from "react";
import {
  Upload,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Check,
  X,
  Zap,
  Monitor,
  Smartphone,
  Tablet,
  ArrowRight,
  Sparkles,
  Video,
} from "lucide-react";

// Types
interface VideoUploadState {
  file: File | null;
  resolution: "720p" | "480p" | "360p";
  isUploading: boolean;
  uploadProgress: number;
  processedVideoUrl: string | null;
  error: string | null;
}

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

// Toast Component
const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl transition-all duration-500 transform ${
        type === "success"
          ? "bg-emerald-500 text-white border border-emerald-400"
          : "bg-red-500 text-white border border-red-400"
      }`}
    >
      <div className="flex items-center space-x-3">
        {type === "success" ? <Check size={20} /> : <X size={20} />}
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );
};

// Custom Video Player Component
const VideoPlayer: React.FC<{ src: string; className?: string }> = ({
  src,
  className = "",
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`relative bg-black rounded-3xl overflow-hidden ${className}`}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Glass morphism controls */}
      <div className="absolute bottom-4 left-4 right-4 bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
        <div className="flex items-center space-x-4">
          <button
            onClick={togglePlay}
            className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all duration-200"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <div className="flex-1">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${
                  (currentTime / duration) * 100
                }%, rgba(255,255,255,0.2) ${
                  (currentTime / duration) * 100
                }%, rgba(255,255,255,0.2) 100%)`,
              }}
            />
          </div>

          <span className="text-white font-mono text-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <button
            onClick={toggleMute}
            className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all duration-200"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

// Animated Progress Ring
const ProgressRing: React.FC<{ progress: number }> = ({ progress }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex items-center justify-center">
      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-gray-800"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-emerald-500 transition-all duration-300"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-white">
          {Math.round(progress)}%
        </span>
        <span className="text-sm text-gray-400">Processing</span>
      </div>
    </div>
  );
};

// Resolution Card Component
const ResolutionCard: React.FC<{
  resolution: "720p" | "480p" | "360p";
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ resolution, selected, onClick, icon, title, description }) => {
  return (
    <div
      onClick={onClick}
      className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:scale-105 ${
        selected
          ? "border-emerald-500 bg-emerald-500/10 shadow-emerald-500/20 shadow-2xl"
          : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
      }`}
    >
      <div className="flex items-center space-x-4">
        <div
          className={`p-3 rounded-xl ${
            selected ? "bg-emerald-500/20" : "bg-gray-700"
          }`}
        >
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </div>
      {selected && (
        <div className="absolute top-3 right-3">
          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
            <Check size={16} className="text-white" />
          </div>
        </div>
      )}
    </div>
  );
};

// File Upload Component
const FileUpload: React.FC<{
  onFileSelect: (file: File) => void;
  isDragOver: boolean;
  onDragOver: (isDragOver: boolean) => void;
  disabled: boolean;
  selectedFile: File | null;
}> = ({ onFileSelect, isDragOver, onDragOver, disabled, selectedFile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find((file) => file.type.startsWith("video/"));

    if (videoFile) {
      onFileSelect(videoFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer ${
          isDragOver
            ? "border-emerald-500 bg-emerald-500/10 scale-105"
            : "border-gray-600 hover:border-gray-500"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center space-y-6">
          <div
            className={`p-6 rounded-full transition-all duration-300 ${
              isDragOver
                ? "bg-emerald-500 text-white scale-110"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            <Upload size={48} />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {selectedFile ? "Change Video" : "Upload Your Video"}
            </h3>
            <p className="text-gray-400 text-lg">
              Drag & drop or click to browse
            </p>
            <p className="text-gray-500 mt-2">
              MP4, MOV, AVI, WebM • Max 100MB
            </p>
          </div>
        </div>
      </div>

      {selectedFile && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <Video className="text-emerald-500" size={24} />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white">{selectedFile.name}</h4>
              <p className="text-gray-400 text-sm">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div className="text-emerald-500">
              <Check size={24} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App Component
const VideoResolutionApp: React.FC = () => {
  const [state, setState] = useState<VideoUploadState>({
    file: null,
    resolution: "720p",
    isUploading: false,
    uploadProgress: 0,
    processedVideoUrl: null,
    error: null,
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Mock API function
  const uploadVideo = async (
    file: File,
    resolution: string
  ): Promise<string> => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 12;
        if (progress >= 100) {
          clearInterval(interval);
          setState((prev) => ({ ...prev, uploadProgress: 100 }));
          setTimeout(() => resolve(URL.createObjectURL(file)), 500);
        } else {
          setState((prev) => ({
            ...prev,
            uploadProgress: Math.min(progress, 95),
          }));
        }
      }, 250);
    });
  };

  const handleFileSelect = (file: File) => {
    setState((prev) => ({ ...prev, file, error: null }));
  };

  const handleResolutionChange = (resolution: "720p" | "480p" | "360p") => {
    setState((prev) => ({ ...prev, resolution }));
  };

  const handleSubmit = async () => {
    if (!state.file) {
      setToast({ message: "Please select a video file first", type: "error" });
      return;
    }

    setState((prev) => ({
      ...prev,
      isUploading: true,
      uploadProgress: 0,
      error: null,
    }));

    try {
      const processedVideoUrl = await uploadVideo(state.file, state.resolution);
      setState((prev) => ({
        ...prev,
        isUploading: false,
        processedVideoUrl,
        uploadProgress: 0,
      }));
      setToast({ message: "Video processed successfully!", type: "success" });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isUploading: false,
        error: "Failed to process video. Please try again.",
        uploadProgress: 0,
      }));
      setToast({
        message: "Processing failed. Please try again.",
        type: "error",
      });
    }
  };

  const handleDownload = () => {
    if (state.processedVideoUrl) {
      const link = document.createElement("a");
      link.href = state.processedVideoUrl;
      link.download = `resized_${state.resolution}_video.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const resetForm = () => {
    setState({
      file: null,
      resolution: "720p",
      isUploading: false,
      uploadProgress: 0,
      processedVideoUrl: null,
      error: null,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center">
                <Zap className="text-white" size={24} />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                <Sparkles size={10} className="text-yellow-800" />
              </div>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              VideoMorph
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <span className="text-gray-400">
              Transform • Optimize • Download
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        {!state.processedVideoUrl ? (
          <>
            {/* Hero Section */}
            <div className="text-center py-16">
              <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 mb-8">
                <Sparkles className="text-emerald-400" size={16} />
                <span className="text-emerald-400 font-medium">
                  AI-Powered Video Processing
                </span>
              </div>

              <h1 className="text-5xl md:text-7xl font-bold mb-6">
                <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Resize Videos
                </span>
                <br />
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Instantly
                </span>
              </h1>

              <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                Transform your videos to any resolution with our lightning-fast
                processing engine. Perfect quality, blazing speed.
              </p>
            </div>

            {/* Upload Section */}
            <div className="mb-12">
              <FileUpload
                onFileSelect={handleFileSelect}
                isDragOver={isDragOver}
                onDragOver={setIsDragOver}
                disabled={state.isUploading}
                selectedFile={state.file}
              />
            </div>

            {/* Resolution Selection */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Choose Your Target Resolution
              </h2>

              <div className="grid md:grid-cols-3 gap-6">
                <ResolutionCard
                  resolution="720p"
                  selected={state.resolution === "720p"}
                  onClick={() => handleResolutionChange("720p")}
                  icon={<Monitor className="text-blue-400" size={24} />}
                  title="720p HD"
                  description="Perfect for desktop & web"
                />

                <ResolutionCard
                  resolution="480p"
                  selected={state.resolution === "480p"}
                  onClick={() => handleResolutionChange("480p")}
                  icon={<Tablet className="text-purple-400" size={24} />}
                  title="480p SD"
                  description="Optimized for tablets"
                />

                <ResolutionCard
                  resolution="360p"
                  selected={state.resolution === "360p"}
                  onClick={() => handleResolutionChange("360p")}
                  icon={<Smartphone className="text-pink-400" size={24} />}
                  title="360p Mobile"
                  description="Lightweight for phones"
                />
              </div>
            </div>

            {/* Process Button */}
            <div className="text-center">
              <button
                onClick={handleSubmit}
                disabled={!state.file || state.isUploading}
                className="group relative inline-flex items-center space-x-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-12 py-6 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {state.isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Zap size={24} />
                    <span>Transform Video</span>
                    <ArrowRight
                      size={20}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </>
                )}
              </button>
            </div>

            {/* Processing Animation */}
            {state.isUploading && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-gray-900 border border-gray-700 rounded-3xl p-12 text-center">
                  <ProgressRing progress={state.uploadProgress} />
                  <h3 className="text-2xl font-bold text-white mt-6 mb-2">
                    Processing Your Video
                  </h3>
                  <p className="text-gray-400">
                    Our AI is optimizing your video to {state.resolution}...
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Results Section */
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 mb-6">
                <Check className="text-emerald-400" size={16} />
                <span className="text-emerald-400 font-medium">
                  Processing Complete
                </span>
              </div>

              <h2 className="text-4xl font-bold text-white mb-4">
                Your Video is Ready!
              </h2>
              <p className="text-gray-400 text-lg">
                Successfully resized to {state.resolution}. Preview below or
                download to your device.
              </p>
            </div>

            {/* Video Player */}
            <div className="mb-12">
              <VideoPlayer
                src={state.processedVideoUrl}
                className="w-full shadow-2xl"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button
                onClick={handleDownload}
                className="group flex items-center justify-center space-x-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
              >
                <Download size={20} />
                <span>Download Video</span>
              </button>

              <button
                onClick={resetForm}
                className="group flex items-center justify-center space-x-3 bg-gray-700 hover:bg-gray-600 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
              >
                <Upload size={20} />
                <span>Process Another</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-20 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-gray-400 mb-2">
            Built with cutting-edge technology for seamless video processing
          </p>
          <p className="text-gray-600">
            © 2025 VideoMorph. Transforming videos at the speed of light.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default VideoResolutionApp;
