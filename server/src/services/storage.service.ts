// src/services/storage.service.ts
/**
 * Cloudinary version of the storage helper.
 *  • uploadFile → local disk  ➜  Cloudinary (returns secure URL)
 *  • downloadFile → Cloudinary URL ➜ local disk
 *  • deleteFile → removes file from Cloudinary
 *  • cleanup → removes temporary local files
 */
import { createWriteStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join, basename, extname } from "node:path";
import https from "node:https";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { logger } from "../utils/logger";

/* -------- 1. SDK config (runs once) ---------------- */
cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

/* -------- 2. Upload local file → Cloudinary -------- */
export async function uploadFile(
  localPath: string,
  publicId: string // folder/filename WITHOUT extension
): Promise<string> {
  // Validate inputs
  if (!localPath || !publicId) {
    throw new Error("Both localPath and publicId are required");
  }

  // Check if file exists and get its size
  let fileStats;
  try {
    fileStats = await stat(localPath);
  } catch (error) {
    throw new Error(`Local file not found: ${localPath}`);
  }

  // Check file size (Cloudinary free tier has limits)
  const maxSize = 100 * 1024 * 1024; // 100MB limit
  if (fileStats.size > maxSize) {
    throw new Error(
      `File too large: ${fileStats.size} bytes. Maximum allowed: ${maxSize} bytes`
    );
  }

  try {
    /**
     * cloudinary.uploader.upload returns:
     * { secure_url: 'https://res.cloudinary.com/…/video/upload/...mp4', ... }
     */
    const res = await cloudinary.uploader.upload(localPath, {
      resource_type: "video",
      public_id: publicId, // e.g. "original/1700000000_myClip"
      overwrite: true,
      timeout: 120000, // 2 minute timeout
      chunk_size: 6000000, // 6MB chunks for large files
      quality: "auto", // Let Cloudinary optimize
      format: "mp4", // Ensure consistent format
    });

    logger.info(
      `⬆️  ${basename(localPath)} (${fileStats.size} bytes) → ${res.secure_url}`
    );
    return res.secure_url; // use HTTPS URL as our "srcUrl"
  } catch (error: any) {
    logger.error(`Upload failed for ${localPath}:`, error.message);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
}

/* -------- 3. Download HTTPS URL → temp file -------- */
export async function downloadFile(cloudUrl: string): Promise<string> {
  if (!cloudUrl || !cloudUrl.startsWith("https://")) {
    throw new Error("Valid HTTPS URL is required");
  }

  const fileName = basename(cloudUrl); // e.g. abc.mp4
  const localPath = join(tmpdir(), `${randomUUID()}_${fileName}`);

  try {
    await new Promise<void>((resolve, reject) => {
      const request = https.get(cloudUrl, (res) => {
        if (res.statusCode !== 200) {
          return reject(
            new Error(
              `Failed to download ${cloudUrl} – status ${res.statusCode}`
            )
          );
        }

        const fileStream = createWriteStream(localPath);

        pipeline(res, fileStream)
          .then(() => resolve())
          .catch(reject);
      });

      request.on("error", reject);
      request.setTimeout(60000, () => {
        // 1 minute timeout
        request.destroy();
        reject(new Error("Download timeout"));
      });
    });

    logger.info(`⬇️  ${cloudUrl} → ${localPath}`);
    return localPath;
  } catch (error: any) {
    logger.error(`Download failed for ${cloudUrl}:`, error.message);
    // Clean up partial file if it exists
    try {
      await unlink(localPath);
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(`File download failed: ${error.message}`);
  }
}

/* -------- 4. Delete file from Cloudinary -------- */
export async function deleteFile(publicId: string): Promise<void> {
  if (!publicId) {
    throw new Error("Public ID is required");
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "video",
    });

    if (result.result !== "ok") {
      throw new Error(`Delete failed: ${result.result}`);
    }

    logger.info(`🗑️  Deleted from Cloudinary: ${publicId}`);
  } catch (error: any) {
    logger.error(`Delete failed for ${publicId}:`, error.message);
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
}

/* -------- 5. Clean up local temp files -------- */
export async function cleanupTempFile(localPath: string): Promise<void> {
  try {
    await unlink(localPath);
    logger.info(`🧹 Cleaned up temp file: ${basename(localPath)}`);
  } catch (error: any) {
    // Don't throw - cleanup failures shouldn't break the main flow
    logger.warn(`Failed to cleanup temp file ${localPath}: ${error.message}`);
  }
}

/* -------- 6. Helper to get file info from Cloudinary -------- */
export async function getFileInfo(publicId: string): Promise<{
  url: string;
  size: number;
  format: string;
  duration?: number;
}> {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: "video",
    });

    return {
      url: result.secure_url,
      size: result.bytes,
      format: result.format,
      duration: result.duration,
    };
  } catch (error: any) {
    throw new Error(`Failed to get file info: ${error.message}`);
  }
}
int 
