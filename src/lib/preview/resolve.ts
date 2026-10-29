// Interpretation of `GET /preview/resolve` (P-19, doc/05 §12.9.5, doc/08 §3.9). PURE (types + parsing only).
//
// NEVER goes through the loaders' bundle fallback: a preview that quietly showed the published page under a
// "preview" banner would be worse than an error.
import type { CmsResult } from "../cms/result";
import type { PageData, PostDetail } from "../cms/types";

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

/** `data` of the 200 for a page link: `page` is exactly the P-06 `data` object (so the title is `page.page.title`). */
export interface PagePreviewData {
  locale: string;
  kind: "page";
  page: PageData;
  preview: PreviewInfo;
}

/** `data` of the 200 for a post link (M5): `post` is exactly the P-08 `data` object (flat, `media` inside). */
export interface PostPreviewData {
  locale: string;
  kind: "post";
  post: PostDetail;
  preview: PreviewInfo;
}

export type PreviewResolveData = PagePreviewData | PostPreviewData;

export type PreviewOutcome =
  | { kind: "ok"; data: PreviewResolveData }
  /** 401 INVALID_TOKEN (unknown, expired, revoked, path mismatch, other entity: one body) or 422 (malformed/truncated link) */
  | { kind: "invalid" }
  /** 429: try again later (cookie stays) */
  | { kind: "busy" }
  /** timeout, 5xx, wrong portal key (401 UNAUTHENTICATED), unusable body: not the editor's fault */
  | { kind: "unavailable"; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parseInfo(info: Record<string, unknown>): PreviewInfo {
  const warnings = Array.isArray(info.warnings)
    ? info.warnings.flatMap((w): PreviewWarning[] =>
        isObj(w) && typeof w.code === "string" ? [{ code: w.code, path: typeof w.path === "string" ? w.path : "" }] : [],
      )
    : [];
  return {
    entity_type: String(info.entity_type ?? ""),
    entity_id: Number(info.entity_id ?? 0),
    locale: String(info.locale ?? ""),
    warnings,
  };
}

/**
 * null when the 200 body is neither a page nor a post preview we can render. Sections with `resolved: {}` are kept as
 * they are. A DRAFT post may lack parts the published one always has (hero, category, excerpt): they arrive as `null`
 * and the missing containers are filled here so the article page never meets `undefined`.
 */
export function parseResolveData(data: unknown): PreviewResolveData | null {
  if (!isObj(data) || !isObj(data.preview)) return null;
  const preview = parseInfo(data.preview);

  if (data.kind === "page" && isObj(data.page)) {
    const page = data.page;
    if (!isObj(page.page) || typeof page.page.title !== "string" || !Array.isArray(page.sections)) return null;
    return {
      locale: typeof data.locale === "string" ? data.locale : String(page.locale ?? ""),
      kind: "page",
      page: { ...(page as unknown as PageData), media: isObj(page.media) ? (page.media as PageData["media"]) : {} },
      preview,
    };
  }

  if (data.kind === "post" && isObj(data.post)) {
    const post = data.post;
    if (typeof post.title !== "string" || typeof post.slug !== "string" || typeof post.href !== "string") return null;
    const gallery = isObj(post.gallery) ? post.gallery : {};
    const seo = isObj(post.seo) ? post.seo : {};
    return {
      locale: typeof data.locale === "string" ? data.locale : String(post.locale ?? ""),
      kind: "post",
      post: {
        ...(post as unknown as PostDetail),
        locale: typeof post.locale === "string" ? post.locale : String(data.locale ?? ""),
        date: typeof post.date === "string" ? post.date : "",
        date_time: typeof post.date_time === "string" ? post.date_time : "",
        body: isObj(post.body) ? (post.body as unknown as PostDetail["body"]) : null,
        hero: isObj(post.hero) ? (post.hero as unknown as NonNullable<PostDetail["hero"]>) : null,
        category: isObj(post.category) ? (post.category as unknown as PostDetail["category"]) : null,
        tags: Array.isArray(post.tags) ? (post.tags as PostDetail["tags"]) : [],
        gallery: {
          heading: typeof gallery.heading === "string" ? gallery.heading : null,
          description: typeof gallery.description === "string" ? gallery.description : null,
          items: Array.isArray(gallery.items) ? (gallery.items as PostDetail["gallery"]["items"]) : [],
        },
        seo: {
          title: typeof seo.title === "string" ? seo.title : post.title,
          description: typeof seo.description === "string" ? seo.description : null,
          og_image: null, // a preview is never shared
          canonical: typeof seo.canonical === "string" ? seo.canonical : "",
          noindex: true,
        },
        media: isObj(post.media) ? (post.media as PostDetail["media"]) : {},
      },
      preview,
    };
  }
  return null;
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
