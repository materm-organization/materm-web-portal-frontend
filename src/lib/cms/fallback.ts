// Fallback bookkeeping: log each (resource, reason) at most once per LOG_EVERY_MS, count every use
// (doc/08 §3.10, NFR-06/23). Never throws.
//
// "Once per process, forever" (the first version) hid a second outage that came hours after the first one; and the
// resource of a page is `page:<path>` with a visitor-chosen path, so the maps are capped.

const LOG_EVERY_MS = 60_000;
const MAX_KEYS = 200;
const OVERFLOW = "other";

const lastLogged = new Map<string, number>();
const counts = new Map<string, number>();

export function logFallback(resource: string, locale: string, reason: string, now: number = Date.now()): void {
  let key = `${resource}|${reason}`;
  if (!counts.has(key) && counts.size >= MAX_KEYS) key = `${OVERFLOW}|${reason}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
  const last = lastLogged.get(key);
  if (last !== undefined && now - last < LOG_EVERY_MS) return;
  if (last === undefined && lastLogged.size >= MAX_KEYS) {
    for (const [k, t] of lastLogged) if (now - t >= LOG_EVERY_MS) lastLogged.delete(k); // drop what is due anyway
    if (lastLogged.size >= MAX_KEYS) return; // still full of fresh keys: counted above, not logged
  }
  lastLogged.set(key, now);
  try {
    console.warn(JSON.stringify({ event: "fallback_used", resource: key.startsWith(`${OVERFLOW}|`) ? OVERFLOW : resource, locale, reason }));
  } catch {
    /* logging must never break a page */
  }
}

/** key `resource|reason` -> number of fallbacks served in this process */
export function getFallbackCounts(): Record<string, number> {
  return Object.fromEntries(counts);
}

/** test hook */
export function resetFallbackState(): void {
  lastLogged.clear();
  counts.clear();
}
