import { getTranslations } from "next-intl/server";

import { AboutSection } from "@/components/our-path/about-section";
import { GalleryTeaser } from "@/components/our-path/gallery-teaser";
import { IntroSection } from "@/components/our-path/intro-section";
import { PageHero } from "@/components/site/page-hero";
import { createTranslatedSiteMetadata } from "@/lib/site-metadata";

export const generateMetadata = () =>
  createTranslatedSiteMetadata("ourPath", "meta.title", "meta.description");

export default async function OurPathPage() {
  const t = await getTranslations("ourPath.hero");

  return (
    <>
      {/* The photo is decorative; PageHero provides the page's only <h1>. */}
      <PageHero
        variant="brand"
        titleSpacing="wide"
        image="/images/site/our-path/hero-bg-forest.jpg"
        imageAlt=""
        title={t("title")}
        description={t("description")}
        animateIn
        priority
      />
      <IntroSection />
      <AboutSection />
      <GalleryTeaser />
    </>
  );
}
