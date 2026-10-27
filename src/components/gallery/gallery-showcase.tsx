import { useTranslations } from "next-intl";

import { GalleryCard } from "@/components/site/gallery-card";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";
import { GALLERY_CARD_COUNT, GALLERY_CARD_IMAGE } from "@/lib/site/gallery-data";

const CARD_SIZES = "(min-width: 1536px) 430px, (min-width: 768px) 30vw, 75vw";

// The "GALLERY / A visual walk-through is coming" section: tick heading + three
// tall cards. The design has no button here. Mobile: swipeable row (cards would
// otherwise stack to ~1500px of the same photo); md+: 3-up grid.
export function GalleryShowcase() {
  const t = useTranslations("gallery.section");

  return (
    <section aria-label={t("title")} className="flex flex-col gap-5">
      <div className="flex flex-col gap-5">
        <Reveal>
          <SectionHeading variant="tick" eyebrow={t("eyebrow")} />
        </Reveal>
        <Reveal as="h2" delay={revealDelay(1)} className="text-2xl font-bold text-site-ink uppercase sm:text-3xl lg:text-[40px]">
          {t("title")}
        </Reveal>
        <Reveal as="p" delay={revealDelay(2)} className="text-base text-site-ink lowercase sm:text-xl lg:text-[22px]">
          {t("description")}
        </Reveal>
      </div>
      <div
        role="group"
        aria-label={t("cardsLabel")}
        tabIndex={0}
        className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden px-6 pb-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-site-green-700 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:gap-x-[39px]"
      >
        {Array.from({ length: GALLERY_CARD_COUNT }, (_, index) => (
          <Reveal
            key={index}
            delay={revealDelay(index)}
            y={32}
            className="w-[75vw] shrink-0 snap-center md:w-auto"
          >
            <GalleryCard
              src={GALLERY_CARD_IMAGE}
              alt={index === 0 ? t("cardAlt") : ""}
              sizes={CARD_SIZES}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
