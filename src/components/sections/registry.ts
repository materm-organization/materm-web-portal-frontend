import type { ComponentType } from "react";

import { ADAPTERS, type AdaptContext, type SectionAdapter } from "./adapters";

import { AboutBlocks } from "./about-blocks";
import { BlogStrip } from "./blog-strip";
import { ContactSection } from "./contact-section";
import { Faq } from "./faq";
import { GalleryCards } from "./gallery-cards";
import { HeroArticle } from "./hero-article";
import { HeroBrand } from "./hero-brand";
import { IntroHeading } from "./intro-heading";
import { IntroText } from "./intro-text";
import { PhotoStory } from "./photo-story";
import { PostList } from "./post-list";
import { TeaserCollage } from "./teaser-collage";
import type { SectionComponentProps, SectionKey } from "./types";

// Section registry (doc/08 section 4.1): `key` -> component. Pure data: no "use client" here.
//  - `versions`: the `section_version`s the props shape supports; anything else is skipped.
//  - `variants`: allowed `cms_page_sections.variant` values, the first is the default (`null` variant).
//  - `frame`: adjacent sections with the same frame share one wrapper (see `FRAMES`).
//  - `adapter`: API section (`TypedSection<K>`) -> component props (`adapters.ts`, T1.2.9). The same adapter
//    serves every `CMS_MODE`; `null` = not enough data, the section is skipped (`adapt-page.ts`).

/** Wrapper shared by adjacent sections of one frame (doc/08 section 4.3 rule 3). */
export const FRAMES = {
  // 1368px content column at >=1464px viewports; fluid gutters below. The Gallery page container.
  "page-column":
    "mx-auto w-full max-w-[1464px] px-6 md:px-10 xl:px-12 flex flex-col gap-10 pt-6 md:gap-12 md:pt-10",
} as const;

export type FrameName = keyof typeof FRAMES;

// A section component is a (possibly async) Server Component of its own props.
type SectionComponent<K extends SectionKey> = (
  props: SectionComponentProps<K>,
) => React.ReactNode | Promise<React.ReactNode>;

export interface SectionRegistryEntry<K extends SectionKey> {
  versions: readonly number[];
  variants: readonly string[];
  frame?: FrameName;
  adapter: SectionAdapter<K>;
  component: SectionComponent<K>;
}

export const SECTION_REGISTRY: { [K in SectionKey]: SectionRegistryEntry<K> } = {
  hero_brand: { versions: [1], variants: ["normal", "wide"], adapter: ADAPTERS.hero_brand, component: HeroBrand },
  hero_article: { versions: [1], variants: [], adapter: ADAPTERS.hero_article, component: HeroArticle },
  intro_heading: { versions: [1], variants: [], adapter: ADAPTERS.intro_heading, component: IntroHeading },
  intro_text: { versions: [1], variants: [], frame: "page-column", adapter: ADAPTERS.intro_text, component: IntroText },
  teaser_collage: { versions: [1], variants: [], adapter: ADAPTERS.teaser_collage, component: TeaserCollage },
  blog_strip: { versions: [1], variants: [], adapter: ADAPTERS.blog_strip, component: BlogStrip },
  gallery_cards: { versions: [1], variants: ["home", "standard", "showcase"], adapter: ADAPTERS.gallery_cards, component: GalleryCards },
  about_blocks: { versions: [1], variants: ["soft", "white"], adapter: ADAPTERS.about_blocks, component: AboutBlocks },
  photo_story: { versions: [1], variants: [], frame: "page-column", adapter: ADAPTERS.photo_story, component: PhotoStory },
  contact_section: { versions: [1], variants: [], adapter: ADAPTERS.contact_section, component: ContactSection },
  faq: { versions: [1], variants: ["soft", "white"], adapter: ADAPTERS.faq, component: Faq },
  post_list: { versions: [1], variants: [], adapter: ADAPTERS.post_list, component: PostList },
};

/** Loosely typed view of an entry, for the renderer (which dispatches on a runtime string). */
export type AnySectionEntry = {
  versions: readonly number[];
  variants: readonly string[];
  frame?: FrameName;
  adapter: (section: never, ctx: AdaptContext) => unknown;
  component: ComponentType<never>;
};

export function getSectionEntry(key: string): AnySectionEntry | undefined {
  return Object.hasOwn(SECTION_REGISTRY, key)
    ? (SECTION_REGISTRY[key as SectionKey] as unknown as AnySectionEntry)
    : undefined;
}
