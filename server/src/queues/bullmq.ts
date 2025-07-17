// here we wire BullMQ to the Redis connection we just created. From now on every job, retry, and event flows through these objects
import { Queue, FlowProducer } from "bullmq";
import { redis } from "../config/redis";

function makeQueuePair(
  name: string,
  options?: {
    retries?: number;
    retentionDays?: number;
    retentionCount?: number;
  }
) {
  const queue = new Queue(name, {
    connection: redis,
    defaultJobOptions: {
      attempts: options?.retries ?? 3, // How many times to try a job before giving up
      removeOnComplete: {
        age: (options?.retentionDays ?? 1) * 86_400, //Delete completed jobs older than X days (default 1 day)
        count: options?.retentionCount ?? 1_000, //Keep maximum X completed jobs (default 1,000)
      },
      /*
      Example scenario:

    You process 500 videos today
    Tomorrow, all 500 get deleted (age limit)
    If you process 1,200 videos in one day, the oldest 200 get deleted immediately (count limit)
      */
      removeOnFail: { age: 604_800 }, //Keep failed jobs for 7 days (604_800 seconds)
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  });

  return queue;
}

// Export the queues for different video resolutions

/*
What each queue does:

queue360/480/720: Each handles one specific resolution based on user's choice

Why separate queues?

Independent scaling: You can run 10 workers for 360p but only 2 for 720p
Resource management: 720p jobs use more CPU/memory
Monitoring: Track performance per resolution type
Failure isolation: If 720p processing breaks, 360p still works
Different retry strategies: 720p might need more retries due to complexity*/

export const queue360 = makeQueuePair("video_360p", {
  retries: 2, // 360p is lightweight, fail faster
  retentionCount: 2000, // Can keep more (smaller jobs)
});

export const queue480 = makeQueuePair("video_480p", {
  retries: 3, // Standard retry
  retentionCount: 1500,
});

export const queue720 = makeQueuePair("video_720p", {
  retries: 5, // 720p is resource-intensive, try harder
  retentionDays: 2, // Keep successful jobs longer for debugging
  retentionCount: 500, // Keep fewer (larger jobs)
});

// FlowProducer for orchestrating complex workflows (future use)
// Currently not needed for single-resolution processing, but kept for future features
export const videoFlow = new FlowProducer({ connection: redis });

// Type definitions for better type safety
export type VideoResolution = "360p" | "480p" | "720p";

export interface VideoJobData {
  videoId: string;
  userId: string;
  inputPath: string;
  outputPath: string;
  resolution: VideoResolution;
}

// Helper function to route jobs to the correct queue based on resolution
export function addVideoProcessingJob(jobData: VideoJobData) {
  const { resolution, ...data } = jobData;

  switch (resolution) {
    case "360p":
      return queue360.add("processVideo", data);
    case "480p":
      return queue480.add("processVideo", data);
    case "720p":
      return queue720.add("processVideo", data);
    default:
      throw new Error(`Unsupported resolution: ${resolution}`);
  }
}
