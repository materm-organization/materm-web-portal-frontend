// Next data-cache tag vocabulary (doc/08 §2.8, §2.2 "Next tags" column) and revalidate windows (§7.1).
// No "server-only": the /api/revalidate route (PF-8) imports `isAllowedTag` from here.

export const TAG = {
  locales: "locales",
  settings: "settings",
  pages: "pages",
  postsList: "posts:list",
  albumsList: "albums:list",
  sitemap: "sitemap",
  redirects: "redirects",
} as const;

export const uiTag = (locale: string) => `ui:${locale}`;
export const menuTag = (key: string) => `menu:${key}`;

/** Seconds. Safety net only: freshness comes from on-demand revalidateTag (doc/08 §7.1). */
export const REVALIDATE = {
  locales: 600, // not in §7.1: same window as settings
  settings: 600, // not in §7.1
  menu: 600, // not in §7.1
  site: 600, // P-05
  ui: 600, // P-03
  page: 300, // P-06
  posts: 300, // P-07
  post: 300, // P-08
  categories: 300, // P-09
  tags: 300, // P-10
  albums: 600, // not in §7.1
  faq: 300, // not in §7.1 (rides with pages)
  form: 300, // not in §7.1 (rides with pages)
  sitemap: 3600, // P-16
  redirects: 600, // P-17
} as const;

/** Tags per resource. P-13/P-14 have "-" in §2.2 (reached through P-06); we attach `pages`+`locales`
 *  because faq/form changes fan out to `page:<id>` + `pages` (§2.8), so a direct fetch is still revalidated. */
export const TAGS = {
  locales: () => [TAG.locales],
  settings: () => [TAG.settings, TAG.locales],
  uiStrings: (locale: string) => [uiTag(locale), TAG.locales],
  menu: (key: string) => [menuTag(key), TAG.locales],
  site: (locale: string) => [TAG.settings, TAG.locales, uiTag(locale), menuTag("main"), menuTag("footer"), menuTag("social")],
  page: (locale: string) => [TAG.pages, TAG.settings, TAG.locales, uiTag(locale)],
  posts: () => [TAG.postsList, TAG.locales],
  post: () => [TAG.postsList, TAG.settings, TAG.locales],
  categories: () => [TAG.postsList, TAG.locales],
  tags: () => [TAG.postsList, TAG.locales],
  albums: () => [TAG.albumsList, TAG.locales],
  album: () => [TAG.albumsList, TAG.locales],
  faq: () => [TAG.pages, TAG.locales],
  form: () => [TAG.pages, TAG.locales],
  sitemap: () => [TAG.sitemap],
  redirects: () => [TAG.redirects],
} as const;

const LOCALE = "[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*";
/** allow-list checked by /api/revalidate before calling revalidateTag; unknown tags are ignored (doc/08 §2.8) */
export const TAG_ALLOWLIST: RegExp[] = [
  /^(?:locales|settings|pages|posts:list|albums:list|sitemap|redirects)$/,
  new RegExp(`^ui:${LOCALE}$`),
  /^menu:[a-z0-9_-]{1,64}$/,
  /^collection:[a-z0-9_-]{1,64}$/,
  /^(?:page|post|album|faq|form):[0-9]{1,18}$/,
];
export const isAllowedTag = (tag: string): boolean => tag.length <= 80 && TAG_ALLOWLIST.some((re) => re.test(tag));
