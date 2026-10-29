import "server-only";
// Signed "fill time" stamp of a form (doc/08 §6.3). The server renders the form with a hidden field
// `rt = base64url(rendered_at_ms) + "." + base64url(HMAC-SHA256(FORM_RENDER_SECRET, rendered_at_ms + "|" + form_slug))`;
// the server action checks the signature and turns the age into `elapsed_ms`, which the portal backend compares with
// the form's `min_fill_seconds` (an absent or 0 value counts as "too fast" = spam). The browser cannot forge a longer
// time, and a stamp made for one form is useless for another (the slug is signed).
//
//  - FORM_RENDER_SECRET: SECRET, server-only (never NEXT_PUBLIC_*), >= 32 characters. REQUIRED in production: without
//    it no visitor could ever prove a fill time and every real message would be stored as spam, so the form answers
//    "unconfigured" instead. In development a random per-process secret is used when it is unset.
//  - A stamp older than 24 h but genuinely signed (a tab left open overnight) counts as 24 h: the visitor is a human.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const MIN_SECRET_LENGTH = 32;
/** Longest fill time we report (a genuinely signed stamp older than this is capped, not refused). */
export const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000;
/** How far into the future a stamp may lie (clock differences between instances). */
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const DEV_SECRET_KEY = "__materm_form_render_secret__";

/** The signing secret, or null when production has none (or a short one). */
export function renderSecret(env: { FORM_RENDER_SECRET?: string; NODE_ENV?: string } = process.env): string | null {
  const configured = env.FORM_RENDER_SECRET?.trim();
  if (configured && configured.length >= MIN_SECRET_LENGTH) return configured;
  if (env.NODE_ENV === "production") return null;
  // development: one random secret per process; on `globalThis` so that a duplicated module instance (dev bundler,
  // server component layer vs. server action layer) still signs and verifies with the same value
  const g = globalThis as Record<string, unknown>;
  if (typeof g[DEV_SECRET_KEY] !== "string") g[DEV_SECRET_KEY] = randomBytes(32).toString("hex");
  return g[DEV_SECRET_KEY] as string;
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const sign = (secret: string, ms: string, slug: string) => createHmac("sha256", secret).update(`${ms}|${slug}`).digest();

/** The value of the hidden `rt` field; "" when there is no secret (the action then refuses to send, see above). */
export function mintRenderStamp(slug: string, now: number = Date.now(), secret: string | null = renderSecret()): string {
  if (!secret) return "";
  const ms = String(Math.trunc(now));
  return `${b64(ms)}.${b64(sign(secret, ms, slug))}`;
}

export interface VerifiedStamp {
  /** time the form was rendered (ms since epoch) */
  renderedAt: number;
  /** now - renderedAt, at least 0, at most MAX_ELAPSED_MS */
  elapsedMs: number;
}

/** null for anything that is not a stamp we signed for this form (missing, malformed, wrong signature, from the future). */
export function verifyRenderStamp(stamp: unknown, slug: string, now: number = Date.now(), secret: string | null = renderSecret()): VerifiedStamp | null {
  if (!secret || typeof stamp !== "string" || stamp.length > 200) return null;
  const [rawMs, rawSig, extra] = stamp.split(".");
  if (!rawMs || !rawSig || extra !== undefined) return null;
  const ms = Buffer.from(rawMs, "base64url").toString("utf8");
  if (!/^\d{1,15}$/.test(ms)) return null;
  const given = Buffer.from(rawSig, "base64url");
  const want = sign(secret, ms, slug);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  const renderedAt = Number(ms);
  if (renderedAt > now + MAX_FUTURE_SKEW_MS) return null;
  return { renderedAt, elapsedMs: Math.min(MAX_ELAPSED_MS, Math.max(0, now - renderedAt)) };
}
