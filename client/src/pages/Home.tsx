import React, { useState } from "react";
import { ResolutionPicker } from "../components/video/ResolutionPicker";
import { FileUpload } from "../components/video/FileUpload";
import { ProgressRing } from "../components/ui/ProgressRing";
import { useToast } from "../components/ui/ToastProvider";
import { Download, DownloadCloud, UploadCloud, WandSparkles, RefreshCw, X, ArrowRight, Upload } from "lucide-react";
import { userVideoUpload } from "../hooks/userVideoUpload";

interface Resolution {
  value: "360p" | "480p" | "720p";
}

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, autoPlay, className }) => (
  <video
    src={src}
    controls
    autoPlay={autoPlay}
    className={`w-full rounded-lg shadow-lg ${className}`}
    style={{ maxHeight: "500px" }}
  />
);

const Home: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [resolution, setResolution] = useState<Resolution["value"]>("480p");
  const { showToast } = useToast();
  const {
    uploadVideo,
    uploadProgress,
    processingProgress,
    processingMessage,
    videoUrl,
    status,
    jobResolution,
    cancel,
    reset,
  } = userVideoUpload();

  const handleStart = () => {
    if (!file) {
      showToast("Please select a video file first.", { variant: "error" });
      return;
    }
    const targetRes = parseInt(resolution.replace("p", "")) as 360 | 480 | 720;
    uploadVideo(file, targetRes);
  };

  const handleReset = () => {
    setFile(null);
    reset();
  };

  const renderStatusIcon = () => {
    if (processingMessage.includes("Downloading"))
      return <DownloadCloud className="h-6 w-6 text-indigo-400" />;
    if (processingMessage.includes("Resizing") || processingMessage.includes("Preparing"))
      return <WandSparkles className="h-6 w-6 text-purple-400 animate-pulse" />;
    if (processingMessage.includes("Uploading"))
      return <UploadCloud className="h-6 w-6 text-emerald-400" />;
    return <WandSparkles className="h-6 w-6 text-purple-400" />;
  };

  const isBusy = status === "uploading" || status === "processing";

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-emerald-500/10 opacity-50" />
      <div className="container mx-auto px-4 py-12 max-w-6xl relative z-10 flex flex-col min-h-screen justify-center">
        {/* Header */}
        <header className="text-center space-y-6 mb-12">
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-xl bg-indigo-500/20 backdrop-blur-lg border border-white/10 shadow-md">
            <Upload className="w-10 h-10 text-indigo-300" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-indigo-300 to-emerald-300 bg-clip-text text-transparent">
            Video Resizer Pro
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Transform your videos with our fast, reliable, and high-quality processing engine.
          </p>
          <p className="text-sm text-indigo-400 font-medium">
            ✨ Fast & Reliable • 🎯 Pixel Perfect • 🚀 Studio Quality
          </p>
        </header>

        {/* Main Content */}
        <main className="space-y-8">
          {videoUrl && status === "completed" ? (
            // Completed State
            <div className="space-y-8 animate-fadeIn">
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-bold text-white">Your Video is Ready!</h2>
                <p className="text-gray-300">
                  Processed at <span className="text-emerald-400 font-semibold">{jobResolution}p</span>
                </p>
              </div>
              <div className="relative rounded-xl bg-gray-800/50 backdrop-blur-lg border border-white/10 p-6 shadow-xl">
                <VideoPlayer key={videoUrl} src={videoUrl} autoPlay className="rounded-lg" />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 px-6 rounded-lg bg-gray-700/50 border border-white/10 text-gray-200 font-medium hover:bg-indigo-500/20 hover:border-indigo-400/50 hover:shadow-lg transition-all duration-300 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5" /> Process Another
                  </span>
                </button>
                <a
                  href={videoUrl}
                  download={`resized-video-${jobResolution}p.mp4`}
                  className="flex-1 py-3 px-6 rounded-lg bg-gradient-to-r from-indigo-600 to-emerald-600 text-white font-medium hover:from-indigo-700 hover:to-emerald-700 hover:shadow-lg transition-all duration-300 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900 text-center"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" /> Download Video
                  </span>
                </a>
              </div>
            </div>
          ) : (
            // Idle & Busy States
            <div className="space-y-8">
              <div className="relative rounded-xl bg-gray-800/50 backdrop-blur-lg border border-white/10 p-8 shadow-xl">
                <FileUpload
                  selectedFile={file}
                  onFileSelect={setFile}
                  onFileClear={() => setFile(null)}
                  onError={(msg: string) => showToast(msg, { variant: "error" })}
                  disabled={isBusy}
                />
              </div>
              <div className="relative rounded-xl bg-gray-800/50 backdrop-blur-lg border border-white/10 p-8 shadow-xl">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-semibold text-white">Select Your Quality</h3>
                  <p className="text-gray-400">Choose the perfect resolution for your video</p>
                </div>
                <ResolutionPicker value={resolution} onChange={setResolution} disabled={isBusy} />
              </div>

              {isBusy ? (
                // Processing State
                <div className="relative rounded-xl bg-gray-800/50 backdrop-blur-lg border border-white/10 p-8 shadow-xl">
                  <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
                    <div className="relative">
                      <ProgressRing
                        progress={status === "uploading" ? uploadProgress : processingProgress}
                        className="w-40 h-40"
                      >
                        <div className="text-center">
                          <span className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
                            {Math.round(status === "uploading" ? uploadProgress : processingProgress)}%
                          </span>
                          <span className="block text-sm text-gray-400 uppercase tracking-wider">
                            {status === "uploading" ? "Uploading" : "Processing"}
                          </span>
                        </div>
                      </ProgressRing>
                    </div>
                    <div className="text-center lg:text-left space-y-4 max-w-md">
                      <h3 className="text-3xl font-semibold text-white">
                        {status === "uploading" ? "Uploading Your Video" : "Crafting Your Masterpiece"}
                      </h3>
                      <div className="flex items-center justify-center lg:justify-start gap-3 text-lg text-gray-300">
                        {status === "processing" && renderStatusIcon()}
                        <p>{status === "uploading" ? "Securely transferring your file..." : processingMessage || "Preparing engine..."}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-indigo-400 font-medium truncate">📁 {file?.name}</p>
                        <p className="text-emerald-400 font-medium">🎯 Target: {resolution} • ⚡ AI Enhanced</p>
                      </div>
                      <button
                        onClick={cancel}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-400/40 px-6 py-3 text-red-300 font-medium hover:bg-red-500/30 hover:border-red-400/60 transition-all duration-300 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                      >
                        <X className="w-5 h-5" /> Cancel Process
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Idle State
                <div className="text-center space-y-6">
                  <button
                    className="relative py-4 px-8 rounded-lg bg-gradient-to-r from-indigo-600 to-emerald-600 text-white font-semibold text-lg hover:from-indigo-700 hover:to-emerald-700 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                    disabled={!file || isBusy}
                    onClick={handleStart}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <ArrowRight className="w-6 h-6" /> Transform to {resolution}
                    </span>
                  </button>
                  {file ? (
                    <div className="space-y-2">
                      <p className="text-gray-300">
                        Ready to process{" "}
                        <span className="text-indigo-400 font-semibold">{file.name}</span>
                      </p>
                      <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
                        <span>📊 {(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                        <span>•</span>
                        <span>🎯 Target: {resolution}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400 animate-pulse">Select a video file to get started</p>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Home;