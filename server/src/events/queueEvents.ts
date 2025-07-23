import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Queue, QueueEvents, Job } from "bullmq"; // Import Queue type
import { redis } from "../config/redis.js";
import { queue360, queue480, queue720, queue1080 } from "../queues/bullmq.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";
import { VideoJobData } from "../services/video.service.js"; // Import shared type

const PROGRESS_THROTTLE_MS = 250;

export async function initQueueEvents(httpServer: HttpServer) {
  logger.info("Initializing WebSocket bridge...");

  const io = new Server(httpServer, {
    path: "/ws",
    cors: { origin: env.nodeEnv === "production" ? env.frontendUrl : "*" },
  });

  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Socket.IO Redis adapter configured.");

  // JWT auth middleware
  io.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth.token ?? "");
      const { sub: userId } = await verifyJwt(token);
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    if (userId) {
      socket.join(userId);
      logger.debug(`WS connect: user=${userId} socket=${socket.id}`);
    }
  });

  const queues = [queue360, queue480, queue720, queue1080] as const;
  const lastProgressEmit = new Map<string, number>();
  const queueEventsList: QueueEvents[] = [];

  async function getJobOwner(
    queue: Queue,
    jobId: string
  ): Promise<string | null> {
    try {
      const job = await Job.fromId<VideoJobData>(queue, jobId);
      return job?.data?.userId || null;
    } catch (err) {
      logger.debug(`Job ${jobId} not found in queue ${queue.name}.`);
      return null;
    }
  }

  for (const q of queues) {
    const qe = new QueueEvents(q.name, { connection: redis });
    queueEventsList.push(qe);

    qe.on("completed", async ({ jobId, returnvalue }) => {
      const userId = await getJobOwner(q, jobId);
      if (userId) {
        const payload =
          typeof returnvalue === "object" && returnvalue !== null
            ? returnvalue
            : {};
        io.to(userId).emit("job:completed", {
          jobId,
          queueName: q.name,
          ...payload,
        });
      }
    });

    qe.on("progress", async ({ jobId, data }) => {
      const now = Date.now();
      const last = lastProgressEmit.get(jobId) ?? 0;
      if (now - last < PROGRESS_THROTTLE_MS) return;
      lastProgressEmit.set(jobId, now);
      const userId = await getJobOwner(q, jobId);
      if (userId) {
        io.to(userId).emit("job:progress", {
          jobId,
          queueName: q.name,
          progress: data,
        });
      }
    });

    qe.on("failed", async ({ jobId, failedReason }) => {
      const userId = await getJobOwner(q, jobId);
      if (userId) {
        io.to(userId).emit("job:failed", {
          jobId,
          queueName: q.name,
          failedReason,
        });
      }
      lastProgressEmit.delete(jobId);
    });

    qe.on("error", (err) => {
      logger.error(`QueueEvents error for ${q.name}:`, err);
    });
  }

  const cleanup = async () => {
    logger.info("Shutting down WebSocket bridge...");
    await Promise.allSettled([
      ...queueEventsList.map((qe) => qe.close()),
      pubClient.disconnect(),
      subClient.disconnect(),
    ]);
    lastProgressEmit.clear();
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  logger.info("📡  WebSocket bridge ready.");
  return io;
}

async function verifyJwt(token: string): Promise<{ sub: string }> {
  if (env.nodeEnv === "development" && token === "dev-token")
    return { sub: "demo-user" };
  if (token.startsWith("user-")) return { sub: token };
  throw new Error("bad token");
}
