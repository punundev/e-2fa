import { Request, Response, NextFunction } from 'express';

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private records = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const existing = this.records.get(key);

    if (!existing || now > existing.resetAt) {
      const record = { count: 1, resetAt: now + windowMs };
      this.records.set(key, record);
      return record;
    }

    existing.count++;
    return existing;
  }
}

/**
 * Upstash REST API or Redis HTTP compatible distributed store.
 * Allows serverless functions to share rate limit state across cold starts.
 */
export class UpstashRedisRateLimitStore implements RateLimitStore {
  constructor(
    private url: string,
    private token: string
  ) {}

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const redisKey = `ratelimit:${key}`;
    const windowSeconds = Math.ceil(windowMs / 1000);

    // INCR then EXPIRE if 1
    const res = await fetch(`${this.url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['TTL', redisKey],
      ]),
    });

    if (!res.ok) {
      throw new Error(`Upstash returned ${res.status}`);
    }

    const data: any = await res.json();
    const count = Number(data[0]?.result || 1);
    let ttl = Number(data[1]?.result);

    // If key has no ttl (first increment), set expiry
    if (ttl === -1 || ttl <= 0) {
      await fetch(`${this.url.replace(/\/$/, '')}/expire/${redisKey}/${windowSeconds}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      }).catch(() => {});
      ttl = windowSeconds;
    }

    return {
      count,
      resetAt: Date.now() + ttl * 1000,
    };
  }
}

let activeStore: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (activeStore) return activeStore;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    activeStore = new UpstashRedisRateLimitStore(upstashUrl, upstashToken);
  } else {
    activeStore = new InMemoryRateLimitStore();
  }

  return activeStore;
}

export function setRateLimitStore(store: RateLimitStore | null): void {
  activeStore = store;
}

export function rateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const store = getRateLimitStore();

    try {
      const record = await store.increment(ip, windowMs);
      if (record.count > max) {
        res.status(429).json({ error: message });
        return;
      }
      next();
    } catch {
      // In case of distributed store temporary outage, fall back safely to prevent blocking all legitimate users
      next();
    }
  };
}
