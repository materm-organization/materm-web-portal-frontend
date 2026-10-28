// Preview session (PF-10, doc/08 §3.9). PURE module (no Next imports, no "server-only"): shared by the route
// handlers, the proxy and the selftest (`npm run preview:selftest`).
//
// The editor opens `<portal-frontend>/api/preview?token=<raw>&path=/our-path&locale=en`. `/api/preview` checks the
// token with the backend and keeps it in ONE HttpOnly cookie, together with the page it was issued for (the backend
// answers 401 when `path` does not match the page, so the path must travel with the token or a click on the nav
// would look like an expired link). The token is never in a URL after the first hop, never in JS-readable storage,
// never a prop of a component.

export const PREVIEW_COOKIE = "materm_preview";
/** Sliding window: 30 minutes of inactivity (the link itself may live up to 24 h, doc/08 §3.9 open note: option b). */
export const PREVIEW_MAX_AGE_SECONDS = 30 * 60;

/** Raw token as the admin issues it (base64url, 43 chars) and as the backend accepts it in `X-Preview-Token`. */
const TOKEN_RE = /^[A-Za-z0-9._~-]{32,256}$/;
/** A CMS page path: `/`, `/our-path`, `/a/b`. A whitelist, so no scheme, no `//`, no `\`, no `%`, no query/fragment. */
const PAGE_PATH_RE = /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/;
export const MAX_PATH_LENGTH = 200;

export function isValidToken(raw: unknown): raw is string {
  return typeof raw === "string" && TOKEN_RE.test(raw);
}

/**
 * The only paths we ever redirect to (open-redirect proof by construction: a same-origin CMS page path).
 * Returns the path without a trailing slash, or null.
 */
export function normalizePreviewPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_PATH_LENGTH) return null;
  const p = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  return PAGE_PATH_RE.test(p) ? p : null;
}

export interface PreviewSession {
  token: string;
  /** the page the link was issued for */
  path: string;
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

// cookie value: `v1.<base64url(path)>.<token>`. The token alphabet contains "." but base64url does not, so the first
// two dots split the value unambiguously.
const VALUE_RE = /^v1\.([A-Za-z0-9_-]{1,300})\.([A-Za-z0-9._~-]{32,256})$/;

export function encodeSession(session: PreviewSession): string {
  if (!isValidToken(session.token) || normalizePreviewPath(session.path) !== session.path) {
    throw new Error("invalid preview session");
  }
  return `v1.${b64url(session.path)}.${session.token}`;
}

/** null for anything that is not a value we wrote (tampered / old / truncated). */
export function parseSession(value: string | null | undefined): PreviewSession | null {
  const m = typeof value === "string" ? VALUE_RE.exec(value) : null;
  if (!m) return null;
  const path = normalizePreviewPath(unb64url(m[1]));
  return path ? { token: m[2], path } : null;
}

export interface CookieAttrs {
  maxAge: number;
  secure: boolean;
}

/** `Set-Cookie` header value. HttpOnly, SameSite=Lax (doc/08 said None for an iframe we do not build), Path=/. */
export function serializeSessionCookie(value: string, { maxAge, secure }: CookieAttrs): string {
  return `${PREVIEW_COOKIE}=${value}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export const setSessionCookie = (session: PreviewSession, secure: boolean): string =>
  serializeSessionCookie(encodeSession(session), { maxAge: PREVIEW_MAX_AGE_SECONDS, secure });

/**
 * Deletes the cookie (same Path / flags, otherwise the browser keeps it). `Expires` in the past is spelled out next to
 * `Max-Age=0`: when Next merges Draft Mode cookies into the response it re-serialises ours and DROPS `Max-Age=0`
 * (seen in the real render: the cookie survived as an empty session cookie), but it keeps `Expires`.
 */
export const clearSessionCookie = (secure: boolean): string =>
  `${serializeSessionCookie("", { maxAge: 0, secure }).replace("; HttpOnly", "; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly")}`;

/** Secure everywhere except `next dev` (plain http). `localhost` accepts Secure cookies over http in current browsers. */
export const cookieIsSecure = (env: { NODE_ENV?: string }): boolean => env.NODE_ENV === "production";

/** Value of one cookie from a `Cookie` request header. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

// ---------------------------------------------------------------- sliding refresh (proxy)

export interface RefreshInput {
  cookieValue: string | undefined;
  pathname: string;
  /** `next-router-prefetch` / `purpose: prefetch`: the user has not done anything */
  isPrefetch: boolean;
  secure: boolean;
}
export interface RefreshPlan {
  /** extra response headers */
  headers: Record<string, string>;
  /** `Set-Cookie` values to append */
  setCookies: string[];
}

/** Pages only: assets, `/_next/*` and the preview API itself never extend the session. */
export function isSessionPath(pathname: string): boolean {
  return !pathname.startsWith("/_next/") && !pathname.startsWith("/api/") && !/\.[a-z0-9]+$/i.test(pathname);
}

/**
 * What the proxy does for a request that carries the preview cookie. Cookies cannot be written while a Server
 * Component renders, so the sliding Max-Age lives here. Null = leave the request alone.
 */
export function planRefresh({ cookieValue, pathname, isPrefetch, secure }: RefreshInput): RefreshPlan | null {
  if (cookieValue === undefined || !isSessionPath(pathname)) return null;
  const headers = { "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer" };
  const session = parseSession(cookieValue);
  // garbage in our cookie: drop it
  if (!session) return { headers: {}, setCookies: [clearSessionCookie(secure)] };
  return { headers, setCookies: isPrefetch ? [] : [setSessionCookie(session, secure)] };
}
