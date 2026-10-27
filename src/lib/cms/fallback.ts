// Fallback bookkeeping: log once per (resource, reason), count every use (doc/08 §3.10, NFR-06/23).
// Never throws.

const logged = new Set<string>();
const counts = new Map<string, number>();

export function logFallback(resource: string, locale: string, reason: string): void {
  const key = `${resource}|${reason}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
  if (logged.has(key)) return;
  logged.add(key);
  try {
    console.warn(JSON.stringify({ event: "fallback_used", resource, locale, reason }));
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
  logged.clear();
  counts.clear();
}
