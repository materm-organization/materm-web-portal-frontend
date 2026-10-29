#!/usr/bin/env node
// Snapshot of the portal read API in the SHAPE OF THE BUNDLE (doc/08 §3.10, PF-12): `npm run cms:snapshot`.
//
// There is ONE fallback, the bundle `src/content/cms-seed/data` (+ `index.ts`): its files already are the API response
// bodies per endpoint and locale, which is exactly what doc/08 §3.10 wants from `src/content/fallback/**`. This script
// produces the same tree from a RUNNING portal backend, so the bundle can be (a) compared with what the API serves and
// (b) replaced by it after go-live. It never writes anywhere unless asked.
//
//   node scripts/cms/snapshot.mjs [--base <url incl. /api/v1>] [--out <dir>] [--compare] [--apply] [--best-effort]
//     base       default CMS_API_BASE_URL, then NEXT_PUBLIC_API_BASE_URL (an absolute URL is required)
//     key        PORTAL_API_KEY from the environment (sent as X-Portal-Key; never printed, never written)
//     --out      write the tree here (default: a temp dir that is printed; nothing in the repo)
//     --compare  also diff the snapshot against src/content/cms-seed/data (exit 1 when they differ)
//     --apply    replace src/content/cms-seed/data + index.ts with the snapshot (manifest.source = "api"); after that
//                `cms:check` skips the seed rebuild check, and `npm run cms:export` goes back to the seed
//     --best-effort  (prebuild use) any problem -> warn and exit 0 with the committed bundle untouched, never fails a build
//
// Discovery: locales (P-01) -> per locale: site (P-05, menu keys), settings, ui-strings, categories, tags, albums (+ each),
// posts (P-07, all pages) + each post, pages = every `page` entry of the sitemap (P-16) resolved through P-06, the FAQ
// groups / form slugs named in the `faq` / `contact_section` props of those pages (P-13 / P-14).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DATA_DIR, SEED_DIR, isMain, parseArgs, readJson, rel, toJsonText } from "./lib/util.mjs";
import { listJson, renderIndex } from "./build-seed.mjs";

const TIMEOUT_MS = 8000;
const PAGE_SIZE = 48;

class SnapshotError extends Error {}

function makeClient(base, key) {
  async function get(path, query = {}) {
    const url = new URL(base.replace(/\/+$/, "") + path);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    let res;
    try {
      res = await fetch(url, { headers: { Accept: "application/json", ...(key ? { "X-Portal-Key": key } : {}) }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "manual" });
    } catch (e) {
      throw new SnapshotError(`${path}: ${e?.name === "TimeoutError" ? "timeout" : "unreachable"}`);
    }
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, body };
  }
  async function must(path, query) {
    const r = await get(path, query);
    if (r.status !== 200 || r.body?.success !== true) throw new SnapshotError(`${path}${query?.locale ? ` [${query.locale}]` : ""}: HTTP ${r.status}${r.body?.code ? ` ${r.body.code}` : ""}`);
    return r.body;
  }
  return { get, must };
}

export async function takeSnapshot({ base, key, log = () => {} }) {
  const api = makeClient(base, key);
  const files = new Map();
  const put = (p, v) => files.set(p, v);

  const locales = await api.must("/public/locales");
  put("locales.json", locales);
  const codes = locales.data.map((l) => l.code);
  const defaultLocale = locales.data.find((l) => l.is_default)?.code ?? codes[0];
  if (!defaultLocale) throw new SnapshotError("no locales");

  const sitemap = await api.must("/public/sitemap");
  put("sitemap.json", sitemap);
  const pagePaths = sitemap.data.entries.filter((e) => e.kind === "page").map((e) => e.path);

  const manifest = { pages: {}, posts: new Map(), albums: new Set(), faq: new Set(), forms: new Set(), menus: new Set() };
  let sections = 0;
  let mediaIds = new Set();

  for (const loc of codes) {
    const q = { locale: loc };
    const site = await api.must("/public/site", q);
    put(`${loc}/site.json`, site);
    for (const k of Object.keys(site.data.menus ?? {})) manifest.menus.add(k);
    put(`${loc}/settings.json`, await api.must("/public/settings", q));
    put(`${loc}/ui-strings.json`, await api.must("/public/ui-strings", q));
    put(`${loc}/categories.json`, await api.must("/public/categories", q));
    put(`${loc}/tags.json`, await api.must("/public/tags", q));
    const albums = await api.must("/public/albums", q);
    put(`${loc}/albums.json`, albums);
    for (const a of albums.data) {
      manifest.albums.add(a.key);
      put(`${loc}/albums/${a.key}.json`, await api.must(`/public/albums/${a.key}`, q));
    }
    // posts: every page of the list, merged into one envelope (the bundle API slices it again)
    let page = 1;
    let all = null;
    for (;;) {
      const r = await api.must("/public/posts", { ...q, page, limit: PAGE_SIZE });
      all = all ? { ...all, data: [...all.data, ...r.data], media: { ...all.media, ...r.media } } : r;
      if (page >= (r.meta?.total_page ?? 1)) break;
      page++;
    }
    all.meta = { total: all.data.length, page: 1, limit: 12, total_page: Math.max(1, Math.ceil(all.data.length / 12)) };
    put(`${loc}/posts/list.json`, all);
    for (const item of all.data) {
      const r = await api.must(`/public/posts/${encodeURIComponent(item.slug)}`, q);
      put(`${loc}/posts/${item.slug}.json`, r);
      const id = r.data.post?.id ?? r.data.id ?? item.id;
      const entry = manifest.posts.get(id) ?? { id, slugs: {} };
      entry.slugs[loc] = item.slug;
      manifest.posts.set(id, entry);
    }
    for (const path of pagePaths) {
      const r = await api.must("/public/pages/resolve", { ...q, path });
      const key = r.data.page.key;
      put(`${loc}/pages/${key}.json`, r);
      manifest.pages[path] = key;
      if (loc === defaultLocale) sections += r.data.sections.length;
      for (const s of r.data.sections) {
        if (s.key === "faq" && s.props?.group_key) manifest.faq.add(s.props.group_key);
        if (s.key === "contact_section" && s.props?.form_slug) manifest.forms.add(s.props.form_slug);
      }
      for (const id of Object.keys(r.data.media ?? {})) mediaIds.add(id);
    }
    for (const k of manifest.menus) {
      const r = await api.get(`/public/menus/${k}`, q);
      if (r.status === 200 && r.body?.success) put(`${loc}/menus/${k}.json`, r.body);
    }
    for (const g of manifest.faq) put(`${loc}/faq/${g}.json`, await api.must(`/public/faq/${g}`, q));
    for (const f of manifest.forms) put(`${loc}/forms/${f}.json`, await api.must(`/public/forms/${f}`, q));
    log(`  ${loc}: ${[...files.keys()].filter((p) => p.startsWith(`${loc}/`)).length} files`);
  }

  const old = existsSync(join(DATA_DIR, "manifest.json")) ? readJson(join(DATA_DIR, "manifest.json")) : {};
  put("manifest.json", {
    schema_version: 1,
    source: "api",
    api_base: new URL(base).origin,
    counts: {
      locales: codes.length,
      pages: Object.keys(manifest.pages).length,
      sections,
      posts: manifest.posts.size,
      albums: manifest.albums.size,
      faq_groups: manifest.faq.size,
      forms: manifest.forms.size,
      media: mediaIds.size,
      ui_strings: Object.keys(files.get(`${defaultLocale}/ui-strings.json`).data.strings ?? {}).length,
    },
    default_locale: defaultLocale,
    locales: codes,
    pages: manifest.pages,
    posts: [...manifest.posts.values()],
    albums: [...manifest.albums].sort(),
    faq_groups: [...manifest.faq].sort(),
    forms: [...manifest.forms].sort(),
    menus: [...manifest.menus],
    source_checksums: old.source_checksums ?? {},
  });
  return files;
}

/** deep equality that reports the first differing JSON paths (max `limit`) */
export function diffJson(a, b, path = "", out = [], limit = 20) {
  if (out.length >= limit) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) diffJson(a[k], b[k], `${path}/${k}`, out, limit);
    return out;
  }
  out.push(`${path || "/"}: bundle=${JSON.stringify(a)?.slice(0, 80)} api=${JSON.stringify(b)?.slice(0, 80)}`);
  return out;
}

export function compareWithBundle(files) {
  const report = [];
  const committed = new Set(listJson(DATA_DIR));
  for (const [p, v] of files) {
    if (p === "manifest.json") continue; // provenance differs by design
    if (!committed.has(p)) { report.push(`${p}: only in the API snapshot`); continue; }
    const d = diffJson(readJson(join(DATA_DIR, p)), v);
    if (d.length) report.push(`${p}:\n      ${d.join("\n      ")}`);
  }
  for (const p of committed) if (p !== "manifest.json" && !files.has(p)) report.push(`${p}: only in the bundle`);
  return report;
}

function writeTree(dir, files) {
  for (const [p, v] of files) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), toJsonText(v));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bestEffort = !!args["best-effort"];
  const base = String(args.base ?? process.env.CMS_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
  const key = process.env.PORTAL_API_KEY || undefined;
  const give = (msg) => {
    if (bestEffort) { console.warn(`cms:snapshot: ${msg}; the committed bundle is used as it is`); process.exit(0); }
    console.error(`cms:snapshot: ${msg}`);
    process.exit(2);
  };
  if (!/^https?:\/\//i.test(base)) give("no absolute API base URL (--base, CMS_API_BASE_URL or NEXT_PUBLIC_API_BASE_URL)");
  if (!key) give("PORTAL_API_KEY is not set");
  let files;
  try {
    files = await takeSnapshot({ base, key, log: (m) => console.log(m) });
  } catch (e) {
    give(e instanceof SnapshotError ? e.message : `unexpected: ${e?.name ?? "error"}`);
  }
  const out = args.out ? String(args.out) : mkdtempSync(join(tmpdir(), "cms-snapshot-"));
  writeTree(out, files);
  console.log(`cms:snapshot: ${files.size} files from ${new URL(base).origin} -> ${out}`);
  let code = 0;
  if (args.compare) {
    const report = compareWithBundle(files);
    if (report.length === 0) console.log("cms:snapshot: the API serves exactly the bundled data (manifest aside)");
    else { console.log(`cms:snapshot: ${report.length} file(s) differ from the bundle:\n  ${report.join("\n  ")}`); code = 1; }
  }
  if (args.apply) {
    for (const p of listJson(DATA_DIR)) if (!files.has(p)) rmSync(join(DATA_DIR, p));
    writeTree(DATA_DIR, files);
    writeFileSync(join(SEED_DIR, "index.ts"), renderIndex([...files.keys()], files.get("manifest.json").locales));
    console.log(`cms:snapshot: applied to ${rel(DATA_DIR)} + index.ts (manifest.source = api). Run: npx tsc --noEmit && npm run cms:validate`);
  } else if (!args.out) {
    rmSync(out, { recursive: true, force: true });
  }
  process.exitCode = code;
}

if (isMain(import.meta.url)) await main();
