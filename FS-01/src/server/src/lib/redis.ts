import Redis from "ioredis";

type MemoryEntry = { value: string; expiresAt?: number };

function createMemoryRedis() {
  const values = new Map<string, MemoryEntry>();
  const read = (key: string) => {
    const entry = values.get(key);
    if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
      values.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    status: "ready",
    async connect() {},
    async quit() {},
    async get(key: string) { return read(key)?.value ?? null; },
    async set(key: string, value: string, ...args: (string | number)[]) {
      const options = args.map(String).map((part) => part.toUpperCase());
      if (options.includes("NX") && read(key)) return null;
      const exIndex = options.indexOf("EX");
      const seconds = exIndex >= 0 ? Number(args[exIndex + 1]) : 0;
      values.set(key, { value, ...(seconds > 0 ? { expiresAt: Date.now() + seconds * 1000 } : {}) });
      return "OK";
    },
    async del(key: string) { return values.delete(key) ? 1 : 0; },
    async eval(_script: string, _keyCount: number, key: string, expected: string) {
      if (read(key)?.value !== expected) return 0;
      values.delete(key);
      return 1;
    },
  };
}

const redisUrl = process.env.REDIS_URL?.trim();
export const redis = redisUrl
  ? new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true })
  : createMemoryRedis();

export const cartKey = (userId: string) => `cart:${userId}`;
