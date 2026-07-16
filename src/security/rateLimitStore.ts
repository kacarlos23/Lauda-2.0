import { createClient, type RedisClientType } from "redis";
import { config } from "../config/unifiedConfig";

export type RateLimitResult = {
  count: number;
  resetAt: number;
};

export interface RateLimitStore {
  consume(key: string, windowMs: number): Promise<RateLimitResult>;
}

type MemoryEntry = { count: number; resetAt: number };

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async consume(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      const created = { count: 1, resetAt: now + windowMs };
      this.entries.set(key, created);
      return created;
    }

    current.count += 1;
    return current;
  }
}

const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

export class RedisRateLimitStore implements RateLimitStore {
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType> | null = null;

  constructor(
    private readonly url: string,
    private readonly connectTimeoutMs = 3_000,
  ) {}

  private async getClient(): Promise<RedisClientType> {
    if (this.client?.isReady) return this.client;
    if (this.connecting) return this.connecting;

    const client = createClient({
      url: this.url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: this.connectTimeoutMs,
        reconnectStrategy: false,
      },
    });
    client.on("error", () => undefined);
    this.connecting = client.connect()
      .then(() => {
        this.client = client as RedisClientType;
        this.connecting = null;
        return this.client;
      })
      .catch((error: unknown) => {
        this.connecting = null;
        throw error;
      });
    return this.connecting;
  }

  async consume(key: string, windowMs: number): Promise<RateLimitResult> {
    const client = await this.getClient();
    const result = await client.eval(CONSUME_SCRIPT, {
      keys: [key],
      arguments: [String(windowMs)],
    }) as [number, number];
    const ttl = Math.max(Number(result[1]), 1);
    return { count: Number(result[0]), resetAt: Date.now() + ttl };
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connecting = null;
    if (client?.isOpen) await client.close();
  }
}

let sharedStore: RateLimitStore | null = null;

export function rateLimitStore(): RateLimitStore {
  if (sharedStore) return sharedStore;
  sharedStore = config.rateLimit.store === "redis"
    ? new RedisRateLimitStore(
        config.rateLimit.redisUrl!,
        config.rateLimit.redisConnectTimeoutMs,
      )
    : new MemoryRateLimitStore();
  return sharedStore;
}
