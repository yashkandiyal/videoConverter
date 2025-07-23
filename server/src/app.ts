import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

import { env } from "./config/env.js";
import { logger, requestLogger } from "./utils/logger.js";

import { uploadRouter } from "./routes/upload.route.js";
import { jobRouter } from "./routes/job.route.js";

export const app = express();

//1) Global middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
  })
);

app.use(compression());

app.use(
  cors({
    origin: env.nodeEnv === "production" ? env.frontendUrl : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        (res as express.Response).status(400).json({ error: "Invalid JSON" });
        throw new Error("Invalid JSON");
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
    parameterLimit: 50,
  })
);

app.use(requestLogger);

//2) Routes
app.use("/api/upload", uploadRouter);
app.use("/api/jobs", jobRouter);

app.get("/health", (_req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB",
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + " MB",
    },
    nodeEnv: env.nodeEnv,
  });
});

app.get("/api", (_req, res) => {
  res.json({
    name: "Video Processing API",
    version: "1.0.0",
    endpoints: {
      upload: "/api/upload",
      jobs: "/api/jobs",
      health: "/health",
      websocket: "/ws",
    },
  });
});
// 3) 404 handler
app.use("*", (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

//4)Central error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const isClientError = err.statusCode >= 400 && err.statusCode < 500;
    if (isClientError) {
      logger.warn("Client error", {
        message: err.message,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      });
    } else {
      logger.error("Server error", {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
    }
    const statusCode = err.statusCode || err.status || 500;
    const message =
      env.nodeEnv === "production" && statusCode === 500
        ? "Internal server error"
        : err.message || "An error occurred";
    res.status(statusCode).json({
      error: message,
      ...(env.nodeEnv === "development" && { stack: err.stack }),
    });
  }
);
