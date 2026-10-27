import "server-only";
// Server-side fetch client for the portal read API (doc/08 §3.3). Never throws: every failure is a CmsResult.
//  - GET: cache "force-cache" + next { revalidate, tags }; locale goes in the QUERY (no Accept-Language)
//  - NO X-Request-Id on cached requests (Next uses headers in the cache key); only on POST
//  - X-Portal-Key from PORTAL_API_KEY (server-only env, never NEXT_PUBLIC)
//  - timeout via AbortSignal.timeout (CMS_FETCH_TIMEOUT_MS, default 2000)
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
}

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
  const mode = getCmsMode();
  const source = mode === "mock" ? "mock" : "api";
  const cfg = getApiConfig(mode);
  if (!cfg.baseUrl) return { kind: "error", ok: false, status: "unconfigured", down: true, source };

  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
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

  let res: Response;
  try {
    res = await fetch(buildUrl(cfg.baseUrl, path, opts.locale, opts.query), init);
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    return { kind: "error", ok: false, status: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network", down: true, source };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null; // 3xx with only a Location header, or a non-JSON error page
  }
  return interpret<T>(res.status, body, res.headers.get("location"), source);
}
