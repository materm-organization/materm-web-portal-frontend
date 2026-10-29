#!/usr/bin/env node
// Self-test of the contact form's delivery to the portal backend (P-15), without a test runner
// (npm run forms:selftest). Same approach as scripts/preview/selftest.mjs: the TypeScript is compiled with the repo's own
// `tsc` into a temp dir (nothing is written into the repo), `server-only` is stubbed, the compiled code runs under
// node:assert against the mock API of scripts/cms/mock-api.mjs (127.0.0.1 sockets owned by this process).
// Covered: signed fill-time stamp (forgery, other form, future, stale, missing secret), visitor address / user agent, the
// mode matrix (production always sends, dev only with CMS_MODE=api, unconfigured), the request the backend receives
// (honeypot forwarded, elapsed_ms, rendered_at, X-Client-IP, X-Portal-Key, no retry), the mapping of every backend answer
// to a message, and that nothing personal reaches the log.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../cms/lib/util.mjs";
import { createMockServer } from "../cms/mock-api.mjs";

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
  const files = ["lib/forms/render-stamp", "lib/forms/submit", "components/contact/contact-validation", "lib/cms/client", "lib/cms/config", "lib/cms/result"].map((f) =>
    join(ROOT, "src", `${f}.ts`),
  );
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

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const ENV_KEYS = ["NODE_ENV", "CMS_MODE", "NEXT_PUBLIC_API_BASE_URL", "CMS_API_BASE_URL", "PORTAL_API_KEY", "CMS_FETCH_TIMEOUT_MS", "CMS_MOCK_URL", "FORM_RENDER_SECRET"];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const setEnv = (env) => {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
};

const SECRET_KEY = "scratch-portal-key-0123456789abcdef0123456789";
const RENDER_SECRET = "scratch-render-secret-0123456789abcdef0123456789";
const GOOD = { name: "Noy Vong", email: "noy.visitor@example.org", phone: "+856 20 123 456", topic: "booking", message: "Hello, we would like to book two nights in April." };
const NOW = 1_800_000_000_000;

const tmp = mkdtempSync(join(tmpdir(), "forms-selftest-"));
try {
  const out = compile(tmp);
  const req = createRequire(join(out, "x.js"));
  const Module = createRequire(import.meta.url)("node:module");
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    return resolveFilename.call(this, request.startsWith("@/") ? join(out, request.slice(2)) : request, ...rest);
  };
  const ST = req("./lib/forms/render-stamp.js");
  const SU = req("./lib/forms/submit.js");

  const input = (over = {}) => ({
    fields: { ...GOOD }, honeypot: "", stamp: ST.mintRenderStamp("contact", NOW - 12_000, RENDER_SECRET), slug: "contact", locale: "en",
    ip: "203.0.113.7", userAgent: "SelfTest/1.0", ...over,
  });
  const deps = (sleeps = []) => ({ now: () => NOW, sleep: async (ms) => void sleeps.push(ms) });

  // ---------------------------------------------------------------- the signed fill time
  await test("stamp: round trip gives the age; a stamp for another form, a forged signature, junk and the future are refused", () => {
    const s = ST.mintRenderStamp("contact", NOW - 12_345, RENDER_SECRET);
    assert.match(s, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.deepEqual(ST.verifyRenderStamp(s, "contact", NOW, RENDER_SECRET), { renderedAt: NOW - 12_345, elapsedMs: 12_345 });
    assert.equal(ST.verifyRenderStamp(s, "other-form", NOW, RENDER_SECRET), null, "the slug is signed");
    assert.equal(ST.verifyRenderStamp(s, "contact", NOW, "another-secret-0123456789abcdef012345"), null);
    const [ms, sig] = s.split(".");
    const later = Buffer.from(String(NOW + 1000)).toString("base64url");
    assert.equal(ST.verifyRenderStamp(`${later}.${sig}`, "contact", NOW + 5000, RENDER_SECRET), null, "a longer time cannot be claimed");
    assert.equal(ST.verifyRenderStamp(`${ms}.${sig.slice(0, -2)}AA`, "contact", NOW, RENDER_SECRET), null);
    for (const junk of ["", "x", "a.b.c", ".", "a.", ".b", "!!.??", "x".repeat(300), null, undefined, 5, {}]) assert.equal(ST.verifyRenderStamp(junk, "contact", NOW, RENDER_SECRET), null, String(junk));
    const future = ST.mintRenderStamp("contact", NOW + 10 * 60_000, RENDER_SECRET);
    assert.equal(ST.verifyRenderStamp(future, "contact", NOW, RENDER_SECRET), null, "10 minutes ahead is a lie");
    assert.deepEqual(ST.verifyRenderStamp(ST.mintRenderStamp("contact", NOW + 60_000, RENDER_SECRET), "contact", NOW, RENDER_SECRET), { renderedAt: NOW + 60_000, elapsedMs: 0 }, "small clock skew is fine");
    assert.equal(ST.verifyRenderStamp(s, "contact", NOW, null), null);
    assert.equal(ST.mintRenderStamp("contact", NOW, null), "");
  });

  await test("stamp: a genuine stamp older than 24 h counts as 24 h (a tab left open), it is not a bot", () => {
    const old = ST.mintRenderStamp("contact", NOW - 3 * 86_400_000, RENDER_SECRET);
    assert.equal(ST.verifyRenderStamp(old, "contact", NOW, RENDER_SECRET).elapsedMs, ST.MAX_ELAPSED_MS);
  });

  await test("secret: production needs FORM_RENDER_SECRET (>= 32 chars); development falls back to ONE random per-process secret", () => {
    assert.equal(ST.renderSecret({ NODE_ENV: "production" }), null);
    assert.equal(ST.renderSecret({ NODE_ENV: "production", FORM_RENDER_SECRET: "short" }), null);
    assert.equal(ST.renderSecret({ NODE_ENV: "production", FORM_RENDER_SECRET: `  ${RENDER_SECRET}  ` }), RENDER_SECRET);
    const a = ST.renderSecret({ NODE_ENV: "development" });
    assert.ok(typeof a === "string" && a.length >= 32 && a !== RENDER_SECRET);
    assert.equal(ST.renderSecret({ NODE_ENV: "development", FORM_RENDER_SECRET: "short" }), a, "stable inside the process (globalThis)");
    assert.equal(ST.renderSecret({}), a);
  });

  // ---------------------------------------------------------------- visitor facts
  await test("client address: Netlify header, then x-real-ip, then the first x-forwarded-for entry; user agent capped at 300", () => {
    const h = (o) => (name) => o[name];
    assert.equal(SU.clientIpFromHeaders(h({ "x-nf-client-connection-ip": "198.51.100.9", "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" })), "198.51.100.9");
    assert.equal(SU.clientIpFromHeaders(h({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" })), "1.1.1.1");
    assert.equal(SU.clientIpFromHeaders(h({ "x-forwarded-for": " 2.2.2.2 , 10.0.0.1" })), "2.2.2.2");
    assert.equal(SU.clientIpFromHeaders(h({})), null);
    assert.equal(SU.clientIpFromHeaders(h({ "x-real-ip": "9".repeat(200) })).length, 64);
    assert.equal(SU.clientUserAgent(h({ "user-agent": "U".repeat(500) })).length, 300);
    assert.equal(SU.clientUserAgent(h({})), null);
  });

  // ---------------------------------------------------------------- the answer of the backend -> what the form shows
  await test("every backend answer maps to one message: 200 success, 422 field codes, 429, 404, 5xx / network / timeout, 4xx", () => {
    const err = (status, extra = {}) => ({ kind: "error", ok: false, status, down: true, source: "api", ...extra });
    assert.deepEqual(SU.mapSubmitResult({ kind: "ok", ok: true, status: 200, data: { status: "received" }, source: "api" }), { status: "success" });
    assert.deepEqual(
      SU.mapSubmitResult(err(422, { code: "VALIDATION_FAILED", errors: [{ in: "body", path: "/data/name", code: "required" }, { in: "body", path: "/data/message", code: "messageShort" }, { in: "body", path: "/data/email", code: "email" }, { in: "body", path: "/data/phone", code: "phone" }] })),
      { status: "error", errors: { name: "required", message: "messageShort", email: "email", phone: "phone" } },
    );
    // unknown field / unknown code / non-body path = nothing the form can point at -> the generic message
    for (const errors of [undefined, [], [{ in: "body", path: "/data/secret", code: "unknown_field" }], [{ in: "body", path: "/locale", code: "invalid_format" }], [{ in: "body", path: "/data/name", code: "weird" }], [{ in: "body", path: "/data/constructor", code: "required" }]]) {
      assert.deepEqual(SU.mapSubmitResult(err(422, { errors })), { status: "error", code: "generic" }, JSON.stringify(errors));
    }
    assert.deepEqual(SU.mapSubmitResult(err(429, { code: "RATE_LIMITED" })), { status: "error", code: "rateLimited" });
    assert.deepEqual(SU.mapSubmitResult(err(404)), { status: "error", code: "unconfigured" });
    assert.deepEqual(SU.mapSubmitResult(err("unconfigured")), { status: "error", code: "unconfigured" });
    for (const s of [400, 413, 415, 405, 409]) assert.deepEqual(SU.mapSubmitResult(err(s)), { status: "error", code: "generic" }, String(s));
    for (const s of [401, 403, 408, 500, 502, 503, 504, "timeout", "network", "invalid"]) assert.deepEqual(SU.mapSubmitResult(err(s)), { status: "error", code: "unavailable" }, String(s));
    assert.deepEqual(SU.mapSubmitResult({ kind: "redirect", ok: false, status: 308, location: "/x", source: "api" }), { status: "error", code: "unavailable" });
  });

  // ---------------------------------------------------------------- modes
  await test("mode matrix: production always sends (or is unconfigured), development sends only with CMS_MODE=api + a base URL", () => {
    const url = "http://127.0.0.1:9/api/v1";
    const plan = (env, nodeEnv) => {
      setEnv(env);
      return SU.planDelivery({ NODE_ENV: nodeEnv });
    };
    assert.equal(plan({ NEXT_PUBLIC_API_BASE_URL: url }, "production"), "send");
    assert.equal(plan({ NEXT_PUBLIC_API_BASE_URL: url, CMS_MODE: "bundle" }, "production"), "send", "CMS_MODE only decides where content is read from");
    assert.equal(plan({ CMS_API_BASE_URL: url, CMS_MODE: "mock" }, "production"), "send");
    assert.equal(plan({}, "production"), "unconfigured");
    assert.equal(plan({ NEXT_PUBLIC_API_BASE_URL: "/api/v1" }, "production"), "unconfigured", "a relative URL is no URL");
    assert.equal(plan({ NEXT_PUBLIC_API_BASE_URL: url }, "development"), "simulate", "bundle (default) in dev");
    assert.equal(plan({ NEXT_PUBLIC_API_BASE_URL: url, CMS_MODE: "mock" }, "development"), "simulate");
    assert.equal(plan({ CMS_MODE: "api" }, "development"), "simulate", "api mode without a URL cannot send");
    assert.equal(plan({ CMS_MODE: "api", NEXT_PUBLIC_API_BASE_URL: url }, "development"), "send");
    assert.equal(plan({ CMS_MODE: "api", CMS_API_BASE_URL: url }, undefined), "send");
  });

  // ---------------------------------------------------------------- end to end against the mock API
  const mock = createMockServer({ key: SECRET_KEY });
  const port = await freePort();
  await new Promise((r) => mock.listen(port, "127.0.0.1", r));
  const base = `http://127.0.0.1:${port}/api/v1`;
  const logs = [];
  const realError = console.error;
  const realInfo = console.info;
  try {
    console.error = (...a) => logs.push(a.join(" "));
    const prodEnv = { NODE_ENV: "production", CMS_MODE: "bundle", CMS_API_BASE_URL: base, PORTAL_API_KEY: SECRET_KEY, FORM_RENDER_SECRET: RENDER_SECRET };

    await test("send: the backend gets the contract (slug path, key, honeypot, elapsed_ms, rendered_at, X-Client-IP / UA, no query token)", async () => {
      setEnv(prodEnv);
      mock.submissions.length = 0;
      const r = await SU.submitContactForm(input(), deps());
      assert.deepEqual(r, { status: "success" });
      assert.equal(mock.submissions.length, 1);
      const { slug, body, headers } = mock.submissions[0];
      assert.equal(slug, "contact");
      assert.deepEqual(body, {
        locale: "en", source_path: "/contact", data: GOOD, honeypot: "", elapsed_ms: 12_000, rendered_at: new Date(NOW - 12_000).toISOString(),
      });
      assert.equal(headers["x-portal-key"], SECRET_KEY);
      assert.equal(headers["x-client-ip"], "203.0.113.7");
      assert.equal(headers["x-client-user-agent"], "SelfTest/1.0");
      assert.match(headers["content-type"], /application\/json/);
      const sent = mock.requests.at(-1);
      assert.equal(sent.method, "POST");
      assert.match(sent.headers["x-request-id"], /^[0-9a-f-]{36}$/);
      assert.deepEqual(sent.query, {});
    });

    await test("send: the honeypot is FORWARDED (the backend scores it), not decided here; a missing or forged stamp is elapsed_ms 0", async () => {
      setEnv(prodEnv);
      mock.submissions.length = 0;
      assert.deepEqual(await SU.submitContactForm(input({ honeypot: "Acme Ltd" }), deps()), { status: "success" });
      assert.equal(mock.submissions.at(-1).body.honeypot, "Acme Ltd");
      assert.equal(mock.submissions.at(-1).body.elapsed_ms, 12_000);
      await SU.submitContactForm(input({ stamp: "" }), deps());
      assert.equal(mock.submissions.at(-1).body.elapsed_ms, 0);
      assert.ok(!("rendered_at" in mock.submissions.at(-1).body));
      const forged = ST.mintRenderStamp("contact", NOW - 60_000, "attacker-secret-0123456789abcdef0123456789");
      await SU.submitContactForm(input({ stamp: forged }), deps());
      assert.equal(mock.submissions.at(-1).body.elapsed_ms, 0, "a forged stamp is a bot");
      await SU.submitContactForm(input({ slug: "../../x" }), deps());
      assert.equal(mock.submissions.at(-1).slug, "contact", "a slug that is not a slug never reaches the URL");
      assert.equal(mock.submissions.at(-1).body.elapsed_ms, 12_000);
      await SU.submitContactForm(input({ ip: null, userAgent: null }), deps());
      assert.equal(mock.submissions.at(-1).headers["x-client-ip"], undefined);
    });

    await test("send: local validation first - nothing leaves for an invalid form; values come back for the inputs", async () => {
      setEnv(prodEnv);
      const before = mock.requests.length;
      const r = await SU.submitContactForm(input({ fields: { ...GOOD, name: "", email: "nope", message: "short" } }), deps());
      assert.equal(r.status, "error");
      assert.deepEqual(r.errors, { name: "required", email: "email", message: "messageShort" });
      assert.equal(r.values.phone, GOOD.phone);
      assert.equal(mock.requests.length, before);
    });

    await test("answers: 429 -> rateLimited, 422 -> inline field errors (unknown paths ignored), 404 -> unconfigured, 503 -> unavailable and NOT retried", async () => {
      setEnv(prodEnv);
      const send = (email) => SU.submitContactForm(input({ fields: { ...GOOD, email } }), deps());
      assert.equal((await send("limited@example.test")).code, "rateLimited");
      const invalid = await send("invalid@example.test");
      assert.deepEqual(invalid.errors, { email: "email" }, "the /locale error is not shown on a field");
      assert.equal(invalid.code, undefined);
      assert.equal((await send("gone@example.test")).code, "unconfigured");
      const before = mock.requests.length;
      assert.equal((await send("down@example.test")).code, "unavailable");
      assert.equal(mock.requests.length, before + 1, "a POST is never retried (a message must not be sent twice)");
    });

    await test("send: a wrong PORTAL_API_KEY is unavailable (our fault), logged once without the key; an unreachable API is unavailable", async () => {
      setEnv({ ...prodEnv, PORTAL_API_KEY: "wrong-key-0123456789abcdef0123456789abcd" });
      logs.length = 0;
      assert.equal((await SU.submitContactForm(input(), deps())).code, "unavailable");
      assert.equal((await SU.submitContactForm(input(), deps())).code, "unavailable");
      assert.equal(logs.filter((l) => l.includes("rejected PORTAL_API_KEY")).length, 1, "once");
      assert.ok(!logs.join("\n").includes("wrong-key"));
      const dead = await freePort();
      setEnv({ ...prodEnv, CMS_API_BASE_URL: `http://127.0.0.1:${dead}/api/v1` });
      assert.equal((await SU.submitContactForm(input(), deps())).code, "unavailable");
    });

    await test("production without an API URL or without FORM_RENDER_SECRET: 'unconfigured', nothing sent, never a fake success", async () => {
      const before = mock.requests.length;
      setEnv({ NODE_ENV: "production", PORTAL_API_KEY: SECRET_KEY, FORM_RENDER_SECRET: RENDER_SECRET });
      let r = await SU.submitContactForm(input(), deps());
      assert.deepEqual([r.status, r.code], ["error", "unconfigured"]);
      assert.equal(r.values.email, GOOD.email, "the visitor keeps what they typed");
      setEnv({ ...prodEnv, FORM_RENDER_SECRET: "" });
      r = await SU.submitContactForm(input(), deps());
      assert.deepEqual([r.status, r.code], ["error", "unconfigured"]);
      assert.equal(mock.requests.length, before);
    });

    await test("development: bundle / mock mode simulates success after 600 ms and sends nothing; CMS_MODE=api really sends", async () => {
      const before = mock.requests.length;
      const sleeps = [];
      for (const env of [{ NODE_ENV: "development" }, { NODE_ENV: "development", CMS_MODE: "mock", CMS_API_BASE_URL: base }, { NODE_ENV: "development", CMS_MODE: "bundle", NEXT_PUBLIC_API_BASE_URL: base }]) {
        setEnv(env);
        assert.deepEqual(await SU.submitContactForm(input(), deps(sleeps)), { status: "success" });
      }
      assert.deepEqual(sleeps, [600, 600, 600]);
      assert.equal(mock.requests.length, before, "no network in the simulation");
      setEnv({ NODE_ENV: "development", CMS_MODE: "api", CMS_API_BASE_URL: base, PORTAL_API_KEY: SECRET_KEY });
      mock.submissions.length = 0;
      assert.deepEqual(await SU.submitContactForm(input({ stamp: ST.mintRenderStamp("contact", NOW - 12_000) }), deps()), { status: "success" });
      assert.equal(mock.submissions.length, 1);
      assert.equal(mock.submissions[0].body.elapsed_ms, 12_000, "dev signs with its own per-process secret");
    });

    await test("log: statuses only - never the message, e-mail, name, phone, address, user agent or portal key", async () => {
      logs.length = 0;
      setEnv(prodEnv);
      await SU.submitContactForm(input({ fields: { ...GOOD, email: "down@example.test" } }), deps());
      setEnv({ ...prodEnv, CMS_API_BASE_URL: `http://127.0.0.1:${await freePort()}/api/v1` });
      await SU.submitContactForm(input(), deps());
      setEnv({ NODE_ENV: "production" });
      await SU.submitContactForm(input(), deps());
      const text = logs.join("\n");
      assert.ok(text.length > 0);
      for (const secret of [GOOD.name, GOOD.email, GOOD.phone, GOOD.message, "down@example.test", "203.0.113.7", "SelfTest/1.0", SECRET_KEY, RENDER_SECRET]) assert.ok(!text.includes(secret), secret);
    });
  } finally {
    console.error = realError;
    console.info = realInfo;
    await new Promise((r) => mock.close(r));
  }

  // ---------------------------------------------------------------- static guards
  await test("static guards: the old delivery variable is gone; the secret is server-only; the action exports async functions only; the form carries the hidden fields", () => {
    const read = (f) => readFileSync(join(ROOT, f), "utf8");
    const walk = (dir) => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
    for (const f of [...walk(join(ROOT, "src")), join(ROOT, "README.md"), join(ROOT, "CLAUDE.md"), join(ROOT, ".env.production"), join(ROOT, "Dockerfile"), join(ROOT, "Jenkinsfile")]) {
      assert.ok(!readFileSync(f, "utf8").includes("CONTACT_" + "ENDPOINT"), `${f} still mentions the old delivery variable`);
    }
    for (const f of walk(join(ROOT, "src"))) assert.ok(!/NEXT_PUBLIC_[A-Z_]*(RENDER|SECRET)/.test(readFileSync(f, "utf8")), `${f} exposes a secret to the browser`);
    const action = read("src/app/(public)/contact/actions.ts");
    assert.ok(action.startsWith('"use server"'));
    const exported = [...action.matchAll(/^export\s+(?!async function)(.+)$/gm)];
    assert.deepEqual(exported.map((m) => m[0]), [], '"use server" files may only export async functions');
    assert.ok(!/process\.env/.test(action), "the action reads no env itself");
    const form = read("src/components/contact/contact-form.tsx");
    assert.ok(form.includes('name="rt"') && form.includes('name="form"') && form.includes('name="company"'));
    const section = read("src/components/sections/contact-section.tsx");
    assert.ok(section.includes("mintRenderStamp(form.slug)"));
    const submit = read("src/lib/forms/submit.ts");
    assert.ok(!/console\.(log|info|warn)/.test(submit), "no console.log in the delivery code");
    assert.ok(submit.includes("forceApi: true") && submit.includes("DELIVERY_TIMEOUT_MS"));
  });
} finally {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\nforms selftest: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
