#!/usr/bin/env node
// Media manifest for the admin seed (doc/08 §8.9, input of T1.2.5 / AD-3).
//
//   node scripts/cms/export-media-manifest.mjs [--check] [--out <file>] [--stamp]
//
// Input : src/content/cms-seed/source/media-manifest.json  (the 24 listed files; NOT a glob of
//         public/images/site, which also holds icons/torn edges/footer art that are not media rows)
//         + the file bytes under public/images/site/** (size, sha256, width/height read from the
//         PNG/JPEG/SVG headers with plain Node)
//         + the first-placement alt text (la/en) found in the seed pages/post/album/settings.
// Output: src/content/cms-seed/exports/media-manifest.json  (default). Deterministic: no
//         timestamps. `--stamp` adds generated_at on a custom --out (release artefact).
// --check: exit 1 when the committed output is stale.
import { readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import {
  EXPORT_DIR, ROOT, SOURCE_DIR, finishCheck, isMain, parseArgs, readJson, rel, toJsonText, writeOrCheck,
} from "./lib/util.mjs";

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".avif": "image/avif",
};

export function pngSize(buf) {
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

export function svgSize(text) {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return null;
  const num = (name) => {
    const m = new RegExp(`\\s${name}\\s*=\\s*["']\\s*([0-9.]+)\\s*(px)?\\s*["']`, "i").exec(tag);
    return m ? Math.round(parseFloat(m[1])) : null;
  };
  const w = num("width"), h = num("height");
  if (w && h) return { width: w, height: h };
  const vb = /viewBox\s*=\s*["']\s*([-0-9.]+)[\s,]+([-0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*["']/i.exec(tag);
  if (vb) return { width: Math.round(parseFloat(vb[3])), height: Math.round(parseFloat(vb[4])) };
  return null;
}

/** Sniff the real format from the bytes (one listed *.png is actually a JPEG). */
export function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return { mime: "image/png", ...pngSize(buf) };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return { mime: "image/jpeg", ...jpegSize(buf) };
  const head = buf.toString("utf8", 0, Math.min(buf.length, 512)).trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return { mime: "image/svg+xml", ...svgSize(buf.toString("utf8")) };
  return null;
}

/** locale-map -> {la,en} when it carries a non-empty text */
function pickAlt(map) {
  if (!map || typeof map !== "object") return null;
  const out = {};
  for (const l of ["la", "en"]) if (typeof map[l] === "string" && map[l].trim()) out[l] = map[l];
  return Object.keys(out).length ? out : null;
}

/** First-placement alt per media_id, walking pages -> post -> album -> brand settings (fixed order). */
export function collectAlts() {
  const alts = new Map();
  const put = (id, alt) => { if (id && alt && !alts.has(id)) alts.set(id, alt); };
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    if (Number.isInteger(n.media_id) && n.alt && typeof n.alt === "object") put(n.media_id, pickAlt(n.alt));
    Object.values(n).forEach(walk);
  };
  for (const p of ["home", "our-path", "blog", "gallery", "contact"]) {
    walk(readJson(join(SOURCE_DIR, `page.${p}.json`)).sections);
  }
  const post = readJson(join(SOURCE_DIR, "post.music-night-under-the-stars.json"));
  const tr = (list, field) => {
    const o = {};
    for (const t of list) if (t[field]) o[t.locale_code] = t[field];
    return pickAlt(o);
  };
  put(post.post.hero_media_id, tr(post.translations, "hero_alt"));
  for (const m of post.media) put(m.media_id, tr(m.translations, "alt"));
  const album = readJson(join(SOURCE_DIR, "album.forest-photo-story.json"));
  for (const it of album.items) put(it.media_id, tr(it.translations, "alt"));
  const ref = readJson(join(SOURCE_DIR, "reference.json"));
  const setting = (k) => ref.settings.find((s) => s.group === "brand" && s.key === k);
  put(setting("logo_media_id")?.value, pickAlt(setting("logo_alt")?.value));
  put(setting("emblem_media_id")?.value, pickAlt(setting("emblem_alt")?.value));
  return alts;
}

export function buildMediaManifest() {
  const listed = readJson(join(SOURCE_DIR, "media-manifest.json"));
  const alts = collectAlts();
  const problems = [];
  const media = listed.map((m) => {
    const abs = join(ROOT, m.file);
    if (!existsSync(abs)) {
      problems.push(`missing file: ${m.file}`);
      return { ...m, mime_type: null, bytes: null, width: null, height: null, checksum_sha256: null, alt: alts.get(m.media_id) ?? null };
    }
    const buf = readFileSync(abs);
    const ext = extname(abs).toLowerCase();
    const dim = sniff(buf);
    if (!dim || !dim.width) problems.push(`cannot read dimensions: ${m.file}`);
    else if (MIME[ext] && MIME[ext] !== dim.mime) {
      console.warn(`export-media-manifest: warning: ${m.file} has extension ${ext} but is ${dim.mime} (mime_type uses the real format)`);
    }
    return {
      media_id: m.media_id,
      file: m.file,
      storage_key: m.storage_key,
      kind: m.kind,
      mime_type: dim?.mime ?? MIME[ext] ?? "application/octet-stream",
      bytes: statSync(abs).size,
      width: dim?.width ?? null,
      height: dim?.height ?? null,
      checksum_sha256: createHash("sha256").update(buf).digest("hex"),
      alt: alts.get(m.media_id) ?? null,
    };
  });
  if (new Set(media.map((m) => m.media_id)).size !== media.length) problems.push("duplicate media_id in manifest");
  return { media, problems };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const { media, problems } = buildMediaManifest();
  if (problems.length) {
    console.error("export-media-manifest: " + problems.join("\n  "));
    process.exit(1);
  }
  const out = args.out ? join(process.cwd(), String(args.out)) : join(EXPORT_DIR, "media-manifest.json");
  const payload = args.stamp ? { generated_at: new Date().toISOString(), media } : media;
  const stale = [];
  writeOrCheck(out, toJsonText(payload), { check: !!args.check, stale });
  if (args.check) finishCheck(stale, "export-media-manifest", "Run: npm run cms:export");
  else console.log(`export-media-manifest: ${media.length} media -> ${rel(out)}`);
}
