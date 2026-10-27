import { getTranslations } from "next-intl/server";

import { HOME_EYEBROW_CLASS, HomeSection } from "@/components/home/home-section";
import { GalleryCard } from "@/components/site/gallery-card";
import { CtaLink } from "@/components/site/cta-link";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";

// Figma 151:10828 / 217:12366: tick eyebrow, h2, paragraph, three 430x562
// cards (gap 39px at the 1368px column), centred "VIEW MORE".
// The shared forest-stream photo (shared card photo).
const PHOTO = "/images/site/gallery-card-forest-stream.png";
const CARD_COUNT = 3;

export async function GalleryTeaser() {
  const t = await getTranslations("home.gallery");
  const caption = { date: t("caption.date"), title: t("caption.title") };

  return (
    // Bottom padding keeps the last row / CTA clear of the fixed bottom nav bar (>= 7rem).
    <HomeSection
      labelledBy="home-gallery-title"
      className="pb-32 md:pb-36 xl:pb-[168px]"
      columnClassName="flex flex-col items-center gap-8 md:gap-10"
    >
      <Reveal className="flex w-full flex-col gap-5" y={20}>
        <SectionHeading eyebrow={t("label")} variant="tick" className={HOME_EYEBROW_CLASS} />
        <h2
          id="home-gallery-title"
          className="text-2xl font-bold text-site-ink uppercase sm:text-3xl lg:text-[40px]"
        >
          {t("title")}
        </h2>
        <p className="text-base text-site-ink lowercase sm:text-xl lg:text-[22px]">
          {t("description")}
        </p>
      </Reveal>

      {/* < md: horizontal snap row (focusable so keyboard users can scroll it).
          >= md: fluid 3-up grid (gap 39/1368 = 2.85%). The padding/negative margin
          gives the 2px outline + 2px offset of a focused card room inside the clip. */}
      <div
        role="region"
        aria-label={t("rowLabel")}
        tabIndex={0}
        className="-m-1.5 w-[calc(100%+0.75rem)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-px-1.5 p-1.5 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-site-green-600 md:m-0 md:w-full md:snap-none md:overflow-visible md:p-0"
      >
        <ul className="flex gap-4 md:grid md:grid-cols-3 md:gap-x-[2.85%]">
          {Array.from({ length: CARD_COUNT }, (_, i) => (
            <Reveal
              as="li"
              key={i}
              delay={revealDelay(i)}
              y={32}
              className="w-[78%] shrink-0 snap-center md:w-auto md:shrink"
            >
              <GalleryCard
                href="/gallery"
                src={PHOTO}
                alt={i === 0 ? t("photoAlt") : ""}
                caption={caption}
                ariaLabel={t("cardLabel", { index: i + 1, total: CARD_COUNT })}
                sizes="(min-width: 1280px) 430px, (min-width: 768px) 30vw, 78vw"
              />
            </Reveal>
          ))}
        </ul>
      </div>

      <Reveal className="mt-2 flex justify-center lg:mt-5" y={20} delay={0.1}>
        <CtaLink href="/gallery" className="min-w-60 justify-center sm:h-[61px] sm:min-w-[294px]">
          {t("cta")}
        </CtaLink>
      </Reveal>
    </HomeSection>
  );
}
