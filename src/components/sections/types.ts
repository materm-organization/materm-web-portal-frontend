// Props contract of the 12 CMS section components (doc/08 section 4, doc/04 section 3.4).
//
// These are the ALREADY-RESOLVED shapes: every `x-localized` leaf is collapsed to a
// plain string for the viewer's locale, every `image` is a `ResolvedImage`, every
// `link` is a `ResolvedLink` (page links already turned into an `href`), rich text is
// a single-locale doc. Section components never see `media_id`, locale maps or API
// envelopes: whoever feeds them (today `adapters/*`, later the API adapters of T1.2.9)
// does the translation. Nothing in this file may import a client module.

export const SECTION_KEYS = [
  "hero_brand",
  "hero_article",
  "intro_heading",
  "intro_text",
  "teaser_collage",
  "blog_strip",
  "gallery_cards",
  "about_blocks",
  "photo_story",
  "contact_section",
  "faq",
  "post_list",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

/** `image` after media resolution. `alt: ""` = decorative. `width`/`height` may be unknown. */
export interface ResolvedImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/** `link` / `cta` after resolution. `href: null` = the target page is not published (render nothing). */
export interface ResolvedLink {
  label: string;
  href: string | null;
  openInNewTab?: boolean;
  rel?: readonly string[];
}

/** Rich text (profile `lite`) collapsed to one locale: ProseMirror-style doc. */
export interface RichTextNode {
  type: string;
  text?: string;
  attrs?: Readonly<Record<string, unknown>>;
  content?: readonly RichTextNode[];
  marks?: readonly { type: string; attrs?: Record<string, unknown> }[];
}
export interface RichTextDoc {
  type: "doc";
  content?: readonly RichTextNode[];
}

// ---------------------------------------------------------------- per-section props

/** Hints only a PREVIEW page carries (editor-only copy, `i18n/site/preview.*.json` `hints.*`). */
export type PreviewHintCode = "no_background_image";

export interface HeroBrandProps {
  title: string;
  description: string | null;
  cta: ResolvedLink | null;
  /** `null` = no usable image (a draft in preview; publish requires one): the hero shows a neutral background. */
  background: ResolvedImage | null;
  /** Set by the adapter in preview mode only, when something is missing that publish would require. */
  previewHint?: PreviewHintCode;
  /** Default true. */
  showLogo?: boolean;
  /** Default true. Only switches the load-in + parallax on/off. */
  animateIn?: boolean;
}

export interface HeroArticleProps {
  title: string;
  /** `meta_items[].text`. */
  metaItems: readonly string[];
  /** `null` = no usable image (a draft in preview): neutral background. */
  background: ResolvedImage | null;
  previewHint?: PreviewHintCode;
  animateIn?: boolean;
}

export interface IntroHeadingProps {
  eyebrow: string;
  title: string;
  description: string | null;
}

export interface IntroTextProps {
  text: RichTextDoc;
}

export interface TeaserCollageProps {
  eyebrow: string;
  title: string;
  body: string | null;
  cta: ResolvedLink | null;
  /** Order = big left, top right, bottom right. */
  images: readonly [ResolvedImage, ResolvedImage, ResolvedImage];
}

export interface BlogStripPostData {
  /** Stable React key (a post may appear more than once). */
  key: string;
  href: string;
  image: ResolvedImage;
  /** Short upright label of a collapsed slice. */
  label: string;
  title: string;
  /** Display date (already formatted for the locale). */
  date: string;
  /** ISO date for `<time dateTime>`. */
  dateTime: string;
  excerpt: string;
}

export interface BlogStripProps {
  eyebrow: string;
  title: string;
  description: string | null;
  cta: ResolvedLink | null;
  posts: readonly BlogStripPostData[];
}

export interface GalleryCardData {
  image: ResolvedImage;
  caption: { date: string; title: string } | null;
  /** `null` = the card is not a link. */
  href: string | null;
}

export interface GalleryCardsProps {
  eyebrow: string;
  title: string;
  description: string | null;
  cta: ResolvedLink | null;
  /** aria-label of the card row; `null` = UI string `site.gallery.rowLabel`. */
  rowLabel: string | null;
  cards: readonly GalleryCardData[];
}

export type AboutImageSide = "left" | "right";
export type AboutLayout = "standard" | "inset";
export type AboutImageRatio = "wide" | "tall" | "pair";

export interface AboutBlockItem {
  dateLabel: string | null;
  title: string;
  body: RichTextDoc;
  image: ResolvedImage;
  imageSide: AboutImageSide;
  layout: AboutLayout;
  /** `null` = `wide` for `standard`, `pair` for `inset`. */
  imageRatio: AboutImageRatio | null;
}

export interface AboutBlocksProps {
  items: readonly AboutBlockItem[];
}

export type PhotoStoryLayout = "wide-narrow" | "narrow-wide" | "staggered-3";
export type PhotoSlotSize = "wide" | "narrow" | "short" | "tall" | "medium";

export interface PhotoStorySlotData {
  /** Album item photo; `width`/`height` are needed here (not `fill`). */
  image: ResolvedImage;
  title: string | null;
  description: string | null;
  size: PhotoSlotSize;
  /** Pushes the slot down 72px on desktop. */
  offset?: boolean;
}

export interface PhotoStoryProps {
  accessibleHeading: string;
  rows: readonly { layout: PhotoStoryLayout; slots: readonly PhotoStorySlotData[] }[];
}

export type ContactIcon = "map_pin" | "phone" | "mail" | "clock";

export interface ContactInfoItem {
  icon: ContactIcon;
  label: string;
  value: string;
  /** `tel:` / `mailto:` / map link; `null` = plain text. */
  href: string | null;
}

/** Codes of `forms.errors.*` (doc/08 section 5.2); `messages` of the form override the bundle. */
export type FormMessageCode =
  | "required"
  | "email"
  | "messageShort"
  | "phone"
  | "generic"
  | "summary"
  | "unconfigured"
  | "rateLimited"
  | "unavailable";

export interface ResolvedFormField {
  /** Field key: `name`, `email`, `phone`, `topic`, `message`. */
  key: string;
  label: string;
  placeholder: string | null;
  options?: readonly { value: string; label: string }[];
}

/** Form definition (P-14 shape, camelCase, text already collapsed to the viewer's locale). */
export interface ResolvedForm {
  slug: string;
  title: string;
  description: string | null;
  submitLabel: string;
  sendingLabel: string;
  success: { title: string; description: string; againLabel: string };
  /** Per-form error texts; a missing code falls back to the `forms.errors.*` bundle. */
  messages: Partial<Record<FormMessageCode, string>>;
  fields: readonly ResolvedFormField[];
}

export interface ContactSectionProps {
  eyebrow: string;
  title: string;
  description: string | null;
  info: readonly ContactInfoItem[];
  /** `null` = no form panel. */
  form: ResolvedForm | null;
}

export interface FaqItemData {
  id: string;
  question: string;
  answer: RichTextDoc;
}

export interface FaqProps {
  eyebrow: string;
  title: string;
  openFirst?: boolean;
  items: readonly FaqItemData[];
}

export interface PostCardData {
  /** Full href, e.g. `/blog/music-night-under-the-stars`. */
  href: string;
  title: string;
  /** Badge text (e.g. "Music Night"). */
  categoryLabel: string;
  date: string;
  dateTime: string;
  location: string;
  image: ResolvedImage;
  excerpt: string;
}

export interface PostListProps {
  showCategoryTabs?: boolean;
  showAllTab?: boolean;
  /** Tabs in order. `key` goes into `/blog?category=<key>`. */
  categories: readonly { key: string; label: string }[];
  /** Selected category key; `null` = all posts. */
  activeCategory: string | null;
  posts: readonly PostCardData[];
}

// ---------------------------------------------------------------- registry typing

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

/** What the renderer adds to every section component's props. */
export interface SectionChrome {
  /** `anchor_id ?? "s-" + public_id`: id of the section's outermost element. Build sub-ids with `subId()`. */
  domId: string;
  /** Effective variant (`null` variant already replaced by the first variant of the type). */
  variant: string | null;
  /** `"soft"` on the LAST section of the page when its variant is soft: put it on the outermost element. */
  footerBackdrop?: "soft";
  /** First section of the page (hero image preload). */
  priority?: boolean;
}

export type SectionComponentProps<K extends SectionKey> = SectionPropsMap[K] & SectionChrome;

/** Preview only: stands where an adapter found too little data (a draft), so the editor sees WHAT is incomplete. */
export const PREVIEW_PLACEHOLDER_KEY = "preview_placeholder" as const;
export interface PreviewPlaceholderData {
  id: string;
  key: typeof PREVIEW_PLACEHOLDER_KEY;
  version: number;
  variant: null;
  anchorId: string | null;
  props: { sectionKey: string; missing: readonly string[] };
}

/** One section of a page as the renderer receives it (adapter / API output). */
export type SectionData = PreviewPlaceholderData | {
  [K in SectionKey]: {
    /** `cms_page_sections.public_id` (any stable unique string for fixtures). */
    id: string;
    key: K;
    version: number;
    /** `cms_page_sections.variant`; `null` = first variant of the type. */
    variant: string | null;
    anchorId: string | null;
    props: SectionPropsMap[K];
  };
}[SectionKey];
