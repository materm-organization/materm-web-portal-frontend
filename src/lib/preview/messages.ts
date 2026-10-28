import "server-only";
import { getLocale } from "next-intl/server";

import en from "../../../i18n/site/preview.en.json";
import la from "../../../i18n/site/preview.la.json";

// Copy of the editor-only preview chrome (`i18n/site/preview.{en,la}.json`: warning lines, status pages, banner extras).
// Deliberately NOT a next-intl namespace: `request.ts` hands every message to the browser, and a visitor must not
// download editor strings (their pages stay byte-identical to what they were before PF-10). Server components only.
// The shared UI strings `site.preview.banner|exit|expired` are ordinary next-intl messages (CMS UI strings P-03).
type Dict = { [key: string]: string | boolean | Dict };
const FILES: Record<string, Dict> = { en, la };

function lookup(dict: Dict, key: string): string | null {
  let cur: string | boolean | Dict | undefined = dict;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null || !Object.hasOwn(cur, part)) return null;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : null;
}

export function formatPreviewText(dict: Dict, key: string, vars: Record<string, string | number> = {}): string {
  const text = lookup(dict, key) ?? lookup(FILES.en, key) ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : m));
}

export async function getPreviewText(): Promise<(key: string, vars?: Record<string, string | number>) => string> {
  const dict = FILES[await getLocale()] ?? FILES.en;
  return (key, vars) => formatPreviewText(dict, key, vars);
}
