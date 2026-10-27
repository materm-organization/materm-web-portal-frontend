import type { Metadata } from "next";

import { getBlogIndexSections, parseBlogCategory } from "@/components/sections/adapters/blog-index";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { createTranslatedSiteMetadata } from "@/lib/site-metadata";

// Blog index: an ADDITION (no Figma design). Reuses the article hero, the category strip
// (filter via `?category=`) and a shadcn Card grid, all through the `hero_article` and
// `post_list` sections.
interface BlogIndexPageProps {
  searchParams: Promise<{ category?: string | string[] }>;
}

export const generateMetadata = (): Promise<Metadata> =>
  createTranslatedSiteMetadata("blog", "index.metaTitle", "index.metaDescription");

export default async function BlogIndexPage({ searchParams }: BlogIndexPageProps) {
  const { category } = await searchParams;
  // Unknown values fall back to "all posts".
  return <SectionRenderer sections={await getBlogIndexSections(parseBlogCategory(category))} />;
}
