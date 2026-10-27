import { getTranslations } from "next-intl/server";

import { GalleryShowcase } from "@/components/gallery/gallery-showcase";
import { PhotoStory } from "@/components/gallery/photo-story";
import { Reveal } from "@/components/site/motion";
import { PageHero } from "@/components/site/page-hero";
import { createTranslatedSiteMetadata } from "@/lib/site-metadata";

export async function generateMetadata() {
  return createTranslatedSiteMetadata("gallery", "meta.title", "meta.description");
}

// 1368px content column at >=1464px viewports; fluid gutters below.
const CONTAINER = "mx-auto w-full max-w-[1464px] px-6 md:px-10 xl:px-12";

export default async function GalleryPage() {
  const t = await getTranslations("gallery");

  return (
    <>
      <PageHero
        variant="article"
        animateIn
        image="/images/site/hero-forest-stream.jpg"
        imageAlt={t("hero.imageAlt")}
        title={t("hero.title")}
        meta={[t("hero.meta.date"), t("hero.meta.event"), t("hero.meta.place")]}
      />

      <div className={`${CONTAINER} flex flex-col gap-10 pt-6 md:gap-12 md:pt-10`}>
        <Reveal as="p" className="text-base leading-[1.6] text-site-muted sm:text-[17px]">
          {t("intro")}
        </Reveal>
        <PhotoStory />
      </div>

      <div className={`${CONTAINER} py-12 md:py-20`}>
        <GalleryShowcase />
      </div>
    </>
  );
}
