import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

declare global {
  // eslint-disable-next-line no-var
  var redisClient: Redis | undefined;
}

export function createRedisClient(): Redis | null {
  try {
    const client = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    client.on("error", () => {
      // Graceful fallback when Redis is offline in local dev
    });

    return client;
  } catch {
    return null;
  }
}

export const redis = globalThis.redisClient || createRedisClient();

if (process.env.NODE_ENV !== "production" && redis) {
  globalThis.redisClient = redis;
}

export const REDIS_CHANNELS = {
  DOC_UPDATES: "yjs:doc-updates",
  PRESENCE_UPDATES: "yjs:presence-updates",
} as const;

export default redis;

