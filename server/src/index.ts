// /server/src/index.ts

import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { initQueueEvents } from "./events/queueEvents.js";
import { app } from "./app.js";
import { Server } from "socket.io";
import { Server as HttpServer } from "http";

let isShuttingDown = false;

// FIX: Listen on '0.0.0.0' to be accessible within a Docker environment.
// Render will forward traffic from the public internet to this port.
const server: HttpServer = app.listen(env.port, "0.0.0.0", () => {
  logger.info(
    `🚀 API listening on http://0.0.0.0:${env.port} (${env.nodeEnv})`
  );
});

// Handle server startup errors
server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    logger.error(`Port ${env.port} is already in use`);
  } else {
    logger.error("Server startup error:", err);
  }
  process.exit(1);
});

let io: Server | null = null;

// Initialize the WebSocket bridge and other async services.
(async () => {
  try {
    io = await initQueueEvents(server);
    logger.info("✅  Application fully initialized");
  } catch (err) {
    logger.error("Failed to initialise WebSocket bridge:", err);
    process.exit(1);
  }
})();

// Graceful shutdown logic (this is excellent and remains largely the same)
const gracefulExit = async (signal: string, code = 0) => {
  if (isShuttingDown) {
    logger.warn(`Already shutting down, forcing exit...`);
    process.exit(code);
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    if (io) {
      logger.info("Closing WebSocket connections...");
      await new Promise<void>((resolve) => {
        io?.close(() => {
          logger.info("WebSocket bridge closed");
          resolve();
        });
      });
    }

    logger.info("Closing HTTP server...");
    await new Promise<void>((resolve, reject) => {
      server.close((err: Error | undefined) => {
        if (err) return reject(err);
        logger.info("HTTP server closed");
        resolve();
      });
    });

    clearTimeout(forceExitTimer);
    logger.info("✅  Graceful shutdown complete");
    process.exit(code);
  } catch (err) {
    logger.error("Error during graceful shutdown:", err);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};

// Signal handlers for graceful shutdown
process.on("SIGINT", () => gracefulExit("SIGINT"));
process.on("SIGTERM", () => gracefulExit("SIGTERM"));

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at promise", { promise, reason });
  gracefulExit("unhandledRejection", 1);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  gracefulExit("uncaughtException", 1);
});
