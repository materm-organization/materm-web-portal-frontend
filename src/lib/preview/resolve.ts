// Interpretation of `GET /preview/resolve` (P-19, doc/05 §12.9.5, doc/08 §3.9). PURE (types + parsing only).
//
// NEVER goes through the loaders' bundle fallback: a preview that quietly showed the published page under a
// "preview" banner would be worse than an error.
import type { CmsResult } from "../cms/result";
import type { PageData } from "../cms/types";

export interface PreviewWarning {
  code: string;
  /** JSON Pointer into the snapshot (not shown as prose; the backend `message` is deliberately ignored) */
  path: string;
}

export interface PreviewInfo {
  entity_type: string;
  entity_id: number;
  locale: string;
  warnings: PreviewWarning[];
}

/** `data` of the 200: `page` is exactly the P-06 `data` object (so the title is `page.page.title`). */
export interface PreviewResolveData {
  locale: string;
  kind: "page";
  page: PageData;
  preview: PreviewInfo;
}

export type PreviewOutcome =
  | { kind: "ok"; data: PreviewResolveData }
  /** 401 INVALID_TOKEN (unknown, expired, revoked, path mismatch, other entity: one body) or 422 (malformed/truncated link) */
  | { kind: "invalid" }
  /** 429: try again later (cookie stays) */
  | { kind: "busy" }
  /** timeout, 5xx, wrong portal key (401 UNAUTHENTICATED), unusable body, post previews (M5): not the editor's fault */
  | { kind: "unavailable"; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** null when the 200 body is not a page preview we can render. Sections with `resolved: {}` are kept as they are. */
export function parseResolveData(data: unknown): PreviewResolveData | null {
  if (!isObj(data) || data.kind !== "page" || !isObj(data.page) || !isObj(data.preview)) return null;
  const page = data.page;
  if (!isObj(page.page) || typeof page.page.title !== "string" || !Array.isArray(page.sections)) return null;
  const warnings = Array.isArray(data.preview.warnings)
    ? data.preview.warnings.flatMap((w): PreviewWarning[] =>
        isObj(w) && typeof w.code === "string" ? [{ code: w.code, path: typeof w.path === "string" ? w.path : "" }] : [],
      )
    : [];
  return {
    locale: typeof data.locale === "string" ? data.locale : String(page.locale ?? ""),
    kind: "page",
    page: { ...(page as unknown as PageData), media: isObj(page.media) ? (page.media as PageData["media"]) : {} },
    preview: {
      entity_type: String(data.preview.entity_type ?? ""),
      entity_id: Number(data.preview.entity_id ?? 0),
      locale: String(data.preview.locale ?? ""),
      warnings,
    },
  };
}

/** The ONE place that decides what a resolve answer means. `res` is what `cmsFetch` returned. */
export function classifyResolve(res: CmsResult<unknown>): PreviewOutcome {
  if (res.kind === "ok") {
    const data = parseResolveData(res.data);
    return data ? { kind: "ok", data } : { kind: "unavailable", reason: "unusable_body" };
  }
  if (res.kind === "error") {
    // 401 has two meanings: INVALID_TOKEN = the link is dead; anything else (UNAUTHENTICATED) = OUR portal key is wrong.
    if (res.status === 401) return res.code === "INVALID_TOKEN" ? { kind: "invalid" } : { kind: "unavailable", reason: "portal_key_rejected" };
    if (res.status === 422) return { kind: "invalid" };
    if (res.status === 429) return { kind: "busy" };
    return { kind: "unavailable", reason: String(res.status) };
  }
  return { kind: "unavailable", reason: "redirect" };
}
