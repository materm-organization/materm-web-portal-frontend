// Response shapes of the portal read API (doc/08 §2.2-§2.3) as the loaders return them.
// Locale maps are already collapsed to one string, `link` is already `href`, media lives in `media`.
// JSON-derived literals are typed loosely (boolean/string) so the bundled seed can `satisfies` them.

// ------------------------------------------------------------------ envelope

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  total_page: number;
}

export interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

/** list endpoints (P-07, P-11): `data` is a flat array, `meta`/`media` sit beside it (doc/08 §2.3.2) */
export interface ListEnvelope<T> extends Envelope<T[]> {
  meta?: PageMeta;
  media?: MediaMap;
}

export interface ErrorBody {
  success: boolean;
  message?: string;
  code?: string;
}

// ------------------------------------------------------------------ media

export interface MediaItem {
  /** relative (`/images/site/...`, served from public/) or absolute (file service) */
  url: string;
  width: number | null;
  height: number | null;
  mime: string | null;
  alt: string | null;
  blurhash: string | null;
  focal: { x: number; y: number } | null;
  variants: unknown[];
}
/** keyed by media_id as a string */
export type MediaMap = Record<string, MediaItem>;

export interface ImageRef {
  media_id: number;
  /** placement alt; null = use `media[media_id].alt`; "" = decorative */
  alt: string | null;
  decorative: boolean;
}

export interface LinkRef {
  /** null = target page not published: render text only / no button (doc/04 §6.3) */
  href: string | null;
  open_in_new_tab: boolean;
  rel: string[];
}

// ------------------------------------------------------------------ P-01 locales / P-02 settings / P-03 ui / P-04 menus / P-05 site

export interface LocaleInfo {
  code: string;
  name: string;
  native_name: string;
  short_label: string;
  flag: string | null;
  is_default: boolean;
  fallback_code: string | null;
  date_formats: { short: string; months: string[] };
}

export type SettingValue = string | number | null;
/** group -> key -> value (localized values collapsed; `*_media_id` values are media ids) */
export type SettingsGroups = Record<string, Record<string, SettingValue>>;

export interface SettingsData {
  locale: string;
  settings: SettingsGroups;
  media: MediaMap;
}

export interface UiStringsData {
  locale: string;
  /** flat dotted keys: `site.nav.label` -> text (ICU placeholders untouched) */
  strings: Record<string, string>;
}

export interface MenuItem {
  id: number;
  label: string;
  aria_label: string | null;
  href: string | null;
  icon: string | null;
  open_in_new_tab: boolean;
  rel: string[];
  /** `exact` | `prefix` */
  active_match: string;
}
export interface MenuData {
  key: string;
  items: MenuItem[];
}
export type MenuResponse = MenuData & { locale: string };

/** P-05: everything the layout needs (header, footer, switcher, metadata) */
export interface SiteData {
  locale: string;
  locales: LocaleInfo[];
  settings: SettingsGroups;
  menus: { main: MenuData; footer: MenuData; social: MenuData };
  /** ui strings of namespace `site` only (flat dotted keys) */
  ui: Record<string, string>;
  media: MediaMap;
}

// ------------------------------------------------------------------ P-06 pages

export interface SeoData {
  title: string;
  title_absolute: boolean;
  description: string | null;
  og_image: { media_id: number } | null;
  canonical: string;
  noindex: boolean;
}

export interface PageInfo {
  id: number;
  public_id: string;
  key: string;
  template: string;
  path: string;
  is_home: boolean;
  resolved_locale: string;
  is_fallback: boolean;
  title: string;
  updated_at: string;
  seo: SeoData;
}

export interface Section {
  /** public_id (UUID): DOM id = anchor_id ?? "s-" + id (doc/08 §4.4) */
  id: string;
  key: string;
  version: number;
  variant: string | null;
  anchor_id: string | null;
  is_fallback: boolean;
  props: Record<string, unknown>;
  resolved: Record<string, unknown>;
  /** backend does not know this key@version: skip it (doc/08 §4.5) */
  unsupported?: boolean;
}

export interface PageData {
  locale: string;
  page: PageInfo;
  sections: Section[];
  media: MediaMap;
}

// ------------------------------------------------------------------ typed section props (after collapse) and `resolved`

export type Text = string | null;
export interface Cta extends LinkRef {
  label: Text;
}
export interface RichTextDoc {
  type: string;
  content?: RichTextNode[];
}
export interface RichTextNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichTextNode[];
}

export interface HeroBrandProps { title: Text; description?: Text; cta?: Cta; background: ImageRef; show_logo?: boolean; animate_in?: boolean }
export interface HeroArticleProps { title: Text; meta_items?: { text: Text }[]; background: ImageRef; animate_in?: boolean }
export interface IntroHeadingProps { eyebrow: Text; title: Text; description?: Text }
export interface IntroTextProps { text: RichTextDoc | null }
export interface TeaserCollageProps { eyebrow: Text; title: Text; body?: Text; cta?: Cta; images: (ImageRef)[] }
export interface BlogStripProps { eyebrow: Text; title: Text; description?: Text; cta?: Cta; source: string; limit?: number }
export interface GalleryCardsProps { eyebrow: Text; title: Text; description?: Text; cta?: Cta; row_label?: Text; source: string; cards_link?: LinkRef }
export interface AboutBlocksProps {
  items: { date_label?: Text; title: Text; body: RichTextDoc | null; image: ImageRef; image_side?: string; layout?: string; image_ratio?: string }[];
}
export interface PhotoStoryProps { accessible_heading: Text; album_id: number; rows: { layout: string; slots: { album_item_id: number; size: string; offset?: boolean }[] }[] }
export interface ContactSectionProps { eyebrow: Text; title: Text; description?: Text; form_slug?: string }
export interface FaqProps { eyebrow: Text; title: Text; group_key: string; open_first?: boolean }
export interface PostListProps { show_category_tabs?: boolean; show_all_tab?: boolean; page_size?: number }

export interface SectionPropsMap {
  hero_brand: HeroBrandProps;
  hero_article: HeroArticleProps;
  intro_heading: IntroHeadingProps;
  intro_text: IntroTextProps;
  teaser_collage: TeaserCollageProps;
  blog_strip: BlogStripProps;
  gallery_cards: GalleryCardsProps;
  about_blocks: AboutBlocksProps;
  photo_story: PhotoStoryProps;
  contact_section: ContactSectionProps;
  faq: FaqProps;
  post_list: PostListProps;
}

export interface BlogStripPost { post_id: number; href: string; label: Text; title: string; date: string; date_time: string; excerpt: Text; image: { media_id: number; alt: Text } }
export interface GalleryCardResolved { image: ImageRef; caption: { date: Text; title: Text } | null; href: string | null }
export interface PhotoSlot { media_id: number; alt: Text; caption_title: Text; caption_description: Text }
export interface ContactInfoItem { icon: string; label: Text; value: string; href: string | null }
export interface FaqItem { id: number; question: string; answer: RichTextDoc }
export interface CategoryInfo { key: string; name: string; slug: string; sort_order: number }

export interface SectionResolvedMap {
  hero_brand: Record<string, never>;
  hero_article: Record<string, never>;
  intro_heading: Record<string, never>;
  intro_text: Record<string, never>;
  teaser_collage: Record<string, never>;
  about_blocks: Record<string, never>;
  blog_strip: { posts: BlogStripPost[] };
  gallery_cards: { cards: GalleryCardResolved[] };
  photo_story: { slots: Record<string, PhotoSlot> };
  contact_section: { info: ContactInfoItem[]; form: FormDefinition | null };
  faq: { items: FaqItem[] };
  post_list: { categories: CategoryInfo[] };
}

export type SectionKey = keyof SectionPropsMap;
export interface TypedSection<K extends SectionKey> extends Omit<Section, "key" | "props" | "resolved"> {
  key: K;
  props: SectionPropsMap[K];
  resolved: SectionResolvedMap[K];
}

// ------------------------------------------------------------------ P-07..P-10 blog

export interface PostListItem {
  id: number;
  public_id: string;
  slug: string;
  href: string;
  resolved_locale: string;
  is_fallback: boolean;
  title: string;
  excerpt: Text;
  label: Text;
  location_label: Text;
  date: string;
  date_time: string;
  category: { key: string; name: string } | null;
  author: { id: number; name: string } | null;
  image: { media_id: number; alt: Text };
  is_featured: boolean;
}

export interface PostsPage {
  items: PostListItem[];
  meta: PageMeta;
  media: MediaMap;
}

export interface PostQuery {
  category?: string;
  tag?: string;
  page?: number;
  limit?: number;
}

export interface PostDetail extends PostListItem {
  locale: string;
  body: RichTextDoc | null;
  hero: { media_id: number; alt: Text };
  gallery: { heading: Text; description: Text; items: { media_id: number; alt: Text; caption: Text }[] };
  tags: { key: string; name: string; slug: string }[];
  seo: { title: string; description: Text; og_image: { media_id: number } | null; canonical: string; noindex: boolean };
  updated_at: string;
  media: MediaMap;
}

/** P-08 outcome as the `getPost` loader reports it */
export type PostResult =
  | { kind: "post"; post: PostDetail }
  /** slug of another locale: `permanentRedirect(location)` (HTTP 308, doc/08 §3.7) */
  | { kind: "redirect"; location: string; status: number }
  | { kind: "not_found" };

export interface TagInfo { key: string; name: string; slug: string }

// ------------------------------------------------------------------ P-11/P-12 albums, P-13 faq, P-14 form

export interface AlbumSummary {
  id: number;
  key: string;
  title: Text;
  description: Text;
  cover: { media_id: number; alt: Text } | null;
}
export interface AlbumItem { id: number; media_id: number; alt: Text; caption_title: Text; caption_description: Text; sort_order: number }
export interface AlbumDetail extends AlbumSummary {
  locale: string;
  items: AlbumItem[];
  media: MediaMap;
}
export interface AlbumsPage { items: AlbumSummary[]; media: MediaMap }

export interface FaqGroup {
  locale: string;
  group_key: string;
  resolved_locale: string;
  items: FaqItem[];
}

export interface FormField {
  key: string;
  required: boolean;
  /** JSON Schema of the field (x-pii removed) */
  schema: { type?: string; minLength?: number; maxLength?: number; format?: string; pattern?: string; enum?: string[] };
  label: string;
  placeholder: Text;
  help: Text;
  options?: { value: string; label: string }[];
}
export interface FormDefinition {
  slug: string;
  resolved_locale: string;
  title: string;
  description: string;
  submit_label: string;
  sending_label: string;
  success: { title: string; description: string; again_label: string };
  messages: Record<string, string>;
  honeypot_field: string;
  fields: FormField[];
  success_redirect_url: string | null;
}

// ------------------------------------------------------------------ P-16 sitemap / robots

export interface SitemapEntry { kind: string; entity_id: number; path: string; lastmod: string }
export interface SitemapData {
  /** default locale: URLs are canonical */
  locale: string;
  base_url: string;
  entries: SitemapEntry[];
}
export interface RobotsData {
  /** SITE_ENV === "production" || CONTEXT === "production" */
  allow: boolean;
  baseUrl: string;
  sitemap: string;
  disallow: string[];
}

// ------------------------------------------------------------------ bundled seed (src/content/cms-seed)

export interface BundleManifest {
  schema_version: number;
  source: string;
  api_base: string | null;
  counts: Record<string, number>;
  default_locale: string;
  locales: string[];
  /** path -> page key */
  pages: Record<string, string>;
  posts: { id: number; slugs: Record<string, string> }[];
  albums: string[];
  faq_groups: string[];
  forms: string[];
  menus: string[];
  source_checksums: Record<string, string>;
}

export interface LocaleBundle {
  site: Envelope<SiteData>;
  settings: Envelope<SettingsData>;
  uiStrings: Envelope<UiStringsData>;
  categories: Envelope<CategoryInfo[]>;
  tags: Envelope<TagInfo[]>;
  albums: ListEnvelope<AlbumSummary>;
  postList: ListEnvelope<PostListItem>;
  menus: Record<string, Envelope<MenuResponse>>;
  pages: Record<string, Envelope<PageData>>;
  posts: Record<string, Envelope<PostDetail>>;
  albumsByKey: Record<string, Envelope<AlbumDetail>>;
  faq: Record<string, Envelope<FaqGroup>>;
  forms: Record<string, Envelope<FormDefinition>>;
}

export interface BundleData {
  manifest: BundleManifest;
  locales: Envelope<LocaleInfo[]>;
  sitemap: Envelope<SitemapData>;
  byLocale: Record<string, LocaleBundle>;
}
