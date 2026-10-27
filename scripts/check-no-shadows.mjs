#!/usr/bin/env node
// Guard for the "no shadows anywhere" rule (see src/components/site/README.md).
// Scans the public-site scope and fails (exit 1, file:line) on box/drop/text
// shadows, `ring-*` utilities and shadow-ish filters. Plain Node, no deps.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SRC_EXT = /\.(ts|tsx|css)$/;

// Directories scanned recursively, plus the shadcn kit files the site uses.
const DIRS = [
  "src/app",
  "src/components/site",
  "src/components/home",
  "src/components/our-path",
  "src/components/blog",
  "src/components/gallery",
  "src/components/global",
  "src/components/contact",
];
const UI_FILES = [
  "button", "card", "sheet", "tabs", "toggle", "toggle-group", "badge",
  "aspect-ratio", "carousel", "separator", "sonner", "empty", "dropdown-menu",
  "input", "textarea", "label", "radio-group", "accordion",
].map((n) => `src/components/ui/${n}.tsx`);

// Each rule is tested per line. `shadow-none` is allowed; `--ring`,
// `--color-ring`, `--sidebar-ring` (and `outline-ring`) are allowed names.
const RULES = [
  { re: /(?<![\w-])(?:[\w-]+:)*-?shadow-(?!none\b)[\w\[]/, msg: "shadow-* utility" },
  { re: /(?<![\w-])(?:[\w-]+:)*(?:drop-shadow|text-shadow)\b/, msg: "drop-shadow / text-shadow" },
  { re: /\[text-shadow:/, msg: "arbitrary text-shadow" },
  { re: /(?<![\w-])(?:[\w-]+:)*ring(?:-[\w\[]|\b(?![-:]))/, msg: "ring utility (use outline)" },
  { re: /(?<![\w-])(?:[\w-]+:)*backdrop-blur\b|(?<![\w-])blur-/, msg: "blur / backdrop-blur" },
  { re: /\b(?:box-shadow|text-shadow|drop-shadow)\s*[:(]/, msg: "CSS shadow property / filter" },
  { re: /--shadow\b|--shadow-/, msg: "--shadow-* variable" },
];
const ALLOWED_VARS = /--(?:color-|sidebar-)?ring\b/g;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (SRC_EXT.test(name)) out.push(p);
  }
}

const files = [];
for (const d of DIRS) walk(join(ROOT, d), files);
for (const f of UI_FILES) files.push(join(ROOT, f));
files.push(join(ROOT, "src/app/globals.css"));

let failures = 0;
for (const file of new Set(files)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((raw, i) => {
    // Variable names such as --ring / --color-ring / --sidebar-ring are fine,
    // as is the `outline-ring/50` base style.
    const line = raw.replace(ALLOWED_VARS, "").replace(/outline-ring\S*/g, "");
    for (const { re, msg } of RULES) {
      if (re.test(line)) {
        console.error(`${relative(ROOT, file).split(sep).join("/")}:${i + 1}: ${msg}: ${raw.trim().slice(0, 140)}`);
        failures++;
        break;
      }
    }
  });
}

if (failures) {
  console.error(`\ncheck:shadows failed: ${failures} line(s). Use solid colours / 1px borders; focus uses outline.`);
  process.exit(1);
}
console.log(`check:shadows OK (${new Set(files).size} files scanned)`);
