import { Reveal, revealDelay } from "@/components/site/motion";

interface ArticleIntroProps {
  /** First entry = standfirst, the rest = body paragraphs. */
  paragraphs: readonly string[];
}

// Standfirst (Manrope 26/600, lh 1.65) + body (Manrope 20/400, lh 1.85), 28px apart.
// Colours: closest existing tokens (design #17251c / #39473e).
export function ArticleIntro({ paragraphs }: ArticleIntroProps) {
  const [standfirst, ...body] = paragraphs;

  return (
    <div className="flex flex-col gap-5 font-site-manrope lg:gap-7">
      {standfirst ? (
        <Reveal
          as="p"
          className="text-lg leading-[1.65] font-semibold text-site-ink-strong sm:text-xl lg:text-[26px]"
        >
          {standfirst}
        </Reveal>
      ) : null}
      {body.map((paragraph, index) => (
        <Reveal
          as="p"
          key={index}
          delay={revealDelay(index + 1)}
          className="text-base leading-[1.85] text-site-ink-strong/85 lg:text-xl"
        >
          {paragraph}
        </Reveal>
      ))}
    </div>
  );
}
