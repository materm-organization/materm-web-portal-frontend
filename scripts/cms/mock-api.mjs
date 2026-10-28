#!/usr/bin/env node
// Tiny mock of the portal read API (doc/08 §2.2) serving the bundled seed, for CMS_MODE=mock.
//
//   npm run cms:mock                       -> http://127.0.0.1:4010/api/v1
//   node scripts/cms/mock-api.mjs --port 4010 --host 127.0.0.1 --data <dir>
//
// Env (all optional):  MOCK_PORTAL_KEY  require this X-Portal-Key (401 otherwise)
//                      MOCK_DELAY_MS    delay every response (timeout tests)
//                      MOCK_FAIL_STATUS answer every API call with this status (e.g. 503)
//                      MOCK_LOG         1 = print one line per request (method, status, path, query keys; never header values)
//
// Preview (P-19, PF-10): GET /api/v1/preview/resolve?locale=&path= with header X-Preview-Token, answered from the
// bundled pages. Fixture tokens (PREVIEW_TOKENS below; any other well-formed token = unknown = 401 INVALID_TOKEN):
//   mock-preview-valid-token-0123456789abcdef       /our-path   snapshot (hero title changed), no warnings
//   mock-preview-home-token-0123456789abcdefgh      /           snapshot of the home page
//   mock-preview-warnings-token-0123456789abcdef    /contact    contact_section + faq with `resolved: {}` and 3 warnings
//   mock-preview-draft-token-0123456789abcdefgh     /our-path   DRAFT: hero without background image, about_blocks without items,
//                                                               gallery_cards without cards (B5: incomplete sections in preview)
//   mock-preview-expired-token-0123456789abcdef     401 INVALID_TOKEN   (same body as unknown / revoked / path mismatch)
//   mock-preview-ratelimit-token-0123456789abcd     429 RATE_LIMITED + Retry-After
//   mock-preview-broken-token-0123456789abcdefg     500
//   missing header, length outside 32-256 or characters outside [A-Za-z0-9._~-]   422 VALIDATION_FAILED
// Replies carry Cache-Control: no-store, X-Robots-Tag: noindex, nofollow, noarchive and Vary: X-Preview-Token.
// Same routes/status codes as src/lib/cms/bundle.ts; scripts/cms/selftest.mjs asserts both agree.
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, isMain, parseArgs } from "./lib/util.mjs";

const PAGE_PATH_RE = /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/;
const own = (o, k) => (k !== undefined && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const intOr = (v, d, min, max) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const ok = (body) => ({ status: 200, body });
const notFound = () => ({ status: 404, body: { success: false, message: "not found", code: "NOT_FOUND" } });
const invalid = (field) => ({
  status: 422,
  body: { success: false, message: "validation failed", code: "VALIDATION_FAILED", errors: [{ in: "query", path: `/${field}` }] },
});

export const PREVIEW_TOKENS = {
  valid: "mock-preview-valid-token-0123456789abcdef",
  home: "mock-preview-home-token-0123456789abcdefgh",
  warnings: "mock-preview-warnings-token-0123456789abcdef",
  draft: "mock-preview-draft-token-0123456789abcdefgh",
  expired: "mock-preview-expired-token-0123456789abcdef",
  rateLimited: "mock-preview-ratelimit-token-0123456789abcd",
  broken: "mock-preview-broken-token-0123456789abcdefg",
};
const PREVIEW_TOKEN_RE = /^[A-Za-z0-9._~-]{32,256}$/;
const PREVIEW_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "X-Preview-Token",
};
const invalidToken = () => ({
  status: 401,
  headers: PREVIEW_HEADERS,
  body: { success: false, message: "preview link expired or invalid", code: "INVALID_TOKEN" },
});

export function createMockApi(dataDir = DATA_DIR) {
  const cache = new Map();
  const file = (rel) => {
    if (!cache.has(rel)) {
      const p = join(dataDir, rel);
      cache.set(rel, existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
    }
    return cache.get(rel);
  };
  const manifest = file("manifest.json");
  const defaultLocale = manifest.default_locale;
  const localeOf = (raw) => {
    const l = raw === "lo" ? "la" : raw;
    return l && manifest.locales.includes(l) ? l : defaultLocale;
  };
  const clean = (rel, arg) => (arg && /^[A-Za-z0-9_.-]+$/.test(arg) ? `${rel}/${arg}.json` : null);

  function postsList(loc, q) {
    const env = file(`${loc}/posts/list.json`);
    const limit = intOr(q.limit, 12, 3, 48);
    const page = intOr(q.page, 1, 1, 1_000_000);
    let items = env.data;
    if (q.category) items = items.filter((i) => i.category?.key === q.category);
    if (q.tag) items = [];
    const slice = items.slice((page - 1) * limit, page * limit);
    const media = {};
    for (const it of slice) {
      const m = env.media?.[String(it.image.media_id)];
      if (m) media[String(it.image.media_id)] = m;
    }
    return ok({
      success: true,
      data: slice,
      meta: { total: items.length, page, limit, total_page: Math.max(1, Math.ceil(items.length / limit)) },
      media,
    });
  }

  function postBySlug(loc, slug) {
    const direct = clean(`${loc}/posts`, slug) && slug !== "list" ? file(`${loc}/posts/${slug}.json`) : null;
    if (direct) return ok(direct);
    const order = [defaultLocale, ...manifest.locales.filter((c) => c !== defaultLocale).sort()];
    const hit = manifest.posts.find((p) => order.some((c) => p.slugs[c] === slug));
    if (!hit) return notFound();
    const target = hit.slugs[loc] ?? hit.slugs[defaultLocale] ?? Object.values(hit.slugs)[0];
    if (!target || target === slug) return notFound();
    const location = `/blog/${target}`;
    return { status: 308, location, body: { success: true, data: { redirect: { location, status: 308 } } } };
  }

  // fixture token -> { path, mutate(page snapshot), warnings }
  const previewFixtures = {
    [PREVIEW_TOKENS.valid]: {
      path: "/our-path",
      mutate: (data) => {
        const hero = data.sections.find((x) => x.key === "hero_brand");
        if (hero) hero.props.title = `${hero.props.title} - DRAFT SNAPSHOT`;
        data.page.title = `${data.page.title} (draft)`;
        data.page.seo.title = data.page.title;
      },
      warnings: [],
    },
    [PREVIEW_TOKENS.home]: {
      path: "/",
      mutate: (data) => {
        const hero = data.sections.find((x) => x.key === "hero_brand");
        if (hero) hero.props.title = `${hero.props.title} - DRAFT HOME`;
      },
      warnings: [],
    },
    [PREVIEW_TOKENS.draft]: {
      path: "/our-path",
      mutate: (data) => {
        for (const x of data.sections) {
          if (x.key === "hero_brand") x.props.background = null; // publish would refuse this
          if (x.key === "about_blocks") x.props.items = [];
          if (x.key === "gallery_cards") x.resolved = {};
        }
      },
      warnings: [],
    },
    [PREVIEW_TOKENS.warnings]: {
      path: "/contact",
      mutate: (data) => {
        data.sections.forEach((x) => {
          if (x.key === "contact_section" || x.key === "faq") x.resolved = {};
        });
      },
      warnings: (data) => [
        { code: "reference_not_published", path: `/sections/${data.sections.findIndex((x) => x.key === "contact_section")}/props/form_slug`, message: "form is not published" },
        { code: "reference_not_published", path: `/sections/${data.sections.findIndex((x) => x.key === "faq")}/props/faq_group_key`, message: "faq group is not published" },
        { code: "link_page_not_published", path: "/sections/0/props/cta/page_id", message: "linked page is not published" },
        { code: "brand_new_code_from_the_future", path: "", message: "n/a" },
      ],
    },
  };

  /** P-19. `headers` are the lower-cased request headers. */
  function previewResolve(q, headers) {
    const token = headers["x-preview-token"];
    const bad = (field, where) => ({
      status: 422,
      headers: PREVIEW_HEADERS,
      body: { success: false, message: "validation failed", code: "VALIDATION_FAILED", errors: [{ in: where, path: `/${field}` }] },
    });
    if (typeof token !== "string" || !PREVIEW_TOKEN_RE.test(token)) return bad("X-Preview-Token", "header");
    const wanted = q.path;
    if (wanted !== undefined && (wanted.length > 200 || !PAGE_PATH_RE.test(wanted))) return bad("path", "query");
    if (token === PREVIEW_TOKENS.rateLimited) {
      return { status: 429, headers: { ...PREVIEW_HEADERS, "Retry-After": "30" }, body: { success: false, message: "too many requests", code: "RATE_LIMITED" } };
    }
    if (token === PREVIEW_TOKENS.broken) return { status: 500, headers: PREVIEW_HEADERS, body: { success: false, message: "internal error", code: "INTERNAL_ERROR" } };
    const fx = own(previewFixtures, token);
    if (!fx) return invalidToken(); // unknown, expired, revoked: one answer
    if (wanted !== undefined && wanted !== fx.path) return invalidToken(); // path mismatch: the same answer
    const loc = localeOf(q.locale);
    const key = own(manifest.pages, fx.path);
    const env = key ? file(`${loc}/pages/${key}.json`) : null;
    if (!env) return invalidToken();
    const data = structuredClone(env.data);
    fx.mutate(data);
    const warnings = typeof fx.warnings === "function" ? fx.warnings(data) : fx.warnings;
    return {
      status: 200,
      headers: PREVIEW_HEADERS,
      body: {
        success: true,
        data: { locale: loc, kind: "page", page: data, preview: { entity_type: "cms.pages", entity_id: data.page.id, locale: loc, warnings } },
      },
    };
  }

  function handle(pathname, q, headers = {}) {
    const seg = pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (seg[0] === "health") return ok({ success: true, data: { status: "ok", source: "mock" } });
    if (seg[0] === "preview" && seg[1] === "resolve" && seg.length === 2) return previewResolve(q, headers);
    if (seg[0] !== "public") return notFound();
    const loc = localeOf(q.locale);
    const [, res, arg] = seg;
    const byArg = (dir) => {
      const rel = clean(`${loc}/${dir}`, arg);
      const f = rel && seg.length === 3 ? file(rel) : null;
      return f ? ok(f) : notFound();
    };
    switch (res) {
      case "locales": return ok(file("locales.json"));
      case "settings": {
        const env = file(`${loc}/settings.json`);
        if (!q.group) return ok(env);
        const groups = new Set(q.group.split(","));
        return ok({ ...env, data: { ...env.data, settings: Object.fromEntries(Object.entries(env.data.settings).filter(([g]) => groups.has(g))) } });
      }
      case "ui-strings": {
        const env = file(`${loc}/ui-strings.json`);
        if (!q.ns) return ok(env);
        const ns = q.ns.split(",");
        return ok({ ...env, data: { ...env.data, strings: Object.fromEntries(Object.entries(env.data.strings).filter(([k]) => ns.some((n) => k.startsWith(`${n}.`)))) } });
      }
      case "menus": return byArg("menus");
      case "site": return ok(file(`${loc}/site.json`));
      case "pages": {
        if (arg !== "resolve") return notFound();
        const p = q.path ?? "";
        if (p.length > 200 || !PAGE_PATH_RE.test(p)) return invalid("path");
        const key = own(manifest.pages, p);
        const f = key ? file(`${loc}/pages/${key}.json`) : null;
        return f ? ok(f) : notFound();
      }
      case "posts": return arg ? postBySlug(loc, decodeURIComponent(arg)) : postsList(loc, q);
      case "categories": return ok(file(`${loc}/categories.json`));
      case "tags": return ok(file(`${loc}/tags.json`));
      case "albums": return arg ? byArg("albums") : ok(file(`${loc}/albums.json`));
      case "faq": return byArg("faq");
      case "forms": return byArg("forms");
      case "sitemap": return ok(file("sitemap.json"));
      default: return notFound();
    }
  }
  return { handle };
}

/** returns a node http.Server (not listening). `server.requests` records what each call looked like. */
export function createMockServer({ dataDir = DATA_DIR, key = process.env.MOCK_PORTAL_KEY, delayMs = Number(process.env.MOCK_DELAY_MS) || 0, failStatus = Number(process.env.MOCK_FAIL_STATUS) || 0 } = {}) {
  const api = createMockApi(dataDir);
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://mock");
    const q = Object.fromEntries(url.searchParams);
    server.requests.push({
      method: req.method,
      path: url.pathname,
      query: q,
      headers: {
        "x-portal-key": req.headers["x-portal-key"],
        "x-request-id": req.headers["x-request-id"],
        "accept-language": req.headers["accept-language"],
        "x-preview-token": req.headers["x-preview-token"],
      },
    });
    const reply = (status, body, extra = {}) => {
      if (process.env.MOCK_LOG) console.log(`${req.method} ${status} ${url.pathname}?${[...url.searchParams.keys()].sort().join("&")}${req.headers["x-preview-token"] ? " [preview-token-header]" : ""}`);
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=30, stale-while-revalidate=300", "X-Mock": "1", ...extra });
      res.end(JSON.stringify(body));
    };
    const run = () => {
      if (req.method !== "GET") return reply(405, { success: false, code: "METHOD_NOT_ALLOWED" });
      const path = url.pathname.replace(/^\/api\/v1/, "");
      if (failStatus && !path.startsWith("/health")) return reply(failStatus, { success: false, code: "SERVICE_UNAVAILABLE" });
      if (key && !path.startsWith("/health") && req.headers["x-portal-key"] !== key) {
        return reply(401, { success: false, code: "UNAUTHENTICATED" });
      }
      const r = api.handle(path, q, req.headers);
      reply(r.status, r.body, { ...r.headers, ...(r.location ? { Location: r.location } : {}) });
    };
    if (delayMs) setTimeout(run, delayMs);
    else run();
  });
  server.requests = [];
  return server;
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port ?? process.env.MOCK_PORT ?? 4010);
  const host = String(args.host ?? "127.0.0.1");
  const server = createMockServer({ dataDir: args.data ? String(args.data) : DATA_DIR });
  server.listen(port, host, () => {
    console.log(`cms mock api: http://${host}:${port}/api/v1  (CMS_MODE=mock; Ctrl+C to stop)`);
  });
}
