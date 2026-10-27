import { getTranslations } from "next-intl/server";

import { CtaLink } from "@/components/site/cta-link";
import { GalleryCard } from "@/components/site/gallery-card";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";
import { GALLERY_TEASER } from "@/lib/site/our-path-data";

// Teaser above the footer: 3 tall cards (horizontal snap-scroll on phones,
// 3-up grid from `sm`) that link to /gallery, then the "VIEW MORE" CTA.
// Scroll reveal like Home's gallery teaser: heading block, cards staggered per
// card, CTA last. Cards carry the Figma hover caption (same as Home).
export async function GalleryTeaser() {
  const t = await getTranslations("ourPath.gallery");
  const cards = Array.from({ length: GALLERY_TEASER.count }, (_, index) => index + 1);
  const caption = { date: t("caption.date"), title: t("caption.title") };

  return (
    <section
      aria-labelledby="our-path-gallery-title"
      className="mx-auto flex w-full max-w-[calc(1368px+4rem)] flex-col items-center gap-5 px-4 pt-16 pb-16 md:px-8 md:pt-28 md:pb-24 lg:pt-40 lg:pb-28"
    >
      <Reveal className="flex w-full flex-col gap-5" y={20}>
        <SectionHeading variant="tick" eyebrow={t("eyebrow")} />
        <h2
          id="our-path-gallery-title"
          className="text-2xl font-bold text-site-ink uppercase sm:text-3xl lg:text-[40px]"
        >
          {t("title")}
        </h2>
        <p className="text-base text-site-ink lowercase sm:text-xl lg:text-[22px]">
          {t("description")}
        </p>
      </Reveal>

      {/* overflow-y-hidden (phones only; `sm:overflow-visible` resets it) keeps the
          cards' 32px reveal offset from creating a vertical scrollbar in the snap row. */}
      <ul
        aria-label={t("rowLabel")}
        className="-mx-4 flex w-[calc(100%+2rem)] snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden px-4 pb-2 sm:mx-0 sm:grid sm:w-full sm:snap-none sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:gap-[39px]"
      >
        {cards.map((position, i) => (
          <Reveal
            as="li"
            key={position}
            delay={revealDelay(i)}
            y={32}
            className="w-[75%] shrink-0 snap-center sm:w-auto"
          >
            <GalleryCard
              src={GALLERY_TEASER.image}
              alt={t("cardAlt", { position, count: GALLERY_TEASER.count })}
              href={GALLERY_TEASER.href}
              caption={caption}
              ariaLabel={t("cardLabel", { index: position, total: GALLERY_TEASER.count })}
              sizes="(min-width: 1280px) 430px, (min-width: 640px) 33vw, 75vw"
            />
          </Reveal>
        ))}
      </ul>

      <Reveal className="flex w-full justify-center sm:w-auto" y={20} delay={0.1}>
        <CtaLink href={GALLERY_TEASER.href} className="w-full sm:w-[294px]">
          {t("cta")}
        </CtaLink>
      </Reveal>
    </section>
  );
}
