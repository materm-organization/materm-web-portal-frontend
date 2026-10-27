// Shared helpers for scripts/cms/*. Plain Node, no dependencies.
// NOTE: nothing in scripts/cms reads ../doc at run time (the repo is self-contained:
// CI/Netlify and clones have no ../doc). Only `sync-from-doc.mjs` takes an explicit path.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const SEED_DIR = join(ROOT, "src", "content", "cms-seed");
export const SOURCE_DIR = join(SEED_DIR, "source");
export const SCHEMA_DIR = join(SEED_DIR, "schemas");
export const EXPORT_DIR = join(SEED_DIR, "exports");
export const DATA_DIR = join(SEED_DIR, "data");
export const I18N_DIR = join(ROOT, "i18n", "site");
export const PUBLIC_SITE_DIR = join(ROOT, "public", "images", "site");

export const rel = (p) => relative(ROOT, p).split("\\").join("/");

export function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Deterministic JSON text: 2-space indent, insertion order, trailing newline. */
export function toJsonText(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

/**
 * Write `content` to `file`, or (check mode) only compare with what is on disk.
 * Returns true when the file is up to date (check) / was written (write).
 */
export function writeOrCheck(file, content, { check, stale }) {
  if (check) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current !== content) {
      stale.push(rel(file));
      return false;
    }
    return true;
  }
  mkdirSync(dirname(file), { recursive: true });
  const current = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (current !== content) writeFileSync(file, content);
  return true;
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

export function finishCheck(stale, label, hint) {
  if (stale.length) {
    console.error(`${label}: STALE (${stale.length} file(s)):`);
    for (const f of stale) console.error(`  - ${f}`);
    console.error(hint);
    process.exit(1);
  }
  console.log(`${label}: up to date`);
}

/** True when the module is the process entry point (works with spaces/odd chars in the path). */
export function isMain(metaUrl) {
  return !!process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href;
}
