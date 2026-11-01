import "server-only";
// Loaders of the portal read API (doc/08 §3.4). Server Components / route handlers only.
//
//  CMS_MODE = bundle (default)  bundled seed only, no network
//           = mock              scripts/cms/mock-api.mjs (CMS_MOCK_URL), falls back to the bundle if it is down
//           = api               real portal-backend (NEXT_PUBLIC_API_BASE_URL + PORTAL_API_KEY),
//                               falls back to the bundle when the API is down / unconfigured
//  A loader never throws into the page: API down -> bundle (logged once, counted), 404 -> null / not_found.
//
//  Every loader is wrapped in React `cache()` (generateMetadata and the page share one result per
//  render). `cache` keys on argument identity, so all arguments are primitives.
import { cache } from "react";
import { bundleApi, type Query } from "./bundle";
import { cmsFetch } from "./client";
import { getCmsMode } from "./config";
import { logFallback } from "./fallback";
import { normalizeLocaleCode } from "./locale";
import { validateRedirect, type RedirectTarget } from "./redirects";
import type { CmsResult } from "./result";
import { REVALIDATE, TAGS } from "./tags";
import type {
  AlbumDetail, AlbumsPage, CategoryInfo, FaqGroup, FormDefinition, LocaleInfo, MenuResponse, PageData,
  PageMeta, PostDetail, PostListItem, PostQuery, PostResult, PostsPage, RobotsData, SettingsData, SiteData,
  SitemapData, TagInfo, UiStringsData,
} from "./types";

export { getCmsMode } from "./config";
export { getFallbackCounts } from "./fallback";
export type { CmsMode } from "./config";

const PAGE_PATH_RE = /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/;

interface Spec {
  resource: string;
  path: string;
  locale: string;
  query?: Query;
  tags: readonly string[];
  revalidate: number;
  redirect?: "manual";
  /** false = a 404 from a healthy API is an answer, not a reason to use the bundle */
  required: boolean;
}

/** One call through the configured mode, with the automatic bundle fallback. */
async function call<T>(spec: Spec): Promise<CmsResult<T>> {
  const query: Query = { ...spec.query };
  const fromBundle = () => bundleApi.request<T>(spec.path, { ...query, locale: spec.locale });
  if (getCmsMode() === "bundle") return fromBundle();

  const res = await cmsFetch<T>(spec.path, {
    locale: spec.locale,
    query,
    tags: spec.tags,
    revalidate: spec.revalidate,
    redirect: spec.redirect,
  });
  if (res.kind === "error" && res.down) {
    logFallback(spec.resource, spec.locale, `api_down:${res.status}`);
    return fromBundle();
  }
  if (spec.required && res.kind !== "ok") {
    logFallback(spec.resource, spec.locale, `unexpected:${res.kind === "error" ? res.status : res.kind}`);
    return fromBundle();
  }
  return res;
}

const locale = (raw: string): string => normalizeLocaleCode(raw) ?? "la";

// --------------------------------------------------------------------------- site / layout

/** P-01 */
export const getLocales = cache(async (): Promise<LocaleInfo[]> => {
  const r = await call<LocaleInfo[]>({ resource: "locales", path: "/public/locales", locale: "", tags: TAGS.locales(), revalidate: REVALIDATE.locales, required: true });
  return r.kind === "ok" ? r.data : [];
});

/** P-05: menus + settings + ui strings (ns site) + locales for the layout */
export const getSite = cache(async (loc: string): Promise<SiteData> => {
  const l = locale(loc);
  const r = await call<SiteData>({ resource: "site", path: "/public/site", locale: l, tags: TAGS.site(l), revalidate: REVALIDATE.site, required: true });
  return (r as { data: SiteData }).data;
});

/** P-02 (`groups` e.g. "brand,footer,contact,seo,site"; omit = all public groups) */
export const getSettings = cache(async (loc: string, groups?: string): Promise<SettingsData> => {
  const l = locale(loc);
  const r = await call<SettingsData>({ resource: "settings", path: "/public/settings", locale: l, query: { group: groups }, tags: TAGS.settings(), revalidate: REVALIDATE.settings, required: true });
  return (r as { data: SettingsData }).data;
});

/** P-03: flat dotted keys, to be applied over the i18n bundle (see ui-strings.ts) */
export const getUiStrings = cache(async (loc: string, ns?: string): Promise<UiStringsData> => {
  const l = locale(loc);
  const r = await call<UiStringsData>({ resource: "ui-strings", path: "/public/ui-strings", locale: l, query: { ns }, tags: TAGS.uiStrings(l), revalidate: REVALIDATE.ui, required: true });
  return (r as { data: UiStringsData }).data;
});

/** P-04: null for an unknown menu key */
export const getMenu = cache(async (key: string, loc: string): Promise<MenuResponse | null> => {
  const l = locale(loc);
  if (!/^[a-z0-9_-]{1,64}$/.test(key)) return null;
  const r = await call<MenuResponse>({ resource: `menu:${key}`, path: `/public/menus/${key}`, locale: l, tags: TAGS.menu(key), revalidate: REVALIDATE.menu, required: false });
  return r.kind === "ok" ? r.data : null;
});

// --------------------------------------------------------------------------- pages

/** P-06: `path` like "/", "/our-path" (a trailing slash is tolerated). null = no such published page -> notFound() */
export const getPage = cache(async (path: string, loc: string): Promise<PageData | null> => {
  const l = locale(loc);
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (p.length > 200 || !PAGE_PATH_RE.test(p)) return null;
  const r = await call<PageData>({ resource: `page:${p}`, path: "/public/pages/resolve", locale: l, query: { path: p }, tags: TAGS.page(l), revalidate: REVALIDATE.page, required: false });
  return r.kind === "ok" ? r.data : null;
});

// --------------------------------------------------------------------------- blog

const cachedPosts = cache(async (loc: string, category: string, tag: string, page: number, limit: number): Promise<PostsPage> => {
  const r = await call<PostListItem[]>({
    resource: "posts",
    path: "/public/posts",
    locale: loc,
    query: { category: category || undefined, tag: tag || undefined, page: page ? String(page) : undefined, limit: limit ? String(limit) : undefined },
    tags: TAGS.posts(),
    revalidate: REVALIDATE.posts,
    required: true,
  });
  if (r.kind !== "ok") return { items: [], meta: { total: 0, page: 1, limit: 12, total_page: 1 }, media: {} };
  const meta: PageMeta = r.meta ?? { total: r.data.length, page: 1, limit: r.data.length || 12, total_page: 1 };
  return { items: r.data, meta, media: r.media ?? {} };
});

/** P-07: unknown category -> empty page (200), like the API */
export const getPosts = (loc: string, query: PostQuery = {}): Promise<PostsPage> =>
  cachedPosts(locale(loc), query.category ?? "", query.tag ?? "", query.page ?? 0, query.limit ?? 0);

/** P-08 incl. slug of another locale -> `{ kind: "redirect", location, status: 308 }` (call `permanentRedirect(location)`) */
export const getPost = cache(async (slug: string, loc: string): Promise<PostResult> => {
  const l = locale(loc);
  if (!slug || slug.length > 200 || /[\s/\\]/.test(slug)) return { kind: "not_found" };
  const r = await call<PostDetail>({ resource: "post", path: `/public/posts/${encodeURIComponent(slug)}`, locale: l, tags: TAGS.post(), revalidate: REVALIDATE.post, redirect: "manual", required: false });
  if (r.kind === "ok") return { kind: "post", post: r.data };
  if (r.kind === "redirect") return { kind: "redirect", location: r.location, status: r.status };
  return { kind: "not_found" };
});

/** P-09 */
export const getCategories = cache(async (loc: string): Promise<CategoryInfo[]> => {
  const l = locale(loc);
  const r = await call<CategoryInfo[]>({ resource: "categories", path: "/public/categories", locale: l, tags: TAGS.categories(), revalidate: REVALIDATE.categories, required: true });
  return r.kind === "ok" ? r.data : [];
});

/** P-10 */
export const getTags = cache(async (loc: string): Promise<TagInfo[]> => {
  const l = locale(loc);
  const r = await call<TagInfo[]>({ resource: "tags", path: "/public/tags", locale: l, tags: TAGS.tags(), revalidate: REVALIDATE.tags, required: true });
  return r.kind === "ok" ? r.data : [];
});

// --------------------------------------------------------------------------- albums / faq / forms

/** P-11 */
export const getAlbums = cache(async (loc: string): Promise<AlbumsPage> => {
  const l = locale(loc);
  const r = await call<AlbumsPage["items"]>({ resource: "albums", path: "/public/albums", locale: l, tags: TAGS.albums(), revalidate: REVALIDATE.albums, required: true });
  return r.kind === "ok" ? { items: r.data, media: r.media ?? {} } : { items: [], media: {} };
});

/** P-12: null = not found */
export const getAlbum = cache(async (key: string, loc: string): Promise<AlbumDetail | null> => {
  const l = locale(loc);
  if (!/^[a-z0-9_-]{1,64}$/.test(key)) return null;
  const r = await call<AlbumDetail>({ resource: `album:${key}`, path: `/public/albums/${key}`, locale: l, tags: TAGS.album(), revalidate: REVALIDATE.albums, required: false });
  return r.kind === "ok" ? r.data : null;
});

/** P-13: null = not found */
export const getFaq = cache(async (groupKey: string, loc: string): Promise<FaqGroup | null> => {
  const l = locale(loc);
  if (!/^[a-z0-9_-]{1,64}$/.test(groupKey)) return null;
  const r = await call<FaqGroup>({ resource: `faq:${groupKey}`, path: `/public/faq/${groupKey}`, locale: l, tags: TAGS.faq(), revalidate: REVALIDATE.faq, required: false });
  return r.kind === "ok" ? r.data : null;
});

/** P-14: form definition (no recipients / retention). null = not found */
export const getForm = cache(async (slug: string, loc: string): Promise<FormDefinition | null> => {
  const l = locale(loc);
  if (!/^[a-z0-9_-]{1,64}$/.test(slug)) return null;
  const r = await call<FormDefinition>({ resource: `form:${slug}`, path: `/public/forms/${slug}`, locale: l, tags: TAGS.form(), revalidate: REVALIDATE.form, required: false });
  return r.kind === "ok" ? r.data : null;
});

// --------------------------------------------------------------------------- redirects

/**
 * P-17, called ONLY by a route that is about to answer 404 (page/post lookup found nothing; a published page wins, BR-26).
 * null = no redirect: no match (404 from the API), bundle/mock mode (no redirects in the bundle), an unsafe or looping
 * target, or the API failed (logged once per minute; a failed lookup stays a 404, it is never guessed and never falls back).
 * React `cache()` shares one result per render; only 200 answers enter Next's data cache (404 / failures are re-asked).
 */
export const resolveRedirect = cache(async (path: string, loc: string): Promise<RedirectTarget | null> => {
  if (getCmsMode() !== "api") return null;
  const l = locale(loc);
  if (!path.startsWith("/") || path.length > 500) return null;
  const res = await cmsFetch<unknown>("/public/redirects/resolve", {
    locale: l,
    query: { path },
    tags: TAGS.redirects(),
    revalidate: REVALIDATE.redirects,
  });
  if (res.kind === "ok") {
    const valid = validateRedirect(path, res.data);
    if (!valid) logFallback("redirect", l, "invalid_target");
    return valid;
  }
  if (res.kind === "error" && res.status !== 404) logFallback("redirect", l, `api_down:${res.status}`);
  return null; // 404 = no redirect; anything else = stay 404
});

// --------------------------------------------------------------------------- sitemap / robots

/** P-16: default-locale canonical URLs. `base_url + path` for each entry */
export const getSitemap = cache(async (): Promise<SitemapData> => {
  const r = await call<SitemapData>({ resource: "sitemap", path: "/public/sitemap", locale: "", tags: TAGS.sitemap(), revalidate: REVALIDATE.sitemap, required: true });
  return (r as { data: SitemapData }).data;
});

/** robots.ts data: env only (FR-SEO-04); production = SITE_ENV or Netlify CONTEXT equals "production" */
export const getRobots = cache(async (): Promise<RobotsData> => {
  const allow = process.env.SITE_ENV === "production" || (!process.env.SITE_ENV && process.env.CONTEXT === "production");
  const { base_url: baseUrl } = await getSitemap();
  return { allow, baseUrl, sitemap: `${baseUrl}/sitemap.xml`, disallow: allow ? ["/api/"] : ["/"] };
});
