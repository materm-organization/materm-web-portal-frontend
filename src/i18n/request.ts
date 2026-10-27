import { getRequestConfig } from "next-intl/server";

import { getUiStrings } from "@/lib/cms/loaders";
import { getRequestLocale } from "@/lib/cms/locale";
import { applyUiStrings } from "@/lib/cms/ui-strings";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type LocaleCode,
} from "@/lib/constants/locales";

type Messages = Record<string, unknown>;

// Public marketing site messages live in their own files so four page owners
// never edit the same JSON. Each file is merged under a top-level namespace:
//   i18n/site/common.{en,la}.json   -> `site`     (nav, footer, shared CTAs)
//   i18n/site/home.{en,la}.json     -> `home`
//   i18n/site/our-path.{en,la}.json -> `ourPath`
//   i18n/site/blog.{en,la}.json     -> `blog`
//   i18n/site/gallery.{en,la}.json  -> `gallery`
//   i18n/site/contact.{en,la}.json  -> `contact`
//   i18n/site/forms.{en,la}.json    -> `forms`    (form error defaults, shared by every form)
// To add a namespace, add a line here, create both locale files and a
// `case` in `loadSiteFile` below (static paths keep the bundler happy).
const SITE_NAMESPACES = {
  site: "common",
  home: "home",
  ourPath: "our-path",
  blog: "blog",
  gallery: "gallery",
  contact: "contact",
  forms: "forms",
} as const;

type SiteFile = (typeof SITE_NAMESPACES)[keyof typeof SITE_NAMESPACES];

// Marker keys such as `_todoTranslate` (the `la` files are English copies) are not messages: drop every
// top-level key that starts with "_" (doc/08 §5.3 step 2).
function withoutMarkers(file: Messages): Messages {
  return Object.fromEntries(Object.entries(file).filter(([key]) => !key.startsWith("_")));
}

async function loadSiteFile(file: SiteFile, locale: LocaleCode): Promise<Messages> {
  switch (file) {
    case "common":
      return (await import(`../../i18n/site/common.${locale}.json`)).default;
    case "home":
      return (await import(`../../i18n/site/home.${locale}.json`)).default;
    case "our-path":
      return (await import(`../../i18n/site/our-path.${locale}.json`)).default;
    case "blog":
      return (await import(`../../i18n/site/blog.${locale}.json`)).default;
    case "gallery":
      return (await import(`../../i18n/site/gallery.${locale}.json`)).default;
    case "contact":
      return (await import(`../../i18n/site/contact.${locale}.json`)).default;
    case "forms":
      return (await import(`../../i18n/site/forms.${locale}.json`)).default;
  }
}

async function loadSiteMessages(locale: LocaleCode): Promise<Messages> {
  const entries = await Promise.all(
    Object.entries(SITE_NAMESPACES).map(async ([namespace, file]) => {
      try {
        return [namespace, withoutMarkers(await loadSiteFile(file, locale))] as const;
      } catch {
        // A missing/broken per-page file must not take the whole site down.
        return [namespace, withoutMarkers(await loadSiteFile(file, "en").catch(() => ({})))] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

async function loadMessages(locale: LocaleCode): Promise<Messages> {
  const base = (await import(`../../i18n/${locale}.json`)).default as Messages;
  return { ...base, ...(await loadSiteMessages(locale)) };
}

// CMS UI-string overrides (`cms_ui_strings`, P-03) are applied over the bundled messages (doc/08 §5.3 step 4).
// The loader already falls back to the bundled copy when the API is down; if even that fails the
// bundle messages are used as they are. Never throws.
async function withUiOverrides(messages: Messages, locale: string): Promise<Messages> {
  try {
    const { strings } = await getUiStrings(locale, "site,blog,forms");
    // clone first: the per-file JSON modules are shared between requests and must not be mutated
    return applyUiStrings(structuredClone(messages) as Parameters<typeof applyUiStrings>[0], strings);
  } catch {
    return messages;
  }
}

export default getRequestConfig(async () => {
  // cookie `locale` -> active locales (P-01) -> default. Only locales we ship message files for are usable.
  const requested = await getRequestLocale();
  const locale: LocaleCode = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;

  try {
    const messages = await withUiOverrides(await loadMessages(locale), locale);
    return { locale, messages, timeZone: "Asia/Vientiane" };
  } catch {
    // last-resort fallback if a locale file is missing/broken — hardcoded to
    // "en" (not DEFAULT_LOCALE) so a broken la.json can't fall back to itself.
    const messages = await loadMessages("en");
    return { locale: "en", messages, timeZone: "Asia/Vientiane" };
  }
});
