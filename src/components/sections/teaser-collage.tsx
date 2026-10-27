import { HOME_EYEBROW_CLASS, HomeSection } from "@/components/home/home-section";
import { OurPathCollage } from "@/components/home/our-path-collage";
import { CtaLink } from "@/components/site/cta-link";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";

import { ctaLinkProps } from "./cta";
import { subId } from "./dom-id";
import type { SectionComponentProps } from "./types";

// `teaser_collage`: text column + the hover collage (3 photos, 4 flex-grow states in code).
export function TeaserCollage({
  domId,
  eyebrow,
  title,
  body,
  cta,
  images,
}: SectionComponentProps<"teaser_collage">) {
  const titleId = subId(domId, "title");
  const link = ctaLinkProps(cta);
  const [glacier, hiker, climber] = images;

  return (
    <HomeSection id={domId} labelledBy={titleId}>
      <div className="grid items-stretch gap-10 lg:grid-cols-[minmax(0,664px)_minmax(0,664px)] lg:justify-between">
        <div className="flex flex-col gap-5">
          <Reveal>
            <SectionHeading eyebrow={eyebrow} variant="tick" className={HOME_EYEBROW_CLASS} />
          </Reveal>
          <Reveal delay={revealDelay(1)}>
            <h2
              id={titleId}
              className="text-2xl leading-[1.65] font-bold text-site-ink-strong uppercase sm:text-3xl xl:text-[40px]"
            >
              {title}
            </h2>
          </Reveal>
          <div className="flex flex-1 flex-col items-start gap-8 lg:justify-between">
            {body ? (
              <Reveal
                as="p"
                delay={revealDelay(2)}
                className="text-base leading-[1.65] text-site-ink lowercase sm:text-xl xl:text-[22px]"
              >
                {body}
              </Reveal>
            ) : null}
            {link ? (
              <Reveal delay={revealDelay(3)}>
                <CtaLink href={link.href} target={link.target} rel={link.rel}>
                  {link.label}
                </CtaLink>
              </Reveal>
            ) : null}
          </div>
        </div>
        <div className="w-full lg:justify-self-end">
          <OurPathCollage
            photos={{
              glacier: { src: glacier.url, alt: glacier.alt },
              hiker: { src: hiker.url, alt: hiker.alt },
              climber: { src: climber.url, alt: climber.alt },
            }}
          />
        </div>
      </div>
    </HomeSection>
  );
}
