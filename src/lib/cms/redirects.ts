// Pure helpers of CMS redirects (P-17, doc/08 §3.7). No "server-only": the selftest compiles this file.
//
// Contract: `GET /public/redirects/resolve?path=/old&locale=la` -> 200 `{data:{target,status_code,hops}}` or 404 NOT_FOUND.
//
// STATUS MAPPING (Next.js can only send 307 and 308 from a Server Component, so the CMS code is mapped to the
// closest one that Next can answer; the mapping is honest, not exact):
//   301 -> 308  permanentRedirect()   permanent; 308 keeps the method (301 may turn POST into GET), irrelevant for GET pages
//   308 -> 308  permanentRedirect()
//   302 -> 307  redirect()            temporary; 307 keeps the method
//   307 -> 307  redirect()
// Browsers and crawlers treat 301/308 and 302/307 the same for GET (SEO signals are equal).

export interface RedirectTarget {
  /** internal path ("/new") or an absolute https URL */
  target: string;
  /** the status the CMS stored (301/302/307/308) */
  statusCode: number;
  hops: number;
}

export const REDIRECT_STATUS = new Set([301, 302, 307, 308]);

/** true = `permanentRedirect()` (HTTP 308), false = `redirect()` (HTTP 307) */
export const isPermanentRedirect = (statusCode: number): boolean => statusCode === 301 || statusCode === 308;

/** the HTTP status Next actually sends for a CMS status code */
export const httpStatusFor = (statusCode: number): 307 | 308 => (isPermanentRedirect(statusCode) ? 308 : 307);

const normalizePath = (p: string): string => {
  const noQuery = p.split(/[?#]/, 1)[0] ?? "";
  const trimmed = noQuery.length > 1 ? noQuery.replace(/\/+$/, "") : noQuery;
  return trimmed || "/";
};

/**
 * Validates the answer of P-17. null = do not redirect (stay 404): malformed body, unknown status, a target that is
 * neither an internal path nor https, protocol-relative / backslash targets, or a target equal to the requested path.
 */
export function validateRedirect(source: string, data: unknown): RedirectTarget | null {
  const d = (data && typeof data === "object" ? data : {}) as { target?: unknown; status_code?: unknown; hops?: unknown };
  const { target, status_code: statusCode } = d;
  if (typeof target !== "string" || typeof statusCode !== "number" || !REDIRECT_STATUS.has(statusCode)) return null;
  if (target.length === 0 || target.length > 2048 || /[\s\\\u0000-\u001f]/.test(target)) return null;
  const hops = typeof d.hops === "number" && Number.isFinite(d.hops) ? d.hops : 1;

  if (target.startsWith("/")) {
    if (target.startsWith("//")) return null; // protocol-relative = external, undeclared
    if (normalizePath(target) === normalizePath(source)) return null; // loop guard
    return { target, statusCode, hops };
  }
  try {
    const url = new URL(target);
    if (url.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { target, statusCode, hops };
}
