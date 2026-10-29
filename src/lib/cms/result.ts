// Outcome of one portal-API call (real, mock or bundled). No "server-only": pure types + parsing.
import type { MediaMap, PageMeta } from "./types";

export type CmsSource = "api" | "mock" | "bundle";

export interface CmsOk<T> {
  kind: "ok";
  ok: true;
  status: number;
  data: T;
  meta?: PageMeta;
  media?: MediaMap;
  source: CmsSource;
}
/** 3xx with a target (P-08 wrong-locale slug -> 308, doc/08 §2.3.3) */
export interface CmsRedirect {
  kind: "redirect";
  ok: false;
  status: number;
  location: string;
  source: CmsSource;
}
/** One entry of the standard `errors[]` of a 4xx (doc/05 §1.5): where (`body` / `query` / `header`), JSON Pointer, machine code. */
export interface ApiFieldError {
  in: string;
  path: string;
  code: string;
}
export interface CmsError {
  kind: "error";
  ok: false;
  status: number | "timeout" | "network" | "invalid" | "unconfigured";
  code?: string;
  /** `errors[]` of a 422 (only well-formed entries; the contact form maps `/data/<field>` to its inline messages) */
  errors?: ApiFieldError[];
  /** true = the API is unusable (429/5xx/401/403/timeout/network/bad body): loaders fall back to the bundle.
   *  false = the API answered and said no (404, 422): believe it. */
  down: boolean;
  source: CmsSource;
}
export type CmsResult<T> = CmsOk<T> | CmsRedirect | CmsError;

const DOWN_4XX = new Set([401, 403, 408, 429]);

interface BodyShape {
  success?: unknown;
  data?: unknown;
  meta?: PageMeta;
  media?: MediaMap;
  code?: string;
  errors?: unknown;
}

export function interpret<T>(status: number, body: unknown, headerLocation: string | null, source: CmsSource): CmsResult<T> {
  const b = (body && typeof body === "object" ? body : {}) as BodyShape;
  if ([301, 302, 307, 308].includes(status)) {
    const redirect = (b.data as { redirect?: { location?: string } } | undefined)?.redirect;
    const location = redirect?.location ?? headerLocation;
    if (typeof location === "string" && location.length > 0) return { kind: "redirect", ok: false, status, location, source };
    return { kind: "error", ok: false, status: "invalid", down: true, source };
  }
  if (status === 200) {
    if (b.success === true && "data" in b) {
      return { kind: "ok", ok: true, status, data: b.data as T, meta: b.meta, media: b.media, source };
    }
    return { kind: "error", ok: false, status: "invalid", down: true, source };
  }
  const down = status >= 500 || DOWN_4XX.has(status) || status < 400;
  const errors = Array.isArray(b.errors)
    ? b.errors.flatMap((e): ApiFieldError[] => {
        const x = e as Partial<ApiFieldError> | null;
        return x && typeof x.path === "string" && typeof x.code === "string" ? [{ in: typeof x.in === "string" ? x.in : "", path: x.path, code: x.code }] : [];
      })
    : [];
  return {
    kind: "error", ok: false, status, code: typeof b.code === "string" ? b.code : undefined,
    ...(errors.length > 0 ? { errors } : {}), down, source,
  };
}
