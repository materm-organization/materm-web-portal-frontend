import "server-only";
// Server-side fetch client for the portal read API (doc/08 §3.3). Never throws: every failure is a CmsResult.
//  - GET: cache "force-cache" + next { revalidate, tags }; locale goes in the QUERY (no Accept-Language)
//  - NO X-Request-Id on cached requests (Next uses headers in the cache key); only on POST
//  - X-Portal-Key from PORTAL_API_KEY (server-only env, never NEXT_PUBLIC)
//  - timeout via AbortSignal.timeout (CMS_FETCH_TIMEOUT_MS, default 2000) for the WHOLE call, retry included
//  - a GET that fails FAST (connection refused/reset, 502/503/504) is retried ONCE after RETRY_PAUSE_MS inside that
//    budget (a restarting backend, one overloaded answer); a timeout is never retried (the budget is spent) and
//    nothing is remembered between calls: the next request starts from scratch, a 503 never sticks. Next's data
//    cache stores only 200 answers, so a failed answer is not cached either.
import { getApiConfig, getCmsMode } from "./config";
import { interpret, type CmsResult } from "./result";

export interface CmsFetchOptions {
  locale?: string;
  /** extra query params (undefined values are dropped) */
  query?: Record<string, string | number | undefined>;
  tags: readonly string[];
  /** seconds */
  revalidate: number;
  timeoutMs?: number;
  method?: "GET" | "POST";
  body?: unknown;
  /** "manual" for P-08 so a 308 is reported instead of followed */
  redirect?: "manual" | "follow";
  /** skip the Next data cache (preview / Draft Mode, POST) */
  noStore?: boolean;
  /** extra request headers (preview: `X-Preview-Token`). Use together with `noStore`: a header is part of Next's cache key. */
  headers?: Record<string, string>;
  /**
   * Talk to the real portal API whatever `CMS_MODE` says (`bundle` / `mock` only decide where CONTENT is read from).
   * The contact form uses it: a submission must never be answered by the mock server or silently dropped.
   */
  forceApi?: boolean;
}

/** pause before the single retry of a fast failure (ms) */
export const RETRY_PAUSE_MS = 100;
const RETRY_STATUS = new Set([502, 503, 504]);

type NextInit = RequestInit & { next?: { revalidate?: number; tags?: string[] } };

export function buildUrl(baseUrl: string, path: string, locale: string | undefined, query: CmsFetchOptions["query"]): string {
  const params: [string, string][] = [];
  if (locale) params.push(["locale", locale]);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== "") params.push([k, String(v)]);
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)); // stable cache key
  const qs = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return `${baseUrl}${path}${qs ? `?${qs}` : ""}`;
}

/** `path` starts with "/public/..." (relative to NEXT_PUBLIC_API_BASE_URL / CMS_MOCK_URL) */
export async function cmsFetch<T>(path: string, opts: CmsFetchOptions): Promise<CmsResult<T>> {
  const mode = opts.forceApi ? "api" : getCmsMode();
  const source = mode === "mock" ? "mock" : "api";
  const cfg = getApiConfig(mode);
  if (!cfg.baseUrl) return { kind: "error", ok: false, status: "unconfigured", down: true, source };

  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  if (cfg.key) headers["X-Portal-Key"] = cfg.key;
  const init: NextInit = {
    method,
    headers,
    signal: AbortSignal.timeout(opts.timeoutMs ?? cfg.timeoutMs),
    redirect: opts.redirect ?? "follow",
  };
  if (method === "GET" && !opts.noStore) {
    init.cache = "force-cache";
    init.next = { revalidate: opts.revalidate, tags: [...opts.tags] };
  } else {
    init.cache = "no-store";
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      headers["X-Request-Id"] = crypto.randomUUID();
      init.body = JSON.stringify(opts.body ?? {});
    }
  }

  const canRetry = method === "GET";
  let res: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(buildUrl(cfg.baseUrl, path, opts.locale, opts.query), init);
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      if (name === "TimeoutError" || name === "AbortError") return { kind: "error", ok: false, status: "timeout", down: true, source };
      if (attempt === 0 && canRetry && (await pauseWithin(init.signal))) continue;
      return { kind: "error", ok: false, status: "network", down: true, source };
    }
    if (attempt === 0 && canRetry && RETRY_STATUS.has(res.status)) {
      await res.body?.cancel().catch(() => undefined);
      if (await pauseWithin(init.signal)) continue;
    }
    break;
  }
  if (!res) return { kind: "error", ok: false, status: "network", down: true, source };

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null; // 3xx with only a Location header, or a non-JSON error page
  }
  return interpret<T>(res.status, body, res.headers.get("location"), source);
}

/** sleeps RETRY_PAUSE_MS; false when the call's budget would not survive the pause (no retry then) */
async function pauseWithin(signal: AbortSignal | null | undefined): Promise<boolean> {
  if (signal?.aborted) return false;
  await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
  return !signal?.aborted;
}
