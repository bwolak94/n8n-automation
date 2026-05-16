import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times: number) => {
    if (times > 10) return null;
    return Math.min(times * 200, 3_000);
  },
  lazyConnect: false,
});

redis.on("connect", () => console.log("[Redis] Connected"));
redis.on("error", (err: Error) =>
  console.error("[Redis] Error:", err.message)
);

// BullMQ requires maxRetriesPerRequest: null on its connections
export const bullmqRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    if (times > 10) return null;
    return Math.min(times * 200, 3_000);
  },
});
