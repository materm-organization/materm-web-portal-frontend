import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { toDoc } from "@/components/sections/adapters";
import { ArticleGallery } from "@/components/blog/article-gallery";
import { ArticleIntro } from "@/components/blog/article-intro";
import { glueAfterDash } from "@/components/blog/article-title";
import { BlogContainer } from "@/components/blog/blog-container";
import { CategoryTabs } from "@/components/blog/category-tabs";
import { Reveal } from "@/components/site/motion";
import { PageHero } from "@/components/site/page-hero";
import { PreviewBanner } from "@/components/site/preview-banner";
import { PreviewHint } from "@/components/site/preview-hint";
import { getCategories, getPost } from "@/lib/cms/loaders";
import { getRequestLocale } from "@/lib/cms/locale";
import { resolveImage } from "@/lib/cms/media";
import { getPreviewPage, readPreviewSession } from "@/lib/cms/preview";
import type { PostDetail } from "@/lib/cms/types";
import { statusLocation } from "@/lib/preview/handlers";
import { PREVIEW_ROBOTS, withPreviewRobots } from "@/lib/preview/metadata";
import type { PreviewInfo } from "@/lib/preview/resolve";
import { createPostMetadata } from "@/lib/site-metadata";

// Article page (template `blog_post` lives in code, doc/08 §3.4): P-08 `getPost`. A slug of another
// locale answers 308 -> `permanentRedirect` (HTTP 308 because the loader resolves before streaming starts,
// so there must be NO `loading.tsx` / Suspense above this page); an unknown slug is a 404.
//
// PREVIEW (M5, doc/05 PT-18): a visitor with the `materm_preview` cookie whose session was opened for THIS article
// (`/blog/<slug>`) gets the post from `GET /preview/resolve` (`getPreviewPage`) instead of P-08: the SAME article
// markup, plus the banner and `noindex`. That path never touches `getPost`, so there is no 308 and no data cache. A dead
// token (401/422) goes through `/api/preview/exit?reason=expired`, 429 / backend trouble to `/preview-status`;
// never to the bundle. On any other article the published post is shown with the small "elsewhere" banner.
interface BlogArticlePageProps {
  params: Promise<{ slug: string }>;
}

type Loaded =
  | { kind: "post"; post: PostDetail; locale: string; path: string; preview: PreviewInfo | null; elsewhereOf: string | null }
  | { kind: "redirect"; location: string }
  | { kind: "not_found" }
  | { kind: "preview-failed"; to: string };

async function loadPost(params: BlogArticlePageProps["params"]): Promise<Loaded & { locale: string }> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const path = `/blog/${slug}`;

  const session = await readPreviewSession(); // null without the cookie / in bundle mode
  if (session && session.path === path) {
    const outcome = await getPreviewPage(session.token, path, locale); // React cache(): shared by generateMetadata and the page
    if (outcome.kind === "ok" && outcome.data.kind === "post") {
      return { kind: "post", post: outcome.data.post, locale, path, preview: outcome.data.preview, elsewhereOf: null };
    }
    if (outcome.kind === "invalid") return { kind: "preview-failed", to: "/api/preview/exit?reason=expired", locale };
    if (outcome.kind === "ok") return { kind: "preview-failed", to: statusLocation("unavailable"), locale }; // a page token for a post path
    return { kind: "preview-failed", to: statusLocation(outcome.kind === "busy" ? "busy" : "unavailable"), locale };
  }

  const result = await getPost(slug, locale); // React cache(): shared by generateMetadata and the page
  if (result.kind === "redirect") return { kind: "redirect", location: result.location, locale };
  if (result.kind !== "post") return { kind: "not_found", locale };
  return { kind: "post", post: result.post, locale, path, preview: null, elsewhereOf: session?.path ?? null };
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const loaded = await loadPost(params);
  if (loaded.kind === "preview-failed") return { robots: PREVIEW_ROBOTS };
  if (loaded.kind !== "post") return {};
  // drafts are never indexed; a published article seen from an open preview session is not indexed either
  return withPreviewRobots(createPostMetadata(loaded.post), loaded.preview !== null || loaded.elsewhereOf !== null);
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const loaded = await loadPost(params);
  if (loaded.kind === "redirect") permanentRedirect(loaded.location);
  if (loaded.kind === "preview-failed") redirect(loaded.to);
  if (loaded.kind !== "post") notFound();

  const { post, locale, preview, elsewhereOf } = loaded;
  const [t, categories] = await Promise.all([getTranslations("blog"), getCategories(locale)]);

  const hero = resolveImage(post.media, post.hero);
  const photos = post.gallery.items.flatMap((item) => {
    const image = resolveImage(post.media, item);
    return image ? [{ src: image.src, alt: image.alt }] : [];
  });

  const article = (
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
      ) : preview ? (
        // editors only: the hint needs a positioned parent; a visitor's markup stays exactly the plain heading
        <div className="relative">
          <h1 className="px-6 pt-16 text-3xl font-bold uppercase md:px-12">{glueAfterDash(post.title)}</h1>
          <PreviewHint code="no_hero_image" />
        </div>
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

  // visitors without a preview session get exactly the tree they always had (no wrapper, same React ids)
  if (!preview && !elsewhereOf) return article;
  return (
    <>
      {preview && <PreviewBanner variant="preview" warnings={preview.warnings} path={loaded.path} />}
      {elsewhereOf && <PreviewBanner variant="elsewhere" path={elsewhereOf} />}
      {article}
    </>
  );
}
