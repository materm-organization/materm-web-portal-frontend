// Single source of truth for the public site's navigation (header + footer).
// `labelKey` is a key under the `site` i18n namespace (i18n/site/common.*.json).
export const SITE_NAV_ITEMS = [
  { href: "/", labelKey: "nav.home" },
  { href: "/our-path", labelKey: "nav.ourPath" },
  { href: "/blog", labelKey: "nav.blog" },
  { href: "/gallery", labelKey: "nav.gallery" },
  // No Contact page exists in the design yet, so this route 404s for now.
  { href: "/contact", labelKey: "nav.contact" },
] as const;

export const SITE_FOOTER_NAV_ITEMS = [
  { href: "/", labelKey: "footer.nav.home" },
  { href: "/our-path", labelKey: "footer.nav.ourPath" },
  { href: "/blog", labelKey: "footer.nav.blog" },
  { href: "/contact", labelKey: "footer.nav.contact" },
] as const;

export type SiteNavItem = (typeof SITE_NAV_ITEMS)[number];

// Home matches exactly; every other item also matches its nested routes
// (e.g. /blog/music-night keeps "The Blog" active).
export function isActiveSiteRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
