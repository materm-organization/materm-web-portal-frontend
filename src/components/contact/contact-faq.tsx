import { getTranslations } from "next-intl/server";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";

import "./contact.css";

const FAQ_ITEMS = ["getting", "times", "events", "groups"] as const;

// Soft off-white band (same colour as Our Path). Heading left, accordion right
// from `lg`, mirroring the 5/12 + 7/12 grid of the section above.
export async function ContactFaq() {
  const t = await getTranslations("contact.faq");

  return (
    <section
      aria-labelledby="contact-faq-title"
      data-footer-backdrop="soft"
      className="contact-scope bg-(--contact-band) px-6 py-12 md:px-12 md:py-24 xl:px-[180px] xl:py-[168px]"
    >
      <div className="mx-auto grid w-full max-w-[1368px] gap-10 lg:grid-cols-12 lg:gap-x-16 xl:gap-x-24">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
          <Reveal>
            <SectionHeading variant="tick" eyebrow={t("eyebrow")} />
          </Reveal>
          <Reveal delay={revealDelay(1)}>
            <h2
              id="contact-faq-title"
              className="text-2xl leading-[1.4] font-bold text-site-ink-strong uppercase sm:text-3xl lg:text-[40px]"
            >
              {t("title")}
            </h2>
          </Reveal>
        </div>
        <Accordion
          type="single"
          collapsible
          defaultValue={FAQ_ITEMS[0]}
          className="min-w-0 border-t border-site-line lg:col-span-7"
        >
          {FAQ_ITEMS.map((item, index) => (
            <Reveal key={item} delay={revealDelay(index + 1)}>
              <AccordionItem
                value={item}
                className="border-site-line last:border-b"
              >
                <AccordionTrigger className="py-5 text-lg leading-[1.4] font-semibold text-site-ink-strong hover:no-underline sm:text-xl lg:text-[22px]">
                  {t(`items.${item}.question`)}
                </AccordionTrigger>
                <AccordionContent className="pr-8 text-base leading-[1.65] text-site-ink sm:text-lg">
                  {t(`items.${item}.answer`)}
                </AccordionContent>
              </AccordionItem>
            </Reveal>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
