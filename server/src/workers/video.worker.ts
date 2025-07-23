import { Worker, Job } from "bullmq";
import { redis } from "../config/redis.js";
import {
  downloadFile,
  uploadFile,
  deleteFile,
  cleanupTempFile,
} from "../services/storage.service.js";
import { convertResolution } from "../jobs/video.processor.js";
import { logger } from "../utils/logger.js";
import { tmpdir } from "node:os";
import { join, basename, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { RES_JOB_OPTS, VideoJobData } from "../services/video.service.js";

//1) Queue configuration

const QUEUE_NAME_TO_RES: Record<string, number> = {
  video_360p: 360,
  video_480p: 480,
  video_720p: 720,
  video_1080p: 1080,
};

const QUEUE_NAME = process.env.QUEUE_NAME || process.argv[2];
const resFromQueue = QUEUE_NAME_TO_RES[QUEUE_NAME ?? ""];

if (!QUEUE_NAME || !resFromQueue) {
  console.error(
    "❌  QUEUE_NAME missing or unknown. Set env QUEUE_NAME=video_480p (etc.)"
  );
  process.exit(1);
}

logger.info(`👷 Worker starting for queue=${QUEUE_NAME}`);

const { timeoutMs } = RES_JOB_OPTS[resFromQueue as keyof typeof RES_JOB_OPTS];
const concurrency = Number(process.env.WORKER_CONCURRENCY) || 2;

// 2. Worker Processing Logic

const worker = new Worker<VideoJobData>(
  QUEUE_NAME,
  async (job: Job<VideoJobData>) => {
    let localIn: string | undefined;
    let localOut: string | undefined;

    try {
      // Get all necessary data from the job payload.
      const { srcUrl, target, userId, originalPublicId } = job.data;

      // --- Stage 1: Downloading ---
      await job.updateProgress({
        stage: "downloading",
        message: "Receiving your video...",
        progress: 5,
      });
      localIn = await downloadFile(srcUrl);

      // --- Stage 2: Processing ---
      await job.updateProgress({
        stage: "processing",
        message: "Preparing engine...",
        progress: 10,
      });
      const base = basename(localIn, extname(localIn));
      const outName = `${base}_${target}p.mp4`;
      localOut = join(tmpdir(), `${randomUUID()}_${outName}`);

      const onProgress = (pct: number) => {
        job.updateProgress({
          stage: "processing",
          message: `Optimizing frames (${Math.round(pct)}%)...`,
          progress: 10 + pct * 0.8,
        });
      };

      await convertResolution(localIn, localOut, target, onProgress);

      // --- Stage 3: Uploading New Video ---
      await job.updateProgress({
        stage: "uploading",
        message: "Uploading your new video...",
        progress: 95,
      });
      const publicIdResized = `resized/${userId}/${Date.now()}_${target}p`;
      const { url: resizedUrl } = await uploadFile(localOut, publicIdResized);

      // --- Stage 4: Deleting Original Video ---
      if (originalPublicId) {
        await job.updateProgress({
          stage: "cleanup",
          message: "Cleaning up original file...",
          progress: 98,
        });
        await deleteFile(originalPublicId);
      } else {
        logger.warn(
          `Job ${job.id} is missing an originalPublicId. Skipping deletion.`
        );
      }

      await job.updateProgress({
        stage: "completed",
        message: "All done!",
        progress: 100,
      });

      return { resizedUrl, target };
    } finally {
      // This block ensures local temp files are always deleted, even if the job fails.
      if (localIn) await cleanupTempFile(localIn);
      if (localOut) await cleanupTempFile(localOut);
    }
  },
  {
    connection: redis,
    concurrency,
    lockDuration: timeoutMs + 60_000,
  }
);

// 3. Event Listeners & Graceful Shutdown

worker.on("completed", (job) =>
  logger.info(`✅ Job ${job.id} completed for user ${job.data.userId}`)
);
worker.on("failed", (job, err) =>
  logger.error(
    `❌ Job ${job?.id} failed for user ${job?.data.userId} – ${err.message}`
  )
);
process.on("SIGINT", async () => {
  logger.info("👋  Worker shutting down – waiting for active job to finish…");
  await worker.close();
  process.exit(0);
});
