import IORedis from "ioredis";
import { env } from "./env";
// Create one redis connection for the entire app.
// ioredis handles an internal command queue so sharing is sage even with high concurrency.

export const redis = new IORedis({
  host: env.redis.host,
  port: env.redis.port,
  /*
    retryStrategy means after each disconnect ioredis waits for min(times*50ms,2000ms) before trying to reconnect.
    This is useful to avoid overwhelming the server with reconnection attempts.
    */
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: null,
});
