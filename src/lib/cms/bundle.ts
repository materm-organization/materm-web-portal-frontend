import "server-only";
// In-process stand-in for the portal read API, served from the bundled seed (src/content/cms-seed).
// Same routes, same bodies, same status codes as the real API (doc/08 §2.2) so loaders use one code path.
// scripts/cms/mock-api.mjs implements the same routes over HTTP; scripts/cms/selftest.mjs asserts parity.
import { BUNDLE } from "../../content/cms-seed";
import { interpret, type CmsResult } from "./result";
import type {
  BundleData, CategoryInfo, Envelope, ListEnvelope, LocaleBundle, MediaMap, PostListItem,
} from "./types";

export interface BundleReply {
  status: number;
  body: unknown;
  location?: string;
}
export type Query = Record<string, string | undefined>;

const PAGE_PATH_RE = /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/;
const notFound = (): BundleReply => ({ status: 404, body: { success: false, message: "not found", code: "NOT_FOUND" } });
const invalid = (field: string): BundleReply => ({
  status: 422,
  body: { success: false, message: "validation failed", code: "VALIDATION_FAILED", errors: [{ in: "query", path: `/${field}` }] },
});
const ok = (body: unknown): BundleReply => ({ status: 200, body });

/** own-property lookup (keys come from URLs: never reach Object.prototype) */
function own<T>(o: Record<string, T>, k: string | undefined): T | undefined {
  return k !== undefined && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
}

function intOr(v: string | undefined, dflt: number, min: number, max: number): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}

export function createBundleApi(data: BundleData) {
  const defaultLocale = data.manifest.default_locale;

  /** FR-LOC-03: `lo` -> `la`; unknown/closed locale -> default (200, never a 404) */
  function localeOf(raw: string | undefined): string {
    const l = raw === "lo" ? "la" : raw;
    return l && data.byLocale[l] ? l : defaultLocale;
  }

  function postsList(lb: LocaleBundle, q: Query): BundleReply {
    const limit = intOr(q.limit, 12, 3, 48);
    const page = intOr(q.page, 1, 1, 1_000_000);
    let items: PostListItem[] = lb.postList.data;
    if (q.category) items = items.filter((i) => i.category?.key === q.category);
    if (q.tag) items = []; // seed has no tags
    const total = items.length;
    const slice = items.slice((page - 1) * limit, page * limit);
    const media: MediaMap = {};
    for (const it of slice) {
      const m = lb.postList.media?.[String(it.image.media_id)];
      if (m) media[String(it.image.media_id)] = m;
    }
    const body: ListEnvelope<PostListItem> = {
      success: true,
      data: slice,
      meta: { total, page, limit, total_page: Math.max(1, Math.ceil(total / limit)) },
      media,
    };
    return ok(body);
  }

  function postBySlug(locale: string, slug: string): BundleReply {
    const lb = data.byLocale[locale];
    // (1) normal path: slug of the viewer's locale (or of the fallback row they see)
    const direct = own(lb.posts, slug);
    if (direct) return ok(direct);
    // (2) cross-locale lookup, default locale first (deterministic tie-break)
    const order = [defaultLocale, ...data.manifest.locales.filter((c) => c !== defaultLocale).sort()];
    const hit = data.manifest.posts.find((p) => order.some((c) => p.slugs[c] === slug));
    if (!hit) return notFound();
    // (3) the viewer's slug (own row, else the fallback chain's row)
    const target = hit.slugs[locale] ?? hit.slugs[defaultLocale] ?? Object.values(hit.slugs)[0];
    if (!target || target === slug) return notFound();
    const location = `/blog/${target}`;
    return { status: 308, location, body: { success: true, data: { redirect: { location, status: 308 } } } };
  }

  /** path = "/public/..." (no base URL, no query) */
  function get(path: string, query: Query = {}): BundleReply {
    const seg = path.replace(/^\/+|\/+$/g, "").split("/");
    if (seg[0] === "health") return ok({ success: true, data: { status: "ok", source: "bundle" } });
    if (seg[0] !== "public") return notFound();
    const locale = localeOf(query.locale);
    const lb = data.byLocale[locale];
    const [, res, arg] = seg;
    switch (res) {
      case "locales":
        return ok(data.locales);
      case "settings": {
        const env = lb.settings;
        if (!query.group) return ok(env);
        const groups = new Set(query.group.split(","));
        const settings = Object.fromEntries(Object.entries(env.data.settings).filter(([g]) => groups.has(g)));
        return ok({ ...env, data: { ...env.data, settings } });
      }
      case "ui-strings": {
        const env = lb.uiStrings;
        if (!query.ns) return ok(env);
        const ns = query.ns.split(",");
        const strings = Object.fromEntries(Object.entries(env.data.strings).filter(([k]) => ns.some((n) => k.startsWith(`${n}.`))));
        return ok({ ...env, data: { ...env.data, strings } });
      }
      case "menus":
        {
        const m = own(lb.menus, arg);
        return m ? ok(m) : notFound();
      }
      case "site":
        return ok(lb.site);
      case "pages": {
        if (arg !== "resolve") return notFound();
        const p = query.path ?? "";
        if (p.length > 200 || !PAGE_PATH_RE.test(p)) return invalid("path");
        const key = own(data.manifest.pages, p);
        const page = key ? own(lb.pages, key) : undefined;
        return page ? ok(page) : notFound();
      }
      case "posts":
        return arg ? postBySlug(locale, decodeURIComponent(arg)) : postsList(lb, query);
      case "categories":
        return ok(lb.categories as Envelope<CategoryInfo[]>);
      case "tags":
        return ok(lb.tags);
      case "albums":
        {
        if (!arg) return ok(lb.albums);
        const a = own(lb.albumsByKey, arg);
        return a ? ok(a) : notFound();
      }
      case "faq":
        {
        const f = own(lb.faq, arg);
        return f ? ok(f) : notFound();
      }
      case "forms":
        {
        const f = seg.length === 3 ? own(lb.forms, arg) : undefined;
        return f ? ok(f) : notFound();
      }
      case "sitemap":
        return ok(data.sitemap);
      default:
        return notFound();
    }
  }

  /** same as `get`, parsed like a client would (deep-cloned: callers may mutate) */
  function request<T>(path: string, query: Query = {}): CmsResult<T> {
    const r = get(path, query);
    return interpret<T>(r.status, structuredClone(r.body), r.location ?? null, "bundle");
  }

  return { get, request, defaultLocale };
}

export const bundleApi = createBundleApi(BUNDLE);
