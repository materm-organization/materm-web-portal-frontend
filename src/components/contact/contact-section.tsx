import { getTranslations } from "next-intl/server";

import { ContactForm } from "@/components/contact/contact-form";
import { ContactInfo } from "@/components/contact/contact-info";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";

// White main section: intro + contact details on the left (5/12), the form
// panel on the right (7/12) from `lg`; stacked (info first) below. Padding and
// 1368px column follow the Home teasers.
export async function ContactSection() {
  const t = await getTranslations("contact.intro");

  return (
    <section
      aria-labelledby="contact-intro-title"
      className="bg-white px-6 py-12 md:px-12 md:py-24 xl:px-[180px] xl:py-[168px]"
    >
      <div className="mx-auto grid w-full max-w-[1368px] gap-12 lg:grid-cols-12 lg:gap-x-16 xl:gap-x-24">
        <div className="flex min-w-0 flex-col gap-10 lg:col-span-5 lg:gap-12">
          <div className="flex flex-col gap-5">
            <Reveal>
              <SectionHeading variant="tick" eyebrow={t("eyebrow")} />
            </Reveal>
            <Reveal delay={revealDelay(1)}>
              <h2
                id="contact-intro-title"
                className="text-2xl leading-[1.4] font-bold text-site-ink-strong uppercase sm:text-3xl lg:text-[40px]"
              >
                {t("title")}
              </h2>
            </Reveal>
            <Reveal
              as="p"
              delay={revealDelay(2)}
              className="text-base leading-[1.65] text-site-ink lowercase sm:text-xl xl:text-[22px]"
            >
              {t("description")}
            </Reveal>
          </div>
          <ContactInfo />
        </div>
        <Reveal delay={0.1} className="min-w-0 lg:col-span-7">
          <ContactForm />
        </Reveal>
      </div>
    </section>
  );
}
