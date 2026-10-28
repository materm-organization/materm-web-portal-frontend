// Logic of `/api/preview` and `/api/preview/exit` (PF-10). PURE with injected dependencies, so the route files
// only wire Next (`draftMode`, the backend call) and the selftest can run the real logic without a server.
//
// Rules: the token is read from the query ONCE; every answer redirects (307) to a RELATIVE, whitelisted CMS page
// path that does not contain the token; every answer is `no-store` + `Referrer-Policy: no-referrer`; an unusable
// token never says why (expired page for unknown / expired / revoked / mismatching / malformed alike).
import { LOCALE_COOKIE_NAME, isSupportedLocale } from "../constants/locales";
import { normalizeLocaleCode } from "../cms/locale";
import type { CmsMode } from "../cms/config";
import { clearSessionCookie, isValidToken, normalizePreviewPath, readCookie, setSessionCookie } from "./session";
import type { PreviewOutcome } from "./resolve";

export const STATUS_PAGE = "/preview-status";
export type StatusKind = "expired" | "unsupported" | "busy" | "unavailable";
export const statusLocation = (kind: StatusKind): string => `${STATUS_PAGE}?s=${kind}`;

export const NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export interface HandlerResult {
  status: 307 | 303;
  /** always relative, never contains the token */
  location: string;
  /** `Set-Cookie` header values */
  setCookies: string[];
  /** Next Draft Mode (skips every data cache layer for this browser): turn on / off */
  draft: "enable" | "disable";
}

export interface StartInput {
  /** `request.url` (absolute) */
  url: string;
  cookieHeader: string | null;
  mode: CmsMode;
  secure: boolean;
  resolve: (token: string, opts: { path: string | null; locale: string }) => Promise<PreviewOutcome>;
}

const SAFE_DEFAULT_LOCALE = "la";

function deny(kind: StatusKind, secure: boolean): HandlerResult {
  return { status: 307, location: statusLocation(kind), setCookies: [clearSessionCookie(secure)], draft: "disable" };
}

/** `GET /api/preview?token=&path=&locale=` */
export async function handleStart({ url, cookieHeader, mode, secure, resolve }: StartInput): Promise<HandlerResult> {
  // bundle has no backend to ask: say so instead of pretending (and never accept a token we cannot verify)
  if (mode === "bundle") return deny("unsupported", secure);

  const params = new URL(url).searchParams;
  // each parameter must appear at most once (ambiguity = reject)
  if (["token", "path", "locale"].some((k) => params.getAll(k).length > 1)) return deny("expired", secure);

  const token = params.get("token");
  if (!isValidToken(token)) return deny("expired", secure);

  const rawPath = params.get("path");
  const path = rawPath === null || rawPath === "" ? null : normalizePreviewPath(rawPath);
  if (rawPath !== null && rawPath !== "" && path === null) return deny("expired", secure);

  // the link's language (when we ship it) becomes the site language for this browser; otherwise the current one
  const linkLocale = normalizeLocaleCode(params.get("locale"));
  const wanted = linkLocale && isSupportedLocale(linkLocale) ? linkLocale : null;
  const cookieLocale = normalizeLocaleCode(readCookie(cookieHeader, LOCALE_COOKIE_NAME));
  const locale = wanted ?? (cookieLocale && isSupportedLocale(cookieLocale) ? cookieLocale : SAFE_DEFAULT_LOCALE);

  const outcome = await resolve(token, { path, locale });
  if (outcome.kind === "invalid") return deny("expired", secure);
  if (outcome.kind === "busy") return { status: 307, location: statusLocation("busy"), setCookies: [], draft: "disable" };
  if (outcome.kind === "unavailable") return { status: 307, location: statusLocation("unavailable"), setCookies: [], draft: "disable" };

  // the link without `path`: go where the backend says the page lives
  const target = path ?? normalizePreviewPath(outcome.data.page.page.path);
  if (!target) return { status: 307, location: statusLocation("unavailable"), setCookies: [], draft: "disable" };

  const setCookies = [setSessionCookie({ token, path: target }, secure)];
  if (wanted) setCookies.push(`${LOCALE_COOKIE_NAME}=${wanted}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`);
  return { status: 307, location: target, setCookies, draft: "enable" };
}

export interface ExitInput {
  url: string;
  method: string;
  secure: boolean;
}

/** `GET|POST /api/preview/exit?path=&reason=expired` */
export function handleExit({ url, method, secure }: ExitInput): HandlerResult {
  const params = new URL(url).searchParams;
  const status: 303 | 307 = method === "POST" ? 303 : 307; // after a POST the browser must follow with GET
  const base = { status, setCookies: [clearSessionCookie(secure)], draft: "disable" as const };
  if (params.get("reason") === "expired") return { ...base, location: statusLocation("expired") };
  return { ...base, location: normalizePreviewPath(params.get("path")) ?? "/" };
}
