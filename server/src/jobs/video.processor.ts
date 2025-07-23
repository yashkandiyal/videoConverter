import { execFile, ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static"; // <-- Use the dedicated package
import { logger } from "../utils/logger.js";

/**
 * A helper function that runs FFprobe to get the total duration of a video file.
 * @param input Path to the video file.
 * @returns The duration of the video in seconds, or 0 if it cannot be determined.
 */
async function getVideoDuration(input: string): Promise<number> {
  try {
    const ffprobePath = ffprobeStatic.path; // <-- Much more reliable
    const args = [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      input,
    ];

    const durationPromise = new Promise<number>((resolve, reject) => {
      execFile(ffprobePath as unknown as string, args, (error, stdout) => {
        if (error) {
          return reject(error);
        }
        const duration = parseFloat(stdout.trim());
        resolve(isNaN(duration) ? 0 : duration);
      });
    });

    return await durationPromise;
  } catch (error) {
    logger.error("Could not determine video duration.", error);
    return 0; // Return 0 if duration cannot be found, preventing crashes.
  }
}

/**
 * Converts a video to the given height, reporting progress along the way.
 */
export async function convertResolution(
  input: string,
  output: string,
  height: number,
  onProgress: (progress: number) => void
): Promise<void> {
  // --- Step 1: Validation ---
  if (!input || !output)
    throw new Error("Input and output paths are required.");
  if (height <= 0) throw new Error("Height must be a positive number.");
  await access(input);
  if (!ffmpegPath) throw new Error("FFmpeg binary not found.");

  // --- Step 2: Get Duration ---
  const totalDuration = await getVideoDuration(input);

  // --- Step 3: Run FFmpeg and Handle Progress ---
  const ffmpegArgs = [
    "-progress",
    "pipe:1", // Pipe progress data to stdout
    "-y",
    "-i",
    input,
    "-vf",
    `scale=-2:${height}`,
    "-c:v",
    "libx264",
    "-preset",
    "superfast", // <-- Changed to superfast for speed (trade-off: potential quality loss)
    "-movflags",
    "faststart",
    "-threads",
    "0", // <-- Let FFmpeg auto-optimize threads for multi-core speedup
    output,
  ];

  // Optional: Hardware acceleration (uncomment if NVIDIA GPU available)
  // ffmpegArgs.splice(ffmpegArgs.indexOf("-c:v"), 2, "-c:v", "h264_nvenc", "-preset", "p1"); // Fast NVENC

  await new Promise<void>((resolve, reject) => {
    // Use `unknown` assertion for maximum TypeScript compatibility
    const ffmpegProcess: ChildProcess = execFile(
      ffmpegPath as unknown as string,
      ffmpegArgs
    );

    // Listen to stdout (pipe:1) for progress data
    ffmpegProcess.stdout?.on("data", (chunk: Buffer) => {
      const data = chunk.toString();
      // Parse key-value pairs more efficiently (loop through lines)
      const lines = data.split("\n");
      for (const line of lines) {
        if (line.includes("out_time_ms=")) {
          const timeMatch = line.match(/out_time_ms=(\d+)/);
          if (timeMatch && totalDuration > 0) {
            const currentTimeMs = parseInt(timeMatch[1], 10);
            const currentTimeSec = currentTimeMs / 1000000;
            const progress = Math.min(
              Math.round((currentTimeSec / totalDuration) * 100),
              100
            );
            onProgress(progress);
          }
        }
      }
    });

    let stderrOutput = "";
    ffmpegProcess.stderr?.on("data", (data) => {
      stderrOutput += data.toString();
    });

    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        onProgress(100); // Ensure progress always finishes at 100%
        resolve();
      } else {
        reject(
          new Error(
            `Video processing failed with exit code ${code}. FFmpeg output: ${stderrOutput}`
          )
        );
      }
    });

    ffmpegProcess.on("error", (err) => {
      reject(err);
    });
  });
}
