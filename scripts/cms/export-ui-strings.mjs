#!/usr/bin/env node
// UI-strings manifest for the admin seed / bundle-sync (doc/08 §8.9, input of T1.2.5 / AD-3).
//
//   node scripts/cms/export-ui-strings.mjs [--check] [--strict] [--out <file>] [--stamp]
//
// Reads i18n/site/{common,blog,forms}.{en,la}.json and writes the flattened dotted keys that live
// in `cms_ui_strings` (doc/04 §4.6 = 28 keys + doc/08 §5.2 = 11 new keys = 39 keys x 2 locales).
// Keys that start with "_" (e.g. `_todoTranslate`) are never exported (doc/08 §5.4).
//
// Each key has a `primary` source (where it lives AFTER task T1.1.13 / PF-1) and, where the key is
// being moved, a `legacy` source (where it lives today). New keys have no legacy source: until
// PF-1 creates them they are listed under `pending` (never invented here). `--strict` fails when
// anything is pending, when a locale value is missing, or when the count is not 39.
//
// Output (deterministic, no timestamps): src/content/cms-seed/exports/ui-strings.json
//   { schema_version, expected_count, keys: [{ key, namespace, values: { la, en } }], pending: [key] }
// `--stamp` (with --out) adds generated_at + source_commit (env CMS_SOURCE_COMMIT) for a release upload.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EXPORT_DIR, I18N_DIR, finishCheck, isMain, parseArgs, readJson, rel, toJsonText, writeOrCheck } from "./lib/util.mjs";

const L = (file, ...path) => ({ file, path });

/** key -> { primary, legacy? }. File = i18n/site/<file>.<locale>.json */
export const UI_KEYS = [
  // site (14)
  ["site.skipToContent", L("common", "skipToContent")],
  ["site.nav.label", L("common", "nav", "label")],
  ["site.nav.openMenu", L("common", "nav", "openMenu")],
  ["site.nav.closeMenu", L("common", "nav", "closeMenu")],
  ["site.nav.menuTitle", L("common", "nav", "menuTitle")],
  ["site.nav.currentPage", L("common", "nav", "currentPage")],
  ["site.language.label", L("common", "language", "label")],
  ["site.cta.exploreExpeditions", L("common", "cta", "exploreExpeditions")],
  ["site.cta.viewAllPosts", L("common", "cta", "viewAllPosts")],
  ["site.cta.viewMore", L("common", "cta", "viewMore")],
  ["site.footer.navLabel", L("common", "footer", "navLabel")],
  ["site.footer.socialLabel", L("common", "footer", "socialLabel")],
  ["site.gallery.rowLabel", L("common", "gallery", "rowLabel"), L("home", "gallery", "rowLabel")],
  ["site.gallery.cardLabel", L("common", "gallery", "cardLabel"), L("home", "gallery", "cardLabel")],
  // blog (7)
  ["blog.categoryNavLabel", L("blog", "categoryNavLabel")],
  ["blog.categories.all", L("blog", "categories", "all")],
  ["blog.article.galleryEyebrow", L("blog", "article", "galleryEyebrow")],
  ["blog.index.listLabel", L("blog", "index", "listLabel")],
  ["blog.index.empty.title", L("blog", "index", "empty", "title")],
  ["blog.index.empty.description", L("blog", "index", "empty", "description")],
  ["blog.index.empty.action", L("blog", "index", "empty", "action")],
  // forms (7 moved + 2 new)
  ["forms.errors.required", L("forms", "errors", "required"), L("contact", "form", "errors", "required")],
  ["forms.errors.email", L("forms", "errors", "email"), L("contact", "form", "errors", "email")],
  ["forms.errors.messageShort", L("forms", "errors", "messageShort"), L("contact", "form", "errors", "messageShort")],
  ["forms.errors.phone", L("forms", "errors", "phone"), L("contact", "form", "errors", "phone")],
  ["forms.errors.generic", L("forms", "errors", "generic"), L("contact", "form", "errors", "generic")],
  ["forms.errors.summary", L("forms", "errors", "summary"), L("contact", "form", "errors", "summary")],
  ["forms.errors.unconfigured", L("forms", "errors", "unconfigured"), L("contact", "form", "errors", "unconfigured")],
  ["forms.errors.rateLimited", L("forms", "errors", "rateLimited")],
  ["forms.errors.unavailable", L("forms", "errors", "unavailable")],
  // new site keys (doc/08 §3.8, §3.9)
  ["site.notFound.title", L("common", "notFound", "title")],
  ["site.notFound.description", L("common", "notFound", "description")],
  ["site.notFound.action", L("common", "notFound", "action")],
  ["site.error.title", L("common", "error", "title")],
  ["site.error.description", L("common", "error", "description")],
  ["site.error.retry", L("common", "error", "retry")],
  ["site.preview.banner", L("common", "preview", "banner")],
  ["site.preview.exit", L("common", "preview", "exit")],
  ["site.preview.expired", L("common", "preview", "expired")],
];
export const EXPECTED_COUNT = 39;
const LOCALES = ["la", "en"];

function load(file, locale) {
  const p = join(I18N_DIR, `${file}.${locale}.json`);
  return existsSync(p) ? readJson(p) : null;
}
function get(obj, path) {
  let cur = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== "object" || !(k in cur)) return undefined;
    cur = cur[k];
  }
  return typeof cur === "string" ? cur : undefined;
}
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

export function buildUiStrings() {
  const cache = new Map();
  const bundle = (file, locale) => {
    const k = `${file}.${locale}`;
    if (!cache.has(k)) cache.set(k, load(file, locale));
    return cache.get(k);
  };
  const keys = [];
  const pending = [];
  const errors = [];
  for (const [key, primary, legacy] of UI_KEYS) {
    if (key.split(".").some((s) => s.startsWith("_"))) continue; // never export "_..." keys
    const values = {};
    let missing = false;
    for (const loc of LOCALES) {
      let v = get(bundle(primary.file, loc), primary.path);
      if (v === undefined && legacy) v = get(bundle(legacy.file, loc), legacy.path);
      if (v === undefined) missing = true;
      else values[loc] = v;
    }
    if (missing) {
      pending.push(key);
      continue;
    }
    if (placeholders(values.la) !== placeholders(values.en)) errors.push(`${key}: ICU placeholders differ between la and en`);
    keys.push({ key, namespace: key.split(".")[0], values });
  }
  keys.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  pending.sort();
  const seen = new Set(UI_KEYS.map(([k]) => k));
  if (seen.size !== UI_KEYS.length) errors.push("duplicate key in UI_KEYS");
  if (UI_KEYS.length !== EXPECTED_COUNT) errors.push(`UI_KEYS has ${UI_KEYS.length} entries, expected ${EXPECTED_COUNT}`);
  return { payload: { schema_version: 1, expected_count: EXPECTED_COUNT, keys, pending }, errors };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const { payload, errors } = buildUiStrings();
  if (payload.pending.length) {
    console.warn(`export-ui-strings: ${payload.pending.length} key(s) pending (not in i18n/site yet): ${payload.pending.join(", ")}`);
  }
  if (errors.length) {
    console.error("export-ui-strings:\n  " + errors.join("\n  "));
    process.exit(1);
  }
  if (args.strict && (payload.pending.length || payload.keys.length !== EXPECTED_COUNT)) {
    console.error(`export-ui-strings --strict: ${payload.keys.length}/${EXPECTED_COUNT} keys resolved, ${payload.pending.length} pending`);
    process.exit(1);
  }
  const out = args.out ? join(process.cwd(), String(args.out)) : join(EXPORT_DIR, "ui-strings.json");
  const body = args.stamp
    ? { generated_at: new Date().toISOString(), source_commit: process.env.CMS_SOURCE_COMMIT ?? null, ...payload }
    : payload;
  const stale = [];
  writeOrCheck(out, toJsonText(body), { check: !!args.check, stale });
  if (args.check) finishCheck(stale, "export-ui-strings", "Run: npm run cms:export");
  else console.log(`export-ui-strings: ${payload.keys.length}/${EXPECTED_COUNT} keys x ${LOCALES.length} locales -> ${rel(out)}`);
}
