import { Redis, RedisOptions } from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

/**
 * Creates a single, shared ioredis connection instance for the entire application.
 * It intelligently uses either a REDIS_URL or host/port from the env config.
 */

// This is the common configuration for all connection types.
const redisOptions: RedisOptions = {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(
      `Redis connection lost. Retrying in ${delay}ms... (attempt ${times})`
    );
    return delay;
  },
  maxRetriesPerRequest: null,
};

// Check the shape of env.redis to decide how to connect.
// The "in" operator is a type-safe way to check for a property on the object.
const connectionConfig =
  "url" in env.redis
    ? env.redis.url // If `url` exists, ioredis can use it directly.
    : {
        // Otherwise, build the options object from host and port.
        host: env.redis.host,
        port: env.redis.port,
      };

// Create the Redis instance with the correct configuration
export const redis =
  typeof connectionConfig === "string"
    ? new Redis(connectionConfig, redisOptions)
    : new Redis({ ...connectionConfig, ...redisOptions });

redis.on("connect", () => {
  logger.info(
    `Redis connected successfully to ${
      "url" in env.redis ? env.redis.url : env.redis.host
    }`
  );
});

redis.on("error", (err) => {
  logger.error("Redis connection error:", err.message);
});
