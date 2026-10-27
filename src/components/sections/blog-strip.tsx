import { BlogStrip as BlogStripAccordion } from "@/components/home/blog-strip";
import type { BlogStripPost } from "@/components/home/blog-strip-slice";
import { HOME_EYEBROW_CLASS, HomeSection } from "@/components/home/home-section";
import { CtaLink } from "@/components/site/cta-link";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";

import { ctaLinkProps } from "./cta";
import { subId } from "./dom-id";
import type { SectionComponentProps } from "./types";

// `blog_strip`: normal-flow section. Desktop (>= lg): the photo slices play on hover / keyboard
// focus (slice 1 expanded at rest; flex weights are designed for 3-4 slices). Below lg: stacked
// 16:9 cards.
export function BlogStrip({
  domId,
  eyebrow,
  title,
  description,
  cta,
  posts,
}: SectionComponentProps<"blog_strip">) {
  const titleId = subId(domId, "title");
  const link = ctaLinkProps(cta);

  // Plain, serialisable data for the client strip.
  const slices: BlogStripPost[] = posts.map((post) => ({
    key: post.key,
    href: post.href,
    image: post.image.url,
    imageAlt: post.image.alt,
    label: post.label,
    title: post.title,
    date: post.date,
    dateTime: post.dateTime,
    excerpt: post.excerpt,
  }));

  return (
    <HomeSection id={domId} labelledBy={titleId} columnClassName="flex flex-col items-center gap-5">
      <div className="flex w-full flex-col gap-5">
        <Reveal>
          <SectionHeading eyebrow={eyebrow} variant="tick" className={HOME_EYEBROW_CLASS} />
        </Reveal>
        <Reveal delay={revealDelay(1)}>
          <h2
            id={titleId}
            className="text-2xl leading-[1.65] font-bold text-site-ink uppercase sm:text-3xl xl:text-[40px]"
          >
            {title}
          </h2>
        </Reveal>
        {description ? (
          <Reveal
            as="p"
            delay={revealDelay(2)}
            className="text-base leading-[1.65] text-site-ink lowercase sm:text-xl xl:text-[22px]"
          >
            {description}
          </Reveal>
        ) : null}
      </div>

      <BlogStripAccordion posts={slices} />

      {link ? (
        <Reveal>
          <CtaLink href={link.href} target={link.target} rel={link.rel} className="sm:w-[294px]">
            {link.label}
          </CtaLink>
        </Reveal>
      ) : null}
    </HomeSection>
  );
}
