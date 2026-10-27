import { getTranslations } from "next-intl/server";

import { ABOUT_BLOCKS, GALLERY_TEASER } from "@/lib/site/our-path-data";

import { paragraphsToDoc } from "../rich-text";
import type { AboutBlockItem, AboutImageRatio, SectionData } from "../types";
import { staticImage } from "./media";

// Our Path as sections (pre-CMS data source, see adapters/home.ts).
// Photo frame of each pre-CMS block (kayak = wide 712:478, glacier = pair 624:480, climber = tall 712:555).
const ABOUT_IMAGE_RATIO_BY_BLOCK: Record<string, AboutImageRatio> = {
  kayak: "wide",
  glacier: "pair",
  climber: "tall",
};

export async function getOurPathSections(): Promise<SectionData[]> {
  const [hero, intro, about, gallery] = await Promise.all([
    getTranslations("ourPath.hero"),
    getTranslations("ourPath.intro"),
    getTranslations("ourPath.about"),
    getTranslations("ourPath.gallery"),
  ]);

  const caption = { date: gallery("caption.date"), title: gallery("caption.title") };

  const items: AboutBlockItem[] = ABOUT_BLOCKS.map((block) => {
    const base = `items.${block.id}`;
    const src = typeof block.image.src === "string" ? block.image.src : block.image.src.src;
    return {
      dateLabel: about(`${base}.date`),
      title: about(`${base}.title`),
      body: paragraphsToDoc(
        Array.from({ length: block.paragraphCount }, (_, index) => about(`${base}.paragraphs.p${index + 1}`)),
      ),
      image: staticImage(src, about(`${base}.imageAlt`)),
      imageSide: block.imageSide,
      layout: block.inset ? "inset" : "standard",
      imageRatio: ABOUT_IMAGE_RATIO_BY_BLOCK[block.id] ?? null,
    };
  });

  return [
    {
      id: "our-path-hero",
      key: "hero_brand",
      version: 1,
      variant: "wide",
      anchorId: null,
      props: {
        title: hero("title"),
        description: hero("description"),
        cta: null,
        background: staticImage("/images/site/our-path/hero-bg-forest.jpg"),
        animateIn: true,
      },
    },
    {
      id: "our-path-intro",
      key: "intro_heading",
      version: 1,
      variant: null,
      anchorId: null,
      props: { eyebrow: intro("eyebrow"), title: intro("title"), description: intro("description") },
    },
    {
      id: "our-path-about",
      key: "about_blocks",
      version: 1,
      variant: "soft",
      anchorId: null,
      props: { items },
    },
    {
      id: "our-path-gallery",
      key: "gallery_cards",
      version: 1,
      variant: "standard",
      anchorId: null,
      props: {
        eyebrow: gallery("eyebrow"),
        title: gallery("title"),
        description: gallery("description"),
        cta: { label: gallery("cta"), href: GALLERY_TEASER.href },
        rowLabel: null,
        cards: Array.from({ length: GALLERY_TEASER.count }, (_, index) => ({
          image: staticImage(
            GALLERY_TEASER.image,
            gallery("cardAlt", { position: index + 1, count: GALLERY_TEASER.count }),
          ),
          caption,
          href: GALLERY_TEASER.href,
        })),
      },
    },
  ];
}
