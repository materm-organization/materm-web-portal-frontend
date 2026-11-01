#!/usr/bin/env node
// Self-test of the CMS data layer without a test runner (npm run cms:selftest).
//
// How it runs: the TypeScript of src/lib/cms + src/content/cms-seed/index.ts is compiled with the
// repo's own `tsc` into a temp dir (CommonJS, nothing is written into the repo); `server-only` is
// stubbed and `react` symlinked there; the compiled loaders are then exercised under
// CMS_MODE = bundle | api (stubbed fetch, real unreachable port, real mock server) | mock.
// No network except 127.0.0.1 sockets owned by this process.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DATA_DIR, ROOT, isMain } from "./lib/util.mjs";
import { createMockServer } from "./mock-api.mjs";

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push([true, name]);
    console.log(`  PASS  ${name}`);
  } catch (e) {
    results.push([false, name]);
    console.log(`  FAIL  ${name}\n        ${String(e?.stack ?? e).split("\n").slice(0, 6).join("\n        ")}`);
  }
}

// ------------------------------------------------------------------ compile
function compile(tmp) {
  const out = join(tmp, "out");
  mkdirSync(join(tmp, "node_modules", "server-only"), { recursive: true });
  writeFileSync(join(tmp, "node_modules", "server-only", "index.js"), "module.exports = {};\n");
  symlinkSync(join(ROOT, "node_modules", "react"), join(tmp, "node_modules", "react"), "dir");
  const files = ["loaders", "bundle", "client", "tags", "locale", "media", "image-hosts", "ui-strings", "config", "fallback", "result", "redirects"].map((f) => join(ROOT, "src/lib/cms", `${f}.ts`));
  writeFileSync(
    join(tmp, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022", lib: ["es2023", "dom"], module: "commonjs", moduleResolution: "node10", esModuleInterop: true,
        resolveJsonModule: true, strict: true, skipLibCheck: true, incremental: false, outDir: out, rootDir: join(ROOT, "src"),
        types: ["node"], typeRoots: [join(ROOT, "node_modules", "@types")],
      },
      files,
    }),
  );
  execFileSync(process.execPath, [join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", join(tmp, "tsconfig.json")], { stdio: "inherit" });
  return out;
}

// ------------------------------------------------------------------ helpers
const ENV_KEYS = ["CMS_MODE", "NEXT_PUBLIC_API_BASE_URL", "CMS_API_BASE_URL", "PORTAL_API_KEY", "CMS_FETCH_TIMEOUT_MS", "CMS_MOCK_URL", "SITE_ENV", "CONTEXT"];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function setEnv(env) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
}
const realFetch = globalThis.fetch;
const realWarn = console.warn;

function freshModules(out) {
  const req = createRequire(join(out, "x.js"));
  for (const k of Object.keys(req.cache)) if (k.startsWith(out)) delete req.cache[k];
  return {
    loaders: req(join(out, "lib/cms/loaders.js")),
    bundle: req(join(out, "lib/cms/bundle.js")),
    tags: req(join(out, "lib/cms/tags.js")),
    locale: req(join(out, "lib/cms/locale.js")),
    fallback: req(join(out, "lib/cms/fallback.js")),
    uiStrings: req(join(out, "lib/cms/ui-strings.js")),
    media: req(join(out, "lib/cms/media.js")),
    seed: req(join(out, "content/cms-seed/index.js")),
    redirects: req(join(out, "lib/cms/redirects.js")),
  };
}

function captureWarn() {
  const lines = [];
  console.warn = (...a) => lines.push(a.map(String).join(" "));
  return { lines, restore: () => (console.warn = realWarn) };
}
const events = (lines) => lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((e) => e?.event === "fallback_used");

function freePort() {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => server.close(resolve));

/** fetch stub backed by the bundle API; records every call */
function stubFetch(bundleApi, calls) {
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    calls.push({ url: u, init });
    const r = bundleApi.get(u.pathname.replace(/^\/api\/v1/, ""), Object.fromEntries(u.searchParams));
    return new Response(JSON.stringify(r.body), { status: r.status, headers: r.location ? { Location: r.location } : {} });
  };
}

const headerOf = (init, name) => Object.entries(init.headers ?? {}).find(([k]) => k.toLowerCase() === name)?.[1];
const sameSet = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

// ------------------------------------------------------------------ main
export async function main() {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "cms-selftest-"))); // realpath: Node keys its module cache by real path (macOS /var -> /private/var)
  let failed = false;
  try {
    console.log(`cms selftest: compiling src/lib/cms with tsc -> ${tmp}`);
    const out = compile(tmp);
    const PAGES = [["/", "home", 4], ["/our-path", "our-path", 4], ["/blog", "blog", 2], ["/gallery", "gallery", 4], ["/contact", "contact", 3]];
    const BASE = "http://api.test/api/v1";

    // ============================================================ 1. bundle mode
    console.log("\n[1] CMS_MODE=bundle (default): no network, every page/locale");
    setEnv({});
    globalThis.fetch = async () => { throw new Error("fetch must not be called in bundle mode"); };
    let m = freshModules(out);
    await test("default mode is bundle; 'fallback' is an alias", async () => {
      assert.equal(m.loaders.getCmsMode(), "bundle");
      process.env.CMS_MODE = "fallback";
      assert.equal(m.loaders.getCmsMode(), "bundle");
      process.env.CMS_MODE = "nonsense";
      assert.equal(m.loaders.getCmsMode(), "bundle");
      delete process.env.CMS_MODE;
    });
    for (const loc of ["la", "en"]) {
      await test(`all 5 pages, locale ${loc} (17 sections total)`, async () => {
        let n = 0;
        for (const [path, key, sections] of PAGES) {
          const p = await m.loaders.getPage(path, loc);
          assert.ok(p, `page ${path}`);
          assert.equal(p.locale, loc);
          assert.equal(p.page.key, key);
          assert.equal(p.sections.length, sections, key);
          assert.ok(p.page.seo.canonical.startsWith("https://"));
          n += p.sections.length;
        }
        assert.equal(n, 17);
      });
    }
    await test("page: trailing slash ok, unknown -> null, invalid path -> null, nothing throws", async () => {
      assert.equal((await m.loaders.getPage("/our-path/", "en")).page.key, "our-path");
      assert.equal(await m.loaders.getPage("/does-not-exist", "en"), null);
      assert.equal(await m.loaders.getPage("/Bad Path", "en"), null);
      assert.equal(await m.loaders.getPage("", "en"), null);
    });
    await test("locale: 'lo' = 'la'; unknown/closed locale -> default (never 404)", async () => {
      assert.equal((await m.loaders.getPage("/", "lo")).locale, "la");
      assert.equal((await m.loaders.getPage("/", "xx")).locale, "la");
      assert.equal((await m.loaders.getPage("/", "not a locale")).locale, "la");
    });
    await test("site: layout data (menus, settings, ui, locales)", async () => {
      const s = await m.loaders.getSite("en");
      assert.equal(s.menus.main.items.length, 5);
      assert.equal(s.menus.footer.items.length, 4);
      assert.equal(s.menus.social.items.length, 4);
      assert.equal(s.menus.main.items[1].href, "/our-path");
      assert.equal(s.settings.brand.name, "MATERM");
      assert.ok(s.media[String(s.settings.brand.logo_media_id)].url.endsWith("materm-logo-white.svg"));
      assert.ok(Object.keys(s.ui).every((k) => k.startsWith("site.")));
      assert.deepEqual(s.locales.map((l) => l.code), ["la", "en"]);
    });
    await test("ui strings: 39 keys x 2 locales; ns filter", async () => {
      for (const loc of ["la", "en"]) assert.equal(Object.keys((await m.loaders.getUiStrings(loc)).strings).length, 39);
      const blog = (await m.loaders.getUiStrings("en", "blog")).strings;
      assert.equal(Object.keys(blog).length, 7);
      const msgs = m.uiStrings.applyUiStrings({ site: { nav: { label: "old", keep: "k" } } }, { "site.nav.label": "new", "forms.errors.x": "y" });
      assert.deepEqual(msgs, { site: { nav: { label: "new", keep: "k" } }, forms: { errors: { x: "y" } } });
    });
    await test("settings (+ group filter), menus, categories, tags, locales", async () => {
      const st = await m.loaders.getSettings("en", "contact,seo");
      assert.deepEqual(Object.keys(st.settings).sort(), ["contact", "seo"]);
      assert.equal((await m.loaders.getMenu("main", "en")).items.length, 5);
      assert.equal(await m.loaders.getMenu("nope", "en"), null);
      assert.equal((await m.loaders.getCategories("en")).length, 5);
      assert.deepEqual(await m.loaders.getTags("en"), []);
      assert.equal((await m.loaders.getLocales()).length, 2);
    });
    await test("posts: list, category filter, unknown category -> empty 200, paging meta, detail", async () => {
      const all = await m.loaders.getPosts("en");
      assert.equal(all.items.length, 1);
      assert.deepEqual(all.meta, { total: 1, page: 1, limit: 12, total_page: 1 });
      assert.ok(all.media[String(all.items[0].image.media_id)]);
      assert.equal((await m.loaders.getPosts("en", { category: "music" })).items.length, 1);
      assert.equal((await m.loaders.getPosts("en", { category: "hiking" })).items.length, 0);
      assert.equal((await m.loaders.getPosts("en", { category: "unknown" })).meta.total, 0);
      assert.equal((await m.loaders.getPosts("en", { page: 2 })).items.length, 0);
      const r = await m.loaders.getPost("music-night-under-the-stars", "en");
      assert.equal(r.kind, "post");
      assert.equal(r.post.gallery.items.length, 9);
      assert.equal(r.post.seo.canonical, "https://materm.example/blog/music-night-under-the-stars");
      assert.equal((await m.loaders.getPost("nope", "en")).kind, "not_found");
      assert.equal((await m.loaders.getPost("constructor", "en")).kind, "not_found");
    });
    await test("albums, faq, form, sitemap, robots", async () => {
      assert.equal((await m.loaders.getAlbums("en")).items.length, 1);
      assert.equal((await m.loaders.getAlbum("forest-photo-story", "en")).items.length, 5);
      assert.equal(await m.loaders.getAlbum("nope", "en"), null);
      assert.equal((await m.loaders.getFaq("contact", "en")).items.length, 4);
      const f = await m.loaders.getForm("contact", "en");
      assert.deepEqual(f.fields.map((x) => x.key), ["name", "email", "phone", "topic", "message"]);
      assert.ok(f.fields.every((x) => !("x-pii" in x.schema)));
      assert.equal(f.fields.find((x) => x.key === "topic").options.length, 4);
      const sm = await m.loaders.getSitemap();
      assert.equal(sm.entries.length, 6);
      assert.ok(sm.entries.some((e) => e.path === "/blog/music-night-under-the-stars"));
      assert.deepEqual(await m.loaders.getRobots(), { allow: false, baseUrl: "https://materm.example", sitemap: "https://materm.example/sitemap.xml", disallow: ["/"] });
      process.env.SITE_ENV = "production";
      assert.deepEqual((await m.loaders.getRobots()).disallow, ["/api/"]);
      delete process.env.SITE_ENV;
    });
    await test("section data is collapsed (no locale maps / link objects) and typed resolved data is present", async () => {
      const home = await m.loaders.getPage("/", "en");
      const hero = home.sections[0];
      assert.equal(hero.key, "hero_brand");
      assert.equal(hero.props.cta.href, "/our-path");
      assert.equal(typeof hero.props.title, "string");
      assert.deepEqual(hero.props.background, { media_id: 1, alt: "", decorative: true });
      const strip = home.sections.find((s) => s.key === "blog_strip");
      assert.equal(strip.resolved.posts.length, 4);
      assert.equal(strip.resolved.posts[0].date, "Sep. 05.2026");
      assert.equal(strip.resolved.posts[0].href, "/blog/music-night-under-the-stars");
      const gal = (await m.loaders.getPage("/gallery", "en")).sections.find((s) => s.key === "photo_story");
      assert.equal(Object.keys(gal.resolved.slots).length, 5);
      const contact = (await m.loaders.getPage("/contact", "en")).sections;
      assert.equal(contact[1].resolved.info.length, 4);
      assert.equal(contact[1].resolved.form.slug, "contact");
      assert.equal(contact[2].resolved.items.length, 4);
      const media = m.media.resolveImage(home.media, hero.props.background);
      assert.equal(media.alt, "");
      assert.ok(media.src.startsWith("/images/site/"));
    });
    await test("loaders return fresh copies (mutating one result does not poison the bundle)", async () => {
      const a = await m.loaders.getSite("en");
      a.menus.main.items.length = 0;
      assert.equal((await m.loaders.getSite("en")).menus.main.items.length, 5);
    });

    // ============================================================ 2. api mode: requests, tags
    console.log("\n[2] CMS_MODE=api (stubbed fetch): request shape and cache tags (doc/08 §2.2, §2.8, §7)");
    setEnv({ CMS_MODE: "api", NEXT_PUBLIC_API_BASE_URL: BASE, PORTAL_API_KEY: "test-key" });
    m = freshModules(out);
    const calls = [];
    stubFetch(m.bundle.bundleApi, calls);
    const EXPECT = [
      // [label, run, path, query, tags, revalidate]
      ["P-01 locales", () => m.loaders.getLocales(), "/public/locales", {}, ["locales"], 600],
      ["P-05 site", () => m.loaders.getSite("en"), "/public/site", { locale: "en" }, ["settings", "locales", "ui:en", "menu:main", "menu:footer", "menu:social"], 600],
      ["P-02 settings", () => m.loaders.getSettings("en", "brand,footer"), "/public/settings", { locale: "en", group: "brand,footer" }, ["settings", "locales"], 600],
      ["P-03 ui-strings", () => m.loaders.getUiStrings("la", "site"), "/public/ui-strings", { locale: "la", ns: "site" }, ["ui:la", "locales"], 600],
      ["P-04 menu", () => m.loaders.getMenu("footer", "en"), "/public/menus/footer", { locale: "en" }, ["menu:footer", "locales"], 600],
      ["P-06 page", () => m.loaders.getPage("/our-path", "en"), "/public/pages/resolve", { locale: "en", path: "/our-path" }, ["pages", "settings", "locales", "ui:en"], 300],
      ["P-07 posts", () => m.loaders.getPosts("en", { category: "music", page: 1, limit: 6 }), "/public/posts", { locale: "en", category: "music", page: "1", limit: "6" }, ["posts:list", "locales"], 300],
      ["P-08 post", () => m.loaders.getPost("music-night-under-the-stars", "en"), "/public/posts/music-night-under-the-stars", { locale: "en" }, ["posts:list", "settings", "locales"], 300],
      ["P-09 categories", () => m.loaders.getCategories("en"), "/public/categories", { locale: "en" }, ["posts:list", "locales"], 300],
      ["P-10 tags", () => m.loaders.getTags("en"), "/public/tags", { locale: "en" }, ["posts:list", "locales"], 300],
      ["P-11 albums", () => m.loaders.getAlbums("en"), "/public/albums", { locale: "en" }, ["albums:list", "locales"], 600],
      ["P-12 album", () => m.loaders.getAlbum("forest-photo-story", "en"), "/public/albums/forest-photo-story", { locale: "en" }, ["albums:list", "locales"], 600],
      ["P-13 faq", () => m.loaders.getFaq("contact", "en"), "/public/faq/contact", { locale: "en" }, ["pages", "locales"], 300],
      ["P-14 form", () => m.loaders.getForm("contact", "en"), "/public/forms/contact", { locale: "en" }, ["pages", "locales"], 300],
      ["P-16 sitemap", () => m.loaders.getSitemap(), "/public/sitemap", {}, ["sitemap"], 3600],
    ];
    for (const [label, run, path, query, tags, revalidate] of EXPECT) {
      await test(`${label}: URL, query, tags, revalidate, headers`, async () => {
        calls.length = 0;
        await run();
        assert.equal(calls.length, 1, "exactly one fetch");
        const { url, init } = calls[0];
        assert.equal(url.origin + url.pathname, `http://api.test/api/v1${path}`);
        assert.deepEqual(Object.fromEntries(url.searchParams), query);
        assert.equal(init.method, "GET");
        assert.equal(init.cache, "force-cache");
        sameSet(init.next.tags, tags);
        assert.equal(new Set(init.next.tags).size, init.next.tags.length, "no duplicate tags");
        assert.ok(init.next.tags.every((t) => m.tags.isAllowedTag(t)), "tags pass the revalidate allow-list");
        assert.equal(init.next.revalidate, revalidate);
        assert.equal(headerOf(init, "x-portal-key"), "test-key");
        assert.equal(headerOf(init, "x-request-id"), undefined, "no X-Request-Id on cached GET");
        assert.equal(headerOf(init, "accept-language"), undefined, "locale travels in the query only");
        assert.ok(init.signal, "timeout signal");
        if (path.startsWith("/public/posts/")) assert.equal(init.redirect, "manual");
      });
    }
    await test("query params are sorted (stable cache key)", async () => {
      calls.length = 0;
      await m.loaders.getPosts("en", { page: 2, category: "music" });
      assert.equal(calls[0].url.search, "?category=music&locale=en&page=2");
    });
    await test("tag allow-list (PF-8): accepts the §2.8 vocabulary, rejects junk", () => {
      for (const t of ["pages", "posts:list", "albums:list", "settings", "locales", "sitemap", "redirects", "ui:en", "ui:la", "menu:main", "page:12", "post:3", "faq:1", "form:2", "album:4", "collection:team"]) assert.ok(m.tags.isAllowedTag(t), t);
      for (const t of ["", "*", "ui:", "ui:EN", "page:abc", "page:", "../x", "x".repeat(200), "posts"]) assert.ok(!m.tags.isAllowedTag(t), t);
    });
    await test("healthy API 404 is an answer: no fallback log, null/not_found", async () => {
      const w = captureWarn();
      try {
        assert.equal(await m.loaders.getPage("/nope", "en"), null);
        assert.equal((await m.loaders.getPost("nope", "en")).kind, "not_found");
        assert.equal(events(w.lines).length, 0);
      } finally { w.restore(); }
    });

    // ============================================================ 3. wrong-locale slug -> 308
    console.log("\n[3] wrong-locale post slug -> 308 target");
    const modified = structuredClone(m.seed.BUNDLE);
    const OLD = "music-night-under-the-stars";
    const NEW = "music-night-en";
    modified.manifest.posts[0].slugs.en = NEW;
    const enPost = modified.byLocale.en.posts[OLD];
    delete modified.byLocale.en.posts[OLD];
    enPost.data.slug = NEW;
    enPost.data.href = `/blog/${NEW}`;
    modified.byLocale.en.posts[NEW] = enPost;
    modified.byLocale.en.postList.data[0].slug = NEW;
    modified.byLocale.en.postList.data[0].href = `/blog/${NEW}`;
    const modApi = m.bundle.createBundleApi(modified);
    await test("bundle: la slug asked in en -> 308 /blog/<en slug>; en slug asked in la -> 308 /blog/<la slug>", () => {
      const a = modApi.get(`/public/posts/${OLD}`, { locale: "en" });
      assert.equal(a.status, 308);
      assert.equal(a.location, `/blog/${NEW}`);
      assert.deepEqual(a.body, { success: true, data: { redirect: { location: `/blog/${NEW}`, status: 308 } } });
      const b = modApi.get(`/public/posts/${NEW}`, { locale: "la" });
      assert.equal(b.status, 308);
      assert.equal(b.location, `/blog/${OLD}`);
      assert.equal(modApi.get(`/public/posts/${NEW}`, { locale: "en" }).status, 200);
      assert.equal(modApi.get(`/public/posts/${OLD}`, { locale: "la" }).status, 200);
      assert.equal(modApi.get("/public/posts/none-at-all", { locale: "en" }).status, 404);
      assert.equal(m.bundle.createBundleApi(modified).request(`/public/posts/${OLD}`, { locale: "en" }).kind, "redirect");
    });
    // same scenario over HTTP: mock server with the modified data, real fetch, redirect: "manual"
    const modDir = join(tmp, "modified-data");
    cpSync(DATA_DIR, modDir, { recursive: true });
    writeFileSync(join(modDir, "manifest.json"), JSON.stringify(modified.manifest));
    writeFileSync(join(modDir, "en/posts", `${NEW}.json`), JSON.stringify(enPost));
    rmSync(join(modDir, "en/posts", `${OLD}.json`));
    writeFileSync(join(modDir, "en/posts/list.json"), JSON.stringify(modified.byLocale.en.postList));
    const modServer = createMockServer({ dataDir: modDir });
    const modPort = await listen(modServer);
    globalThis.fetch = realFetch;
    setEnv({ CMS_MODE: "mock", CMS_MOCK_URL: `http://127.0.0.1:${modPort}/api/v1` });
    m = freshModules(out);
    await test("mock over HTTP: getPost(la slug, en) -> { kind: 'redirect', location, status: 308 }; no fallback used", async () => {
      const w = captureWarn();
      try {
        const r = await m.loaders.getPost(OLD, "en");
        assert.deepEqual(r, { kind: "redirect", location: `/blog/${NEW}`, status: 308 });
        assert.equal((await m.loaders.getPost(NEW, "en")).kind, "post");
        assert.equal((await m.loaders.getPost(NEW, "la")).kind, "redirect");
        assert.equal(events(w.lines).length, 0);
      } finally { w.restore(); }
    });
    await close(modServer);

    // ============================================================ 3b. redirects (P-17)
    console.log("\n[3b] resolveRedirect: bundle/mock = null, api = P-17 with validation, failures stay 404");
    {
      const ok = (data) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
      const notFound = () => new Response(JSON.stringify({ success: false, code: "NOT_FOUND" }), { status: 404 });
      const calls3b = [];
      const answers = {
        "/old": () => ok({ target: "/new", status_code: 301, hops: 1 }),
        "/temp": () => ok({ target: "/new", status_code: 302, hops: 1 }),
        "/ext": () => ok({ target: "https://example.org/x", status_code: 307, hops: 1 }),
        "/loop": () => ok({ target: "/loop/", status_code: 301, hops: 1 }),
        "/http": () => ok({ target: "http://example.org/x", status_code: 301, hops: 1 }),
        "/proto": () => ok({ target: "//evil.example/x", status_code: 301, hops: 1 }),
        "/js": () => ok({ target: "javascript:alert(1)", status_code: 301, hops: 1 }),
        "/status": () => ok({ target: "/new", status_code: 200, hops: 1 }),
        "/junk": () => ok({ nope: true }),
        "/boom": () => new Response("{}", { status: 503 }),
        "/limited": () => new Response("{}", { status: 429 }),
      };
      const install = () => {
        globalThis.fetch = async (url, init = {}) => {
          const u = new URL(String(url));
          calls3b.push({ url: u, init });
          return (answers[u.searchParams.get("path")] ?? notFound)();
        };
      };

      setEnv({});
      globalThis.fetch = async () => { throw new Error("no fetch in bundle mode"); };
      let mm = freshModules(out);
      await test("bundle mode: null, no fetch", async () => {
        assert.equal(await mm.loaders.resolveRedirect("/old", "la"), null);
      });

      setEnv({ CMS_MODE: "mock", CMS_MOCK_URL: "http://127.0.0.1:1/api/v1" });
      mm = freshModules(out);
      await test("mock mode: null, no fetch", async () => {
        assert.equal(await mm.loaders.resolveRedirect("/old", "la"), null);
      });

      setEnv({ CMS_MODE: "api", NEXT_PUBLIC_API_BASE_URL: BASE, PORTAL_API_KEY: "k".repeat(32) });
      mm = freshModules(out);
      install();
      await test("api: request shape (path + locale query, X-Portal-Key, redirects tag)", async () => {
        const r = await mm.loaders.resolveRedirect("/old", "la");
        assert.deepEqual(r, { target: "/new", statusCode: 301, hops: 1 });
        const c = calls3b.at(-1);
        assert.equal(c.url.pathname, "/api/v1/public/redirects/resolve");
        assert.equal(c.url.searchParams.get("path"), "/old");
        assert.equal(c.url.searchParams.get("locale"), "la");
        assert.equal(headerOf(c.init, "x-portal-key"), "k".repeat(32));
        assert.deepEqual(c.init.next.tags, ["redirects"]);
      });
      await test("api: 302 and external https pass", async () => {
        assert.equal((await mm.loaders.resolveRedirect("/temp", "la")).statusCode, 302);
        assert.equal((await mm.loaders.resolveRedirect("/ext", "la")).target, "https://example.org/x");
      });
      await test("api: 404 = null", async () => {
        assert.equal(await mm.loaders.resolveRedirect("/missing", "la"), null);
      });
      await test("api: loop, http, protocol-relative, javascript:, bad status, junk body = null", async () => {
        for (const p of ["/loop", "/http", "/proto", "/js", "/status", "/junk"]) {
          assert.equal(await mm.loaders.resolveRedirect(p, "la"), null, p);
        }
      });
      await test("api: 503 / 429 / unreachable = null and logged, never thrown", async () => {
        const w = captureWarn();
        try {
          assert.equal(await mm.loaders.resolveRedirect("/boom", "la"), null);
          assert.equal(await mm.loaders.resolveRedirect("/limited", "la"), null);
          globalThis.fetch = async () => { throw Object.assign(new Error("refused"), { name: "TypeError" }); };
          assert.equal(await mm.loaders.resolveRedirect("/old2", "la"), null);
        } finally { w.restore(); install(); }
        const ev = events(w.lines).filter((e) => e.resource === "redirect");
        assert.ok(ev.length >= 2, JSON.stringify(ev));
      });
      await test("status mapping: 301/308 -> permanent (HTTP 308), 302/307 -> temporary (HTTP 307)", async () => {
        const r = mm.redirects;
        assert.deepEqual([301, 308, 302, 307].map(r.isPermanentRedirect), [true, true, false, false]);
        assert.deepEqual([301, 308, 302, 307].map(r.httpStatusFor), [308, 308, 307, 307]);
      });
      await test("loop guard ignores trailing slash and query of the source", async () => {
        assert.equal(mm.redirects.validateRedirect("/a/b", { target: "/a/b/", status_code: 301 }), null);
        assert.notEqual(mm.redirects.validateRedirect("/a/b", { target: "/a/c", status_code: 301 }), null);
      });
      globalThis.fetch = realFetch; // later sections expect the real fetch
      setEnv({});
    }

    // ============================================================ 4. mock server parity
    console.log("\n[4] CMS_MODE=mock: mock server vs in-process bundle (same routes, same bodies)");
    const mock = createMockServer({ key: "mock-key" });
    const port = await listen(mock);
    const mockBase = `http://127.0.0.1:${port}/api/v1`;
    setEnv({ CMS_MODE: "mock", CMS_MOCK_URL: mockBase, PORTAL_API_KEY: "mock-key" });
    m = freshModules(out);
    await test("every endpoint x locale (la, en, lo, xx): status, body and Location equal", async () => {
      const LOCS = ["la", "en", "lo", "xx"];
      const cases = [["/public/locales", {}], ["/public/sitemap", {}]]; // /health differs by design (reports its own source)
      for (const l of LOCS) {
        const q = { locale: l };
        cases.push(["/public/site", q], ["/public/settings", q], ["/public/settings", { ...q, group: "brand,seo" }], ["/public/ui-strings", q], ["/public/ui-strings", { ...q, ns: "site,forms" }],
          ["/public/menus/main", q], ["/public/menus/social", q], ["/public/menus/none", q], ["/public/categories", q], ["/public/tags", q],
          ["/public/albums", q], ["/public/albums/forest-photo-story", q], ["/public/albums/none", q], ["/public/faq/contact", q], ["/public/faq/none", q],
          ["/public/forms/contact", q], ["/public/forms/none", q], ["/public/posts", q], ["/public/posts", { ...q, category: "music" }], ["/public/posts", { ...q, category: "hiking" }],
          ["/public/posts", { ...q, tag: "x" }], ["/public/posts", { ...q, page: "2", limit: "3" }], ["/public/posts", { ...q, limit: "999" }],
          ["/public/posts/music-night-under-the-stars", q], ["/public/posts/none", q], ["/public/posts/constructor", q], ["/public/posts/list", q],
          ["/public/pages/resolve", { ...q, path: "/nope" }], ["/public/pages/resolve", { ...q, path: "BAD" }], ["/public/pages/resolve", q]);
        for (const [, key] of PAGES.map((p) => [p[0], p[0]])) cases.push(["/public/pages/resolve", { ...q, path: key }]);
      }
      let n = 0;
      for (const [path, query] of cases) {
        const want = m.bundle.bundleApi.get(path, query);
        const qs = new URLSearchParams(query).toString();
        const res = await fetch(`${mockBase}${path}${qs ? `?${qs}` : ""}`, { headers: { "X-Portal-Key": "mock-key" }, redirect: "manual" });
        const body = await res.json();
        assert.equal(res.status, want.status, `${path} ${qs} status`);
        assert.deepEqual(body, JSON.parse(JSON.stringify(want.body)), `${path} ${qs} body`);
        assert.equal(res.headers.get("location") ?? undefined, want.location, `${path} ${qs} location`);
        n++;
      }
      console.log(`        (${n} requests compared)`);
    });
    await test("loaders in mock mode equal loaders in bundle mode (deep-equal) and send the key", async () => {
      const mockModules = m;
      mock.requests.length = 0;
      const viaMock = {
        site: await mockModules.loaders.getSite("en"),
        pages: await Promise.all(PAGES.map((p) => mockModules.loaders.getPage(p[0], "la"))),
        posts: await mockModules.loaders.getPosts("en"),
        post: await mockModules.loaders.getPost("music-night-under-the-stars", "en"),
        form: await mockModules.loaders.getForm("contact", "en"),
        sitemap: await mockModules.loaders.getSitemap(),
      };
      assert.ok(mock.requests.length >= 10, "went over HTTP");
      assert.ok(mock.requests.every((r) => r.headers["x-portal-key"] === "mock-key"));
      assert.ok(mock.requests.every((r) => r.headers["x-request-id"] === undefined), "no X-Request-Id");
      // undici adds a constant "accept-language: *" itself; what matters is that no per-locale value is sent
      assert.ok(mock.requests.every((r) => [undefined, "*"].includes(r.headers["accept-language"])), "no locale-specific Accept-Language");
      setEnv({});
      const b = freshModules(out).loaders;
      assert.deepEqual(viaMock.site, await b.getSite("en"));
      assert.deepEqual(viaMock.pages, await Promise.all(PAGES.map((p) => b.getPage(p[0], "la"))));
      assert.deepEqual(viaMock.posts, await b.getPosts("en"));
      assert.deepEqual(viaMock.post, await b.getPost("music-night-under-the-stars", "en"));
      assert.deepEqual(viaMock.form, await b.getForm("contact", "en"));
      assert.deepEqual(viaMock.sitemap, await b.getSitemap());
    });

    // ============================================================ 5. api down -> bundle
    console.log("\n[5] API down -> automatic bundle fallback, logged once, never throws");
    const bundleModules = freshModules(out);
    const bundleSite = (await bundleModules.loaders.getSite("en")).menus.main.items.length;
    const expectFallback = async (label, env, reasonRe, prepare) => {
      await test(label, async () => {
        setEnv(env);
        const mm = freshModules(out);
        const w = captureWarn();
        try {
          if (prepare) await prepare();
          const s1 = await mm.loaders.getSite("en");
          const s2 = await mm.loaders.getSite("la"); // different cache key, same resource+reason -> still one log line
          const p = await mm.loaders.getPage("/our-path", "en");
          const post = await mm.loaders.getPost("music-night-under-the-stars", "en");
          assert.equal(s1.menus.main.items.length, bundleSite);
          assert.equal(s2.locale, "la");
          assert.equal(p.page.key, "our-path");
          assert.equal(post.kind, "post");
          const ev = events(w.lines);
          assert.ok(ev.length >= 3, `logged ${ev.length}`);
          assert.ok(ev.every((e) => reasonRe.test(e.reason)), JSON.stringify(ev));
          const keys = ev.map((e) => `${e.resource}|${e.reason}`);
          assert.equal(new Set(keys).size, keys.length, "each (resource, reason) logged once");
          assert.equal(ev.filter((e) => e.resource === "site").length, 1, "site logged once despite 2 calls");
          const counts = mm.fallback.getFallbackCounts();
          assert.ok(Object.values(counts).reduce((a, b) => a + b, 0) >= 4, "every fallback is counted");
        } finally { w.restore(); }
      });
    };
    const dead = await freePort();
    await expectFallback("connection refused (closed localhost port)", { CMS_MODE: "api", NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${dead}/api/v1`, PORTAL_API_KEY: "k" }, /^api_down:network$/);
    await expectFallback("API answers 503", { CMS_MODE: "api", PORTAL_API_KEY: "k" }, /^api_down:503$/, async () => {
      const bad = createMockServer({ failStatus: 503 });
      const p = await listen(bad);
      process.env.NEXT_PUBLIC_API_BASE_URL = `http://127.0.0.1:${p}/api/v1`;
      globalThis.__badServer = bad;
    });
    await close(globalThis.__badServer);
    await expectFallback("API slower than the timeout (CMS_FETCH_TIMEOUT_MS=150, server delays 800 ms)", { CMS_MODE: "api", PORTAL_API_KEY: "k", CMS_FETCH_TIMEOUT_MS: "150" }, /^api_down:timeout$/, async () => {
      const slow = createMockServer({ delayMs: 800 });
      const p = await listen(slow);
      process.env.NEXT_PUBLIC_API_BASE_URL = `http://127.0.0.1:${p}/api/v1`;
      globalThis.__slowServer = slow;
    });
    globalThis.__slowServer.closeAllConnections?.();
    await close(globalThis.__slowServer);
    await expectFallback("wrong X-Portal-Key (401) is treated as down", { CMS_MODE: "api", PORTAL_API_KEY: "wrong" }, /^api_down:401$/, async () => {
      const k = createMockServer({ key: "right" });
      const p = await listen(k);
      process.env.NEXT_PUBLIC_API_BASE_URL = `http://127.0.0.1:${p}/api/v1`;
      globalThis.__keyServer = k;
    });
    await close(globalThis.__keyServer);
    await expectFallback("NEXT_PUBLIC_API_BASE_URL is the relative placeholder '/api/v1'", { CMS_MODE: "api", NEXT_PUBLIC_API_BASE_URL: "/api/v1" }, /^api_down:unconfigured$/);
    await test("CMS_API_BASE_URL (runtime, server-only) wins over NEXT_PUBLIC_API_BASE_URL", async () => {
      setEnv({ CMS_MODE: "api", NEXT_PUBLIC_API_BASE_URL: "/api/v1", CMS_API_BASE_URL: `http://127.0.0.1:${port}/api/v1`, PORTAL_API_KEY: "mock-key" });
      const mm = freshModules(out);
      mock.requests.length = 0;
      const w = captureWarn();
      try {
        assert.equal((await mm.loaders.getSite("en")).locale, "en");
        assert.equal(mock.requests.length, 1);
        assert.equal(events(w.lines).length, 0);
      } finally { w.restore(); }
    });
    await expectFallback("mock mode with the mock server not running", { CMS_MODE: "mock", CMS_MOCK_URL: `http://127.0.0.1:${dead}/api/v1` }, /^api_down:network$/);
    await test("fallback never throws for any loader", async () => {
      setEnv({ CMS_MODE: "api", NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${dead}/api/v1` });
      const mm = freshModules(out);
      const w = captureWarn();
      try {
        const L = mm.loaders;
        await Promise.all([L.getLocales(), L.getSite("en"), L.getSettings("en"), L.getUiStrings("en"), L.getMenu("main", "en"), L.getPage("/", "en"), L.getPosts("en"), L.getPost("x", "en"), L.getCategories("en"), L.getTags("en"), L.getAlbums("en"), L.getAlbum("forest-photo-story", "en"), L.getFaq("contact", "en"), L.getForm("contact", "en"), L.getSitemap(), L.getRobots()]);
      } finally { w.restore(); }
    });

    // ============================================================ 5b. a failure is never sticky (B1)
    console.log("\n[5b] one fast retry, no sticky 'api_down' state, bounded fallback bookkeeping");
    const flaky = () => {
      const inner = createMockServer({ key: "k" });
      const ctl = { mode: "ok", count: 0, delayMs: 0 };
      const server = createHttpServer((rq, rs) => {
        ctl.count++;
        if (ctl.mode === "503") { rs.writeHead(503, { "Content-Type": "application/json" }); return rs.end(JSON.stringify({ success: false, code: "SERVICE_UNAVAILABLE" })); }
        if (ctl.mode === "slow") return setTimeout(() => inner.emit("request", rq, rs), ctl.delayMs);
        if (ctl.mode === "once-503") { ctl.mode = "ok"; rs.writeHead(503, { "Content-Type": "application/json" }); return rs.end(JSON.stringify({ success: false })); }
        if (ctl.mode === "once-reset") { ctl.mode = "ok"; return rq.socket.destroy(); }
        return inner.emit("request", rq, rs);
      });
      return { server, ctl };
    };
    const withFlaky = async (env, fn) => {
      const { server, ctl } = flaky();
      const fp = await listen(server);
      setEnv({ CMS_MODE: "api", PORTAL_API_KEY: "k", NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${fp}/api/v1`, ...env });
      const mm = freshModules(out);
      const w = captureWarn();
      try { await fn({ mm, ctl, w }); } finally { w.restore(); server.closeAllConnections?.(); await close(server); }
    };
    await test("a 503 once is retried inside the same call: API data, no fallback", async () => {
      await withFlaky({}, async ({ mm, ctl, w }) => {
        ctl.mode = "once-503";
        assert.equal((await mm.loaders.getSite("en")).locale, "en");
        assert.equal(ctl.count, 2, "one failed + one retried request");
        assert.equal(events(w.lines).length, 0, "no fallback was used");
      });
    });
    await test("a connection reset once is retried the same way", async () => {
      await withFlaky({}, async ({ mm, ctl, w }) => {
        ctl.mode = "once-reset";
        assert.equal((await mm.loaders.getSite("en")).locale, "en");
        assert.equal(ctl.count, 2);
        assert.equal(events(w.lines).length, 0);
      });
    });
    await test("503 for good: exactly ONE retry (2 requests per call), then the bundle; the next call asks the API again", async () => {
      await withFlaky({}, async ({ mm, ctl, w }) => {
        ctl.mode = "503";
        await mm.loaders.getSite("en");
        assert.equal(ctl.count, 2, "bounded: 2 requests, not a loop");
        assert.deepEqual(events(w.lines).map((e) => e.reason), ["api_down:503"]);
        ctl.mode = "ok"; ctl.count = 0; // the backend recovers: nothing may stay marked as down
        const before = events(w.lines).length;
        assert.equal((await mm.loaders.getSite("la")).locale, "la");
        assert.equal(ctl.count, 1, "the API is asked again at once");
        assert.equal(events(w.lines).length, before, "healthy answer: no fallback");
      });
    });
    await test("slow once: timeout -> bundle for that call only, NOT retried; the next call is served by the API", async () => {
      await withFlaky({ CMS_FETCH_TIMEOUT_MS: "150" }, async ({ mm, ctl, w }) => {
        ctl.mode = "slow"; ctl.delayMs = 600;
        await mm.loaders.getSite("en");
        assert.equal(ctl.count, 1, "a timeout spends the budget: no retry");
        assert.deepEqual(events(w.lines).map((e) => e.reason), ["api_down:timeout"]);
        ctl.mode = "ok"; ctl.count = 0;
        const before = events(w.lines).length;
        assert.equal((await mm.loaders.getSite("la")).locale, "la");
        assert.equal(ctl.count, 1);
        assert.equal(events(w.lines).length, before);
      });
    });
    await test("401 and a healthy 404 are not retried", async () => {
      await withFlaky({ PORTAL_API_KEY: "wrong" }, async ({ mm, ctl }) => {
        await mm.loaders.getSite("en");
        assert.equal(ctl.count, 1);
      });
      await withFlaky({}, async ({ mm, ctl }) => {
        assert.equal(await mm.loaders.getPage("/no-such-page", "en"), null);
        assert.equal(ctl.count, 1);
      });
    });
    await test("fallback log: once per minute per (resource, reason), a later outage is visible again", async () => {
      const fb = freshModules(out).fallback;
      const w = captureWarn();
      try {
        fb.logFallback("site", "en", "api_down:503", 1_000_000);
        fb.logFallback("site", "la", "api_down:503", 1_000_000 + 59_000);
        assert.equal(events(w.lines).length, 1, "throttled inside the minute");
        fb.logFallback("site", "en", "api_down:503", 1_000_000 + 61_000);
        assert.equal(events(w.lines).length, 2, "logged again after the minute");
        assert.equal(fb.getFallbackCounts()["site|api_down:503"], 3, "every use is counted");
      } finally { w.restore(); }
    });
    await test("fallback bookkeeping is bounded (visitor-chosen page paths)", async () => {
      const fb = freshModules(out).fallback;
      const w = captureWarn();
      try {
        for (let i = 0; i < 5000; i++) fb.logFallback(`page:/p${i}`, "en", "api_down:timeout", 5_000_000);
        assert.ok(Object.keys(fb.getFallbackCounts()).length <= 201, `${Object.keys(fb.getFallbackCounts()).length} count keys`);
        assert.ok(events(w.lines).length <= 201, `${events(w.lines).length} log lines`);
        assert.equal(Object.values(fb.getFallbackCounts()).reduce((a, b) => a + b, 0), 5000, "nothing is lost from the totals");
      } finally { w.restore(); }
    });

    await close(mock);
  } catch (e) {
    failed = true;
    console.error("cms selftest: aborted:", e);
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    rmSync(tmp, { recursive: true, force: true });
  }
  const bad = results.filter(([ok]) => !ok).length;
  console.log(`\ncms selftest: ${results.length - bad}/${results.length} passed${bad || failed ? " - FAILED" : ""}`);
  if (bad || failed) process.exitCode = 1;
}

if (isMain(import.meta.url)) await main();
