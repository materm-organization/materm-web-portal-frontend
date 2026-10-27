import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CtaLink } from "@/components/site/cta-link";
import { PageHero } from "@/components/site/page-hero";

// 404 of the public site (doc/08 §3.8): rendered inside the site layout (bottom nav, footer) whenever a page
// calls `notFound()` (unknown CMS path, unknown article slug). Strings: `site.notFound.*`. No shadows.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.notFound");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function NotFound() {
  const t = await getTranslations("site.notFound");

  return (
    <PageHero
      variant="brand"
      image="/images/site/hero-forest-stream.jpg"
      imageAlt=""
      title={t("title")}
      description={t("description")}
      showLogo={false}
    >
      <CtaLink href="/" className="sm:w-[294px]">
        {t("action")}
      </CtaLink>
    </PageHero>
  );
}
