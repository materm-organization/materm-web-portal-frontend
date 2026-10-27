import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BlogContainer } from "@/components/blog/blog-container";
import { CategoryTabs } from "@/components/blog/category-tabs";
import { localizePost } from "@/components/blog/localize-post";
import { PostCard } from "@/components/blog/post-card";
import { Reveal, revealDelay } from "@/components/site/motion";
import { PageHero } from "@/components/site/page-hero";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { CtaLink } from "@/components/site/cta-link";
import { createTranslatedSiteMetadata } from "@/lib/site-metadata";
import { getPostsByCategory, isBlogCategory } from "@/lib/site/blog-posts";

// Blog index: an ADDITION (no Figma design). Reuses the article hero, the
// category strip (filter via `?category=`) and a shadcn Card grid.
interface BlogIndexPageProps {
  searchParams: Promise<{ category?: string | string[] }>;
}

export const generateMetadata = (): Promise<Metadata> =>
  createTranslatedSiteMetadata("blog", "index.metaTitle", "index.metaDescription");

export default async function BlogIndexPage({ searchParams }: BlogIndexPageProps) {
  const { category: rawCategory } = await searchParams;
  const candidate = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
  // Unknown values fall back to "all posts".
  const category = isBlogCategory(candidate) ? candidate : undefined;

  const t = await getTranslations("blog");
  const posts = await Promise.all(getPostsByCategory(category).map(localizePost));

  return (
    <>
      <PageHero
        variant="article"
        image="/images/site/hero-forest-stream.jpg"
        imageAlt=""
        title={t("index.title")}
        meta={[t("index.subtitle")]}
        animateIn
      />

      <BlogContainer className="pt-12 pb-16 lg:pb-[100px]">
        <Reveal y={16}>
          <CategoryTabs active={category} showAll />
        </Reveal>

        <div className="mt-10 lg:mt-14">
          {posts.length > 0 ? (
            <ul
              aria-label={t("index.listLabel")}
              className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-[39px] lg:gap-y-10"
            >
              {posts.map((post, index) => (
                <Reveal as="li" key={post.slug} delay={revealDelay(index % 3)}>
                  <PostCard post={post} priority={index === 0} />
                </Reveal>
              ))}
            </ul>
          ) : (
            <Reveal>
              <Empty className="border border-site-line">
                <EmptyHeader>
                  <EmptyTitle className="text-site-ink">{t("index.empty.title")}</EmptyTitle>
                  <EmptyDescription className="text-site-muted">
                    {t("index.empty.description", {
                      category: category ? t(`categories.${category}`) : "",
                    })}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  {/* Same page as the category tabs: keep the scroll position. */}
                  <CtaLink href="/blog" scroll={false}>
                    {t("index.empty.action")}
                  </CtaLink>
                </EmptyContent>
              </Empty>
            </Reveal>
          )}
        </div>
      </BlogContainer>
    </>
  );
}
