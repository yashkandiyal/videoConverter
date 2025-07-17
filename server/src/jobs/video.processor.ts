// src/jobs/video.processor.ts
/**
 * A robust, testable wrapper around FFmpeg that:
 *  1. Validates input parameters
 *  2. Checks if input file exists
 *  3. Takes a local input file path
 *  4. Scales it to the requested height (keeping aspect ratio)
 *  5. Writes the result to a local output file path
 *  6. Provides clear error messages
 *
 * It throws descriptive errors if anything goes wrong, so BullMQ
 * will mark the job as "failed" and trigger retries with proper context.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static"; // pulls the correct binary for Win/Mac/Linux

const exec = promisify(execFile);

/**
 * Convert an MP4 to the given height while preserving width ratio.
 *
 * @param input   Absolute/relative path to source video on disk
 * @param output  Path where the resized MP4 should be written
 * @param height  New height in pixels (e.g. 360, 480, 720)
 * @throws {Error} If parameters are invalid, file doesn't exist, or FFmpeg fails
 */
export async function convertResolution(
  input: string,
  output: string,
  height: number
): Promise<void> {
  // Step 1: Validate input parameters
  if (!input || typeof input !== "string" || input.trim() === "") {
    throw new Error(
      "Input file path is required and must be a non-empty string"
    );
  }

  if (!output || typeof output !== "string" || output.trim() === "") {
    throw new Error(
      "Output file path is required and must be a non-empty string"
    );
  }

  if (!height || typeof height !== "number" || height <= 0 || height > 4320) {
    throw new Error(
      "Height must be a positive number between 1 and 4320 pixels"
    );
  }

  // Step 2: Check if input file exists and is accessible
  try {
    await access(input);
  } catch (error) {
    throw new Error(`Input file not found or not accessible: ${input}`);
  }

  // Step 3: Ensure FFmpeg binary is available
  if (!ffmpegPath) {
    throw new Error(
      "FFmpeg binary not found. Please ensure ffmpeg-static is properly installed."
    );
  }

  // Step 4: Execute FFmpeg with proper error handling
  try {
    await exec(
      ffmpegPath,
      [
        "-y", // overwrite output file if it exists
        "-i",
        input, // specify input file
        "-vf",
        `scale=-2:${height}`, // video filter: scale to height, auto-width (even number)
        "-c:v",
        "libx264", // video codec: H.264 (widely supported)
        "-preset",
        "fast", // encoding speed/quality trade-off
        "-movflags",
        "faststart", // optimize for web streaming
        output, // output file path
      ],
      {
        maxBuffer: 10 * 1024 * 1024, // 10 MB buffer for stdout/stderr
        timeout: 5 * 60 * 1000, // 5 minute timeout for very large files
      }
    );
  } catch (error: any) {
    // Provide detailed error information for debugging
    const errorMessage =
      error.stderr || error.message || "Unknown FFmpeg error";
    throw new Error(`Video processing failed: ${errorMessage}`);
  }
}
