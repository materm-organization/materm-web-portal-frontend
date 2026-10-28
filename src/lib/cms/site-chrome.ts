// Header / footer / language switcher data from the P-05 site bundle (doc/08 §3.4, §5.5). Pure: usable from
// Server Components and from the Node self-test (`npm run site:selftest`). No "server-only", no "use client".
//
// What it decides:
//  - menu items whose target is not published (`href: null`) or whose href is unsafe are SKIPPED;
//  - an empty / missing menu falls back to the code defaults (labels from the i18n bundle);
//  - brand name, statement, emblem alt and copyright come from settings `brand.*` / `footer.*`, with the i18n
//    bundle as the fallback;
//  - the switcher lists only the locales the API returned (P-01 lists active locales only; an explicit
//    `is_active: false` is dropped too).
import type { LocaleInfo, MenuData, MenuItem, SettingsGroups, SiteData } from "./types";

export type Translate = (key: string) => string;

export interface ChromeLink {
  href: string;
  label: string;
  ariaLabel: string | null;
  /** `exact`: only that path; `prefix`: the path and everything below it */
  match: "exact" | "prefix";
  /** absolute http(s) / mailto / tel: rendered as a plain <a>, never marked active */
  external: boolean;
  newTab: boolean;
  /** `noopener noreferrer` is always present when newTab */
  rel: string | undefined;
  icon: string | null;
}

export interface ChromeLanguage {
  code: string;
  /** chip text, `short_label` from the API */
  label: string;
  /** full name for tooltips / aria */
  name: string;
}

export interface SiteChrome {
  brand: { name: string; statement: string; emblemAlt: string; copyright: string };
  nav: ChromeLink[];
  footerNav: ChromeLink[];
  social: ChromeLink[];
  languages: ChromeLanguage[];
}

/** Code defaults used when the API menu is empty (i18n keys under `site`). */
const NAV_FALLBACK = [
  { href: "/", key: "nav.home", match: "exact" },
  { href: "/our-path", key: "nav.ourPath", match: "prefix" },
  { href: "/blog", key: "nav.blog", match: "prefix" },
  { href: "/gallery", key: "nav.gallery", match: "prefix" },
  { href: "/contact", key: "nav.contact", match: "prefix" },
] as const;
const FOOTER_FALLBACK = [
  { href: "/", key: "footer.nav.home", match: "exact" },
  { href: "/our-path", key: "footer.nav.ourPath", match: "prefix" },
  { href: "/blog", key: "footer.nav.blog", match: "prefix" },
  { href: "/contact", key: "footer.nav.contact", match: "prefix" },
] as const;

const INTERNAL_RE = /^\/(?![/\\])[^\s]*$/;
const EXTERNAL_RE = /^(?:https?:\/\/[^\s/]+[^\s]*|mailto:[^\s]+|tel:[^\s]+)$/i;

function toLink(item: MenuItem): ChromeLink | null {
  const href = item.href?.trim();
  if (!href) return null; // target page not published
  const internal = INTERNAL_RE.test(href);
  if (!internal && !EXTERNAL_RE.test(href)) return null;
  const label = item.label?.trim();
  if (!label) return null;
  const newTab = item.open_in_new_tab === true;
  const rel = [...new Set([...(item.rel ?? []), ...(newTab ? ["noopener", "noreferrer"] : [])])].join(" ");
  return {
    href,
    label,
    ariaLabel: item.aria_label?.trim() || null,
    // "/" never prefix-matches: it would be active on every page
    match: item.active_match === "exact" || href === "/" ? "exact" : "prefix",
    external: !internal,
    newTab,
    rel: rel || undefined,
    icon: item.icon || null,
  };
}

function linksOf(menu: MenuData | undefined): ChromeLink[] {
  return (menu?.items ?? []).map(toLink).filter((l): l is ChromeLink => l !== null);
}

function fallbackLinks(defs: ReadonlyArray<{ href: string; key: string; match: "exact" | "prefix" }>, t: Translate): ChromeLink[] {
  return defs.map((d) => ({ href: d.href, label: t(d.key), ariaLabel: null, match: d.match, external: false, newTab: false, rel: undefined, icon: null }));
}

/** Does the page at `pathname` belong to this nav item? External links are never active. */
export function isActiveLink(pathname: string, link: Pick<ChromeLink, "href" | "match" | "external">): boolean {
  if (link.external) return false;
  const path = link.href.split(/[?#]/)[0] || "/";
  if (link.match === "exact" || path === "/") return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function setting(settings: SettingsGroups | undefined, group: string, key: string): string | undefined {
  const v = settings?.[group]?.[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/**
 * Locales for the switcher. The API order is the editors' `sort_order`, with the default locale first (la);
 * the Figma bar shows "EN | LAO", so the default locale is shown LAST (other locales keep the API order).
 */
export function chromeLanguages(locales: readonly (LocaleInfo & { is_active?: boolean })[] | undefined): ChromeLanguage[] {
  const active = (locales ?? []).filter((l) => l.is_active !== false && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(l.code));
  const ordered = [...active.filter((l) => !l.is_default), ...active.filter((l) => l.is_default)];
  return ordered.map((l) => ({ code: l.code, label: l.short_label?.trim() || l.code.toUpperCase(), name: l.native_name?.trim() || l.name || l.code }));
}

export function buildSiteChrome(site: SiteData | undefined, t: Translate): SiteChrome {
  const s = site?.settings;
  const nav = linksOf(site?.menus?.main);
  const footerNav = linksOf(site?.menus?.footer);
  return {
    brand: {
      name: setting(s, "brand", "name") ?? t("brand"),
      statement: setting(s, "brand", "statement") ?? t("footer.statement"),
      emblemAlt: setting(s, "brand", "emblem_alt") ?? t("footer.emblemAlt"),
      copyright: setting(s, "footer", "copyright") ?? t("footer.copyright"),
    },
    nav: nav.length > 0 ? nav : fallbackLinks(NAV_FALLBACK, t),
    footerNav: footerNav.length > 0 ? footerNav : fallbackLinks(FOOTER_FALLBACK, t),
    // social links have no code default: no menu = no icons
    social: linksOf(site?.menus?.social).filter((l) => l.external && l.icon !== null),
    languages: chromeLanguages(site?.locales),
  };
}
