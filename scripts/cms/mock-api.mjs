#!/usr/bin/env node
// Tiny mock of the portal read API (doc/08 §2.2) serving the bundled seed, for CMS_MODE=mock.
//
//   npm run cms:mock                       -> http://127.0.0.1:4010/api/v1
//   node scripts/cms/mock-api.mjs --port 4010 --host 127.0.0.1 --data <dir>
//
// Env (all optional):  MOCK_PORTAL_KEY  require this X-Portal-Key (401 otherwise)
//                      MOCK_DELAY_MS    delay every response (timeout tests)
//                      MOCK_FAIL_STATUS answer every API call with this status (e.g. 503)
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

  function handle(pathname, q) {
    const seg = pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (seg[0] === "health") return ok({ success: true, data: { status: "ok", source: "mock" } });
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
      },
    });
    const reply = (status, body, extra = {}) => {
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
      const r = api.handle(path, q);
      reply(r.status, r.body, r.location ? { Location: r.location } : {});
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
