import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { initQueueEvents } from "./events/queueEvents.js";
import { app } from "./app.js";

let isShuttingDown = false;

const server = app.listen(env.port, () => {
  logger.info(
    `🚀  API listening on http://localhost:${env.port} (${env.nodeEnv})`
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

let io: any = null;

(async () => {
  try {
    io = await initQueueEvents(server);
    logger.info("✅  Application fully initialized");
  } catch (err) {
    logger.error("Failed to initialise WebSocket bridge:", err);
    process.exit(1);
  }
})();

const gracefulExit = async (signal: string, code = 0) => {
  if (isShuttingDown) {
    logger.warn(`Already shutting down, forcing exit...`);
    process.exit(code);
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  // Set a timeout for forced shutdown
  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    // Close Socket.IO first
    if (io) {
      logger.info("Closing WebSocket connections...");
      await new Promise<void>((resolve) => {
        io.close(() => {
          logger.info("WebSocket bridge closed");
          resolve();
        });
      });
    }

    // Then close HTTP server
    logger.info("Closing HTTP server...");
    await new Promise<void>((resolve, reject) => {
      server.close((err: Error | undefined) => {
        if (err) reject(err);
        else {
          logger.info("HTTP server closed");
          resolve();
        }
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

// Signal handlers
process.on("SIGINT", () => gracefulExit("SIGINT"));
process.on("SIGTERM", () => gracefulExit("SIGTERM"));

// Error handlers
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at promise", { promise, reason });
  gracefulExit("unhandledRejection", 1);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  gracefulExit("uncaughtException", 1);
});
