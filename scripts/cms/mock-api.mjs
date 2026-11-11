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
//   mock-preview-post-token-0123456789abcdefghij    /blog/music-night-under-the-stars   POST snapshot (title changed), no warnings;
//                                                               data = { kind: "post", post: <P-08 body>, preview } (M5, doc/05 PT-18)
//   mock-preview-postdraft-token-0123456789abcdef   /blog/music-night-under-the-stars   DRAFT post: no hero, no category, no
//                                                               excerpt, empty body/gallery + 2 warnings
//   mock-preview-expired-token-0123456789abcdef     401 INVALID_TOKEN   (same body as unknown / revoked / path mismatch)
//   mock-preview-ratelimit-token-0123456789abcd     429 RATE_LIMITED + Retry-After
//   mock-preview-broken-token-0123456789abcdefg     500
//   missing header, length outside 32-256 or characters outside [A-Za-z0-9._~-]   422 VALIDATION_FAILED
// Form submission (P-15): POST /api/v1/public/forms/{slug}/submissions (JSON, X-Portal-Key) answers 200 {status:"received"},
// keeps the accepted body in `server.submissions`, and reacts to magic e-mail addresses so the contact form's error
// mapping can be tried without a backend: limited@example.test -> 429 (+Retry-After), invalid@example.test -> 422 with
// errors[/data/email = email], gone@example.test -> 404, down@example.test -> 503.
// Replies carry Cache-Control: no-store, X-Robots-Tag: noindex, nofollow, noarchive and Vary: X-Preview-Token.
// Same routes/status codes as src/lib/cms/bundle.ts; scripts/cms/selftest.mjs asserts both agree.
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

// Video support (release 2): hero_brand `background_video`. Fixture pages (resolve P-06) built from the home page:
//   /video-hero          background_video -> a real tiny MP4 served by this mock at /mock-media/hero-video.mp4
//   /video-hero-404      background_video -> a URL that answers 404 (exercises the poster fallback)
//   /video-hero-notvideo background_video -> media whose mime is image/png (adapter: no video)
//   /video-hero-nomedia  background_video -> a media_id missing from the media map (adapter: no video)
// The media URLs are absolute and point back at this server (Host header), like file-service URLs. Preview token
// `video` (below) answers the home page with the working video as a draft.
export const VIDEO_FIXTURE_PATHS = ["/video-hero", "/video-hero-404", "/video-hero-notvideo", "/video-hero-nomedia"];
const MOCK_MEDIA_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
export const MOCK_VIDEO_FILE = join(MOCK_MEDIA_DIR, "hero-video.mp4");
const VIDEO_MEDIA_ID = 9001;

export const PREVIEW_TOKENS = {
  video: "mock-preview-video-token-0123456789abcdefg",
  valid: "mock-preview-valid-token-0123456789abcdef",
  home: "mock-preview-home-token-0123456789abcdefgh",
  warnings: "mock-preview-warnings-token-0123456789abcdef",
  draft: "mock-preview-draft-token-0123456789abcdefgh",
  post: "mock-preview-post-token-0123456789abcdefghij",
  postDraft: "mock-preview-postdraft-token-0123456789abcdef",
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

  /** home page snapshot with a `background_video` of the given flavour (see VIDEO_FIXTURE_PATHS) */
  function withVideo(data, flavour, base) {
    const hero = data.sections.find((x) => x.key === "hero_brand");
    if (!hero) return data;
    if (flavour === "nomedia") {
      hero.props.background_video = { media_id: VIDEO_MEDIA_ID };
      return data;
    }
    const entry = {
      url: `${base}/mock-media/${flavour === "404" ? "missing-video.mp4" : "hero-video.mp4"}`,
      width: 320, height: 180, mime: "video/mp4", kind: "video", duration_ms: 2000, bytes: 12535,
      alt: null, blurhash: null, focal: null, variants: [],
    };
    if (flavour === "notvideo") Object.assign(entry, { url: `${base}/mock-media/hero-video.mp4`, mime: "image/png", kind: "image" });
    data.media[String(VIDEO_MEDIA_ID)] = entry;
    hero.props.background_video = { media_id: VIDEO_MEDIA_ID };
    return data;
  }
  const mediaBase = (headers) => `http://${headers?.host ?? "127.0.0.1:4010"}`;

  // fixture token -> { path, mutate(page snapshot), warnings }
  const previewFixtures = {
    [PREVIEW_TOKENS.video]: {
      path: "/",
      mutate: (data, headers) => {
        withVideo(data, "ok", mediaBase(headers));
        const hero = data.sections.find((x) => x.key === "hero_brand");
        if (hero) hero.props.title = `${hero.props.title} - DRAFT VIDEO`;
      },
      warnings: [],
    },
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

  // post fixtures: the bundled P-08 body of the sample article, changed like a draft would be
  const POST_SLUG = "music-night-under-the-stars";
  const postFixtures = {
    [PREVIEW_TOKENS.post]: {
      mutate: (post) => {
        post.title = `${post.title} (draft)`;
        post.seo.title = post.title;
      },
      warnings: [],
    },
    [PREVIEW_TOKENS.postDraft]: {
      mutate: (post) => {
        post.title = "Untitled draft";
        post.hero = null;
        post.category = null;
        post.excerpt = null;
        post.image = null;
        post.body = null;
        post.gallery = { heading: null, description: null, items: [] };
      },
      warnings: [
        { code: "reference_not_published", path: "/post/category_id", message: "the category is not published" },
        { code: "post_not_published", path: "/translations/0/body", message: "a linked post is not published" },
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
    const pfx = own(postFixtures, token);
    if (pfx) {
      if (wanted !== undefined && wanted !== `/blog/${POST_SLUG}`) return invalidToken();
      const ploc = localeOf(q.locale);
      const penv = file(`${ploc}/posts/${POST_SLUG}.json`);
      if (!penv) return invalidToken();
      const post = structuredClone(penv.data);
      pfx.mutate(post);
      post.seo.noindex = true;
      return {
        status: 200,
        headers: PREVIEW_HEADERS,
        body: {
          success: true,
          data: { locale: ploc, kind: "post", post, preview: { entity_type: "cms.posts", entity_id: post.id, locale: ploc, warnings: pfx.warnings } },
        },
      };
    }
    const fx = own(previewFixtures, token);
    if (!fx) return invalidToken(); // unknown, expired, revoked: one answer
    if (wanted !== undefined && wanted !== fx.path) return invalidToken(); // path mismatch: the same answer
    const loc = localeOf(q.locale);
    const key = own(manifest.pages, fx.path);
    const env = key ? file(`${loc}/pages/${key}.json`) : null;
    if (!env) return invalidToken();
    const data = structuredClone(env.data);
    fx.mutate(data, headers);
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
        if (VIDEO_FIXTURE_PATHS.includes(p)) {
          const home = file(`${loc}/pages/${manifest.pages["/"]}.json`);
          if (!home) return notFound();
          const env = structuredClone(home);
          withVideo(env.data, p.slice("/video-hero".length + 1) || "ok", mediaBase(headers));
          env.data.page.path = p;
          return ok(env);
        }
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
    const submit = (path, raw) => {
      const m = /^\/public\/forms\/([a-z0-9_-]{1,64})\/submissions$/.exec(path);
      if (!m) return reply(404, { success: false, message: "not found", code: "NOT_FOUND" });
      if (key && req.headers["x-portal-key"] !== key) return reply(401, { success: false, code: "UNAUTHENTICATED" });
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return reply(400, { success: false, message: "bad request", code: "BAD_REQUEST" }, { "Cache-Control": "no-store" });
      }
      const NS = { "Cache-Control": "no-store" };
      const email = String(body?.data?.email ?? "");
      if (email === "limited@example.test") return reply(429, { success: false, message: "too many requests", code: "RATE_LIMITED" }, { ...NS, "Retry-After": "30" });
      if (email === "invalid@example.test") {
        return reply(422, { success: false, message: "validation failed", code: "VALIDATION_FAILED", errors: [{ in: "body", path: "/data/email", code: "email" }, { in: "body", path: "/locale", code: "invalid_format" }] }, NS);
      }
      if (email === "gone@example.test") return reply(404, { success: false, message: "not found", code: "NOT_FOUND" }, NS);
      if (email === "down@example.test") return reply(503, { success: false, message: "unavailable", code: "SERVICE_UNAVAILABLE" }, { ...NS, "Retry-After": "5" });
      server.submissions.push({ slug: m[1], body, headers: { "x-portal-key": req.headers["x-portal-key"], "x-client-ip": req.headers["x-client-ip"], "x-client-user-agent": req.headers["x-client-user-agent"], "content-type": req.headers["content-type"] } });
      reply(200, { success: true, data: { status: "received" } }, NS);
    };
    // tiny generated MP4 for the hero video fixtures (no key, no auth: it stands in for a public file-service URL)
    const sendVideo = (rq, rs) => {
      const buf = readFileSync(MOCK_VIDEO_FILE);
      const range = /^bytes=(\d*)-(\d*)$/.exec(String(rq.headers.range ?? ""));
      const base = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "no-store", "X-Mock": "1" };
      if (range) {
        const start = range[1] === "" ? Math.max(0, buf.length - Number(range[2])) : Number(range[1]);
        const end = range[1] === "" || range[2] === "" ? buf.length - 1 : Math.min(Number(range[2]), buf.length - 1);
        if (start > end || start >= buf.length) {
          rs.writeHead(416, { ...base, "Content-Range": `bytes */${buf.length}` });
          return rs.end();
        }
        rs.writeHead(206, { ...base, "Content-Range": `bytes ${start}-${end}/${buf.length}`, "Content-Length": end - start + 1 });
        return rs.end(buf.subarray(start, end + 1));
      }
      rs.writeHead(200, { ...base, "Content-Length": buf.length });
      rs.end(buf);
    };
    const run = () => {
      if (req.method === "POST") {
        const chunks = [];
        let size = 0;
        req.on("data", (c) => {
          size += c.length;
          if (size <= 65536) chunks.push(c);
        });
        req.on("end", () => (size > 65536 ? reply(413, { success: false, code: "PAYLOAD_TOO_LARGE" }) : submit(url.pathname.replace(/^\/api\/v1/, ""), Buffer.concat(chunks).toString("utf8"))));
        return;
      }
      if (req.method !== "GET") return reply(405, { success: false, code: "METHOD_NOT_ALLOWED" });
      if (url.pathname === "/mock-media/hero-video.mp4") return sendVideo(req, res);
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
  server.submissions = [];
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
