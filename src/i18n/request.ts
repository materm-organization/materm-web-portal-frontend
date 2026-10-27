import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
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
        return [namespace, await loadSiteFile(file, locale)] as const;
      } catch {
        // A missing/broken per-page file must not take the whole site down.
        return [namespace, await loadSiteFile(file, "en").catch(() => ({}))] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

async function loadMessages(locale: LocaleCode): Promise<Messages> {
  const base = (await import(`../../i18n/${locale}.json`)).default as Messages;
  return { ...base, ...(await loadSiteMessages(locale)) };
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  try {
    const messages = await loadMessages(locale);
    return { locale, messages, timeZone: "Asia/Vientiane" };
  } catch {
    // last-resort fallback if a locale file is missing/broken — hardcoded to
    // "en" (not DEFAULT_LOCALE) so a broken la.json can't fall back to itself.
    const messages = await loadMessages("en");
    return { locale: "en", messages, timeZone: "Asia/Vientiane" };
  }
});
