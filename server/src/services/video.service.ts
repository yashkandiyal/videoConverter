import { Job, JobsOptions, Queue } from "bullmq";
import { queue360, queue480, queue720, queue1080 } from "../queues/bullmq.js";
import { logger } from "../utils/logger.js";

// 1. Supported resolutions and Types
export const ALLOWED_RESOLUTIONS = [360, 480, 720] as const;
export type AllowedRes = (typeof ALLOWED_RESOLUTIONS)[number];

export interface VideoJobData {
  srcUrl: string;
  target: AllowedRes;
  userId: string;
  requestedAt: number;
  originalPublicId: string;
  [key: string]: unknown;
}

interface QueueJobOpts {
  attempts: number;
  timeoutMs: number;
  backoffDelayMs: number;
}

export const RES_JOB_OPTS: Record<AllowedRes, QueueJobOpts> = {
  360: { attempts: 3, timeoutMs: 10 * 60 * 1_000, backoffDelayMs: 5_000 },
  480: { attempts: 3, timeoutMs: 20 * 60 * 1_000, backoffDelayMs: 5_000 },
  720: { attempts: 4, timeoutMs: 30 * 60 * 1_000, backoffDelayMs: 10_000 },
};

// 2. Resolution → Queue mapping
const RES_TO_QUEUE: Record<AllowedRes, Queue> = {
  360: queue360,
  480: queue480,
  720: queue720,
};

// 3. Public args & result types
export interface EnqueueVideoArgs {
  srcUrl: string;
  userId: string;
  resolution: number;
  originalPublicId: string;
  jobMeta?: Record<string, unknown>;
}

export interface EnqueueVideoResult {
  jobId: string;
  resolution: AllowedRes;
  queueName: string;
}

// 4. Validation + job name helpers
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

function buildJobName(res: AllowedRes, userId: string): string {
  return `transcode:${res}p:${userId}`;
}

// 5. Enqueue a single job to the correct queue
export async function enqueueVideoTranscode(
  args: EnqueueVideoArgs
): Promise<EnqueueVideoResult> {
  const { srcUrl, userId, resolution, originalPublicId, jobMeta = {} } = args;

  const cleanRes = validateResolution(resolution);
  const queue = RES_TO_QUEUE[cleanRes];
  const { attempts, backoffDelayMs } = RES_JOB_OPTS[cleanRes];

  const jobData: VideoJobData = {
    srcUrl,
    target: cleanRes,
    userId,
    requestedAt: Date.now(),
    originalPublicId,
    ...jobMeta,
  };

  const jobOptions: JobsOptions = {
    attempts,
    backoff: { type: "exponential", delay: backoffDelayMs },
    removeOnComplete: { age: 3600 * 24, count: 1000 },
    removeOnFail: { age: 3600 * 24 * 7 },
  };

  const job = await queue.add(
    buildJobName(cleanRes, userId),
    jobData,
    jobOptions
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

// 6. Status helpers
export interface VideoJobStatus {
  jobId: string;
  resolution?: AllowedRes;
  queueName: string;
  state: Awaited<Job["getState"]>;
  progress: number | object;
  result?: unknown;
  error?: string;
  data?: VideoJobData;
}

export async function getVideoJobStatusByRes(
  resolution: number,
  jobId: string
): Promise<VideoJobStatus | null> {
  const cleanRes = validateResolution(resolution);
  const queue = RES_TO_QUEUE[cleanRes];
  return getVideoJobStatusFromQueue(queue, jobId, cleanRes);
}

export async function getVideoJobStatusAnyQueue(
  jobId: string
): Promise<VideoJobStatus | null> {
  for (const [res, queue] of Object.entries(RES_TO_QUEUE)) {
    const status = await getVideoJobStatusFromQueue(
      queue,
      jobId,
      Number(res) as AllowedRes
    );
    if (status) return status;
  }
  return null;
}

async function getVideoJobStatusFromQueue(
  queue: Queue,
  jobId: string,
  resHint?: AllowedRes
): Promise<VideoJobStatus | null> {
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const jobData = job.data as VideoJobData;
  const resolution = resHint || jobData.target;

  return {
    jobId,
    resolution,
    queueName: queue.name,
    state,
    progress: job.progress,
    result: state === "completed" ? job.returnvalue : undefined,
    error: state === "failed" ? job.failedReason : undefined,
    data: jobData,
  };
}

// 7. Remove / cancel job
export async function removeVideoJobByRes(
  resolution: number,
  jobId: string
): Promise<boolean> {
  const cleanRes = validateResolution(resolution);
  const queue = RES_TO_QUEUE[cleanRes];
  const job = await queue.getJob(jobId);
  if (!job) return false;
  await job.remove();
  logger.warn(`Removed job=${jobId} from queue=${queue.name}`);
  return true;
}
