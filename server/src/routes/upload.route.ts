import { Request, Response, NextFunction, Router } from "express";
import multer from "multer";
import { uploadFile, cleanupTempFile } from "../services/storage.service.js";
import {
  enqueueVideoTranscode,
  validateResolution,
  VideoJobData,
  EnqueueVideoArgs,
} from "../services/video.service.js";
import { logger } from "../utils/logger.js";

const upload = multer({
  dest: "/tmp",
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1, // Only allow single file upload
  },
  fileFilter: (req, file, cb) => {
    // Validate file type
    const allowedTypes = [
      "video/mp4",
      "video/avi",
      "video/mov",
      "video/wmv",
      "video/flv",
      "video/webm",
      "video/mkv",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type. Only video files are allowed."));
    }

    // Validate file extension as additional security
    const allowedExtensions = [
      ".mp4",
      ".avi",
      ".mov",
      ".wmv",
      ".flv",
      ".webm",
      ".mkv",
    ];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf("."));

    if (!allowedExtensions.includes(fileExtension)) {
      return cb(new Error("Invalid file extension."));
    }

    cb(null, true);
  },
});

export const uploadRouter = Router();

const handleMulterError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          error: "File too large. Maximum size is 100MB.",
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          error: "Too many files. Only one file allowed.",
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          error: 'Unexpected field name. Use "file" as the field name.',
        });
      default:
        return res.status(400).json({
          error: "File upload error.",
        });
    }
  }

  if (
    err.message.includes("Invalid file type") ||
    err.message.includes("Invalid file extension")
  ) {
    return res.status(400).json({ error: err.message });
  }

  next(err);
};

uploadRouter.post(
  "/",
  upload.single("file"),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    let uploadedFileUrl: string | null = null;
    let originalPublicId: string | null = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file was found in the request.",
        });
      }

      const { resolution: rawRes } = req.body;
      if (!rawRes) {
        return res.status(400).json({
          error: "Field 'resolution' is required.",
        });
      }

      const parsedResolution = Number(rawRes);
      if (isNaN(parsedResolution)) {
        return res.status(400).json({
          error: "Resolution must be a valid number.",
        });
      }

      let resolution: number;
      try {
        resolution = validateResolution(parsedResolution);
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Invalid resolution.",
        });
      }

      const userId = "demo-user"; // Replace with real auth

      const timestamp = Date.now();
      const filePath = `original/${userId}/${timestamp}`;

      logger.info(
        `Starting upload: user=${userId}, file=${req.file.originalname}, size=${req.file.size}bytes`
      );

      try {
        const uploadResult = await uploadFile(req.file.path, filePath);
        uploadedFileUrl = uploadResult.url;
        originalPublicId = uploadResult.publicId;
      } catch (error) {
        logger.error(`Upload failed: ${error}`);
        return res.status(500).json({
          error: "Failed to upload file to storage.",
        });
      }

      const enqueueArgs: EnqueueVideoArgs = {
        srcUrl: uploadedFileUrl,
        userId,
        resolution,
        originalPublicId,
        jobMeta: {
          originalFilename: req.file.originalname,
          fileSize: req.file.size,
          uploadTimestamp: timestamp,
        },
      };

      let jobId: string;
      let queueName: string;
      try {
        const jobResult = await enqueueVideoTranscode(enqueueArgs);
        jobId = jobResult.jobId;
        queueName = jobResult.queueName;
      } catch (error) {
        logger.error(`Failed to enqueue transcoding job: ${error}`);

        if (uploadedFileUrl && originalPublicId) {
          try {
            logger.warn(
              `Upload succeeded but job enqueueing failed. File may need manual cleanup: ${originalPublicId}`
            );
          } catch (cleanupError) {
            logger.error(
              `Failed to cleanup uploaded file after job enqueue failure: ${cleanupError}`
            );
          }
        }

        return res.status(500).json({
          error: "Failed to process video transcoding request.",
        });
      }

      logger.info(
        `Upload successful: user=${userId} res=${resolution} file=${req.file.originalname} -> job=${jobId} (${queueName})`
      );

      return res.status(202).json({
        jobId,
        queueName,
        resolution,
        srcUrl: uploadedFileUrl,
        originalFilename: req.file.originalname,
        message: "File uploaded successfully and transcoding job queued.",
      });
    } catch (error) {
      logger.error(`Unexpected error in upload route: ${error}`);

      if (uploadedFileUrl && originalPublicId) {
        logger.warn(
          `Unexpected error occurred after successful upload. File may need cleanup: ${originalPublicId}`
        );
      }

      next(error);
    } finally {
      // Always cleanup the temporary file
      if (req.file?.path) {
        try {
          await cleanupTempFile(req.file.path);
          logger.debug(`Cleaned up temporary file: ${req.file.path}`);
        } catch (cleanupError) {
          logger.error(
            `Failed to cleanup temporary file ${req.file.path}: ${cleanupError}`
          );
        }
      }
    }
  }
);

// Health check endpoint for the upload service
uploadRouter.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    service: "upload",
    timestamp: new Date().toISOString(),
  });
});
