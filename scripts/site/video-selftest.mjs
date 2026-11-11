#!/usr/bin/env node
// Self-test of the hero background video (release 2 of video support) without a test runner (npm run video:selftest).
// Same approach as scripts/site/selftest.mjs: the TypeScript is compiled with the repo's own `tsc` into a temp dir
// (nothing is written into the repo) and exercised with node:assert.
//   - adapter `toVideo` / `heroBrand` (missing media, null url, unsafe url, non-video mime, kind mismatch, ok)
//   - `HeroVideo` server markup (muted, playsInline, autoPlay, loop, preload=metadata, poster, aria-hidden, no controls ...)
//   - the pure policy (reduced motion, Save-Data, slow connection, stall timeout, source type)
//   - the mock API's video fixtures run through the adapter
// What this does NOT cover (needs a browser, see the real-render evidence in the release report): the effect-driven
// behaviour of HeroVideo (error -> poster, play() rejection, pause off screen), `prefers-reduced-motion` emulation.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import Module from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../cms/lib/util.mjs";
import { createMockApi } from "../cms/mock-api.mjs";

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

const tmp = mkdtempSync(join(tmpdir(), "video-selftest-"));
try {
  const out = join(tmp, "out");
  mkdirSync(join(tmp, "node_modules"), { recursive: true });
  for (const pkg of ["react", "react-dom", "cn", "scheduler"]) {
    try {
      symlinkSync(join(ROOT, "node_modules", pkg), join(tmp, "node_modules", pkg), "dir");
    } catch {
      /* optional */
    }
  }
  writeFileSync(
    join(tmp, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022", lib: ["es2023", "dom"], module: "commonjs", moduleResolution: "node10", esModuleInterop: true,
        jsx: "react-jsx", strict: true, skipLibCheck: true, incremental: false, outDir: out, rootDir: join(ROOT, "src"),
        types: ["node"], typeRoots: [join(ROOT, "node_modules", "@types")],
        baseUrl: join(ROOT, "src"), paths: { "@/*": ["./*"] },
      },
      files: ["components/sections/adapters.ts", "components/site/hero-video.tsx", "components/site/hero-video-policy.ts"].map((f) => join(ROOT, "src", f)),
    }),
  );
  execFileSync(process.execPath, [join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", join(tmp, "tsconfig.json")], { stdio: "inherit" });

  // `@/x` -> compiled output
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    return origResolve.call(this, request.startsWith("@/") ? join(out, request.slice(2)) : request, ...rest);
  };
  const req = createRequire(join(out, "x.js"));
  const { toVideo, ADAPTERS } = req("./components/sections/adapters.js");
  const P = req("./components/site/hero-video-policy.js");
  const { HeroVideo } = req("./components/site/hero-video.js");
  const { renderToStaticMarkup } = req(join(tmp, "node_modules", "react-dom", "server"));
  const React = req(join(tmp, "node_modules", "react"));

  const item = (over = {}) => ({ url: "https://files.example/v.mp4", width: 1920, height: 1080, mime: "video/mp4", alt: null, blurhash: null, focal: null, variants: [], ...over });
  const media = (over) => ({ "7": item(over) });

  // ---------------------------------------------------------------- adapter
  await test("toVideo: missing ref / missing media entry / unknown id -> null", () => {
    assert.equal(toVideo({}, undefined), null);
    assert.equal(toVideo({}, null), null);
    assert.equal(toVideo({}, {}), null);
    assert.equal(toVideo(media(), { media_id: 8 }), null);
    assert.equal(toVideo(undefined, { media_id: 7 }), null);
  });
  await test("toVideo: null / empty / unsafe url -> null", () => {
    for (const url of [null, "", "javascript:alert(1)", "data:video/mp4;base64,AAAA", "//evil.example/v.mp4", "file:///etc/passwd"]) {
      assert.equal(toVideo(media({ url }), { media_id: 7 }), null, String(url));
    }
  });
  await test("toVideo: non video/* mime (or missing mime, or kind mismatch) -> null", () => {
    for (const mime of ["image/png", "application/pdf", "", null, "video", "videox/mp4"]) {
      assert.equal(toVideo(media({ mime }), { media_id: 7 }), null, String(mime));
    }
    assert.equal(toVideo(media({ kind: "image" }), { media_id: 7 }), null);
    assert.equal(toVideo(media({ kind: "document" }), { media_id: 7 }), null);
  });
  await test("toVideo: a video/* item gives { url, mime, width, height, durationMs }", () => {
    assert.deepEqual(toVideo(media({ duration_ms: 4200, bytes: 99 }), { media_id: 7 }), {
      url: "https://files.example/v.mp4", mime: "video/mp4", width: 1920, height: 1080, durationMs: 4200,
    });
    assert.deepEqual(toVideo(media({ url: "/images/x.webm", mime: "Video/WebM; codecs=vp9", kind: "video", width: null, height: 0 }), { media_id: 7 }), {
      url: "/images/x.webm", mime: "video/webm", width: null, height: null, durationMs: null,
    });
  });
  await test("toVideo never throws on garbage", () => {
    assert.equal(toVideo({ "7": null }, { media_id: 7 }), null);
    assert.equal(toVideo({ "7": { url: 5, mime: {} } }, { media_id: 7 }), null);
    assert.equal(toVideo(null, { media_id: 7 }), null);
  });

  const heroSection = (props) => ({ id: "s", key: "hero_brand", version: 1, props: { title: "T", background: { media_id: 1, alt: null, decorative: true }, ...props }, resolved: {} });
  const ctx = (m) => ({ locale: "en", media: { "1": item({ url: "/images/site/home/hero-bg.png", mime: "image/png" }), ...m }, category: null, getPosts: async () => ({ items: [] }) });

  await test("heroBrand adapter: no background_video -> props have no backgroundVideo key (unchanged shape)", async () => {
    const p = await ADAPTERS.hero_brand(heroSection({}), ctx({}));
    assert.equal("backgroundVideo" in p, false);
    assert.equal(p.background.url, "/images/site/home/hero-bg.png");
  });
  await test("heroBrand adapter: bad video keeps the poster, good video is passed", async () => {
    const bad = await ADAPTERS.hero_brand(heroSection({ background_video: { media_id: 7 } }), ctx({ "7": item({ mime: "image/png" }) }));
    assert.equal("backgroundVideo" in bad, false);
    assert.ok(bad.background);
    const good = await ADAPTERS.hero_brand(heroSection({ background_video: { media_id: 7 } }), ctx(media()));
    assert.equal(good.backgroundVideo.url, "https://files.example/v.mp4");
    assert.ok(good.background);
  });
  await test("mock API fixtures through the adapter: ok -> video; 404 file -> video (browser falls back); notvideo / nomedia -> none", async () => {
    const api = createMockApi();
    const adapt = async (path) => {
      const r = api.handle("/public/pages/resolve", { path, locale: "en" }, { host: "127.0.0.1:4010" });
      assert.equal(r.status, 200, path);
      const hero = r.body.data.sections.find((s) => s.key === "hero_brand");
      return ADAPTERS.hero_brand(hero, ctx(r.body.data.media));
    };
    assert.equal((await adapt("/video-hero")).backgroundVideo.url, "http://127.0.0.1:4010/mock-media/hero-video.mp4");
    assert.equal((await adapt("/video-hero-404")).backgroundVideo.url, "http://127.0.0.1:4010/mock-media/missing-video.mp4");
    assert.equal("backgroundVideo" in (await adapt("/video-hero-notvideo")), false);
    assert.equal("backgroundVideo" in (await adapt("/video-hero-nomedia")), false);
  });

  // ---------------------------------------------------------------- HeroVideo markup
  const html = renderToStaticMarkup(React.createElement(HeroVideo, { src: "https://files.example/v.mp4", mime: "video/mp4", posterUrl: "/images/site/home/hero-bg.png" }));
  await test("HeroVideo server markup: muted, playsInline, autoPlay, loop, preload=metadata, poster, aria-hidden, tabindex -1", () => {
    const tag = /<video\b[^>]*>/.exec(html)?.[0] ?? "";
    for (const a of ['muted=""', 'playsInline=""', 'autoPlay=""', 'loop=""', 'preload="metadata"', 'poster="/images/site/home/hero-bg.png"', 'aria-hidden="true"', 'tabindex="-1"', "disablePictureInPicture", "disableRemotePlayback"]) {
      assert.ok(tag.includes(a), `missing ${a} in ${tag}`);
    }
    assert.match(html, /<source src="https:\/\/files\.example\/v\.mp4" type="video\/mp4"\/>/);
  });
  await test("HeroVideo markup: no controls, no crossorigin, no sound, starts transparent, covers the hero box", () => {
    const tag = /<video\b[^>]*>/.exec(html)[0];
    assert.doesNotMatch(tag, /controls/i);
    assert.doesNotMatch(html, /crossorigin/i);
    assert.match(tag, /opacity-0/);
    assert.match(tag, /absolute inset-0 size-full object-cover/);
    assert.doesNotMatch(tag, /shadow|blur/);
    assert.match(tag, /data-hero-video="pending"/);
  });
  await test("HeroVideo without poster omits the attribute; non-video mime falls back to video/mp4", () => {
    const h = renderToStaticMarkup(React.createElement(HeroVideo, { src: "/a.webm", mime: "video/webm" }));
    assert.doesNotMatch(h, /poster=/);
    assert.match(h, /type="video\/webm"/);
    assert.equal(P.sourceType("image/png"), "video/mp4");
    assert.equal(P.sourceType(null), "video/mp4");
  });

  // ---------------------------------------------------------------- policy
  await test("policy: reduced motion -> poster only (also when the connection is fine)", () => {
    assert.equal(P.shouldSkipVideo({ reducedMotion: true }), true);
    assert.equal(P.shouldSkipVideo({ reducedMotion: true, connection: { effectiveType: "4g" } }), true);
    assert.equal(P.shouldSkipVideo({ reducedMotion: false }), false);
  });
  await test("policy: saveData / slow-2g / 2g / 3g -> poster only; 4g, unknown, no connection API -> play", () => {
    assert.equal(P.shouldSkipVideo({ reducedMotion: false, connection: { saveData: true } }), true);
    for (const t of ["slow-2g", "2g", "3g"]) assert.equal(P.shouldSkipVideo({ reducedMotion: false, connection: { effectiveType: t } }), true, t);
    for (const c of [{ effectiveType: "4g" }, { effectiveType: "5g" }, { saveData: false }, {}, null, undefined]) {
      assert.equal(P.shouldSkipVideo({ reducedMotion: false, connection: c }), false, JSON.stringify(c));
    }
  });
  await test("policy: stall timeout is ~8 s", () => {
    assert.equal(P.STALL_MS, 8000);
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\nvideo:selftest ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
