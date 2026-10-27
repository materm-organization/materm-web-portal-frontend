import { getTranslations } from "next-intl/server";

import { localizePost } from "@/components/blog/localize-post";
import { BLOG_CATEGORIES, getPostsByCategory, isBlogCategory } from "@/lib/site/blog-posts";

import type { SectionData } from "../types";
import { staticImage } from "./media";

/** `?category=` value -> a known category key, or `undefined` (= all posts). */
export function parseBlogCategory(raw: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return isBlogCategory(candidate) ? candidate : undefined;
}

// The Blog index as sections (pre-CMS data source, see adapters/home.ts). Unknown category
// values fall back to "all posts". No Figma design exists for this page (an addition).
export async function getBlogIndexSections(category?: string): Promise<SectionData[]> {
  const t = await getTranslations("blog");
  const selected = isBlogCategory(category) ? category : undefined;
  const posts = await Promise.all(getPostsByCategory(selected).map(localizePost));

  return [
    {
      id: "blog-hero",
      key: "hero_article",
      version: 1,
      variant: null,
      anchorId: null,
      props: {
        title: t("index.title"),
        metaItems: [t("index.subtitle")],
        background: staticImage("/images/site/hero-forest-stream.jpg"),
        animateIn: true,
      },
    },
    {
      id: "blog-posts",
      key: "post_list",
      version: 1,
      variant: null,
      anchorId: null,
      props: {
        showCategoryTabs: true,
        showAllTab: true,
        categories: BLOG_CATEGORIES.map((key) => ({ key, label: t(`categories.${key}`) })),
        activeCategory: selected ?? null,
        posts: posts.map((post) => ({
          href: `/blog/${post.slug}`,
          title: post.title,
          categoryLabel: post.categoryLabel,
          date: post.displayDate,
          dateTime: post.isoDate,
          location: post.location,
          image: staticImage(post.heroImage.src, post.heroImage.alt),
          excerpt: post.intro[0] ?? "",
        })),
      },
    },
  ];
}
