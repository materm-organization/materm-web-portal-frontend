// POST /api/revalidate: the verification and decision logic (doc/08 §7.2), free of Next imports so that
// `npm run site:selftest` can run every branch. `src/app/api/revalidate/route.ts` supplies the real
// `revalidateTag` / `revalidatePath`, the clock and the stores.
//
// Contract (what the admin-backend relay, T1.3.1, must send):
//   POST /api/revalidate
//   X-Materm-Timestamp: <unix seconds>
//   X-Materm-Signature: v1=<hex HMAC-SHA256(REVALIDATE_SECRET, timestamp + "." + rawBody)>
//   body: {"event_id":"<uuid>","tags":["pages","settings"],"occurred_at"?:"<RFC 3339>","sent_at"?:"<RFC 3339>"}
//         (<= 16 KiB, 1..128 tags)
//   200 {"success":true,"data":{"revalidated":[...],"ignored":[...]}}   (+ "duplicate":true for a known event_id)
//   400 bad body · 401 bad/missing/stale signature · 413 too large · 429 rate limited · 503 secret not configured
//
// Fail closed: no (or too short) REVALIDATE_SECRET = 503, never "accept anything". The secret, the signature
// and the body are never written to logs or echoed in a response.
import { createHmac, timingSafeEqual } from "node:crypto";

import { isAllowedTag } from "../cms/tags";
import type { FixedWindowLimiter, SeenStore } from "./stores";

export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_TAGS = 128;
export const MIN_SECRET_LENGTH = 32;
export const DEFAULT_MAX_SKEW_SECONDS = 300;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 120;
/** failed authentications tolerated per client per minute; more are answered 429 (a valid signature is never throttled) */
export const FAILED_AUTH_PER_MINUTE = 20;
export const SITEMAP_PATH = "/sitemap.xml";
const SIGNATURE_RE = /^v1=([0-9a-f]{64})$/i;
const EVENT_ID_RE = /^[\x21-\x7e]{1,64}$/;
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;

export type Reason =
  | "ok"
  | "duplicate"
  | "secret_missing"
  | "too_large"
  | "missing_headers"
  | "bad_timestamp"
  | "stale_timestamp"
  | "bad_signature"
  | "client_blocked"
  | "rate_limited"
  | "bad_body"
  | "revalidate_failed";

export interface RevalidateDeps {
  revalidateTag: (tag: string, profile: { expire: number }) => void;
  revalidatePath: (path: string) => void;
  seen: SeenStore;
  /** failed authentications per client */
  failures: FixedWindowLimiter;
  /** authenticated requests overall */
  throughput: FixedWindowLimiter;
}

export interface RevalidateRequest {
  /** header lookup, case-insensitive (a `Headers` instance fits) */
  headers: { get(name: string): string | null };
  rawBody: Uint8Array;
  nowMs: number;
  /** best-effort client address, used only to throttle failed authentications */
  clientKey: string;
  env: Record<string, string | undefined>;
}

export interface RevalidateResult {
  status: number;
  body: Record<string, unknown>;
  /** for logs and tests only, never sent to the caller */
  reason: Reason;
  eventId?: string;
  revalidated?: number;
  ignored?: number;
  retryAfterSeconds?: number;
}

const fail = (status: number, code: string, message: string, reason: Reason, extra: Partial<RevalidateResult> = {}): RevalidateResult => ({
  status,
  body: { success: false, code, message },
  reason,
  ...extra,
});

function intEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Current secret first, then the previous one (rotation, doc/08 §7.2). Secrets shorter than 32 chars are unusable. */
export function configuredSecrets(env: RevalidateRequest["env"]): string[] {
  return [env.REVALIDATE_SECRET, env.REVALIDATE_SECRET_PREVIOUS].filter(
    (s): s is string => typeof s === "string" && s.length >= MIN_SECRET_LENGTH,
  );
}

export function signPayload(secret: string, timestamp: string, rawBody: Uint8Array): string {
  const mac = createHmac("sha256", secret);
  mac.update(`${timestamp}.`);
  mac.update(rawBody);
  return `v1=${mac.digest("hex")}`;
}

/** constant-time comparison of two `v1=<64 hex>` signatures */
function signatureMatches(expected: string, given: string): boolean {
  const a = Buffer.from(expected.slice(3), "hex");
  const b = Buffer.from(given.slice(3), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

interface Parsed {
  eventId: string;
  tags: string[];
}

function parseBody(rawBody: Uint8Array): Parsed | null {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.event_id !== "string" || !EVENT_ID_RE.test(o.event_id)) return null;
  if (!Array.isArray(o.tags) || o.tags.length < 1 || o.tags.length > MAX_TAGS) return null;
  if (!o.tags.every((t): t is string => typeof t === "string")) return null;
  // `sent_at` (the relay's send time) and `occurred_at` (outbox row time) are informational: freshness is decided
  // by the signed timestamp header. When present they must at least be well formed.
  for (const key of ["sent_at", "occurred_at"] as const) {
    const v = o[key];
    if (v !== undefined && v !== null && !(typeof v === "string" && RFC3339_RE.test(v) && !Number.isNaN(Date.parse(v)))) return null;
  }
  return { eventId: o.event_id, tags: o.tags as string[] };
}

export function handleRevalidate(req: RevalidateRequest, deps: RevalidateDeps): RevalidateResult {
  // 1. fail closed without a usable secret
  const secrets = configuredSecrets(req.env);
  if (secrets.length === 0 || !req.env.REVALIDATE_SECRET || req.env.REVALIDATE_SECRET.length < MIN_SECRET_LENGTH) {
    return fail(503, "SERVICE_UNAVAILABLE", "Revalidation is not configured.", "secret_missing");
  }

  // 2. size before anything else (no HMAC over a huge body)
  if (req.rawBody.byteLength > MAX_BODY_BYTES) {
    return fail(413, "PAYLOAD_TOO_LARGE", "Body is too large.", "too_large");
  }

  // 3. failed authentications are counted per client. A client that is over the limit gets 429 instead of 401, but
  //    ONLY when its signature is invalid: the HMAC is always checked (microseconds), so a caller who can spoof the
  //    client address (X-Forwarded-For outside Netlify) can never lock the real, correctly signed relay out.
  const unauthorized = (reason: Reason): RevalidateResult => {
    if (deps.failures.hit(req.clientKey, req.nowMs, FAILED_AUTH_PER_MINUTE)) {
      return fail(429, "RATE_LIMITED", "Too many failed attempts.", "client_blocked", { retryAfterSeconds: 60 });
    }
    return fail(401, "UNAUTHENTICATED", "Invalid signature.", reason);
  };

  // 4. headers
  const timestamp = req.headers.get("x-materm-timestamp")?.trim() ?? "";
  const signature = req.headers.get("x-materm-signature")?.trim() ?? "";
  if (!timestamp || !signature) return unauthorized("missing_headers");
  if (!/^\d{1,12}$/.test(timestamp)) return unauthorized("bad_timestamp");
  if (!SIGNATURE_RE.test(signature)) return unauthorized("bad_signature");

  // 5. HMAC first, freshness second: both are cheap, and an unsigned caller learns nothing about the window
  let signed = false;
  for (const secret of secrets) {
    if (signatureMatches(signPayload(secret, timestamp, req.rawBody), signature)) signed = true;
  }
  if (!signed) return unauthorized("bad_signature");
  const skew = intEnv(req.env.REVALIDATE_MAX_SKEW_SECONDS, DEFAULT_MAX_SKEW_SECONDS, 30, 900);
  if (Math.abs(req.nowMs / 1000 - Number(timestamp)) > skew) {
    return fail(401, "UNAUTHENTICATED", "Timestamp is outside the accepted window.", "stale_timestamp");
  }

  // 6. authenticated from here on: overall ceiling (light, per instance)
  const limit = intEnv(req.env.REVALIDATE_RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_LIMIT_PER_MINUTE, 1, 100000);
  if (deps.throughput.hit("all", req.nowMs, limit)) {
    return fail(429, "RATE_LIMITED", "Too many requests.", "rate_limited", { retryAfterSeconds: 60 });
  }

  // 7. body schema
  const parsed = parseBody(req.rawBody);
  if (!parsed) return fail(400, "VALIDATION_FAILED", "Body must be {event_id, tags[]} within the documented limits.", "bad_body");

  // 8. replay: the same event_id again (relay retry or replay) is acknowledged but not applied twice
  if (deps.seen.has(parsed.eventId, req.nowMs)) {
    return {
      status: 200,
      body: { success: true, data: { revalidated: [], ignored: [], duplicate: true } },
      reason: "duplicate",
      eventId: parsed.eventId,
      revalidated: 0,
      ignored: 0,
    };
  }
  deps.seen.add(parsed.eventId, req.nowMs);

  // 9. allow-list, then revalidate. Unknown tags are skipped, never fatal.
  const revalidated: string[] = [];
  const ignored: string[] = [];
  try {
    for (const tag of new Set(parsed.tags)) {
      if (!isAllowedTag(tag)) {
        ignored.push(tag.length > 80 ? `${tag.slice(0, 80)}...` : tag);
        continue;
      }
      deps.revalidateTag(tag, { expire: 0 });
      revalidated.push(tag);
    }
    if (revalidated.includes("sitemap")) deps.revalidatePath(SITEMAP_PATH);
  } catch {
    // let the relay's retry (same event_id) run again
    deps.seen.delete(parsed.eventId);
    return fail(500, "INTERNAL_ERROR", "Revalidation failed.", "revalidate_failed", { eventId: parsed.eventId });
  }

  return {
    status: 200,
    body: { success: true, data: { revalidated, ignored } },
    reason: "ok",
    eventId: parsed.eventId,
    revalidated: revalidated.length,
    ignored: ignored.length,
  };
}
