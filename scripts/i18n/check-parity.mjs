#!/usr/bin/env node
// i18n guard for the public site (PF-1, doc/08 section 5).
//  1. every i18n/site/<name>.en.json has a <name>.la.json with the SAME key set
//     (keys starting with "_" such as `_todoTranslate` are ignored);
//  2. every `la` file carries `"_todoTranslate": true` (the Lao copy is still English);
//  3. the 39 shared UI-string keys of doc/08 section 5.2 (site 23, blog 7, forms 9)
//     exist in both locales and the `{placeholders}` of `la` match `en`;
//  4. the keys that moved are gone from their old home.
// Plain Node, no dependencies. Exit 1 on any problem.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const DIR = join(ROOT, "i18n", "site");
const problems = [];

const read = (file) => JSON.parse(readFileSync(join(DIR, file), "utf8"));

function flatten(value, prefix = "", out = new Map()) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith("_")) continue;
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
}

const placeholders = (text) =>
  typeof text === "string" ? [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",") : "";

// 1 + 2: file pairs
const names = readdirSync(DIR)
  .filter((f) => f.endsWith(".en.json"))
  .map((f) => f.replace(/\.en\.json$/, ""));
const flat = {};
for (const name of names) {
  const laFile = `${name}.la.json`;
  if (!existsSync(join(DIR, laFile))) {
    problems.push(`${name}: missing ${laFile}`);
    continue;
  }
  const en = read(`${name}.en.json`);
  const la = read(laFile);
  flat[name] = { en: flatten(en), la: flatten(la) };
  for (const key of flat[name].en.keys()) {
    if (!flat[name].la.has(key)) problems.push(`${name}: key "${key}" missing in la`);
  }
  for (const key of flat[name].la.keys()) {
    if (!flat[name].en.has(key)) problems.push(`${name}: key "${key}" missing in en`);
  }
  if (la._todoTranslate !== true) problems.push(`${laFile}: missing "_todoTranslate": true`);
  if ("_todoTranslate" in en) problems.push(`${name}.en.json: must not carry _todoTranslate`);
}
for (const file of readdirSync(DIR)) {
  if (file.endsWith(".la.json") && !existsSync(join(DIR, file.replace(".la.json", ".en.json")))) {
    problems.push(`${file}: missing ${file.replace(".la.json", ".en.json")}`);
  }
}

// 3: the 39 shared UI keys (file name -> namespace in request.ts)
const UI_KEYS = {
  common: [
    "skipToContent",
    "nav.label", "nav.openMenu", "nav.closeMenu", "nav.menuTitle", "nav.currentPage",
    "language.label",
    "cta.exploreExpeditions", "cta.viewAllPosts", "cta.viewMore",
    "footer.navLabel", "footer.socialLabel",
    "gallery.rowLabel", "gallery.cardLabel",
    "notFound.title", "notFound.description", "notFound.action",
    "error.title", "error.description", "error.retry",
    "preview.banner", "preview.exit", "preview.expired",
  ],
  blog: [
    "categoryNavLabel", "categories.all", "article.galleryEyebrow",
    "index.listLabel", "index.empty.title", "index.empty.description", "index.empty.action",
  ],
  forms: [
    "errors.required", "errors.email", "errors.messageShort", "errors.phone",
    "errors.generic", "errors.summary", "errors.unconfigured",
    "errors.rateLimited", "errors.unavailable",
  ],
};
let total = 0;
const counts = {};
for (const [name, keys] of Object.entries(UI_KEYS)) {
  counts[name] = keys.length;
  for (const key of keys) {
    total += 1;
    for (const locale of ["en", "la"]) {
      const value = flat[name]?.[locale]?.get(key);
      if (typeof value !== "string" || value === "") problems.push(`${name}.${locale}: UI key "${key}" missing or empty`);
    }
    if (placeholders(flat[name]?.en?.get(key)) !== placeholders(flat[name]?.la?.get(key))) {
      problems.push(`${name}: UI key "${key}" has different {placeholders} in en and la`);
    }
  }
}
if (total !== 39) problems.push(`expected 39 shared UI keys, listed ${total}`);

// 4: moved keys must be gone from the old place
const MOVED = [
  ["home", "gallery.rowLabel"], ["home", "gallery.cardLabel"],
  ["our-path", "gallery.rowLabel"], ["our-path", "gallery.cardLabel"],
  ["contact", "form.errors.required"], ["contact", "form.errors.email"],
  ["contact", "form.errors.messageShort"], ["contact", "form.errors.phone"],
  ["contact", "form.errors.generic"], ["contact", "form.errors.summary"],
  ["contact", "form.errors.unconfigured"],
];
for (const [name, key] of MOVED) {
  for (const locale of ["en", "la"]) {
    if (flat[name]?.[locale]?.has(key)) problems.push(`${name}.${locale}: "${key}" should have moved`);
  }
}

console.log(
  `i18n parity: ${names.length} file pairs (${names.join(", ")}); shared UI keys ${total} ` +
    `(site ${counts.common}, blog ${counts.blog}, forms ${counts.forms}) x 2 locales`,
);
if (problems.length > 0) {
  console.error(problems.map((p) => `  - ${p}`).join("\n"));
  console.error(`i18n parity FAILED (${problems.length} problem(s))`);
  process.exit(1);
}
console.log("i18n parity OK");
