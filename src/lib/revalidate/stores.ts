// In-memory stores for /api/revalidate: replay protection by event_id and a light fixed-window rate limiter.
// Per server instance only (a serverless deployment has several instances): best effort by design. The real
// guards are the HMAC and the signed timestamp window; revalidating the same tags twice is harmless.

export interface SeenStore {
  has(id: string, nowMs: number): boolean;
  add(id: string, nowMs: number): void;
  delete(id: string): void;
  readonly size: number;
}

/** LRU of event ids with a TTL. Map keeps insertion order, so the oldest entry is the first key. */
export function createSeenStore(maxEntries = 10_000, ttlMs = 15 * 60_000): SeenStore {
  const map = new Map<string, number>();
  return {
    has(id, nowMs) {
      const exp = map.get(id);
      if (exp === undefined) return false;
      if (exp <= nowMs) {
        map.delete(id);
        return false;
      }
      // refresh recency
      map.delete(id);
      map.set(id, exp);
      return true;
    },
    add(id, nowMs) {
      map.delete(id);
      map.set(id, nowMs + ttlMs);
      while (map.size > maxEntries) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
    delete(id) {
      map.delete(id);
    },
    get size() {
      return map.size;
    },
  };
}

export interface FixedWindowLimiter {
  /** counts one hit; true when the window count now exceeds `limit` */
  hit(key: string, nowMs: number, limit: number): boolean;
  readonly size: number;
}

export function createFixedWindowLimiter(windowMs = 60_000, maxKeys = 5_000): FixedWindowLimiter {
  const map = new Map<string, { start: number; count: number }>();
  const current = (key: string, nowMs: number) => {
    const e = map.get(key);
    return e && nowMs - e.start < windowMs ? e : undefined;
  };
  return {
    hit(key, nowMs, limit) {
      let e = current(key, nowMs);
      if (!e) {
        if (map.size >= maxKeys) {
          // drop expired entries first, then the oldest
          for (const [k, v] of map) if (nowMs - v.start >= windowMs) map.delete(k);
          while (map.size >= maxKeys) {
            const oldest = map.keys().next().value;
            if (oldest === undefined) break;
            map.delete(oldest);
          }
        }
        e = { start: nowMs, count: 0 };
        map.set(key, e);
      }
      e.count += 1;
      return e.count > limit;
    },
    get size() {
      return map.size;
    },
  };
}
