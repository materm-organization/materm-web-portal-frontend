import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ArticleGallery } from "@/components/blog/article-gallery";
import { ArticleIntro } from "@/components/blog/article-intro";
import { BlogContainer } from "@/components/blog/blog-container";
import { CategoryTabs } from "@/components/blog/category-tabs";
import { localizePost } from "@/components/blog/localize-post";
import { Reveal } from "@/components/site/motion";
import { PageHero } from "@/components/site/page-hero";
import { createSiteMetadata } from "@/lib/site-metadata";
import { getAllPosts, getPostBySlug } from "@/lib/site/blog-posts";

interface BlogArticlePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return createSiteMetadata({ title: "Not found" });

  const localized = await localizePost(post);
  return {
    ...createSiteMetadata({ title: localized.title, description: localized.intro[0] }),
    openGraph: {
      type: "article",
      publishedTime: localized.isoDate,
      images: [{ url: localized.heroImage.src, alt: localized.heroImage.alt }],
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const [article, t] = await Promise.all([localizePost(post), getTranslations("blog")]);

  return (
    <>
      <PageHero
        variant="article"
        image={article.heroImage.src}
        imageAlt={article.heroImage.alt}
        title={article.heroTitle}
        meta={[article.displayDate, article.categoryLabel, article.location]}
        animateIn
        // Forces the design's two-line break ("... STARS" / "— A RECAP") without
        // touching the shared hero: caps the h1 width below the one-line width.
        className="[&_h1]:max-w-[1100px]"
      />

      <BlogContainer className="pt-12">
        <Reveal y={16}>
          <CategoryTabs active={article.category} />
        </Reveal>
        <div className="mt-10 lg:mt-14">
          <ArticleIntro paragraphs={article.intro} />
        </div>
      </BlogContainer>

      <BlogContainer className="pt-12 pb-16 lg:pt-[136px] lg:pb-[100px]">
        <ArticleGallery
          eyebrow={t("article.galleryEyebrow")}
          heading={article.gallery.heading}
          description={article.gallery.description}
          photos={article.gallery.photos}
        />
      </BlogContainer>
    </>
  );
}
