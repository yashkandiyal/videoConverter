// src/services/video.service.ts
/**
 * Video job orchestration layer (multi-queue, single requested resolution).
 *
 * User picks ONE output resolution (360 | 480 | 720).
 * We enqueue a single job into the matching queue:
 *   360p  -> queue360.queue  (BullMQ queue "video_360p")
 *   480p  -> queue480.queue  (BullMQ queue "video_480p")
 *   720p  -> queue720.queue  (BullMQ queue "video_720p")
 *
 * No parent/child flow is created. Simpler. Faster. Perfect for your current product.
 * You can later add multi-resolution fan-out by reintroducing FlowProducer.
 */

import type { Job } from "bullmq";
import { queue360, queue480, queue720 } from "../queues/bullmq.js";
import { logger } from "../utils/logger.js";

/* ------------------------------------------------------------------
   1. Supported resolutions
------------------------------------------------------------------ */
export const ALLOWED_RESOLUTIONS = [360, 480, 720] as const;
export type AllowedRes = (typeof ALLOWED_RESOLUTIONS)[number];

/**
 * If you want different *job-level* options per resolution (timeouts, attempts),
 * configure them here and we’ll apply them when we enqueue.
 *
 * Why? 720p encodes usually take longer than 360p. You may want:
 *   - higher timeout
 *   - more attempts
 *   - different backoff
 */
interface QueueJobOpts {
  attempts: number;
  timeoutMs: number;
  backoffDelayMs: number;
}
const RES_JOB_OPTS: Record<AllowedRes, QueueJobOpts> = {
  360: { attempts: 3, timeoutMs: 10 * 60 * 1_000, backoffDelayMs: 5_000 }, // 10 min
  480: { attempts: 3, timeoutMs: 20 * 60 * 1_000, backoffDelayMs: 5_000 }, // 20 min
  720: { attempts: 4, timeoutMs: 30 * 60 * 1_000, backoffDelayMs: 10_000 }, // heavier workload
};

/* ------------------------------------------------------------------
   2. Resolution → Queue mapping
       (We only import .queue; .scheduler is initialized in bullmq.ts)
------------------------------------------------------------------ */
import type { Queue } from "bullmq";
const RES_TO_QUEUE: Record<AllowedRes, Queue> = {
  360: queue360,
  480: queue480,
  720: queue720,
};

/* ------------------------------------------------------------------
   3. Public args & result types
------------------------------------------------------------------ */
export interface EnqueueVideoArgs {
  /** Cloudinary secure URL to the ORIGINAL uploaded video. */
  srcUrl: string;
  /** Auth user ID / tenant key / owner. */
  userId: string;
  /** Requested resolution (user input — validated). */
  resolution: number;
  /** Optional bag of metadata (original filename, upload source, etc.) */
  jobMeta?: Record<string, unknown>;
}

export interface EnqueueVideoResult {
  jobId: string;
  resolution: AllowedRes;
  queueName: string;
}

/* ------------------------------------------------------------------
   4. Validation + job name helpers
------------------------------------------------------------------ */
export function validateResolution(r: number): AllowedRes {
  if (!ALLOWED_RESOLUTIONS.includes(r as AllowedRes)) {
    throw new Error(
      `Unsupported resolution "${r}". Allowed: ${ALLOWED_RESOLUTIONS.join(
        ", "
      )}.`
    );
  }
  return r as AllowedRes;
}

/** Friendly job name shown in BullMQ UIs. */
function buildJobName(res: AllowedRes): string {
  return `scale:${res}`;
}

/* ------------------------------------------------------------------
   5. Enqueue a single job to the correct queue
------------------------------------------------------------------ */
export async function enqueueVideoTranscode(
  args: EnqueueVideoArgs
): Promise<EnqueueVideoResult> {
  const { srcUrl, userId, resolution, jobMeta = {} } = args;

  // validate & map
  const cleanRes = validateResolution(resolution);
  const queue = RES_TO_QUEUE[cleanRes];
  const { attempts, timeoutMs, backoffDelayMs } = RES_JOB_OPTS[cleanRes];

  // add job
  const job = await queue.add(
    buildJobName(cleanRes),
    {
      srcUrl,
      target: cleanRes,
      userId,
      requestedAt: Date.now(),
      ...jobMeta,
    },
    {
      attempts,
      backoff: { type: "exponential", delay: backoffDelayMs },
      timeout: timeoutMs,
      // Per-job cleanup? optional; queue has defaults set in bullmq.ts
      // removeOnComplete: { age: 86400 },
      // removeOnFail:     { age: 604800 },
                }
  );

  logger.info(
    `Queued transcode job=${job.id} res=${cleanRes} user=${userId} queue=${queue.name}`
  );

  return {
    jobId: job.id as string,
    resolution: cleanRes,
    queueName: queue.name,
  };
}

/* ------------------------------------------------------------------
   6. Status helpers
   Because we have 3 queues, callers must tell us the resolution (or queueName).
   We'll provide 3 access patterns:
     A) getStatusByRes(res, jobId)  ← simplest, if caller knows res
     B) getStatusByQueue(queueName, jobId)
     C) bruteForceGetStatus(jobId)  ← try all queues (slow; admin only)
------------------------------------------------------------------ */

export interface VideoJobStatus {
  jobId: string;
  resolution?: AllowedRes; // known if using getStatusByRes
  queueName: string;
  state: Awaited<Job["getState"]>;
  progress: number | object;
  result?: { resizedUrl: string; target: number } | unknown;
  error?: string;
  data?: unknown; // original job.data
}

/* ---------- A) Fast path: you know the resolution ---------- */
export async function getVideoJobStatusByRes(
  resolution: number,
  jobId: string
): Promise<VideoJobStatus | null> {
  let clean: AllowedRes;
  try {
    clean = validateResolution(resolution);
  } catch {
    return null;
  }
  const queue = RES_TO_QUEUE[clean];
  return getVideoJobStatusFromQueue(queue, jobId, clean);
}

/* ---------- B) If you stored queueName with jobId ---------- */
export async function getVideoJobStatusByQueue(
  queueName: string,
  jobId: string
): Promise<VideoJobStatus | null> {
  const queue = Object.values(RES_TO_QUEUE).find((q) => q.name === queueName);
  if (!queue) return null;
  return getVideoJobStatusFromQueue(queue, jobId);
}

/* ---------- C) Brute-force (try all queues) ---------- */
export async function getVideoJobStatusAnyQueue(
  jobId: string
): Promise<VideoJobStatus | null> {
  for (const [res, queue] of Object.entries(RES_TO_QUEUE) as [
    string,
    Queue
  ][]) {
    const status = await getVideoJobStatusFromQueue(
      queue,
      jobId,
      Number(res) as AllowedRes
    );
    if (status) return status;
  }
  return null;
}

/* ---------- core status helper ---------- */
async function getVideoJobStatusFromQueue(
  queue: Queue,
  jobId: string,
  resHint?: AllowedRes
): Promise<VideoJobStatus | null> {
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState(); // waiting | active | completed | failed | delayed | paused
  const progress = job.progress;
  const result = job.returnvalue;
  const error = job.failedReason;

  // Try to derive resolution if not provided
  let resolution = resHint;
  if (!resolution) {
    // Attempt from job.data.target if available
    const tgt = (job.data as any)?.target;
    if (ALLOWED_RESOLUTIONS.includes(tgt)) resolution = tgt as AllowedRes;
  }

  return {
    jobId,
    resolution,
    queueName: queue.name,
    state,
    progress,
    result: state === "completed" ? result : undefined,
    error: state === "failed" ? error : undefined,
    data: job.data,
  };
}

/* ------------------------------------------------------------------
   7. Remove / cancel job (before it runs)
------------------------------------------------------------------ */
export async function removeVideoJobByRes(
  resolution: number,
  jobId: string
): Promise<boolean> {
  let clean: AllowedRes;
  try {
    clean = validateResolution(resolution);
  } catch {
    return false;
  }
  const queue = RES_TO_QUEUE[clean];
  const job = await queue.getJob(jobId);
  if (!job) return false;
  await job.remove();
  logger.warn(`Removed job=${jobId} from queue=${queue.name}`);
  return true;
}
