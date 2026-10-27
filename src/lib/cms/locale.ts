// Locale helpers. `normalizeLocaleCode` / `pickLocale` are pure; `getRequestLocale` reads the cookie.
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME } from "../constants/locales";
import type { LocaleInfo } from "./types";

export const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

/** `lo` is an alias of `la` (doc/08 §2.1). Returns null when the value is not a locale code. */
export function normalizeLocaleCode(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!LOCALE_PATTERN.test(v)) return null;
  return v === "lo" ? "la" : v;
}

/** requested -> active list -> default (FR-LOC-03: a closed/unknown locale becomes the default) */
export function pickLocale(raw: string | null | undefined, active: readonly LocaleInfo[]): string {
  const code = normalizeLocaleCode(raw);
  if (code && active.some((l) => l.code === code)) return code;
  return active.find((l) => l.is_default)?.code ?? DEFAULT_LOCALE;
}

/** cookie `locale` -> active locales (P-01, cached) -> default. Dynamic (reads cookies()). */
export async function getRequestLocale(): Promise<string> {
  const { cookies } = await import("next/headers");
  const raw = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  const { getLocales } = await import("./loaders");
  return pickLocale(raw, await getLocales());
}
