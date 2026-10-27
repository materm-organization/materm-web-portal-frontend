import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, permanentRedirect } from "next/navigation";

import { toDoc } from "@/components/sections/adapters";
import { ArticleGallery } from "@/components/blog/article-gallery";
import { ArticleIntro } from "@/components/blog/article-intro";
import { glueAfterDash } from "@/components/blog/article-title";
import { BlogContainer } from "@/components/blog/blog-container";
import { CategoryTabs } from "@/components/blog/category-tabs";
import { Reveal } from "@/components/site/motion";
import { PageHero } from "@/components/site/page-hero";
import { getCategories, getPost } from "@/lib/cms/loaders";
import { getRequestLocale } from "@/lib/cms/locale";
import { resolveImage } from "@/lib/cms/media";
import { createPostMetadata } from "@/lib/site-metadata";

// Article page (template `blog_post` lives in code, doc/08 §3.4): P-08 `getPost`. A slug of another
// locale answers 308 -> `permanentRedirect` (HTTP 308 because the loader resolves before streaming starts,
// so there must be NO `loading.tsx` / Suspense above this page); an unknown slug is a 404.
interface BlogArticlePageProps {
  params: Promise<{ slug: string }>;
}

async function loadPost(params: BlogArticlePageProps["params"]) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const result = await getPost(slug, locale); // React cache(): shared by generateMetadata and the page
  return { result, locale };
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { result } = await loadPost(params);
  return result.kind === "post" ? createPostMetadata(result.post) : {};
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { result, locale } = await loadPost(params);
  if (result.kind === "redirect") permanentRedirect(result.location);
  if (result.kind !== "post") notFound();

  const { post } = result;
  const [t, categories] = await Promise.all([getTranslations("blog"), getCategories(locale)]);

  const hero = resolveImage(post.media, post.hero);
  const photos = post.gallery.items.flatMap((item) => {
    const image = resolveImage(post.media, item);
    return image ? [{ src: image.src, alt: image.alt }] : [];
  });

  return (
    <>
      {hero ? (
        <PageHero
          variant="article"
          image={hero.src}
          imageAlt={hero.alt}
          title={glueAfterDash(post.title)}
          meta={[post.date, post.label ?? post.category?.name, post.location_label]}
          animateIn
          // Forces the design's two-line break ("... STARS" / "— A RECAP") without
          // touching the shared hero: caps the h1 width below the one-line width.
          className="[&_h1]:max-w-[1100px]"
        />
      ) : (
        <h1 className="px-6 pt-16 text-3xl font-bold uppercase md:px-12">{glueAfterDash(post.title)}</h1>
      )}

      <BlogContainer className="pt-12">
        <Reveal y={16}>
          <CategoryTabs
            active={post.category?.key}
            categories={categories.map((category) => ({ key: category.key, label: category.name }))}
          />
        </Reveal>
        <div className="mt-10 lg:mt-14">
          <ArticleIntro body={toDoc(post.body)} />
        </div>
      </BlogContainer>

      {photos.length > 0 ? (
        <BlogContainer className="pt-12 pb-16 lg:pt-[136px] lg:pb-[100px]">
          <ArticleGallery
            eyebrow={t("article.galleryEyebrow")}
            heading={post.gallery.heading ?? ""}
            description={post.gallery.description ?? ""}
            photos={photos}
          />
        </BlogContainer>
      ) : null}
    </>
  );
}
