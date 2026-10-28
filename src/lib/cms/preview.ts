import "server-only";
// Preview loader (PF-10, doc/08 §3.9): `GET /preview/resolve` with the editor's token. Server only.
//  - the token travels ONLY in the `X-Preview-Token` header (never in a URL, never logged, never returned)
//  - `cache: "no-store"`, no tags: a preview request never reads or writes Next's data cache
//  - no bundle fallback (see lib/preview/resolve.ts): every failure is a PreviewOutcome
//  - works with CMS_MODE=api (real backend) and CMS_MODE=mock (scripts/cms/mock-api.mjs); bundle has no backend
import { cache } from "react";
import { cmsFetch } from "./client";
import { getCmsMode } from "./config";
import { normalizeLocaleCode } from "./locale";
import { classifyResolve, type PreviewOutcome } from "../preview/resolve";
import { parseSession, PREVIEW_COOKIE, type PreviewSession } from "../preview/session";

let warnedKey = false;

export async function resolvePreview(token: string, opts: { path: string | null; locale: string }): Promise<PreviewOutcome> {
  const res = await cmsFetch<unknown>("/preview/resolve", {
    locale: normalizeLocaleCode(opts.locale) ?? "la",
    query: { path: opts.path ?? undefined },
    tags: [],
    revalidate: 0,
    noStore: true,
    headers: { "X-Preview-Token": token },
  });
  const outcome = classifyResolve(res);
  if (outcome.kind === "unavailable" && outcome.reason === "portal_key_rejected" && !warnedKey) {
    warnedKey = true;
    // our own misconfiguration (PORTAL_API_KEY), not the editor's link: say so once, without any value
    console.warn(JSON.stringify({ event: "preview_unavailable", reason: "portal_key_rejected" }));
  }
  return outcome;
}

/**
 * One resolve per (token, path, locale) per render: `generateMetadata` and the page share it (React `cache()`;
 * the backend counts a use per call). Arguments are primitives so `cache` can key on them.
 */
export const getPreviewPage = cache((token: string, path: string, locale: string): Promise<PreviewOutcome> => resolvePreview(token, { path, locale }));

/**
 * The editor's preview session from the cookie, or null (no cookie, a cookie we did not write, or no backend to
 * ask: bundle mode ignores the cookie). Reading `cookies()` is fine here: the catch-all already reads the locale
 * cookie, so the route is dynamic whatever happens.
 */
export async function readPreviewSession(): Promise<PreviewSession | null> {
  if (getCmsMode() === "bundle") return null;
  const { cookies } = await import("next/headers");
  return parseSession((await cookies()).get(PREVIEW_COOKIE)?.value);
}
