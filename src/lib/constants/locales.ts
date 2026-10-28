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

// `<html lang>` (doc/08 §5.5, Q-08-1). The proposal is `la` -> `lo` (ISO 639-1 `la` is Latin, Lao is `lo`), but
// Q-08-1 is still OPEN, so the internal code is used as it is. If the answer is yes, add `la: "lo"` here and
// nowhere else (the cookie, the API and the message files keep the internal code `la`).
const BCP47_ALIASES: Readonly<Record<string, string>> = {};

export function toBcp47(locale: string): string {
  return BCP47_ALIASES[locale] ?? locale;
}
