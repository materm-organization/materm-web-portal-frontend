import { getTranslations } from "next-intl/server";

import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";

// Eyebrow + h2 + lede under the hero. `gap-2.5` tightens the shared heading's
// default 20px rhythm to the design's ~10px. Each piece fades up on scroll
// with the Home stagger (0 / 1 / 2 steps).
export async function IntroSection() {
  const t = await getTranslations("ourPath.intro");

  return (
    <section className="mx-auto w-full max-w-[calc(1368px+4rem)] px-4 pt-6 pb-6 md:px-8 md:pt-10 md:pb-10">
      <div className="flex w-full flex-col gap-2.5">
        <Reveal>
          <SectionHeading variant="tick" eyebrow={t("eyebrow")} />
        </Reveal>
        <Reveal
          as="h2"
          delay={revealDelay(1)}
          className="text-2xl font-bold text-site-ink uppercase sm:text-3xl lg:text-[40px]"
        >
          {t("title")}
        </Reveal>
        <Reveal
          as="p"
          delay={revealDelay(2)}
          className="text-base text-site-ink lowercase sm:text-xl lg:text-[22px]"
        >
          {t("description")}
        </Reveal>
      </div>
    </section>
  );
}
