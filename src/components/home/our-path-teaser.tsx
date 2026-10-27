import { getTranslations } from "next-intl/server";

import { OurPathCollage } from "@/components/home/our-path-collage";
import { HOME_EYEBROW_CLASS, HomeSection } from "@/components/home/home-section";
import { CtaLink } from "@/components/site/cta-link";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";

export async function OurPathTeaser() {
  const t = await getTranslations("home.ourPath");

  return (
    <HomeSection labelledBy="home-our-path-title">
      <div className="grid items-stretch gap-10 lg:grid-cols-[minmax(0,664px)_minmax(0,664px)] lg:justify-between">
        <div className="flex flex-col gap-5">
          <Reveal>
            <SectionHeading eyebrow={t("label")} variant="tick" className={HOME_EYEBROW_CLASS} />
          </Reveal>
          <Reveal delay={revealDelay(1)}>
            <h2
              id="home-our-path-title"
              className="text-2xl leading-[1.65] font-bold text-site-ink-strong uppercase sm:text-3xl xl:text-[40px]"
            >
              {t("title")}
            </h2>
          </Reveal>
          <div className="flex flex-1 flex-col items-start gap-8 lg:justify-between">
            <Reveal
              as="p"
              delay={revealDelay(2)}
              className="text-base leading-[1.65] text-site-ink lowercase sm:text-xl xl:text-[22px]"
            >
              {t("body")}
            </Reveal>
            <Reveal delay={revealDelay(3)}>
              <CtaLink href="/our-path">{t("cta")}</CtaLink>
            </Reveal>
          </div>
        </div>
        <div className="w-full lg:justify-self-end">
          <OurPathCollage
            photos={{
              glacier: { src: "/images/site/home/our-path-photo-1.jpg", alt: t("photos.glacier") },
              hiker: { src: "/images/site/home/our-path-photo-2.jpg", alt: t("photos.hiker") },
              climber: { src: "/images/site/home/our-path-photo-3.jpg", alt: t("photos.climber") },
            }}
          />
        </div>
      </div>
    </HomeSection>
  );
}
