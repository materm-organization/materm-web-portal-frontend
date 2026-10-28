export const DEFAULT_LOCALE = "la" as const;

export const LOCALE_COOKIE_NAME = "locale";

export const LOCALES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "la", name: "ລາວ", flag: "🇱🇦" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

export function isSupportedLocale(value: string | undefined): value is LocaleCode {
  return !!value && LOCALES.some((l) => l.code === value);
}

// `<html lang>` (doc/08 §5.5, Q-08-1): decided yes on 2026-10-28 - ISO 639-1 `la` is Latin, Lao is `lo`, so the
// attribute says `lo`. Only this attribute changes: the cookie, the API and the message files keep the internal
// code `la`.
const BCP47_ALIASES: Readonly<Record<string, string>> = { la: "lo" };

export function toBcp47(locale: string): string {
  return BCP47_ALIASES[locale] ?? locale;
}
