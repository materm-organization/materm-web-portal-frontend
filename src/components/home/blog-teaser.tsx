import { getTranslations } from "next-intl/server";

import { BlogStrip } from "@/components/home/blog-strip";
import type { BlogStripPost } from "@/components/home/blog-strip-slice";
import { HOME_EYEBROW_CLASS, HomeSection } from "@/components/home/home-section";
import { CtaLink } from "@/components/site/cta-link";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";
import { HOME_BLOG_POSTS } from "@/lib/site/home-data";

// Normal-flow section. Desktop (>= lg): the four photo slices play on hover / keyboard focus
// (BlogStrip, slice 1 expanded at rest). Below lg: stacked 16:9 cards.
export async function BlogTeaser() {
  const t = await getTranslations("home.blog");

  const posts: BlogStripPost[] = HOME_BLOG_POSTS.map(({ key, slug, image, publishedAt }) => ({
    key,
    href: `/blog/${slug}`,
    image,
    dateTime: publishedAt,
    imageAlt: t(`posts.${key}.imageAlt`),
    label: t(`posts.${key}.label`),
    title: t(`posts.${key}.title`),
    date: t(`posts.${key}.date`),
    excerpt: t(`posts.${key}.excerpt`),
  }));

  return (
    <HomeSection labelledBy="home-blog-title" columnClassName="flex flex-col items-center gap-5">
      <div className="flex w-full flex-col gap-5">
        <Reveal>
          <SectionHeading eyebrow={t("label")} variant="tick" className={HOME_EYEBROW_CLASS} />
        </Reveal>
        <Reveal delay={revealDelay(1)}>
          <h2
            id="home-blog-title"
            className="text-2xl leading-[1.65] font-bold text-site-ink uppercase sm:text-3xl xl:text-[40px]"
          >
            {t("title")}
          </h2>
        </Reveal>
        <Reveal
          as="p"
          delay={revealDelay(2)}
          className="text-base leading-[1.65] text-site-ink lowercase sm:text-xl xl:text-[22px]"
        >
          {t("description")}
        </Reveal>
      </div>

      <BlogStrip posts={posts} />

      <Reveal>
        <CtaLink href="/blog" className="sm:w-[294px]">
          {t("cta")}
        </CtaLink>
      </Reveal>
    </HomeSection>
  );
}
