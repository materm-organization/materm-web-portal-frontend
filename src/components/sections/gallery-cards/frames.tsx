import type { ReactNode } from "react";

import { HOME_EYEBROW_CLASS, HomeSection } from "@/components/home/home-section";
import { CtaLink } from "@/components/site/cta-link";
import { GalleryCard } from "@/components/site/gallery-card";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";

import { ctaLinkProps } from "../cta";
import { subId } from "../dom-id";
import type { GalleryCardsProps } from "../types";

// The three frames of `gallery_cards` (doc/04 section 3.4.7): they differ in padding, heading
// markup, how the row is exposed to assistive tech and the CTA, and must stay pixel-identical
// to the three pre-CMS sections they replace (Home, Our Path, Gallery).

export interface GalleryFrameProps extends GalleryCardsProps {
  domId: string;
  /** Resolved aria-label of the card row. */
  rowLabel: string;
  /** Accessible name of a card that is a link (`site.gallery.cardLabel`). */
  cardLabel: (index: number, total: number) => string;
}

interface CardEntry {
  card: GalleryCardsProps["cards"][number];
  index: number;
  /** `site.gallery.cardLabel`, used only when the card is a link. */
  label: string;
  sizes: string;
}

function cardEntries(
  { cards, cardLabel }: Pick<GalleryFrameProps, "cards" | "cardLabel">,
  sizes: string,
): CardEntry[] {
  return cards.map((card, index) => ({ card, index, label: cardLabel(index + 1, cards.length), sizes }));
}

function renderCard({ card, label, sizes }: CardEntry) {
  return (
    <GalleryCard
      src={card.image.url}
      alt={card.image.alt}
      href={card.href ?? undefined}
      caption={card.caption ?? undefined}
      ariaLabel={card.href ? label : undefined}
      sizes={sizes}
    />
  );
}

function CtaBlock({ cta, className, linkClassName, delay = 0.1 }: {
  cta: GalleryCardsProps["cta"];
  className: string;
  linkClassName: string;
  delay?: number;
}): ReactNode {
  const link = ctaLinkProps(cta);
  if (!link) return null;
  return (
    <Reveal className={className} y={20} delay={delay}>
      <CtaLink href={link.href} target={link.target} rel={link.rel} className={linkClassName}>
        {link.label}
      </CtaLink>
    </Reveal>
  );
}

// Home: Figma 151:10828 / 217:12366 - tick eyebrow, h2, paragraph, three 430x562 cards (gap 39px
// at the 1368px column), centred CTA. Bottom padding keeps the last row / CTA clear of the fixed
// bottom nav bar (>= 7rem).
export function HomeGalleryFrame(props: GalleryFrameProps) {
  const { domId, eyebrow, title, description, rowLabel, cta } = props;
  const titleId = subId(domId, "title");
  const entries = cardEntries(props, "(min-width: 1280px) 430px, (min-width: 768px) 30vw, 78vw");

  return (
    <HomeSection
      id={domId}
      labelledBy={titleId}
      className="pb-32 md:pb-36 xl:pb-[168px]"
      columnClassName="flex flex-col items-center gap-8 md:gap-10"
    >
      <Reveal className="flex w-full flex-col gap-5" y={20}>
        <SectionHeading eyebrow={eyebrow} variant="tick" className={HOME_EYEBROW_CLASS} />
        <h2
          id={titleId}
          className="text-2xl font-bold text-site-ink uppercase sm:text-3xl lg:text-[40px]"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-base text-site-ink lowercase sm:text-xl lg:text-[22px]">{description}</p>
        ) : null}
      </Reveal>

      {/* < md: horizontal snap row (focusable so keyboard users can scroll it).
          >= md: fluid 3-up grid (gap 39/1368 = 2.85%). The padding/negative margin
          gives the 2px outline + 2px offset of a focused card room inside the clip. */}
      <div
        role="region"
        aria-label={rowLabel}
        tabIndex={0}
        className="-m-1.5 w-[calc(100%+0.75rem)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-px-1.5 p-1.5 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-site-green-600 md:m-0 md:w-full md:snap-none md:overflow-visible md:p-0"
      >
        <ul className="flex gap-4 md:grid md:grid-cols-3 md:gap-x-[2.85%]">
          {entries.map((entry) => (
            <Reveal
              as="li"
              key={entry.index}
              delay={revealDelay(entry.index)}
              y={32}
              className="w-[78%] shrink-0 snap-center md:w-auto md:shrink"
            >
              {renderCard(entry)}
            </Reveal>
          ))}
        </ul>
      </div>

      <CtaBlock
        cta={cta}
        className="mt-2 flex justify-center lg:mt-5"
        linkClassName="min-w-60 justify-center sm:h-[61px] sm:min-w-[294px]"
      />
    </HomeSection>
  );
}

// Standard (Our Path): 3 tall cards (horizontal snap-scroll on phones, 3-up grid from `sm`) that
// link on, then the CTA. Scroll reveal like Home: heading block, cards staggered per card, CTA last.
export function StandardGalleryFrame(props: GalleryFrameProps) {
  const { domId, eyebrow, title, description, rowLabel, cta } = props;
  const titleId = subId(domId, "title");
  const entries = cardEntries(props, "(min-width: 1280px) 430px, (min-width: 640px) 33vw, 75vw");

  return (
    <section
      id={domId}
      aria-labelledby={titleId}
      className="mx-auto flex w-full max-w-[calc(1368px+4rem)] flex-col items-center gap-5 px-4 pt-16 pb-16 md:px-8 md:pt-28 md:pb-24 lg:pt-40 lg:pb-28"
    >
      <Reveal className="flex w-full flex-col gap-5" y={20}>
        <SectionHeading variant="tick" eyebrow={eyebrow} />
        <h2
          id={titleId}
          className="text-2xl font-bold text-site-ink uppercase sm:text-3xl lg:text-[40px]"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-base text-site-ink lowercase sm:text-xl lg:text-[22px]">{description}</p>
        ) : null}
      </Reveal>

      {/* overflow-y-hidden (phones only; `sm:overflow-visible` resets it) keeps the
          cards' 32px reveal offset from creating a vertical scrollbar in the snap row. */}
      <ul
        aria-label={rowLabel}
        className="-mx-4 flex w-[calc(100%+2rem)] snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden px-4 pb-2 sm:mx-0 sm:grid sm:w-full sm:snap-none sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:gap-[39px]"
      >
        {entries.map((entry) => (
          <Reveal
            as="li"
            key={entry.index}
            delay={revealDelay(entry.index)}
            y={32}
            className="w-[75%] shrink-0 snap-center sm:w-auto"
          >
            {renderCard(entry)}
          </Reveal>
        ))}
      </ul>

      <CtaBlock
        cta={cta}
        className="flex w-full justify-center sm:w-auto"
        linkClassName="w-full sm:w-[294px]"
      />
    </section>
  );
}

// Showcase (Gallery page): tick heading + three tall cards, no button in the design. The 1464px
// page container wraps the section (it is the section's own frame). Mobile: swipeable row; md+: 3-up grid.
const SHOWCASE_CONTAINER = "mx-auto w-full max-w-[1464px] px-6 md:px-10 xl:px-12 py-12 md:py-20";

export function ShowcaseGalleryFrame(props: GalleryFrameProps) {
  const { domId, eyebrow, title, description, rowLabel, cta } = props;
  const entries = cardEntries(props, "(min-width: 1536px) 430px, (min-width: 768px) 30vw, 75vw");

  return (
    <div className={SHOWCASE_CONTAINER}>
      <section id={domId} aria-label={title} className="flex flex-col gap-5">
        <div className="flex flex-col gap-5">
          <Reveal>
            <SectionHeading variant="tick" eyebrow={eyebrow} />
          </Reveal>
          <Reveal
            as="h2"
            delay={revealDelay(1)}
            className="text-2xl font-bold text-site-ink uppercase sm:text-3xl lg:text-[40px]"
          >
            {title}
          </Reveal>
          {description ? (
            <Reveal
              as="p"
              delay={revealDelay(2)}
              className="text-base text-site-ink lowercase sm:text-xl lg:text-[22px]"
            >
              {description}
            </Reveal>
          ) : null}
        </div>
        <div
          role="group"
          aria-label={rowLabel}
          tabIndex={0}
          className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden px-6 pb-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-site-green-700 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:gap-x-[39px]"
        >
          {entries.map((entry) => (
            <Reveal
              key={entry.index}
              delay={revealDelay(entry.index)}
              y={32}
              className="w-[75vw] shrink-0 snap-center md:w-auto"
            >
              {renderCard(entry)}
            </Reveal>
          ))}
        </div>
        <CtaBlock
          cta={cta}
          className="flex w-full justify-center sm:w-auto"
          linkClassName="w-full sm:w-[294px]"
        />
      </section>
    </div>
  );
}
