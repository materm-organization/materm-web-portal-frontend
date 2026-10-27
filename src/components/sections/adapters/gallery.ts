import { getTranslations } from "next-intl/server";

import {
  GALLERY_CARD_COUNT,
  GALLERY_CARD_IMAGE,
  GALLERY_PHOTOS,
  PHOTO_STORY_ROWS,
} from "@/lib/site/gallery-data";

import { paragraphsToDoc } from "../rich-text";
import type { SectionData } from "../types";
import { staticImage } from "./media";

// The Gallery page as sections (pre-CMS data source, see adapters/home.ts).
export async function getGallerySections(): Promise<SectionData[]> {
  const [t, photos] = await Promise.all([getTranslations("gallery"), getTranslations("gallery.photos")]);

  return [
    {
      id: "gallery-hero",
      key: "hero_article",
      version: 1,
      variant: null,
      anchorId: null,
      props: {
        title: t("hero.title"),
        metaItems: [t("hero.meta.date"), t("hero.meta.event"), t("hero.meta.place")],
        background: staticImage("/images/site/hero-forest-stream.jpg", t("hero.imageAlt")),
        animateIn: true,
      },
    },
    {
      id: "gallery-intro",
      key: "intro_text",
      version: 1,
      variant: null,
      anchorId: null,
      props: { text: paragraphsToDoc([t("intro")]) },
    },
    {
      id: "gallery-photo-story",
      key: "photo_story",
      version: 1,
      variant: null,
      anchorId: null,
      props: {
        accessibleHeading: t("story.heading"),
        rows: PHOTO_STORY_ROWS.map((row) => ({
          layout: row.layout,
          slots: row.slots.map((slot) => {
            const photo = GALLERY_PHOTOS[slot.photo];
            return {
              image: {
                url: photo.src,
                alt: photos(`${photo.id}.alt`),
                width: photo.width,
                height: photo.height,
              },
              title: photos(`${photo.id}.title`),
              description: photos(`${photo.id}.description`),
              size: slot.size,
              offset: slot.offset,
            };
          }),
        })),
      },
    },
    {
      id: "gallery-showcase",
      key: "gallery_cards",
      version: 1,
      variant: "showcase",
      anchorId: null,
      props: {
        eyebrow: t("section.eyebrow"),
        title: t("section.title"),
        description: t("section.description"),
        cta: null,
        rowLabel: t("section.cardsLabel"),
        cards: Array.from({ length: GALLERY_CARD_COUNT }, (_, index) => ({
          image: staticImage(GALLERY_CARD_IMAGE, index === 0 ? t("section.cardAlt") : ""),
          caption: null,
          href: null,
        })),
      },
    },
  ];
}
