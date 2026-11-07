#!/usr/bin/env node
// Self-test of the preview flow (PF-10) without a test runner (npm run preview:selftest). Same approach as
// scripts/cms/selftest.mjs and scripts/site/selftest.mjs: the TypeScript is compiled with the repo's own `tsc` into a
// temp dir (nothing is written into the repo), `server-only` is stubbed, and the compiled code runs under node:assert.
// Covered: token / path validation (open-redirect attempts), cookie attributes, sliding refresh, the logic of
// /api/preview and /api/preview/exit (redirect target without the token), the resolve answer (resolved:{}, warnings,
// 401 / 422 / 429 / 5xx), warning texts, never-cache fetch options, noindex metadata. Network: only 127.0.0.1 sockets
// owned by this process (the mock API) and a stubbed fetch.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../cms/lib/util.mjs";
import { PREVIEW_TOKENS, createMockServer } from "../cms/mock-api.mjs";

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(true);
    console.log(`  PASS  ${name}`);
  } catch (e) {
    results.push(false);
    console.log(`  FAIL  ${name}\n        ${String(e?.stack ?? e).split("\n").slice(0, 6).join("\n        ")}`);
  }
}

function compile(tmp) {
  const out = join(tmp, "out");
  mkdirSync(join(tmp, "node_modules", "server-only"), { recursive: true });
  writeFileSync(join(tmp, "node_modules", "server-only", "index.js"), "module.exports = {};\n");
  mkdirSync(join(tmp, "node_modules", "next-intl", "server"), { recursive: true });
  writeFileSync(join(tmp, "node_modules", "next-intl", "server", "index.js"), "exports.getLocale = async () => 'en';\n"); // request scope stub
  symlinkSync(join(ROOT, "i18n"), join(tmp, "i18n"), "dir"); // messages.ts imports ../../../i18n/site/*.json relative to out/lib/preview
  symlinkSync(join(ROOT, "node_modules", "react"), join(tmp, "node_modules", "react"), "dir");
  const files = [
    "lib/preview/session", "lib/preview/resolve", "lib/preview/warnings", "lib/preview/handlers", "lib/preview/metadata", "lib/preview/messages",
    "lib/cms/preview", "lib/cms/client", "lib/cms/config", "lib/cms/result", "lib/cms/locale",
    "components/sections/adapters", "components/sections/preview-missing", // B5: draft sections (adapters import `@/lib/cms/media`)
  ].map((f) => join(ROOT, "src", `${f}.ts`));
  writeFileSync(
    join(tmp, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022", lib: ["es2023", "dom"], module: "commonjs", moduleResolution: "node10", esModuleInterop: true,
        resolveJsonModule: true, strict: true, skipLibCheck: true, incremental: false, outDir: out, rootDir: join(ROOT, "src"),
        baseUrl: join(ROOT, "src"), paths: { "@/*": ["*"] },
        types: ["node"], typeRoots: [join(ROOT, "node_modules", "@types")],
      },
      files,
    }),
  );
  execFileSync(process.execPath, [join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", join(tmp, "tsconfig.json")], { stdio: "inherit" });
  return out;
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const ENV_KEYS = ["CMS_MODE", "NEXT_PUBLIC_API_BASE_URL", "CMS_API_BASE_URL", "PORTAL_API_KEY", "CMS_FETCH_TIMEOUT_MS", "CMS_MOCK_URL"];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const setEnv = (env) => {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
};
const realFetch = globalThis.fetch;

const TOKEN = "T".repeat(10) + "-secret-preview-token_0123456789.~abc"; // scratch value, 47 chars
const SECRET_KEY = "scratch-portal-key-0123456789abcdef0123456789";

const tmp = mkdtempSync(join(tmpdir(), "preview-selftest-"));
try {
  const out = compile(tmp);
  const req = createRequire(join(out, "x.js"));
  const S = req("./lib/preview/session.js");
  const R = req("./lib/preview/resolve.js");
  const W = req("./lib/preview/warnings.js");
  const H = req("./lib/preview/handlers.js");
  const M = req("./lib/preview/metadata.js");
  const P = req("./lib/cms/preview.js");
  const T = req("./lib/preview/messages.js");
  // the compiled adapters import `@/lib/cms/media`: map the alias to the compiled tree
  const Module = createRequire(import.meta.url)("node:module");
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    return resolveFilename.call(this, request.startsWith("@/") ? join(out, request.slice(2)) : request, ...rest);
  };
  const A = req("./components/sections/adapters.js");
  const MISS = req("./components/sections/preview-missing.js");

  const pageData = (over = {}) => ({
    locale: "en",
    kind: "page",
    page: {
      locale: "en",
      page: { id: 2, key: "our-path", path: "/our-path", title: "Our Path (draft)" },
      sections: [
        { id: "a", key: "hero_brand", props: { title: "Draft hero" }, resolved: {} },
        { id: "b", key: "faq", props: {}, resolved: {} },
      ],
      media: {},
    },
    preview: { entity_type: "cms.pages", entity_id: 2, locale: "en", warnings: [{ code: "reference_not_published", path: "/sections/1/props/faq_group_key", message: "x" }] },
    ...over,
  });
  const okOutcome = () => ({ kind: "ok", data: R.parseResolveData(pageData()) });
  // M5 (doc/05 PT-18): the answer for a post link. `post` is the P-08 data object; a DRAFT may lack hero / category / body.
  const postData = (over = {}, post = {}) => ({
    locale: "en",
    kind: "post",
    post: {
      id: 9, slug: "draft-article", href: "/blog/draft-article", title: "Draft article", date: "Oct. 29.2026", date_time: "2026-10-29T00:00:00Z",
      category: null, hero: null, body: null, gallery: { heading: null, description: null, items: [] }, tags: [], media: {},
      seo: { title: "Draft article", description: null, og_image: { media_id: 3 }, canonical: "https://x.example/blog/draft-article", noindex: false },
      ...post,
    },
    preview: { entity_type: "cms.posts", entity_id: 9, locale: "en", warnings: [{ code: "reference_not_published", path: "/post/category_id", message: "x" }] },
    ...over,
  });

  // ---------------------------------------------------------------- token / path validation
  await test("token shape: 32-256 chars of [A-Za-z0-9._~-] only", () => {
    assert.ok(S.isValidToken(TOKEN));
    assert.ok(S.isValidToken("a".repeat(32)));
    assert.ok(S.isValidToken("a".repeat(256)));
    assert.ok(S.isValidToken("Zm9vYmFyLWJhc2U2NHVybC10b2tlbi00M2NoYXJzLS0"));
    for (const bad of ["", "a".repeat(31), "a".repeat(257), TOKEN + " ", " " + TOKEN, TOKEN + "\n", TOKEN.replace("-", "/"), TOKEN.replace("-", "+"), TOKEN.replace("-", "="), TOKEN.replace("-", "%"), "é".repeat(40), null, undefined, 42, [TOKEN], {}]) {
      assert.equal(S.isValidToken(bad), false, `accepted ${JSON.stringify(bad)}`);
    }
  });

  await test("path: only same-origin CMS page paths; every open-redirect shape is refused", () => {
    assert.equal(S.normalizePreviewPath("/"), "/");
    assert.equal(S.normalizePreviewPath("/our-path"), "/our-path");
    assert.equal(S.normalizePreviewPath("/our-path/"), "/our-path");
    assert.equal(S.normalizePreviewPath("/a/b-c/d1"), "/a/b-c/d1");
    const attacks = [
      "//evil.com", "//evil.com/", "/\\evil.com", "\\\\evil.com", "\\/evil.com", "///evil.com", "/\\/evil.com",
      "https://evil.com", "http://evil.com", "HTTP://evil.com", "javascript:alert(1)", "data:text/html,x", "mailto:a@b.c", "evil.com", "http:evil.com",
      "/%2F%2Fevil.com", "/%5Cevil.com", "/%2fevil.com", "/..//evil.com", "/a/../b", "/./a", "/a//b", "/a/", "//",
      "/a?x=1", "/a#x", "/a b", "/\tevil.com", "/\nevil.com", "/\r\nSet-Cookie: x=1", "/a\u0000b", "/A", "/Our-Path", "/é", "/a;b", "/a:b", "/@evil.com", "/ ",
      "", " ", "x", "/" + "a".repeat(201), null, undefined, 1, ["/a"], {},
    ];
    for (const a of attacks) {
      const got = S.normalizePreviewPath(a);
      // "/a/" is the one entry here that legitimately normalises (trailing slash); everything else must be refused
      if (a === "/a/") assert.equal(got, "/a");
      else assert.equal(got, null, `accepted ${JSON.stringify(a)} as ${got}`);
    }
  });

  // ---------------------------------------------------------------- cookie
  await test("cookie value: round trip, tamper / truncation / foreign values are rejected", () => {
    const v = S.encodeSession({ token: TOKEN, path: "/our-path" });
    assert.deepEqual(S.parseSession(v), { token: TOKEN, path: "/our-path" });
    assert.deepEqual(S.parseSession(S.encodeSession({ token: TOKEN, path: "/" })), { token: TOKEN, path: "/" });
    for (const bad of [undefined, null, "", TOKEN, "v1.", "v2." + v.slice(3), v.slice(0, -40), v + "!", v.replace(/^v1\.[^.]+/, "v1." + Buffer.from("//evil.com").toString("base64url")), v.replace(/^v1\.[^.]+/, "v1." + Buffer.from("/a b").toString("base64url"))]) {
      assert.equal(S.parseSession(bad), null, `accepted ${String(bad)}`);
    }
    assert.throws(() => S.encodeSession({ token: "short", path: "/a" }));
    assert.throws(() => S.encodeSession({ token: TOKEN, path: "//evil.com" }));
  });

  await test("Set-Cookie attributes: HttpOnly, SameSite=Lax, Path=/, Max-Age=1800, Secure outside dev", () => {
    const prod = S.setSessionCookie({ token: TOKEN, path: "/our-path" }, true);
    const dev = S.setSessionCookie({ token: TOKEN, path: "/our-path" }, false);
    const attrs = (c) => c.split("; ").slice(1);
    assert.deepEqual(attrs(prod), ["Path=/", "Max-Age=1800", "HttpOnly", "SameSite=Lax", "Secure"]);
    assert.deepEqual(attrs(dev), ["Path=/", "Max-Age=1800", "HttpOnly", "SameSite=Lax"]);
    assert.ok(prod.startsWith("materm_preview=v1."));
    assert.equal(S.PREVIEW_MAX_AGE_SECONDS, 30 * 60);
    assert.equal(S.cookieIsSecure({ NODE_ENV: "production" }), true);
    assert.equal(S.cookieIsSecure({ NODE_ENV: "development" }), false);
    assert.equal(S.cookieIsSecure({}), false);
    assert.ok(!/SameSite=None/i.test(prod) && !/Domain=/i.test(prod));
    const gone = S.clearSessionCookie(true);
    assert.deepEqual(attrs(gone), ["Path=/", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "HttpOnly", "SameSite=Lax", "Secure"]);
    assert.ok(gone.startsWith("materm_preview=;"));
  });

  await test("sliding refresh: every page request with the cookie re-arms Max-Age; prefetch / assets / api do not", () => {
    const value = S.encodeSession({ token: TOKEN, path: "/our-path" });
    for (let i = 0; i < 3; i++) {
      const plan = S.planRefresh({ cookieValue: value, pathname: "/our-path", isPrefetch: false, secure: true });
      assert.equal(plan.setCookies.length, 1);
      assert.ok(plan.setCookies[0].includes("Max-Age=1800"));
      assert.ok(plan.setCookies[0].startsWith(`materm_preview=${value};`)); // same value, fresh window
      assert.equal(plan.headers["X-Robots-Tag"], "noindex, nofollow, noarchive");
    }
    // another page of the site also counts as activity of the session
    assert.equal(S.planRefresh({ cookieValue: value, pathname: "/blog", isPrefetch: false, secure: true }).setCookies.length, 1);
    assert.deepEqual(S.planRefresh({ cookieValue: value, pathname: "/blog", isPrefetch: true, secure: true }).setCookies, []);
    for (const p of ["/_next/static/chunks/a.js", "/api/preview", "/api/preview/exit", "/images/site/a.png", "/favicon.ico", "/robots.txt"]) {
      assert.equal(S.planRefresh({ cookieValue: value, pathname: p, isPrefetch: false, secure: true }), null, p);
    }
    assert.equal(S.planRefresh({ cookieValue: undefined, pathname: "/", isPrefetch: false, secure: true }), null);
    const junk = S.planRefresh({ cookieValue: "garbage", pathname: "/", isPrefetch: false, secure: true });
    assert.deepEqual(junk.setCookies, [S.clearSessionCookie(true)]);
  });

  await test("proxy.ts matcher is cookie-gated, literal, in sync with the cookie name, and skips _next / api", () => {
    const src = readFileSync(join(ROOT, "src", "proxy.ts"), "utf8");
    assert.ok(src.includes(`has: [{ type: "cookie", key: "${S.PREVIEW_COOKIE}" }]`));
    assert.ok(src.includes("(?!_next/|api/)"));
  });

  // ---------------------------------------------------------------- /api/preview
  const start = (query, over = {}) => {
    const calls = [];
    const input = {
      url: `https://site.example/api/preview?${query}`,
      cookieHeader: over.cookieHeader ?? null,
      mode: over.mode ?? "api",
      secure: over.secure ?? true,
      resolve: async (token, opts) => {
        calls.push({ token, ...opts });
        return over.outcome ?? okOutcome();
      },
    };
    return H.handleStart(input).then((r) => ({ r, calls }));
  };
  const expiredLoc = "/preview-status?s=expired";

  await test("/api/preview: valid link -> 307 to the page WITHOUT the token, cookie set, Draft Mode on, token verified once", async () => {
    const { r, calls } = await start(`token=${TOKEN}&path=/our-path&locale=en`);
    assert.equal(r.status, 307);
    assert.equal(r.location, "/our-path");
    assert.ok(!r.location.includes(TOKEN) && !r.location.includes("token") && !r.location.includes("?"));
    assert.equal(r.draft, "enable");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { token: TOKEN, path: "/our-path", locale: "en" });
    assert.ok(r.setCookies[0].startsWith("materm_preview="));
    assert.ok(r.setCookies[0].includes("HttpOnly") && r.setCookies[0].includes("SameSite=Lax") && r.setCookies[0].includes("Max-Age=1800"));
    assert.deepEqual(S.parseSession(S.readCookie(r.setCookies[0].split("; ")[0], "materm_preview")), { token: TOKEN, path: "/our-path" });
    // the link language becomes the site language
    assert.ok(r.setCookies.some((c) => c.startsWith("locale=en;")));
    for (const [k, v] of Object.entries(H.NO_STORE_HEADERS)) assert.ok(v, k);
    assert.equal(H.NO_STORE_HEADERS["Cache-Control"], "no-store, max-age=0");
    assert.equal(H.NO_STORE_HEADERS["Referrer-Policy"], "no-referrer");
  });

  await test("/api/preview: no path in the link -> target is the page path the backend returned", async () => {
    const { r, calls } = await start(`token=${TOKEN}`);
    assert.equal(r.location, "/our-path");
    assert.equal(calls[0].path, null);
    assert.equal(calls[0].locale, "la"); // no cookie, no link locale -> the site default
  });

  await test("/api/preview (post): the link path /blog/<slug> is the cookie path and the redirect; without a path the backend's post.href is used", async () => {
    const outcome = { kind: "ok", data: R.parseResolveData(postData()) };
    let x = await start(`token=${TOKEN}&path=/blog/draft-article&locale=en`, { outcome });
    assert.equal(x.r.status, 307);
    assert.equal(x.r.location, "/blog/draft-article");
    assert.ok(!x.r.location.includes(TOKEN) && !x.r.location.includes("?"));
    assert.equal(x.r.draft, "enable");
    assert.deepEqual(x.calls[0], { token: TOKEN, path: "/blog/draft-article", locale: "en" });
    assert.deepEqual(S.parseSession(S.readCookie(x.r.setCookies[0].split("; ")[0], "materm_preview")), { token: TOKEN, path: "/blog/draft-article" });
    x = await start(`token=${TOKEN}`, { outcome });
    assert.equal(x.r.location, "/blog/draft-article");
    assert.equal(x.calls[0].path, null);
    // a post path is a valid whitelist entry, a path that could escape the blog is still not
    for (const bad of ["/blog/../admin", "/blog//x", "/blog/x?y=1", "/blog/%2e%2e"]) {
      x = await start(`token=${TOKEN}&path=${encodeURIComponent(bad)}`, { outcome });
      assert.equal(x.r.location, expiredLoc, bad);
      assert.equal(x.calls.length, 0, bad);
    }
  });

  await test("/api/preview: locale from the link only when we ship it; else the visitor's locale cookie", async () => {
    let x = await start(`token=${TOKEN}&path=/our-path&locale=fr`);
    assert.equal(x.calls[0].locale, "la");
    assert.ok(!x.r.setCookies.some((c) => c.startsWith("locale=")));
    x = await start(`token=${TOKEN}&path=/our-path&locale=../x`, { cookieHeader: "locale=en; a=b" });
    assert.equal(x.calls[0].locale, "en");
    x = await start(`token=${TOKEN}&path=/our-path&locale=lo`);
    assert.equal(x.calls[0].locale, "la"); // alias
    assert.ok(x.r.setCookies.some((c) => c.startsWith("locale=la;")));
  });

  await test("/api/preview: bad token shape / open redirect / duplicates -> expired page, backend never asked, cookie cleared", async () => {
    const bad = [
      "", "token=", "token=short", `token=${TOKEN}%20`, `token=${TOKEN}&token=${TOKEN}`, `token=${TOKEN}&path=//evil.com`, `token=${TOKEN}&path=https://evil.com`,
      `token=${TOKEN}&path=/\\evil.com`, `token=${TOKEN}&path=%2F%2Fevil.com`, `token=${TOKEN}&path=/a?x=1`, `token=${TOKEN}&path=/a&path=/b`, `token=${TOKEN}&path=javascript:alert(1)`,
      `token=${TOKEN}&locale=en&locale=la`, `token=${"a".repeat(300)}`,
    ];
    for (const q of bad) {
      const { r, calls } = await start(q);
      assert.equal(r.location, expiredLoc, q);
      assert.equal(calls.length, 0, q);
      assert.equal(r.draft, "disable");
      assert.deepEqual(r.setCookies, [S.clearSessionCookie(true)]);
      assert.ok(!r.location.includes("token"));
    }
  });

  await test("/api/preview: 401 / 422 from the backend = the same expired page, no reason; 429 / unavailable keep the cookie", async () => {
    let x = await start(`token=${TOKEN}&path=/our-path`, { outcome: { kind: "invalid" } });
    assert.deepEqual([x.r.status, x.r.location, x.r.setCookies, x.r.draft], [307, expiredLoc, [S.clearSessionCookie(true)], "disable"]);
    x = await start(`token=${TOKEN}&path=/our-path`, { outcome: { kind: "busy" } });
    assert.deepEqual([x.r.location, x.r.setCookies], ["/preview-status?s=busy", []]);
    x = await start(`token=${TOKEN}&path=/our-path`, { outcome: { kind: "unavailable", reason: "500" } });
    assert.deepEqual([x.r.location, x.r.setCookies], ["/preview-status?s=unavailable", []]);
    assert.ok(!JSON.stringify(x.r).includes(TOKEN) || x.r.setCookies.length === 0);
  });

  await test("/api/preview: bundle mode answers 'preview needs CMS_MODE=api', asks nobody, sets nothing", async () => {
    const { r, calls } = await start(`token=${TOKEN}&path=/our-path`, { mode: "bundle" });
    assert.equal(r.location, "/preview-status?s=unsupported");
    assert.equal(calls.length, 0);
    assert.ok(r.setCookies.every((c) => c.includes("Max-Age=0")));
    assert.ok(!r.setCookies.some((c) => c.includes(TOKEN)));
  });

  await test("/api/preview: dev (http) cookie has no Secure flag", async () => {
    const { r } = await start(`token=${TOKEN}&path=/our-path`, { secure: false });
    assert.ok(!r.setCookies[0].includes("Secure"));
  });

  // ---------------------------------------------------------------- /api/preview/exit
  await test("/api/preview/exit: clears cookie + Draft Mode, validated path or '/', POST -> 303, reason=expired -> expired page", () => {
    const exit = (q, method = "GET") => H.handleExit({ url: `https://site.example/api/preview/exit${q}`, method, secure: true });
    let r = exit("?path=/our-path");
    assert.deepEqual([r.status, r.location, r.draft], [307, "/our-path", "disable"]);
    assert.deepEqual(r.setCookies, [S.clearSessionCookie(true)]);
    assert.equal(exit("").location, "/");
    assert.equal(exit("?path=//evil.com").location, "/");
    assert.equal(exit("?path=https://evil.com").location, "/");
    assert.equal(exit("?path=/\\evil.com").location, "/");
    assert.equal(exit("?path=/a?x=1").location, "/");
    r = exit("?path=/blog", "POST");
    assert.deepEqual([r.status, r.location], [303, "/blog"]);
    r = exit("?reason=expired&path=/our-path");
    assert.equal(r.location, expiredLoc);
    assert.deepEqual(r.setCookies, [S.clearSessionCookie(true)]);
  });

  // ---------------------------------------------------------------- resolve answer
  await test("resolve answer: P-06 data object inside data.page (title = data.page.page.title); resolved:{} and warnings kept", () => {
    const d = R.parseResolveData(pageData());
    assert.equal(d.page.page.title, "Our Path (draft)");
    assert.equal(d.page.sections.length, 2);
    assert.deepEqual(d.page.sections[1].resolved, {});
    assert.deepEqual(d.preview.warnings, [{ code: "reference_not_published", path: "/sections/1/props/faq_group_key" }]);
    assert.deepEqual(d.page.media, {});
    // lenient where harmless, strict where it matters
    assert.deepEqual(R.parseResolveData(pageData({ preview: { entity_type: "cms.pages", entity_id: 1, locale: "en" } })).preview.warnings, []);
    assert.equal(R.parseResolveData(pageData({ kind: "post" })), null, "a post answer without data.post is unusable");
    assert.equal(R.parseResolveData(pageData({ kind: "album" })), null);
    assert.equal(R.parseResolveData(pageData({ page: undefined })), null);
    assert.equal(R.parseResolveData(pageData({ page: { page: {}, sections: [] } })), null);
    assert.equal(R.parseResolveData(null), null);
    assert.equal(R.parseResolveData("x"), null);
  });

  await test("resolve answer (post): P-08 data object inside data.post; a draft's null parts are filled, noindex forced, og image dropped", () => {
    const d = R.parseResolveData(postData());
    assert.equal(d.kind, "post");
    assert.equal(d.post.title, "Draft article");
    assert.equal(d.post.hero, null);
    assert.equal(d.post.category, null);
    assert.equal(d.post.body, null);
    assert.deepEqual(d.post.gallery, { heading: null, description: null, items: [] });
    assert.deepEqual(d.post.tags, []);
    assert.deepEqual(d.post.media, {});
    assert.equal(d.post.seo.noindex, true, "a preview is never indexed, whatever the backend says");
    assert.equal(d.post.seo.og_image, null);
    assert.equal(d.post.locale, "en");
    assert.deepEqual(d.preview.warnings, [{ code: "reference_not_published", path: "/post/category_id" }]);
    // a sparse backend answer never leaves a container undefined for the article page
    const sparse = R.parseResolveData(postData({}, { gallery: undefined, tags: undefined, media: undefined, seo: undefined, date: undefined }));
    assert.deepEqual([sparse.post.gallery.items, sparse.post.tags, sparse.post.media, sparse.post.date], [[], [], {}, ""]);
    assert.equal(sparse.post.seo.title, "Draft article");
    // strict where it matters
    assert.equal(R.parseResolveData(postData({ post: undefined })), null);
    assert.equal(R.parseResolveData(postData({}, { slug: 5 })), null);
    assert.equal(R.parseResolveData(postData({}, { href: undefined })), null);
    assert.equal(R.parseResolveData(postData({ preview: undefined })), null);
    assert.equal(R.classifyResolve({ kind: "ok", ok: true, status: 200, data: postData(), source: "api" }).kind, "ok");
  });

  await test("resolve status handling: 401 INVALID_TOKEN / 422 = invalid, 429 = busy, 401 other + 5xx + timeout + bad body = unavailable", () => {
    const err = (status, code) => ({ kind: "error", ok: false, status, code, down: true, source: "api" });
    assert.equal(R.classifyResolve(err(401, "INVALID_TOKEN")).kind, "invalid");
    assert.equal(R.classifyResolve(err(422, "VALIDATION_FAILED")).kind, "invalid");
    assert.equal(R.classifyResolve(err(429, "RATE_LIMITED")).kind, "busy");
    assert.deepEqual(R.classifyResolve(err(401, "UNAUTHENTICATED")), { kind: "unavailable", reason: "portal_key_rejected" });
    assert.equal(R.classifyResolve(err(401, undefined)).kind, "unavailable");
    for (const s of [500, 502, 503, 404, 403, "timeout", "network", "invalid", "unconfigured"]) assert.equal(R.classifyResolve(err(s)).kind, "unavailable", String(s));
    assert.equal(R.classifyResolve({ kind: "ok", ok: true, status: 200, data: { nope: 1 }, source: "api" }).kind, "unavailable");
    assert.equal(R.classifyResolve({ kind: "ok", ok: true, status: 200, data: pageData(), source: "api" }).kind, "ok");
    assert.equal(R.classifyResolve({ kind: "redirect", ok: false, status: 308, location: "/x", source: "api" }).kind, "unavailable");
  });

  await test("warning codes -> one readable line each (en + la), unknown codes get the generic line", () => {
    const en = JSON.parse(readFileSync(join(ROOT, "i18n/site/preview.en.json"), "utf8"));
    const la = JSON.parse(readFileSync(join(ROOT, "i18n/site/preview.la.json"), "utf8"));
    for (const code of ["reference_not_published", "link_page_not_published", "post_not_published", "section_type_unknown", "shared_section_unavailable", "shared_section_not_live"]) {
      assert.equal(W.warningMessageKey(code), code);
      for (const f of [en, la]) assert.ok(typeof f.warnings[code] === "string" && f.warnings[code].length > 10 && !f.warnings[code].includes(code), code);
    }
    for (const bad of ["", "brand_new_code", "__proto__", "constructor", "REFERENCE_NOT_PUBLISHED"]) assert.equal(W.warningMessageKey(bad), "unknown", bad);
    assert.ok(en.warnings.unknown && la.warnings.unknown);
    for (const k of ["expiredTitle", "unsupportedTitle", "unsupportedDescription", "busyTitle", "busyDescription", "unavailableTitle", "unavailableDescription"]) assert.ok(en.status[k] && la.status[k], k);
    // the expired copy is a shared UI string, present in both locales of common.*.json
    for (const loc of ["en", "la"]) assert.ok(JSON.parse(readFileSync(join(ROOT, `i18n/site/common.${loc}.json`), "utf8")).preview.expired.length > 10);
    assert.equal(la._todoTranslate, true);
  });

  await test("preview copy is NOT a next-intl namespace (visitors do not download it); interpolation + en fallback work", () => {
    const request = readFileSync(join(ROOT, "src/i18n/request.ts"), "utf8");
    assert.ok(!/preview\.(en|la)\.json/.test(request) && !/\bpreview:/.test(request));
    const dict = { warningsTitle: "Not everything ({count})", only: { en: "x" } };
    assert.equal(T.formatPreviewText(dict, "warningsTitle", { count: 3 }), "Not everything (3)");
    assert.equal(T.formatPreviewText(dict, "warningAt", { path: "/a" }), "at /a"); // missing in this dict -> the English file
    assert.equal(T.formatPreviewText(dict, "no.such.key"), "no.such.key");
    assert.equal(T.formatPreviewText({}, "warningsTitle", {}), "Not everything could be shown ({count})");
  });

  await test("noindex: preview and open-session pages return robots {index:false, follow:false}; normal pages are untouched", () => {
    const base = { title: "Our Path", description: "d", robots: undefined };
    assert.deepEqual(M.withPreviewRobots(base, true).robots, { index: false, follow: false });
    assert.equal(M.withPreviewRobots(base, true).title, "Our Path"); // everything else stays as today
    assert.equal(M.withPreviewRobots(base, false), base);
    assert.deepEqual(M.PREVIEW_ROBOTS, { index: false, follow: false });
  });

  // ---------------------------------------------------------------- never-cache + token only in a header
  await test("resolve request: GET, cache 'no-store', no tags / revalidate, token ONLY in X-Preview-Token (not the URL), portal key server-side", async () => {
    setEnv({ CMS_MODE: "api", CMS_API_BASE_URL: "http://portal.test/api/v1", PORTAL_API_KEY: SECRET_KEY });
    const seen = [];
    globalThis.fetch = async (url, init) => {
      seen.push({ url: String(url), init });
      return new Response(JSON.stringify({ success: true, data: pageData() }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    try {
      const o = await P.resolvePreview(TOKEN, { path: "/our-path", locale: "en" });
      assert.equal(o.kind, "ok");
      assert.equal(seen.length, 1);
      const { url, init } = seen[0];
      assert.equal(url, "http://portal.test/api/v1/preview/resolve?locale=en&path=%2Four-path");
      assert.ok(!url.includes(TOKEN) && !/token/i.test(url));
      assert.equal(init.method, "GET");
      assert.equal(init.cache, "no-store");
      assert.equal(init.next, undefined, "preview must not carry next.tags / next.revalidate");
      assert.equal(init.headers["X-Preview-Token"], TOKEN);
      assert.equal(init.headers["X-Portal-Key"], SECRET_KEY);
      assert.equal(init.headers["X-Request-Id"], undefined);
      assert.ok(init.signal);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  await test("resolve: backend trouble is never turned into published content (no bundle fallback), nothing is logged with the token", async () => {
    setEnv({ CMS_MODE: "api", CMS_API_BASE_URL: "http://portal.test/api/v1", PORTAL_API_KEY: "wrong" });
    const logs = [];
    const { warn, log, error, info } = console;
    console.warn = console.log = console.error = console.info = (...a) => logs.push(a.join(" "));
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, code: "UNAUTHENTICATED" }), { status: 401 });
    try {
      assert.deepEqual(await P.resolvePreview(TOKEN, { path: "/our-path", locale: "en" }), { kind: "unavailable", reason: "portal_key_rejected" });
      globalThis.fetch = async () => { throw Object.assign(new Error("down"), { name: "TimeoutError" }); };
      assert.equal((await P.resolvePreview(TOKEN, { path: "/our-path", locale: "en" })).kind, "unavailable");
      setEnv({ CMS_MODE: "api" }); // no base URL at all
      assert.equal((await P.resolvePreview(TOKEN, { path: "/our-path", locale: "en" })).kind, "unavailable");
    } finally {
      globalThis.fetch = realFetch;
      Object.assign(console, { warn, log, error, info });
    }
    assert.ok(logs.every((l) => !l.includes(TOKEN) && !l.includes("wrong")), logs.join("|"));
  });

  await test("mock API end to end: valid / warnings / expired / unknown / path mismatch / malformed / 429 / 500, token travels in a header", async () => {
    const mock = createMockServer({ key: SECRET_KEY });
    const port = await freePort();
    await new Promise((r) => mock.listen(port, "127.0.0.1", r));
    setEnv({ CMS_MODE: "mock", CMS_MOCK_URL: `http://127.0.0.1:${port}/api/v1`, PORTAL_API_KEY: SECRET_KEY });
    try {
      let o = await P.resolvePreview(PREVIEW_TOKENS.valid, { path: "/our-path", locale: "en" });
      assert.equal(o.kind, "ok");
      assert.equal(o.data.page.page.path, "/our-path");
      assert.ok(o.data.page.page.title.endsWith("(draft)"));
      assert.ok(o.data.page.sections.find((s) => s.key === "hero_brand").props.title.endsWith("DRAFT SNAPSHOT"));
      assert.deepEqual(o.data.preview.warnings, []);
      assert.equal(o.data.preview.entity_type, "cms.pages");

      o = await P.resolvePreview(PREVIEW_TOKENS.warnings, { path: "/contact", locale: "en" });
      assert.equal(o.kind, "ok");
      assert.deepEqual(o.data.page.sections.filter((s) => s.key === "faq" || s.key === "contact_section").map((s) => s.resolved), [{}, {}]);
      assert.deepEqual(o.data.preview.warnings.map((w) => w.code), ["reference_not_published", "reference_not_published", "link_page_not_published", "brand_new_code_from_the_future"]);
      assert.equal(W.warningMessageKey(o.data.preview.warnings[3].code), "unknown");

      o = await P.resolvePreview(PREVIEW_TOKENS.home, { path: "/", locale: "la" });
      assert.equal(o.kind, "ok");

      o = await P.resolvePreview(PREVIEW_TOKENS.draft, { path: "/our-path", locale: "en" }); // B5 fixture: an incomplete draft
      assert.equal(o.kind, "ok");
      assert.equal(o.data.page.sections.find((s) => s.key === "hero_brand").props.background, null);
      assert.deepEqual(o.data.page.sections.find((s) => s.key === "about_blocks").props.items, []);

      // M5: a post link (kind "post", P-08 body inside data.post), and an incomplete draft of it
      o = await P.resolvePreview(PREVIEW_TOKENS.post, { path: "/blog/music-night-under-the-stars", locale: "en" });
      assert.equal(o.kind, "ok");
      assert.equal(o.data.kind, "post");
      assert.ok(o.data.post.title.endsWith("(draft)"));
      assert.equal(o.data.post.href, "/blog/music-night-under-the-stars");
      assert.equal(o.data.post.seo.noindex, true);
      assert.ok(o.data.post.hero && Object.keys(o.data.post.media).length > 0);
      assert.equal(o.data.preview.entity_type, "cms.posts");
      o = await P.resolvePreview(PREVIEW_TOKENS.postDraft, { path: "/blog/music-night-under-the-stars", locale: "en" });
      assert.equal(o.kind, "ok");
      assert.deepEqual([o.data.post.hero, o.data.post.category, o.data.post.body], [null, null, null]);
      assert.deepEqual(o.data.preview.warnings.map((w) => w.code), ["reference_not_published", "post_not_published"]);
      assert.equal((await P.resolvePreview(PREVIEW_TOKENS.post, { path: "/our-path", locale: "en" })).kind, "invalid", "a post token on a page path looks like any dead token");
      assert.equal((await P.resolvePreview(PREVIEW_TOKENS.valid, { path: "/blog/music-night-under-the-stars", locale: "en" })).kind, "invalid", "a page token on a post path too");

      for (const t of [PREVIEW_TOKENS.expired, "mock-preview-never-issued-token-0123456789abc"]) {
        assert.equal((await P.resolvePreview(t, { path: "/our-path", locale: "en" })).kind, "invalid", t);
      }
      assert.equal((await P.resolvePreview(PREVIEW_TOKENS.valid, { path: "/blog", locale: "en" })).kind, "invalid", "path mismatch looks like any other dead token");
      assert.equal((await P.resolvePreview("tooshort", { path: "/our-path", locale: "en" })).kind, "invalid", "422 = malformed");
      assert.equal((await P.resolvePreview(PREVIEW_TOKENS.rateLimited, { path: "/our-path", locale: "en" })).kind, "busy");
      assert.equal((await P.resolvePreview(PREVIEW_TOKENS.broken, { path: "/our-path", locale: "en" })).kind, "unavailable");

      // every request: header token, never in the query; replies are no-store on the wire
      const previewReqs = mock.requests.filter((r) => r.path.endsWith("/preview/resolve"));
      assert.ok(previewReqs.length >= 13);
      for (const r of previewReqs) {
        assert.ok(!("token" in r.query) && !Object.values(r.query).some((v) => String(v).includes("mock-preview")));
        assert.equal(r.headers["x-portal-key"], SECRET_KEY);
        assert.ok(typeof r.headers["x-preview-token"] === "string");
      }
      const raw = await realFetch(`http://127.0.0.1:${port}/api/v1/preview/resolve?path=/our-path`, { headers: { "X-Portal-Key": SECRET_KEY, "X-Preview-Token": PREVIEW_TOKENS.valid } });
      assert.equal(raw.headers.get("cache-control"), "no-store");
      assert.equal(raw.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
      assert.equal(raw.headers.get("vary"), "X-Preview-Token");
      const noHeader = await realFetch(`http://127.0.0.1:${port}/api/v1/preview/resolve`, { headers: { "X-Portal-Key": SECRET_KEY } });
      assert.equal(noHeader.status, 422);
      const noKey = await realFetch(`http://127.0.0.1:${port}/api/v1/preview/resolve`, { headers: { "X-Preview-Token": PREVIEW_TOKENS.valid } });
      assert.equal(noKey.status, 401);
      assert.equal((await noKey.json()).code, "UNAUTHENTICATED");
      // and the public routes still answer as before
      assert.equal((await realFetch(`http://127.0.0.1:${port}/api/v1/public/locales`, { headers: { "X-Portal-Key": SECRET_KEY } })).status, 200);
    } finally {
      await new Promise((r) => mock.close(r));
    }
  });

  await test("bundle mode ignores the preview cookie (readPreviewSession needs no request scope)", async () => {
    setEnv({ CMS_MODE: "bundle" });
    assert.equal(await P.readPreviewSession(), null);
    setEnv({});
    assert.equal(await P.readPreviewSession(), null);
  });

  // ---------------------------------------------------------------- B5: draft sections in preview
  const MEDIA = {
    7: { id: 7, url: "/images/site/hero.jpg", alt: "a hero", width: 100, height: 50 },
    8: { id: 8, url: "https://files.example.test:8080/hero.jpg", alt: "", width: 100, height: 50 }, // any absolute http(s) host is fine
    9: { id: 9, url: "javascript:alert(1)", alt: "", width: 100, height: 50 },
    10: { id: 10, url: "//evil.example.test/x.jpg", alt: "", width: 100, height: 50 },
    11: { id: 11, url: "data:image/png;base64,AAAA", alt: "", width: 100, height: 50 },
  };
  const heroSection = (props) => ({ id: "h", key: "hero_brand", version: 1, props: { title: "Draft title", ...props }, resolved: undefined });
  await test("hero_brand without a background image: title and text stay, background null, hint only in preview", () => {
    const visitor = A.ADAPTERS.hero_brand(heroSection({ description: "Sub", background: undefined }), { locale: "en", media: MEDIA, category: null });
    assert.equal(visitor.title, "Draft title");
    assert.equal(visitor.description, "Sub");
    assert.equal(visitor.background, null);
    assert.ok(!("previewHint" in visitor), "a visitor never sees the hint");
    const editor = A.ADAPTERS.hero_brand(heroSection({}), { locale: "en", media: MEDIA, category: null, preview: true });
    assert.equal(editor.previewHint, "no_background_image");
    const withImage = A.ADAPTERS.hero_brand(heroSection({ background: { media_id: 7 } }), { locale: "en", media: MEDIA, category: null, preview: true });
    assert.equal(withImage.background.url, "/images/site/hero.jpg");
    assert.ok(!("previewHint" in withImage), "no hint when the image is there");
  });

  await test("hero_brand / hero_article: an unknown media id or an unsafe URL (javascript:, data:, protocol-relative) is 'no image', the title stays; no title = nothing to draw", () => {
    const ctx = { locale: "en", media: MEDIA, category: null, preview: true };
    assert.equal(A.ADAPTERS.hero_brand(heroSection({ background: { media_id: 999 } }), ctx).background, null);
    for (const id of [9, 10, 11]) {
      const unsafe = A.ADAPTERS.hero_brand(heroSection({ background: { media_id: id } }), { ...ctx, preview: false });
      assert.equal(unsafe.background, null, `media ${id}: unsafe scheme is treated as missing`);
      assert.equal(unsafe.title, "Draft title");
    }
    const remote = A.ADAPTERS.hero_brand(heroSection({ background: { media_id: 8 } }), { ...ctx, preview: false });
    assert.equal(remote.background.url, "https://files.example.test:8080/hero.jpg", "an absolute file-service URL on any host is present");
    const art = A.ADAPTERS.hero_article({ id: "a", key: "hero_article", version: 1, props: { title: "Article", meta_items: [{ text: "x" }, null, { text: "" }] }, resolved: undefined }, ctx);
    assert.deepEqual([art.title, art.metaItems, art.background, art.previewHint], ["Article", ["x"], null, "no_background_image"]);
    assert.equal(A.ADAPTERS.hero_brand(heroSection({ title: "" }), ctx), null);
    assert.equal(A.ADAPTERS.hero_article({ id: "a", key: "hero_article", version: 1, props: {}, resolved: undefined }, ctx), null);
  });

  await test("no adapter throws on a bare draft section (empty props, null resolved): null or props, never an exception", async () => {
    const ctx = { locale: "en", media: {}, category: null, preview: true, getPosts: async () => ({ items: [], meta: { total: 0, page: 1, limit: 12, total_page: 1 }, media: {} }) };
    for (const key of Object.keys(A.ADAPTERS)) {
      for (const sec of [{ props: {}, resolved: undefined }, { props: {}, resolved: {} }, { props: {}, resolved: null }]) {
        const out = await A.ADAPTERS[key]({ id: "x", key, version: 1, ...sec }, ctx);
        assert.ok(out === null || typeof out === "object", `${key} -> ${typeof out}`);
      }
    }
  });

  await test("describeMissing names the field that keeps a draft section from rendering (the placeholder text)", () => {
    const ctx = { media: MEDIA };
    const d = (key, props = {}, resolved) => MISS.describeMissing(key, { props, resolved }, ctx);
    assert.deepEqual(d("hero_brand", {}), ["title"]);
    assert.deepEqual(d("intro_heading", { title: "" }), ["title"]);
    assert.deepEqual(d("intro_text", { text: "no doc" }), ["text"]);
    assert.deepEqual(d("teaser_collage", { title: "T", images: [{ media_id: 7 }, { media_id: 7 }] }), ["images (3 usable photos)"]);
    assert.deepEqual(d("blog_strip", {}, {}), ["posts (none published or with an image)"]);
    assert.deepEqual(d("gallery_cards", {}, {}), ["cards (none with an image)"]);
    assert.deepEqual(d("about_blocks", { items: [] }), ["items (image, title and body)"]);
    assert.deepEqual(d("faq", {}, {}), ["faq_group_key (no published questions)"]);
    assert.deepEqual(d("photo_story", { rows: [] }), ["rows"]);
    assert.deepEqual(d("contact_section", {}), ["content"], "unknown cause: generic");
    assert.deepEqual(d("no_such_type", null), ["content"]);
  });

  await test("static guards: token never in NEXT_PUBLIC_*, never a component prop, never logged", () => {
    const read = (f) => readFileSync(join(ROOT, f), "utf8");
    const banner = read("src/components/site/preview-banner.tsx");
    assert.ok(!/token/i.test(banner.replace(/\/\/.*$/gm, "")), "the banner must not know the token");
    const page = read("src/app/(public)/[[...path]]/page.tsx");
    assert.ok(!/<PreviewBanner[^>]*token/i.test(page));
    // the article page: the preview branch is decided by the cookie path BEFORE getPost (no 308, no data cache), the banner gets no token
    const article = read("src/app/(public)/blog/[slug]/page.tsx");
    assert.ok(!/<PreviewBanner[^>]*token/i.test(article));
    assert.ok(article.indexOf("getPreviewPage(") !== -1 && article.indexOf("getPreviewPage(") < article.indexOf("getPost(slug"), "preview branch comes first");
    assert.ok(/session\.path === path/.test(article) && article.includes("PREVIEW_ROBOTS"));
    for (const f of ["src/lib/preview/session.ts", "src/lib/preview/resolve.ts", "src/lib/preview/handlers.ts", "src/lib/preview/respond.ts", "src/app/api/preview/route.ts", "src/app/api/preview/exit/route.ts", "src/proxy.ts"]) {
      assert.ok(!/console\.|NEXT_PUBLIC_[A-Z_]*TOKEN/.test(read(f)), `${f} logs or leaks`);
    }
    const loader = read("src/lib/cms/preview.ts");
    assert.deepEqual(loader.match(/console\.[a-z]+\(.*\)/g), ['console.warn(JSON.stringify({ event: "preview_unavailable", reason: "portal_key_rejected" }))']);
    for (const f of ["src/app/api/preview/route.ts", "src/app/api/preview/exit/route.ts"]) assert.ok(read(f).includes('export const dynamic = "force-dynamic"'));
    // banner leaves preview with a plain <a>: next/link would prefetch the exit route and end the session
    assert.ok(banner.includes("<a href={exitHref}>") && !/from "next\/link"/.test(banner));
  });
} finally {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\npreview selftest: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
