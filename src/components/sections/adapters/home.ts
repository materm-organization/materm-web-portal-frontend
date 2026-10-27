import { getTranslations } from "next-intl/server";

import { HOME_BLOG_POSTS } from "@/lib/site/home-data";

import type { SectionData } from "../types";
import { staticImage } from "./media";

// Home as sections, built from the typed data + the `home` i18n namespace. This is the
// pre-CMS data source; T1.1.14's data layer / T1.2.9's API adapters replace it with the same
// `SectionData[]` shape. Section ids are stable fixtures (DOM id = "s-" + id).

const GALLERY_CARD_PHOTO = "/images/site/gallery-card-forest-stream.png";
const GALLERY_CARD_COUNT = 3;

export async function getHomeSections(): Promise<SectionData[]> {
  const [hero, ourPath, blog, gallery] = await Promise.all([
    getTranslations("home.hero"),
    getTranslations("home.ourPath"),
    getTranslations("home.blog"),
    getTranslations("home.gallery"),
  ]);

  const caption = { date: gallery("caption.date"), title: gallery("caption.title") };

  return [
    {
      id: "home-hero",
      key: "hero_brand",
      version: 1,
      variant: "normal",
      anchorId: null,
      props: {
        title: hero("title"),
        description: hero("description"),
        cta: { label: hero("cta"), href: "/our-path" },
        // The photo is decorative; the hero provides the page's only <h1>.
        background: staticImage("/images/site/home/hero-bg.png"),
        showLogo: true,
        animateIn: true,
      },
    },
    {
      id: "home-our-path",
      key: "teaser_collage",
      version: 1,
      variant: null,
      anchorId: null,
      props: {
        eyebrow: ourPath("label"),
        title: ourPath("title"),
        body: ourPath("body"),
        cta: { label: ourPath("cta"), href: "/our-path" },
        images: [
          staticImage("/images/site/home/our-path-photo-1.jpg", ourPath("photos.glacier")),
          staticImage("/images/site/home/our-path-photo-2.jpg", ourPath("photos.hiker")),
          staticImage("/images/site/home/our-path-photo-3.jpg", ourPath("photos.climber")),
        ],
      },
    },
    {
      id: "home-blog",
      key: "blog_strip",
      version: 1,
      variant: null,
      anchorId: null,
      props: {
        eyebrow: blog("label"),
        title: blog("title"),
        description: blog("description"),
        cta: { label: blog("cta"), href: "/blog" },
        posts: HOME_BLOG_POSTS.map(({ key, slug, image, publishedAt }) => ({
          key,
          href: `/blog/${slug}`,
          image: staticImage(image, blog(`posts.${key}.imageAlt`)),
          label: blog(`posts.${key}.label`),
          title: blog(`posts.${key}.title`),
          date: blog(`posts.${key}.date`),
          dateTime: publishedAt,
          excerpt: blog(`posts.${key}.excerpt`),
        })),
      },
    },
    {
      id: "home-gallery",
      key: "gallery_cards",
      version: 1,
      variant: "home",
      anchorId: null,
      props: {
        eyebrow: gallery("label"),
        title: gallery("title"),
        description: gallery("description"),
        cta: { label: gallery("cta"), href: "/gallery" },
        rowLabel: null,
        cards: Array.from({ length: GALLERY_CARD_COUNT }, (_, i) => ({
          image: staticImage(GALLERY_CARD_PHOTO, i === 0 ? gallery("photoAlt") : ""),
          caption,
          href: "/gallery",
        })),
      },
    },
  ];
}
