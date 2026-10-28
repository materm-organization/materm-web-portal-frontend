import { revalidatePath, revalidateTag } from "next/cache";

import { MAX_BODY_BYTES, handleRevalidate, type RevalidateDeps } from "@/lib/revalidate/handler";
import { readBodyLimited } from "@/lib/revalidate/read-body";
import { createFixedWindowLimiter, createSeenStore } from "@/lib/revalidate/stores";

// On-demand revalidation webhook called by the admin-backend relay (doc/08 §7.2, PF-8). The logic and its
// contract live in `src/lib/revalidate/handler.ts`; this file only wires Next's functions, the clock and the
// per-instance stores. Node runtime (node:crypto); POST only (Next answers other methods with 405).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stores = {
  seen: createSeenStore(),
  failures: createFixedWindowLimiter(),
  throughput: createFixedWindowLimiter(),
};

const deps: RevalidateDeps = {
  // `{ expire: 0 }`: stale data is never served, the next request refetches (NFR-03). doc/08 §7.2.
  revalidateTag: (tag, profile) => revalidateTag(tag, profile),
  revalidatePath: (path) => revalidatePath(path),
  ...stores,
};

function clientKey(req: Request): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  ).slice(0, 64);
}

/** Never log the secret, the signature or the body. Only the outcome and counts. */
function log(entry: Record<string, unknown>): void {
  try {
    console.info(JSON.stringify({ event: "revalidate", ...entry }));
  } catch {
    /* logging must never break the endpoint */
  }
}

function respond(status: number, body: unknown, retryAfterSeconds?: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}) },
  });
}

export async function POST(req: Request): Promise<Response> {
  // The body is read with a hard cap, never buffered past it.
  const rawBody = await readBodyLimited(req, MAX_BODY_BYTES);
  if (rawBody === null) {
    // too large: the handler answers 503 when the secret is missing (fail closed), otherwise 413
    const result = handleRevalidate(
      { headers: req.headers, rawBody: new Uint8Array(MAX_BODY_BYTES + 1), nowMs: Date.now(), clientKey: clientKey(req), env: process.env },
      deps,
    );
    log({ status: result.status, reason: result.reason });
    return respond(result.status, result.body);
  }

  const result = handleRevalidate(
    { headers: req.headers, rawBody, nowMs: Date.now(), clientKey: clientKey(req), env: process.env },
    deps,
  );
  log({
    status: result.status,
    reason: result.reason,
    ...(result.eventId ? { event_id: result.eventId } : {}),
    ...(result.revalidated !== undefined ? { revalidated: result.revalidated, ignored: result.ignored } : {}),
  });
  return respond(result.status, result.body, result.retryAfterSeconds);
}
