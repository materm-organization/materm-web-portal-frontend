// Pure decisions of `HeroVideo` (no React, no DOM: scripts/site/video-selftest.mjs compiles and exercises this file).

/** A video that reports `stalled` and does not resume for this long is dropped for its poster. */
export const STALL_MS = 8000;

/** The slice of `navigator.connection` we read (Network Information API; Chromium only, best effort). */
export interface ConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

const SLOW_TYPES = new Set(["slow-2g", "2g", "3g"]);

/** true = show the poster only (no video element at all). */
export function shouldSkipVideo(env: { reducedMotion: boolean; connection?: ConnectionLike | null }): boolean {
  if (env.reducedMotion) return true;
  const c = env.connection;
  if (!c) return false;
  return c.saveData === true || (typeof c.effectiveType === "string" && SLOW_TYPES.has(c.effectiveType));
}

/** `<source type>`: the media mime without parameters; anything that is not `video/*` falls back to mp4. */
export function sourceType(mime: string | null | undefined): string {
  const m = typeof mime === "string" ? mime.split(";")[0].trim().toLowerCase() : "";
  return /^video\/[a-z0-9.+-]+$/.test(m) ? m : "video/mp4";
}
