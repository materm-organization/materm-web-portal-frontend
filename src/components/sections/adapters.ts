// API -> props adapters (doc/08 §4.1, PF-4). ONE path for every `CMS_MODE` (bundle, mock, api): a section
// arrives as the portal API sent it (`TypedSection<K>`: snake_case props, `media_id`s, `resolved.*`; locale
// maps already collapsed by the server) and leaves as the camelCase props of its component
// (`types.ts`, `ResolvedImage {url, alt, width, height}`, `ResolvedLink`).
//
// Rules:
//  - Pure and synchronous, except `post_list` (it needs the post list): no "server-only", no React, so the
//    function can be exercised outside Next. Everything the API can get wrong is handled HERE.
//  - Return `null` when the data is not enough to render the section (missing hero image, empty list...):
//    `adaptPage` skips it and logs `section_invalid` (doc/08 §4.5). A throw is treated the same way.
//  - Text is never trusted to be present: `null`/missing becomes `""` or `null` as the component expects.
//  - Images go through `resolveImage` (placement alt wins, decorative = "", host guard of `next/image`).
import { resolveImage } from "@/lib/cms/media";
import type {
  AboutBlocksProps as ApiAboutBlocks,
  Cta,
  LinkRef,
  MediaMap,
  PostQuery,
  PostsPage,
  PostListItem,
  TypedSection,
  FormDefinition,
} from "@/lib/cms/types";
import type { SectionKey as ApiSectionKey } from "@/lib/cms/types";

import type {
  AboutBlockItem,
  AboutImageRatio,
  AboutImageSide,
  AboutLayout,
  ContactIcon,
  ContactInfoItem,
  FormMessageCode,
  GalleryCardData,
  PhotoSlotSize,
  PhotoStoryLayout,
  PhotoStorySlotData,
  PostCardData,
  ResolvedForm,
  ResolvedImage,
  ResolvedLink,
  RichTextDoc,
  SectionPropsMap,
} from "./types";

/** What an adapter may use besides the section itself. */
export interface AdaptContext {
  locale: string;
  /** `data.media` of the page response */
  media: MediaMap;
  /** `?category=` of the request (only `post_list` reads it) */
  category: string | null;
  /** P-07, injected by `adaptPage` so this file stays free of server-only modules */
  getPosts: (query: PostQuery) => Promise<PostsPage>;
}

export type SectionAdapter<K extends ApiSectionKey> = (
  section: TypedSection<K>,
  ctx: AdaptContext,
) => SectionPropsMap[K] | null | Promise<SectionPropsMap[K] | null>;

// ---------------------------------------------------------------- small helpers (exported for tests)

export const str = (v: unknown): string => (typeof v === "string" ? v : "");
export const strOrNull = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const arr = <T,>(v: readonly T[] | null | undefined): readonly T[] => (Array.isArray(v) ? v : []);
function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

export function toImage(media: MediaMap, ref: Parameters<typeof resolveImage>[1]): ResolvedImage | null {
  const r = resolveImage(media, ref);
  return r ? { url: r.src, alt: r.alt, width: r.width, height: r.height } : null;
}

/** `cta` / `link`: no label or no target = no button */
export function toLink(cta: (Partial<Cta> & Partial<LinkRef>) | null | undefined): ResolvedLink | null {
  const label = strOrNull(cta?.label);
  if (!cta || !label || !cta.href) return null;
  return { label, href: cta.href, openInNewTab: cta.open_in_new_tab === true, rel: arr(cta.rel) };
}

/** a rich-text value that is not a `doc` is no text */
export function toDoc(v: unknown): RichTextDoc | null {
  return v && typeof v === "object" && (v as { type?: unknown }).type === "doc" ? (v as RichTextDoc) : null;
}

// ---------------------------------------------------------------- adapters

const heroBrand: SectionAdapter<"hero_brand"> = (s, { media }) => {
  const background = toImage(media, s.props.background);
  const title = strOrNull(s.props.title);
  if (!background || !title) return null;
  return {
    title,
    description: strOrNull(s.props.description),
    cta: toLink(s.props.cta),
    background,
    showLogo: s.props.show_logo ?? true,
    animateIn: s.props.animate_in ?? true,
  };
};

const heroArticle: SectionAdapter<"hero_article"> = (s, { media }) => {
  const background = toImage(media, s.props.background);
  const title = strOrNull(s.props.title);
  if (!background || !title) return null;
  return {
    title,
    metaItems: arr(s.props.meta_items).map((m) => strOrNull(m?.text)).filter((t): t is string => t !== null),
    background,
    animateIn: s.props.animate_in ?? true,
  };
};

const introHeading: SectionAdapter<"intro_heading"> = (s) => {
  const title = strOrNull(s.props.title);
  if (!title) return null;
  return { eyebrow: str(s.props.eyebrow), title, description: strOrNull(s.props.description) };
};

const introText: SectionAdapter<"intro_text"> = (s) => {
  const text = toDoc(s.props.text);
  return text ? { text } : null;
};

const teaserCollage: SectionAdapter<"teaser_collage"> = (s, { media }) => {
  const images = arr(s.props.images).map((ref) => toImage(media, ref));
  const title = strOrNull(s.props.title);
  // the collage is designed for exactly three photos (big left, top right, bottom right)
  if (!title || images.length !== 3 || images.some((i) => i === null)) return null;
  return {
    eyebrow: str(s.props.eyebrow),
    title,
    body: strOrNull(s.props.body),
    cta: toLink(s.props.cta),
    images: images as [ResolvedImage, ResolvedImage, ResolvedImage],
  };
};

const blogStrip: SectionAdapter<"blog_strip"> = (s, { media }) => {
  const posts = arr(s.resolved?.posts).flatMap((post, index) => {
    const image = toImage(media, post.image);
    if (!image || !post.href || !strOrNull(post.title)) return [];
    return [{
      // the same post may appear more than once: the index keeps React keys unique
      key: `${post.post_id}-${index}`,
      href: post.href,
      image,
      label: str(post.label),
      title: post.title,
      date: str(post.date),
      dateTime: str(post.date_time),
      excerpt: str(post.excerpt),
    }];
  });
  if (posts.length === 0) return null;
  return {
    eyebrow: str(s.props.eyebrow),
    title: str(s.props.title),
    description: strOrNull(s.props.description),
    cta: toLink(s.props.cta),
    posts,
  };
};

const galleryCards: SectionAdapter<"gallery_cards"> = (s, { media }) => {
  const cards = arr(s.resolved?.cards).flatMap((card): GalleryCardData[] => {
    const image = toImage(media, card.image);
    if (!image) return [];
    const date = strOrNull(card.caption?.date);
    const title = strOrNull(card.caption?.title);
    return [{ image, caption: date || title ? { date: str(date), title: str(title) } : null, href: strOrNull(card.href) }];
  });
  if (cards.length === 0) return null;
  return {
    eyebrow: str(s.props.eyebrow),
    title: str(s.props.title),
    description: strOrNull(s.props.description),
    cta: toLink(s.props.cta),
    rowLabel: strOrNull(s.props.row_label),
    cards,
  };
};

const aboutBlocks: SectionAdapter<"about_blocks"> = (s, { media }) => {
  const items = arr<ApiAboutBlocks["items"][number]>(s.props.items).flatMap((item, index): AboutBlockItem[] => {
    const image = toImage(media, item.image);
    const body = toDoc(item.body);
    const title = strOrNull(item.title);
    if (!image || !body || !title) return [];
    const side: AboutImageSide = oneOf(item.image_side, ["left", "right"] as const) ?? (index % 2 === 0 ? "left" : "right");
    return [{
      dateLabel: strOrNull(item.date_label),
      title,
      body,
      image,
      imageSide: side,
      layout: oneOf<AboutLayout>(item.layout, ["standard", "inset"]) ?? "standard",
      imageRatio: oneOf<AboutImageRatio>(item.image_ratio, ["wide", "tall", "pair"]),
    }];
  });
  return items.length > 0 ? { items } : null;
};

const LAYOUTS = ["wide-narrow", "narrow-wide", "staggered-3"] as const;
const SIZES = ["wide", "narrow", "short", "tall", "medium"] as const;

const photoStory: SectionAdapter<"photo_story"> = (s, { media }) => {
  const slots = s.resolved?.slots ?? {};
  const rows = arr(s.props.rows).flatMap((row) => {
    const layout = oneOf<PhotoStoryLayout>(row.layout, LAYOUTS);
    if (!layout) return [];
    const cells = arr(row.slots).flatMap((slot): PhotoStorySlotData[] => {
      const item = Object.hasOwn(slots, String(slot.album_item_id)) ? slots[String(slot.album_item_id)] : undefined;
      const size = oneOf<PhotoSlotSize>(slot.size, SIZES);
      const image = item ? toImage(media, { media_id: item.media_id, alt: item.alt }) : null;
      if (!item || !size || !image) return [];
      return [{ image, title: strOrNull(item.caption_title), description: strOrNull(item.caption_description), size, offset: slot.offset === true }];
    });
    return cells.length > 0 ? [{ layout, slots: cells }] : [];
  });
  if (rows.length === 0) return null;
  return { accessibleHeading: str(s.props.accessible_heading), rows };
};

const CONTACT_ICONS = ["map_pin", "phone", "mail", "clock"] as const;
const FORM_MESSAGE_CODES: readonly FormMessageCode[] = [
  "required", "email", "messageShort", "phone", "generic", "summary", "unconfigured", "rateLimited", "unavailable",
];

export function toForm(def: FormDefinition | null | undefined): ResolvedForm | null {
  if (!def || !def.slug || arr(def.fields).length === 0) return null;
  const messages: Partial<Record<FormMessageCode, string>> = {};
  for (const code of FORM_MESSAGE_CODES) {
    const v = def.messages && Object.hasOwn(def.messages, code) ? strOrNull(def.messages[code]) : null;
    if (v) messages[code] = v;
  }
  return {
    slug: def.slug,
    title: str(def.title),
    description: strOrNull(def.description),
    submitLabel: str(def.submit_label),
    sendingLabel: str(def.sending_label),
    success: { title: str(def.success?.title), description: str(def.success?.description), againLabel: str(def.success?.again_label) },
    messages,
    fields: arr(def.fields).map((f) => ({
      key: f.key,
      label: str(f.label),
      placeholder: strOrNull(f.placeholder),
      ...(f.options && f.options.length > 0 ? { options: f.options.map((o) => ({ value: o.value, label: str(o.label) })) } : {}),
    })),
  };
}

const contactSection: SectionAdapter<"contact_section"> = (s) => {
  const info = arr(s.resolved?.info).flatMap((item): ContactInfoItem[] => {
    const icon = oneOf<ContactIcon>(item.icon, CONTACT_ICONS);
    const value = strOrNull(item.value);
    return icon && value ? [{ icon, label: str(item.label), value, href: strOrNull(item.href) }] : [];
  });
  return {
    eyebrow: str(s.props.eyebrow),
    title: str(s.props.title),
    description: strOrNull(s.props.description),
    info,
    form: toForm(s.resolved?.form),
  };
};

const faq: SectionAdapter<"faq"> = (s) => {
  const items = arr(s.resolved?.items).flatMap((item) => {
    const answer = toDoc(item.answer);
    return answer && strOrNull(item.question) ? [{ id: String(item.id), question: item.question, answer }] : [];
  });
  if (items.length === 0) return null;
  return { eyebrow: str(s.props.eyebrow), title: str(s.props.title), openFirst: s.props.open_first ?? true, items };
};

function toPostCard(item: PostListItem, media: MediaMap): PostCardData | null {
  const image = toImage(media, item.image);
  if (!image || !item.href || !strOrNull(item.title)) return null;
  return {
    href: item.href,
    title: item.title,
    // the badge shows the post's `label` ("Music Night"); the tab label ("Music") is the category name
    categoryLabel: str(item.label) || str(item.category?.name),
    date: str(item.date),
    dateTime: str(item.date_time),
    location: str(item.location_label),
    image,
    excerpt: str(item.excerpt),
  };
}

const postList: SectionAdapter<"post_list"> = async (s, ctx) => {
  const categories = arr(s.resolved?.categories).map((c) => ({ key: c.key, label: str(c.name) }));
  // an unknown `?category=` falls back to "all posts" (the API would answer with an empty list)
  const active = ctx.category && categories.some((c) => c.key === ctx.category) ? ctx.category : null;
  const page = await ctx.getPosts({ category: active ?? undefined, limit: s.props.page_size });
  return {
    showCategoryTabs: s.props.show_category_tabs ?? true,
    showAllTab: s.props.show_all_tab ?? true,
    categories,
    activeCategory: active,
    posts: page.items.flatMap((item) => {
      const card = toPostCard(item, page.media);
      return card ? [card] : [];
    }),
  };
};

/** key -> adapter. Complete by type: a new section key does not compile until it has an adapter. */
export const ADAPTERS: { [K in ApiSectionKey]: SectionAdapter<K> } = {
  hero_brand: heroBrand,
  hero_article: heroArticle,
  intro_heading: introHeading,
  intro_text: introText,
  teaser_collage: teaserCollage,
  blog_strip: blogStrip,
  gallery_cards: galleryCards,
  about_blocks: aboutBlocks,
  photo_story: photoStory,
  contact_section: contactSection,
  faq,
  post_list: postList,
};
