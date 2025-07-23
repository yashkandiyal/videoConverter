import winston from "winston";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";

// 1. Colour & level settings

const levels = { error: 0, warn: 1, info: 2, debug: 3 } as const;
winston.addColors({
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "blue",
});

//2. Output formats

const devFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let out = `${timestamp} ${level} ${message}`;
    if (stack) out += `\n${stack}`;
    if (Object.keys(meta).length) out += `\n${JSON.stringify(meta, null, 2)}`;
    return out;
  })
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const NODE_ENV = process.env.NODE_ENV ?? "development";

//3. Winston base config
const baseLogger = winston.createLogger({
  levels,
  level: NODE_ENV === "production" ? "info" : "debug",
  format: NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

/* File rotation (prod only) */
if (NODE_ENV === "production") {
  mkdirSync("logs", { recursive: true });
  baseLogger.add(
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
      tailable: true,
      format: prodFormat,
    })
  );
  baseLogger.add(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
      format: prodFormat,
    })
  );
}

// 4. Per-request context via AsyncLocalStorage

export interface RequestContext {
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

//  5. Contextual logger wrapper
class ContextualLogger {
  constructor(private readonly core: winston.Logger) {}

  private get ctx() {
    return als.getStore() ?? {};
  }

  private write(level: keyof typeof levels, msg: string, meta: any = {}) {
    this.core.log(level, msg, { ...this.ctx, ...meta });
  }

  error(msg: string, meta?: any) {
    this.write("error", msg, meta);
  }
  warn(msg: string, meta?: any) {
    this.write("warn", msg, meta);
  }
  info(msg: string, meta?: any) {
    this.write("info", msg, meta);
  }
  debug(msg: string, meta?: any) {
    this.write("debug", msg, meta);
  }

  /** Timing helper: const t = logger.time('encode'); ... t.end(); */
  time(label: string) {
    const start = Date.now();
    return {
      end: (m?: string) =>
        this.info(m ?? `${label} OK`, { ms: Date.now() - start }),
    };
  }
}

export const logger = new ContextualLogger(baseLogger);
export const rawLogger = baseLogger;

// 6. Express middleware to populate context

export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId =
    req.headers["x-request-id"] ||
    req.headers["x-correlation-id"] ||
    Math.random().toString(36).slice(2, 10);

  als.run<RequestContext>(
    {
      requestId,
      userId: req.user?.id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
      method: req.method,
      url: req.originalUrl || req.url,
    },
    () => {
      logger.info(`↗︎ ${req.method} ${req.originalUrl || req.url}`);

      res.on("finish", () => {
        logger.info(`↘︎ ${req.method} ${req.originalUrl || req.url}`, {
          statusCode: res.statusCode,
          ms: Date.now() - start,
        });
      });

      next();
      return {
        requestId,
        userId: req.user?.id,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
        method: req.method,
        url: req.originalUrl || req.url,
      };
    }
  );
};
