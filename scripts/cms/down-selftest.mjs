#!/usr/bin/env node
// API-down matrix (PF-12, doc/08 §3.10 + §8.6 "Resilience"): `npm run cms:down-selftest`.
// For every API failure of doc/08 §8.6 x EVERY resource family of the data layer it asserts:
//   * the loader never throws and returns exactly what the bundle returns (no 5xx page, a 404 stays a 404),
//   * `fallback_used` is signalled once per (resource, reason) with the expected reason,
//   * the contact form answers `unavailable` (never a fake success), preview answers `unavailable` (never published content),
//   * nothing sticks: after the failure ends, the next call is served by the API again.
// Failures: connection refused | timeout | 5xx | unauthorised key (401) | invalid body (200 that is not the API envelope).
// Same harness as scripts/cms/selftest.mjs: tsc into a temp dir, mock API of scripts/cms/mock-api.mjs, 127.0.0.1 only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT, isMain } from "./lib/util.mjs";
import { createMockServer } from "./mock-api.mjs";

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(true);
    console.log(`  PASS  ${name}`);
  } catch (e) {
    results.push(false);
    console.log(`  FAIL  ${name}\n        ${String(e?.stack ?? e).split("\n").slice(0, 8).join("\n        ")}`);
  }
}

function compile(tmp) {
  const out = join(tmp, "out");
  mkdirSync(join(tmp, "node_modules", "server-only"), { recursive: true });
  writeFileSync(join(tmp, "node_modules", "server-only", "index.js"), "module.exports = {};\n");
  symlinkSync(join(ROOT, "node_modules", "react"), join(tmp, "node_modules", "react"), "dir");
  const files = [
    "lib/cms/loaders", "lib/cms/preview", "lib/forms/submit", "lib/forms/render-stamp",
  ].map((f) => join(ROOT, "src", `${f}.ts`));
  writeFileSync(
    join(tmp, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022", lib: ["es2023", "dom"], module: "commonjs", moduleResolution: "node10", esModuleInterop: true,
        resolveJsonModule: true, strict: true, skipLibCheck: true, incremental: false, outDir: out, rootDir: join(ROOT, "src"),
        baseUrl: join(ROOT, "src"), paths: { "@/*": ["*"] }, types: ["node"], typeRoots: [join(ROOT, "node_modules", "@types")],
      },
      files,
    }),
  );
  execFileSync(process.execPath, [join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", join(tmp, "tsconfig.json")], { stdio: "inherit" });
  return out;
}

const ENV_KEYS = ["NODE_ENV", "CMS_MODE", "NEXT_PUBLIC_API_BASE_URL", "CMS_API_BASE_URL", "PORTAL_API_KEY", "CMS_FETCH_TIMEOUT_MS", "CMS_MOCK_URL", "FORM_RENDER_SECRET", "SITE_ENV", "CONTEXT"];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const setEnv = (env) => {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
};
const realWarn = console.warn;
const captureWarn = () => {
  const lines = [];
  console.warn = (...a) => lines.push(a.map(String).join(" "));
  return { lines, restore: () => (console.warn = realWarn) };
};
const events = (lines) => lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((e) => e?.event === "fallback_used");
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); });
const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

function freshModules(out) {
  const req = createRequire(join(out, "x.js"));
  for (const k of Object.keys(req.cache)) if (k.startsWith(out)) delete req.cache[k];
  return {
    L: req(join(out, "lib/cms/loaders.js")),
    fallback: req(join(out, "lib/cms/fallback.js")),
    preview: req(join(out, "lib/cms/preview.js")),
    submit: req(join(out, "lib/forms/submit.js")),
    stamp: req(join(out, "lib/forms/render-stamp.js")),
  };
}

/** the whole read surface, grouped by resource family: [family, resourcePrefixes, call] */
const FAMILIES = [
  ["site", ["locales", "site", "settings", "ui-strings", "menu:main"], (L) => Promise.all([L.getLocales(), L.getSite("en"), L.getSite("la"), L.getSettings("en"), L.getUiStrings("en", "site,blog,forms"), L.getMenu("main", "en")])],
  ["page resolve", ["page:/", "page:/our-path", "page:/blog", "page:/gallery", "page:/contact"], (L) => Promise.all(["/", "/our-path", "/blog", "/gallery", "/contact"].map((p) => L.getPage(p, "en")))],
  ["page 404", ["page:/no-such-page", "page:/a/b/c"], (L) => Promise.all([L.getPage("/no-such-page", "en"), L.getPage("/a/b/c", "la")])],
  ["blog list", ["posts", "categories", "tags"], (L) => Promise.all([L.getPosts("en"), L.getPosts("la", { category: "music" }), L.getCategories("en"), L.getTags("en")])],
  ["blog detail", ["post"], (L) => Promise.all([L.getPost("music-night-under-the-stars", "en"), L.getPost("does-not-exist", "en")])],
  ["gallery", ["albums", "album:forest-photo-story"], (L) => Promise.all([L.getAlbums("en"), L.getAlbum("forest-photo-story", "la")])],
  ["faq", ["faq:contact"], (L) => Promise.all([L.getFaq("contact", "en"), L.getFaq("nope", "en")])],
  ["form definition", ["form:contact"], (L) => Promise.all([L.getForm("contact", "en")])],
  ["sitemap", ["sitemap"], (L) => Promise.all([L.getSitemap(), L.getRobots()])],
];

export async function main() {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "cms-down-selftest-")));
  try {
    console.log(`cms down selftest: compiling -> ${tmp}`);
    const out = compile(tmp);
    // "@/" imports of lib/forms/submit
    const Module = createRequire(import.meta.url)("node:module");
    const resolveFilename = Module._resolveFilename;
    Module._resolveFilename = function (request, ...rest) {
      return resolveFilename.call(this, request.startsWith("@/") ? join(out, request.slice(2)) : request, ...rest);
    };

    // baseline: what the bundle answers (CMS_MODE=bundle, no network)
    setEnv({});
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("no network in bundle mode"); };
    const base = freshModules(out);
    const baseline = {};
    for (const [fam, , call] of FAMILIES) baseline[fam] = JSON.parse(JSON.stringify(await call(base.L)));
    globalThis.fetch = realFetch;

    // ------------------------------------------------------------------ the failures
    const cases = [
      { name: "connection refused", reason: /^api_down:network$/, server: async () => ({ url: `http://127.0.0.1:${await freePort()}/api/v1`, stop: async () => {} }), env: {} },
      { name: "timeout", reason: /^api_down:timeout$/, env: { CMS_FETCH_TIMEOUT_MS: "150" }, server: async () => { const s = createMockServer({ delayMs: 12_000 }); const p = await listen(s); return { url: `http://127.0.0.1:${p}/api/v1`, stop: () => close(s) }; } },
      { name: "5xx (503)", reason: /^api_down:503$/, env: {}, server: async () => { const s = createMockServer({ failStatus: 503 }); const p = await listen(s); return { url: `http://127.0.0.1:${p}/api/v1`, stop: () => close(s) }; } },
      { name: "5xx (500)", reason: /^api_down:500$/, env: {}, server: async () => { const s = createMockServer({ failStatus: 500 }); const p = await listen(s); return { url: `http://127.0.0.1:${p}/api/v1`, stop: () => close(s) }; } },
      { name: "invalid / unauthorised key (401)", reason: /^api_down:401$/, env: { PORTAL_API_KEY: "wrong-key" }, server: async () => { const s = createMockServer({ key: "right-key" }); const p = await listen(s); return { url: `http://127.0.0.1:${p}/api/v1`, stop: () => close(s) }; } },
      { name: "forbidden key (403)", reason: /^api_down:403$/, env: {}, server: async () => { const s = createHttpServer((q, r) => { r.writeHead(403, { "Content-Type": "application/json" }); r.end('{"success":false,"code":"FORBIDDEN"}'); }); const p = await listen(s); return { url: `http://127.0.0.1:${p}/api/v1`, stop: () => close(s) }; } },
      { name: "invalid body (200 HTML page, e.g. a proxy error page)", reason: /^api_down:invalid$/, env: {}, server: async () => { const s = createHttpServer((q, r) => { r.writeHead(200, { "Content-Type": "text/html" }); r.end("<html>bad gateway</html>"); }); const p = await listen(s); return { url: `http://127.0.0.1:${p}/api/v1`, stop: () => close(s) }; } },
    ];

    const GOOD = { name: "Noy Vong", email: "noy.visitor@example.org", phone: "+856 20 123 456", topic: "booking", message: "Hello, we would like to book two nights in April." };
    const NOW = 1_800_000_000_000;
    const SECRET = "scratch-render-secret-0123456789abcdef0123456789";

    for (const c of cases) {
      console.log(`\n[${c.name}]`);
      const srv = await c.server();
      const env = { CMS_MODE: "api", PORTAL_API_KEY: "right-key", NEXT_PUBLIC_API_BASE_URL: srv.url, ...c.env };
      try {
        for (const [fam, prefixes, call] of FAMILIES) {
          await test(`${fam}: bundle content, no throw, fallback_used signalled`, async () => {
            setEnv(env);
            const m = freshModules(out);
            const w = captureWarn();
            let got;
            const t0 = Date.now();
            try { got = JSON.parse(JSON.stringify(await call(m.L))); } finally { w.restore(); }
            assert.deepEqual(got, baseline[fam], "the answer equals the bundle's");
            assert.ok(Date.now() - t0 < 5_000, `answered in ${Date.now() - t0} ms (budget 150-2000 ms + one fast retry)`);
            const ev = events(w.lines);
            const resources = new Set(ev.map((e) => e.resource));
            for (const r of prefixes) assert.ok(resources.has(r), `fallback_used for ${r}; saw ${[...resources].join(",")}`);
            for (const e of ev) {
              assert.match(e.reason, c.reason, JSON.stringify(e));
              assert.ok(typeof e.locale === "string");
            }
            const keys = ev.map((e) => `${e.resource}|${e.reason}`);
            assert.equal(new Set(keys).size, keys.length, "each (resource, reason) logged once");
          });
        }
      } finally { /* servers are stopped below */ }

      await test("contact form: 'unavailable' (never a fake success), the message is not retried or logged", async () => {
        setEnv({ ...env, NODE_ENV: "production", FORM_RENDER_SECRET: SECRET, CMS_FETCH_TIMEOUT_MS: "150" });
        const m = freshModules(out);
        const w = captureWarn();
        let r;
        try {
          r = await m.submit.submitContactForm({ fields: { ...GOOD, ...(c.name.startsWith("5xx") ? { email: "down@example.test" } : {}) }, honeypot: "", stamp: m.stamp.mintRenderStamp("contact", NOW - 12_000, SECRET), slug: "contact", locale: "en", ip: "203.0.113.7", userAgent: "SelfTest/1.0" }, { now: () => NOW, sleep: async () => {} });
        } finally { w.restore(); }
        assert.deepEqual({ status: r.status, code: r.code }, { status: "error", code: "unavailable" }); // (mock: POST 5xx is triggered by the down@ address; failStatus covers GET)
        const text = w.lines.join("\n");
        for (const secret of [GOOD.email, "down@example.test", GOOD.name, GOOD.message, "203.0.113.7", "wrong-key", "right-key", SECRET]) assert.ok(!text.includes(secret), "no personal data / key in the log");
      });

      await test("preview: 'unavailable', never the published page (no bundle fallback)", async () => {
        setEnv({ ...env, CMS_FETCH_TIMEOUT_MS: "150" });
        const m = freshModules(out);
        const w = captureWarn();
        let r;
        try { r = await m.preview.resolvePreview("mock-preview-valid-token-0123456789abcdef", { path: "/our-path", locale: "en" }); } finally { w.restore(); }
        assert.equal(r.kind, "unavailable", JSON.stringify(r));
        assert.equal(events(w.lines).length, 0, "preview is not a bundle fallback");
        assert.ok(!w.lines.join("\n").includes("mock-preview-valid-token"), "token never logged");
      });
      await srv.stop();
    }

    // ------------------------------------------------------------------ recovery: nothing sticks
    console.log("\n[recovery]");
    await test("after an outage the next call is served by the API again (no sticky down state)", async () => {
      const mock = createMockServer({ key: "right-key" });
      const bad = createMockServer({ failStatus: 503 });
      const pm = await listen(mock);
      const pb = await listen(bad);
      try {
        // same process: first the broken URL, then the healthy one (runtime override CMS_API_BASE_URL)
        setEnv({ CMS_MODE: "api", PORTAL_API_KEY: "right-key", CMS_API_BASE_URL: `http://127.0.0.1:${pb}/api/v1` });
        const m = freshModules(out);
        const w = captureWarn();
        try {
          await m.L.getSite("en");
          assert.equal(events(w.lines).length, 1);
          process.env.CMS_API_BASE_URL = `http://127.0.0.1:${pm}/api/v1`;
          mock.requests.length = 0;
          assert.equal((await m.L.getSite("la")).locale, "la");
          assert.ok(mock.requests.length >= 1, "the healthy API was asked");
          assert.equal(events(w.lines).length, 1, "no new fallback");
        } finally { w.restore(); }
      } finally { await close(mock); await close(bad); }
    });
    await test("healthy API: no fallback_used at all across every family", async () => {
      const mock = createMockServer({ key: "right-key" });
      const p = await listen(mock);
      try {
        setEnv({ CMS_MODE: "api", PORTAL_API_KEY: "right-key", NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${p}/api/v1` });
        const m = freshModules(out);
        const w = captureWarn();
        try { for (const [, , call] of FAMILIES) await call(m.L); } finally { w.restore(); }
        assert.equal(events(w.lines).length, 0, JSON.stringify(events(w.lines)));
      } finally { await close(mock); }
    });
  } finally {
    for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
    console.warn = realWarn;
    rmSync(tmp, { recursive: true, force: true });
  }
  const bad = results.filter((ok) => !ok).length;
  console.log(`\ncms down selftest: ${results.length - bad}/${results.length} passed${bad ? " - FAILED" : ""}`);
  if (bad) process.exitCode = 1;
}

if (isMain(import.meta.url)) await main();
