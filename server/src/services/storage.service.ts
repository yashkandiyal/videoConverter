/**
 * Cloudinary version of the storage helper.
 *  • uploadFile → local disk  ➜  Cloudinary (returns secure URL & public ID)
 *  • downloadFile → Cloudinary URL ➜ local disk
 *  • deleteFile → removes file from Cloudinary
 *  • cleanupTempFile → removes temporary local files
 */
import { createWriteStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join, basename } from "node:path";
import https from "node:https";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// 1. SDK config (runs once)

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

// 2. Upload local file → Cloudinary

export async function uploadFile(
  localPath: string,
  publicId: string
): Promise<{ url: string; publicId: string }> {
  if (!localPath || !publicId) {
    throw new Error("Both localPath and publicId are required");
  }
  const fileStats = await stat(localPath);
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (fileStats.size > maxSize) {
    throw new Error(
      `File too large: ${fileStats.size} bytes. Max: ${maxSize} bytes`
    );
  }

  try {
    const res: UploadApiResponse = await cloudinary.uploader.upload(localPath, {
      resource_type: "video",
      public_id: publicId,
      overwrite: true,
      timeout: 120000,
      chunk_size: 6000000,
      quality: "auto",
      format: "mp4",
    });

    logger.info(
      `⬆️  ${basename(localPath)} (${fileStats.size} bytes) → ${res.secure_url}`
    );

    return { url: res.secure_url, publicId: res.public_id };
  } catch (error: any) {
    logger.error(`Upload failed for ${localPath}:`, error.message);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
}

// 3. Download HTTPS URL → temp file

export async function downloadFile(cloudUrl: string): Promise<string> {
  if (!cloudUrl || !cloudUrl.startsWith("https://")) {
    throw new Error("Valid HTTPS URL is required");
  }
  const fileName = basename(cloudUrl);
  const localPath = join(tmpdir(), `${randomUUID()}_${fileName}`);

  try {
    await new Promise<void>((resolve, reject) => {
      const request = https.get(cloudUrl, (res) => {
        if (res.statusCode !== 200) {
          return reject(
            new Error(`Download failed with status ${res.statusCode}`)
          );
        }
        pipeline(res, createWriteStream(localPath)).then(resolve).catch(reject);
      });
      request.on("error", reject);
      request.setTimeout(60000, () => {
        request.destroy();
        reject(new Error("Download timeout"));
      });
    });

    logger.info(`⬇️  ${cloudUrl} → ${localPath}`);
    return localPath;
  } catch (error: any) {
    logger.error(`Download failed for ${cloudUrl}:`, error.message);
    await cleanupTempFile(localPath).catch(() => {});
    throw new Error(`File download failed: ${error.message}`);
  }
}

// 4. Delete file from Cloudinary

export async function deleteFile(publicId: string): Promise<void> {
  if (!publicId) {
    logger.warn("Attempted to delete file without a public ID.");
    return;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "video",
    });

    if (result.result !== "ok") {
      logger.warn(
        `Cloudinary deletion for ${publicId} returned: ${result.result}`
      );
    } else {
      logger.info(`🗑️  Deleted from Cloudinary: ${publicId}`);
    }
  } catch (error: any) {
    logger.error(`Cloudinary delete failed for ${publicId}:`, error.message);
  }
}

// 5. Clean up local temp files
export async function cleanupTempFile(localPath: string): Promise<void> {
  try {
    await unlink(localPath);
    logger.info(`🧹 Cleaned up temp file: ${basename(localPath)}`);
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      logger.warn(`Failed to cleanup temp file ${localPath}: ${error.message}`);
    }
  }
}

// 6. Helper to get file info from Cloudinary
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
    throw new Error(
      `Failed to get file info for ${publicId}: ${error.message}`
    );
  }
}
