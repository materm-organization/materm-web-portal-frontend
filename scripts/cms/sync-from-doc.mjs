#!/usr/bin/env node
// Maintainer tool: refresh the repo copies of the design-doc seed from a doc checkout.
//
//   node scripts/cms/sync-from-doc.mjs <path-to>/doc/content-schemas
//
// Copies content-schemas/*.json -> src/content/cms-seed/schemas/ and
// content-schemas/examples/{page,post,album}.*.json + menus.json + media-manifest.json -> src/content/cms-seed/source/.
// (The repo is self-contained: doc/ is its own repo and is not available to CI/Netlify/clones, so no
// other script reads it.) Afterwards run `npm run cms:export` and `npm run cms:validate`.
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { SCHEMA_DIR, SOURCE_DIR } from "./lib/util.mjs";

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/cms/sync-from-doc.mjs <path>/doc/content-schemas");
  process.exit(2);
}
const dir = resolve(arg);
if (!existsSync(join(dir, "examples"))) {
  console.error(`not a content-schemas dir: ${dir}`);
  process.exit(2);
}
let n = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  copyFileSync(join(dir, f), join(SCHEMA_DIR, f));
  n++;
}
for (const f of readdirSync(join(dir, "examples")).filter((x) => x.endsWith(".json"))) {
  copyFileSync(join(dir, "examples", f), join(SOURCE_DIR, f));
  n++;
}
console.log(`sync-from-doc: copied ${n} files (reference.json is hand-authored and untouched)`);
