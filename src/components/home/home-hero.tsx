import { getTranslations } from "next-intl/server";

import { CtaLink } from "@/components/site/cta-link";
import { PageHero } from "@/components/site/page-hero";

export async function HomeHero() {
  const t = await getTranslations("home.hero");

  return (
    <PageHero
      variant="brand"
      image="/images/site/home/hero-bg.png"
      imageAlt=""
      title={t("title")}
      description={t("description")}
      // The title carries a hard line break ("...Wild" / "Within..."); it
      // collapses to normal wrapping on narrow screens.
      className="[&_h1]:whitespace-pre-line"
      animateIn
      priority
    >
      <CtaLink href="/our-path" className="sm:w-[294px]">
        {t("cta")}
      </CtaLink>
    </PageHero>
  );
}
