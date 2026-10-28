#!/usr/bin/env node
// Self-test of the revalidate endpoint logic (PF-8) and the header/footer/switcher data (PF-6) without a test
// runner (npm run site:selftest). Same approach as scripts/cms/selftest.mjs: the TypeScript is compiled with the
// repo's own `tsc` into a temp dir (nothing is written into the repo) and exercised with node:assert.
// No network, no Next runtime: `revalidateTag` / `revalidatePath` are recorded by stubs.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../cms/lib/util.mjs";

const results = [];
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        results.push(true);
        console.log(`  PASS  ${name}`);
      },
      (e) => {
        results.push(false);
        console.log(`  FAIL  ${name}\n        ${String(e?.stack ?? e).split("\n").slice(0, 6).join("\n        ")}`);
      },
    );
}

const tmp = mkdtempSync(join(tmpdir(), "site-selftest-"));
try {
  const out = join(tmp, "out");
  writeFileSync(
    join(tmp, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022", lib: ["es2023", "dom"], module: "commonjs", moduleResolution: "node10", esModuleInterop: true,
        strict: true, skipLibCheck: true, incremental: false, outDir: out, rootDir: join(ROOT, "src"),
        types: ["node"], typeRoots: [join(ROOT, "node_modules", "@types")],
      },
      files: ["lib/revalidate/handler", "lib/revalidate/stores", "lib/revalidate/read-body", "lib/cms/tags", "lib/cms/site-chrome"].map((f) => join(ROOT, "src", `${f}.ts`)),
    }),
  );
  execFileSync(process.execPath, [join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", join(tmp, "tsconfig.json")], { stdio: "inherit" });
  const req = createRequire(join(out, "x.js"));
  const H = req("./lib/revalidate/handler.js");
  const S = req("./lib/revalidate/stores.js");
  const { readBodyLimited } = req("./lib/revalidate/read-body.js");
  const C = req("./lib/cms/site-chrome.js");

  // ---------------------------------------------------------------- revalidate
  const SECRET = "s".repeat(24) + "scratch-secret-0123456789"; // scratch value for the test only
  const PREVIOUS = "p".repeat(24) + "previous-secret-0123456789";
  const NOW = 1_800_000_000_000;
  const enc = (s) => new TextEncoder().encode(s);
  const bodyOf = (o) => (typeof o === "string" ? o : JSON.stringify(o));

  function harness(envOver = {}) {
    const calls = { tags: [], paths: [] };
    let throwOn = null;
    const deps = {
      revalidateTag: (tag, profile) => {
        if (throwOn === tag) throw new Error("boom");
        calls.tags.push([tag, profile]);
      },
      revalidatePath: (p) => calls.paths.push(p),
      seen: S.createSeenStore(),
      failures: S.createFixedWindowLimiter(),
      throughput: S.createFixedWindowLimiter(),
    };
    const env = { REVALIDATE_SECRET: SECRET, ...envOver };
    const send = (payload, o = {}) => {
      const raw = enc(bodyOf(payload));
      const ts = o.ts ?? String(Math.floor((o.nowMs ?? NOW) / 1000));
      const sig = o.sig ?? H.signPayload(o.secret ?? SECRET, ts, raw);
      const headers = new Headers();
      if (!o.noTimestamp) headers.set("X-Materm-Timestamp", ts);
      if (!o.noSignature) headers.set("X-Materm-Signature", sig);
      return H.handleRevalidate({ headers, rawBody: o.rawBytes ?? raw, nowMs: o.nowMs ?? NOW, clientKey: o.client ?? "1.2.3.4", env: o.env ?? env }, deps);
    };
    return { calls, deps, send, failOn: (t) => (throwOn = t) };
  }
  const ev = (tags, id = "11111111-1111-4111-8111-111111111111", extra = {}) => ({ event_id: id, tags, sent_at: "2026-10-27T08:00:00Z", ...extra });

  console.log("revalidate endpoint");
  await test("valid request: 200, each allowed tag revalidated with { expire: 0 }", () => {
    const h = harness();
    const r = h.send(ev(["pages", "settings", "page:12", "ui:en", "menu:main"]));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { success: true, data: { revalidated: ["pages", "settings", "page:12", "ui:en", "menu:main"], ignored: [] } });
    assert.deepEqual(h.calls.tags.map((c) => c[0]), ["pages", "settings", "page:12", "ui:en", "menu:main"]);
    assert.ok(h.calls.tags.every((c) => c[1].expire === 0));
    assert.deepEqual(h.calls.paths, []);
  });
  await test("body with occurred_at instead of sent_at is accepted (doc/08 §7.2 names occurred_at)", () => {
    const h = harness();
    assert.equal(h.send({ event_id: "e1", tags: ["pages"], occurred_at: "2026-10-26T08:00:00Z" }).status, 200);
    assert.equal(h.send({ event_id: "e2", tags: ["pages"] }).status, 200);
  });
  await test("tag `sitemap` also revalidates /sitemap.xml", () => {
    const h = harness();
    assert.equal(h.send(ev(["sitemap"])).status, 200);
    assert.deepEqual(h.calls.paths, ["/sitemap.xml"]);
    const h2 = harness();
    h2.send(ev(["pages"]));
    assert.deepEqual(h2.calls.paths, []);
  });
  await test("unknown / internal tags are ignored, never revalidated, never fatal", () => {
    const h = harness();
    const bad = ["*", "media:5", "tag:1", "author:2", "shared_section:3", "menu_id:4", "category:5", "page:abc", "PAGES", "ui:", "x".repeat(300), "", "pages ", "page:1;drop"];
    const r = h.send(ev(["pages", ...bad]));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data.revalidated, ["pages"]);
    assert.deepEqual(r.body.data.ignored, bad.map((b) => (b.length > 80 ? `${b.slice(0, 80)}...` : b)));
    assert.deepEqual(h.calls.tags.map((c) => c[0]), ["pages"]);
  });
  await test("only unknown tags: 200 with an empty revalidated list", () => {
    const h = harness();
    const r = h.send(ev(["media:1", "*"]));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data.revalidated, []);
    assert.equal(h.calls.tags.length, 0);
  });
  await test("duplicate tags in one event are revalidated once", () => {
    const h = harness();
    h.send(ev(["pages", "pages", "settings", "pages"]));
    assert.deepEqual(h.calls.tags.map((c) => c[0]), ["pages", "settings"]);
  });
  await test("wrong signature: 401 UNAUTHENTICATED, nothing revalidated", () => {
    const h = harness();
    const good = H.signPayload(SECRET, String(NOW / 1000), enc(bodyOf(ev(["pages"]))));
    const flipped = good.slice(0, -1) + (good.endsWith("0") ? "1" : "0");
    const r = h.send(ev(["pages"]), { sig: flipped });
    assert.equal(r.status, 401);
    assert.equal(r.body.code, "UNAUTHENTICATED");
    assert.equal(r.reason, "bad_signature");
    assert.equal(h.calls.tags.length, 0);
  });
  await test("signature made with another secret, or over another body, is rejected", () => {
    const h = harness();
    assert.equal(h.send(ev(["pages"]), { secret: "z".repeat(40) }).status, 401);
    const ts = String(NOW / 1000);
    const sig = H.signPayload(SECRET, ts, enc(bodyOf(ev(["settings"]))));
    assert.equal(h.send(ev(["pages"]), { sig, ts }).status, 401);
  });
  await test("malformed or missing signature headers: 401", () => {
    const h = harness();
    assert.equal(h.send(ev(["pages"]), { noSignature: true }).reason, "missing_headers");
    assert.equal(h.send(ev(["pages"]), { noTimestamp: true }).reason, "missing_headers");
    assert.equal(h.send(ev(["pages"]), { sig: "sha256=abc" }).reason, "bad_signature");
    assert.equal(h.send(ev(["pages"]), { sig: "v1=" + "g".repeat(64) }).reason, "bad_signature");
    assert.equal(h.send(ev(["pages"]), { ts: "yesterday" }).reason, "bad_timestamp");
    assert.equal(h.calls.tags.length, 0);
  });
  await test("stale timestamp (> 300 s, either direction) is rejected even with a valid signature", () => {
    const h = harness();
    const old = String(Math.floor(NOW / 1000) - 301);
    const fut = String(Math.floor(NOW / 1000) + 301);
    assert.equal(h.send(ev(["pages"], "a1"), { ts: old }).reason, "stale_timestamp");
    assert.equal(h.send(ev(["pages"], "a2"), { ts: fut }).reason, "stale_timestamp");
    assert.equal(h.send(ev(["pages"], "a3"), { ts: String(Math.floor(NOW / 1000) - 300) }).status, 200);
    assert.equal(h.send(ev(["pages"], "a4"), { env: { REVALIDATE_SECRET: SECRET, REVALIDATE_MAX_SKEW_SECONDS: "60" }, ts: String(Math.floor(NOW / 1000) - 61) }).status, 401);
  });
  await test("replay: the same event_id is acknowledged (200, duplicate:true) but not applied twice", () => {
    const h = harness();
    assert.equal(h.send(ev(["pages"])).body.data.revalidated.length, 1);
    const again = h.send(ev(["pages"]), { nowMs: NOW + 5000 });
    assert.equal(again.status, 200);
    assert.equal(again.reason, "duplicate");
    assert.deepEqual(again.body.data, { revalidated: [], ignored: [], duplicate: true });
    assert.equal(h.calls.tags.length, 1);
    // another event id is applied
    assert.equal(h.send(ev(["pages"], "another")).body.data.revalidated.length, 1);
    assert.equal(h.calls.tags.length, 2);
  });
  await test("a replay with an invalid signature never reaches the event store", () => {
    const h = harness();
    h.send(ev(["pages"], "evt-x"), { sig: "v1=" + "0".repeat(64) });
    assert.equal(h.deps.seen.size, 0);
  });
  await test("oversize body: 413 (checked before the HMAC)", () => {
    const h = harness();
    const r = h.send(ev(["pages"]), { rawBytes: new Uint8Array(H.MAX_BODY_BYTES + 1) });
    assert.equal(r.status, 413);
    assert.equal(h.send(ev(["pages"], "ok-size"), { rawBytes: undefined }).status, 200);
  });
  await test("missing secret: 503 and nothing is accepted (fail closed), even with a 'valid' signature", () => {
    const h = harness();
    for (const env of [{}, { REVALIDATE_SECRET: "" }, { REVALIDATE_SECRET: "too-short" }, { REVALIDATE_SECRET_PREVIOUS: PREVIOUS }]) {
      const r = h.send(ev(["pages"]), { env, secret: env.REVALIDATE_SECRET || "" });
      assert.equal(r.status, 503, JSON.stringify(Object.keys(env)));
      assert.equal(r.reason, "secret_missing");
    }
    // an oversize body on a misconfigured server is still 503, not 413
    assert.equal(h.send(ev(["pages"]), { env: {}, rawBytes: new Uint8Array(H.MAX_BODY_BYTES + 1) }).status, 503);
    assert.equal(h.calls.tags.length, 0);
  });
  await test("secret rotation: REVALIDATE_SECRET_PREVIOUS is still accepted", () => {
    const h = harness({ REVALIDATE_SECRET_PREVIOUS: PREVIOUS });
    assert.equal(h.send(ev(["pages"]), { secret: PREVIOUS }).status, 200);
    assert.equal(h.send(ev(["settings"], "e-cur")).status, 200);
    assert.equal(h.send(ev(["pages"], "e-other"), { secret: "q".repeat(40) }).status, 401);
  });
  await test("bad body (valid signature): 400", () => {
    const h = harness();
    const cases = [
      "not json", "[]", "null", '"x"', "{}",
      { tags: ["pages"] }, { event_id: "", tags: ["pages"] }, { event_id: "has space", tags: ["pages"] }, { event_id: "e".repeat(65), tags: ["pages"] },
      { event_id: "e", tags: [] }, { event_id: "e", tags: "pages" }, { event_id: "e" }, { event_id: "e", tags: [1] }, { event_id: "e", tags: [null] },
      { event_id: "e", tags: Array.from({ length: 129 }, (_, i) => `page:${i}`) },
      { event_id: "e", tags: ["pages"], sent_at: "yesterday" }, { event_id: "e", tags: ["pages"], occurred_at: 5 },
    ];
    cases.forEach((c, i) => {
      const r = h.send(c);
      assert.equal(r.status, 400, `case ${i}: ${bodyOf(c).slice(0, 40)}`);
      assert.equal(r.body.code, "VALIDATION_FAILED");
    });
    assert.equal(h.send({ event_id: "e", tags: Array.from({ length: 128 }, (_, i) => `page:${i}`) }).status, 200);
    assert.equal(h.calls.tags.length, 128);
    const bad = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]); // invalid UTF-8
    assert.equal(h.send("", { rawBytes: bad, sig: H.signPayload(SECRET, String(NOW / 1000), bad) }).status, 400);
  });
  await test("a bad signature wins over a bad body (401, no schema hints for unsigned callers)", () => {
    const h = harness();
    assert.equal(h.send("not json", { sig: "v1=" + "0".repeat(64) }).status, 401);
  });
  await test("failed authentications are throttled per client (429); other clients and valid signatures are unaffected", () => {
    const h = harness();
    const wrong = { sig: "v1=" + "0".repeat(64), client: "9.9.9.9" };
    for (let i = 0; i < H.FAILED_AUTH_PER_MINUTE; i++) assert.equal(h.send(ev(["pages"]), wrong).status, 401);
    const blocked = h.send(ev(["pages"]), wrong);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.retryAfterSeconds, 60);
    assert.equal(h.send(ev(["pages"], "other-client"), { client: "5.5.5.5" }).status, 200);
    // a correctly signed request is never throttled, even from the blocked address (spoofed X-Forwarded-For)
    assert.equal(h.send(ev(["pages"], "signed-from-blocked"), { client: "9.9.9.9" }).status, 200);
    // window passes
    assert.equal(h.send(ev(["pages"], "later"), { client: "9.9.9.9", nowMs: NOW + 61_000 }).status, 200);
  });
  await test("authenticated throughput ceiling (REVALIDATE_RATE_LIMIT_PER_MINUTE): 429, then recovers", () => {
    const h = harness({ REVALIDATE_RATE_LIMIT_PER_MINUTE: "3" });
    for (let i = 0; i < 3; i++) assert.equal(h.send(ev(["pages"], `t${i}`)).status, 200);
    assert.equal(h.send(ev(["pages"], "t3")).status, 429);
    assert.equal(h.send(ev(["pages"], "t4"), { nowMs: NOW + 61_000 }).status, 200);
  });
  await test("revalidateTag throwing: 500 and the event can be retried", () => {
    const h = harness();
    h.failOn("settings");
    const r = h.send(ev(["pages", "settings"], "retry-me"));
    assert.equal(r.status, 500);
    assert.equal(h.deps.seen.has("retry-me", NOW), false);
    h.failOn(null);
    assert.equal(h.send(ev(["pages", "settings"], "retry-me")).status, 200);
  });
  await test("the secret, the signature and the body never appear in a response or a result", () => {
    const h = harness({ REVALIDATE_SECRET_PREVIOUS: PREVIOUS });
    const payload = ev(["pages", "page:7", "weird☃"], "needle-event-id");
    const sig = H.signPayload(SECRET, String(NOW / 1000), enc(bodyOf(payload)));
    const all = [
      h.send(payload, { sig }),
      h.send(payload, { sig: "v1=" + "1".repeat(64) }),
      h.send(payload, { env: {} }),
      h.send(payload, { rawBytes: new Uint8Array(H.MAX_BODY_BYTES + 1) }),
      h.send("not json{"),
    ].map((r) => JSON.stringify(r.body));
    for (const text of all) for (const secret of [SECRET, PREVIOUS, sig.slice(3)]) assert.ok(!text.includes(secret));
    assert.ok(!all[2].includes("needle-event-id"));
  });

  console.log("revalidate stores / body reader");
  await test("seen store: TTL and LRU size cap", () => {
    const s = S.createSeenStore(3, 1000);
    s.add("a", 0); s.add("b", 0); s.add("c", 0);
    assert.ok(s.has("a", 10)); // refreshes a
    s.add("d", 10);
    assert.equal(s.size, 3);
    assert.equal(s.has("b", 10), false); // oldest evicted
    assert.ok(s.has("a", 10) && s.has("c", 10) && s.has("d", 10));
    assert.equal(s.has("a", 5000), false); // expired
  });
  await test("limiter: bounded number of keys", () => {
    const l = S.createFixedWindowLimiter(60_000, 5);
    for (let i = 0; i < 50; i++) l.hit(`k${i}`, 1000, 10);
    assert.ok(l.size <= 5);
  });
  await test("readBodyLimited: small body, Content-Length too big, stream without length too big", async () => {
    const mk = (body, headers = {}) => new Request("http://x/api/revalidate", { method: "POST", body, headers, duplex: "half" });
    assert.deepEqual(Array.from(await readBodyLimited(mk("hello"), 16)), Array.from(enc("hello")));
    assert.equal(await readBodyLimited(mk("x".repeat(40)), 16), null);
    assert.equal(await readBodyLimited(mk("hi", { "content-length": "99999" }), 16), null);
    const stream = new ReadableStream({ start(c) { c.enqueue(enc("12345678")); c.enqueue(enc("12345678")); c.enqueue(enc("12345678")); c.close(); } });
    assert.equal(await readBodyLimited(mk(stream), 16), null);
    assert.equal((await readBodyLimited(new Request("http://x/", { method: "POST" }), 16)).byteLength, 0);
  });

  // ---------------------------------------------------------------- site chrome
  console.log("site chrome (PF-6)");
  const t = (k) => `i18n:${k}`;
  const item = (o) => ({ id: 1, label: "L", aria_label: null, href: "/x", icon: null, open_in_new_tab: false, rel: [], active_match: "prefix", ...o });
  const loc = (code, o = {}) => ({ code, name: code, native_name: code.toUpperCase(), short_label: code.toUpperCase(), flag: null, is_default: false, fallback_code: null, date_formats: { short: "", months: [] }, ...o });
  const site = (o = {}) => ({
    locale: "en",
    locales: [loc("la", { is_default: true, short_label: "LAO" }), loc("en", { short_label: "EN" })],
    settings: { brand: { name: "MATERM", statement: "S", emblem_alt: "E", logo_media_id: 1 }, footer: { copyright: "C" } },
    menus: { main: { key: "main", items: [item({ label: "Home", href: "/", active_match: "exact" }), item({ id: 2, label: "Blog", href: "/blog" })] }, footer: { key: "footer", items: [item({ label: "F", href: "/f" })] }, social: { key: "social", items: [item({ label: "IG", href: "https://instagram.com/x", icon: "instagram", open_in_new_tab: true })] } },
    ui: {}, media: {},
    ...o,
  });
  await test("menu items whose target is missing (href null) or unsafe are skipped", () => {
    const s = site();
    s.menus.main.items = [
      item({ label: "ok", href: "/ok" }), item({ id: 2, label: "unpublished", href: null }), item({ id: 3, label: "evil", href: "//evil.example" }),
      item({ id: 4, label: "js", href: "javascript:alert(1)" }), item({ id: 5, label: "bs", href: "/\\evil" }), item({ id: 6, label: "", href: "/blank" }),
      item({ id: 7, label: "ext", href: "https://example.org/a" }), item({ id: 8, label: "mail", href: "mailto:a@b.c" }),
    ];
    const nav = C.buildSiteChrome(s, t).nav;
    assert.deepEqual(nav.map((n) => n.label), ["ok", "ext", "mail"]);
    assert.deepEqual(nav.map((n) => n.external), [false, true, true]);
  });
  await test("empty / missing menus fall back to the code defaults (i18n labels); social has no default", () => {
    const s = site();
    s.menus.main.items = [item({ href: null })];
    s.menus.footer.items = [];
    s.menus.social.items = [];
    const c = C.buildSiteChrome(s, t);
    assert.deepEqual(c.nav.map((n) => [n.href, n.label]), [["/", "i18n:nav.home"], ["/our-path", "i18n:nav.ourPath"], ["/blog", "i18n:nav.blog"], ["/gallery", "i18n:nav.gallery"], ["/contact", "i18n:nav.contact"]]);
    assert.deepEqual(c.footerNav.map((n) => n.label), ["i18n:footer.nav.home", "i18n:footer.nav.ourPath", "i18n:footer.nav.blog", "i18n:footer.nav.contact"]);
    assert.deepEqual(c.social, []);
    const none = C.buildSiteChrome(undefined, t);
    assert.equal(none.nav.length, 5);
    assert.equal(none.brand.name, "i18n:brand");
    assert.deepEqual(none.languages, []);
  });
  await test("brand/footer come from settings, the i18n bundle is the fallback per key", () => {
    const c = C.buildSiteChrome(site(), t);
    assert.deepEqual(c.brand, { name: "MATERM", statement: "S", emblemAlt: "E", copyright: "C" });
    const partial = C.buildSiteChrome(site({ settings: { brand: { name: "  ", statement: null }, footer: {} } }), t);
    assert.deepEqual(partial.brand, { name: "i18n:brand", statement: "i18n:footer.statement", emblemAlt: "i18n:footer.emblemAlt", copyright: "i18n:footer.copyright" });
  });
  await test("new-tab links always carry noopener noreferrer; social needs an external href and an icon", () => {
    const s = site();
    s.menus.social.items = [item({ label: "IG", href: "https://i.example/x", icon: "instagram", open_in_new_tab: true, rel: ["me"] }), item({ id: 2, label: "no icon", href: "https://i.example/y" }), item({ id: 3, label: "internal", href: "/y", icon: "youtube" })];
    const c = C.buildSiteChrome(s, t);
    assert.equal(c.social.length, 1);
    assert.equal(c.social[0].rel, "me noopener noreferrer");
    assert.equal(c.social[0].newTab, true);
  });
  await test("language switcher: only the locales the API returned, default last, inactive dropped", () => {
    assert.deepEqual(C.buildSiteChrome(site(), t).languages.map((l) => [l.code, l.label]), [["en", "EN"], ["la", "LAO"]]);
    const three = site({ locales: [loc("la", { is_default: true }), loc("en"), loc("th", { is_active: false }), loc("fr", { short_label: "" })] });
    assert.deepEqual(C.buildSiteChrome(three, t).languages.map((l) => [l.code, l.label]), [["en", "EN"], ["fr", "FR"], ["la", "LA"]]);
    assert.deepEqual(C.buildSiteChrome(site({ locales: [loc("la", { is_default: true })] }), t).languages.map((l) => l.code), ["la"]);
    assert.deepEqual(C.chromeLanguages([loc("../x")]), []);
  });
  await test("isActiveLink: exact vs prefix, '/' never prefix-matches, external never active", () => {
    const L = (href, match, external = false) => ({ href, match, external });
    assert.ok(C.isActiveLink("/", L("/", "exact")));
    assert.ok(!C.isActiveLink("/blog", L("/", "prefix")));
    assert.ok(C.isActiveLink("/blog", L("/blog", "prefix")));
    assert.ok(C.isActiveLink("/blog/music-night", L("/blog", "prefix")));
    assert.ok(!C.isActiveLink("/blogger", L("/blog", "prefix")));
    assert.ok(!C.isActiveLink("/blog/x", L("/blog", "exact")));
    assert.ok(!C.isActiveLink("/blog", L("/blog", "prefix", true)));
    assert.ok(C.isActiveLink("/blog", L("/blog?x=1#y", "prefix")));
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
