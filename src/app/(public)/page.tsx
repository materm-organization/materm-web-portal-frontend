import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BlogTeaser } from "@/components/home/blog-teaser";
import { GalleryTeaser } from "@/components/home/gallery-teaser";
import { HomeHero } from "@/components/home/home-hero";
import { OurPathTeaser } from "@/components/home/our-path-teaser";

// Home shows just the site name (absolute title bypasses the "%s | Materm" template).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home.meta");
  return { title: { absolute: t("title") }, description: t("description") };
}

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <OurPathTeaser />
      <BlogTeaser />
      <GalleryTeaser />
    </>
  );
}
