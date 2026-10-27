import type { RichTextDoc } from "@/components/sections/types";
import { RichText } from "@/components/site/rich-text";

interface ArticleIntroProps {
  /** Article body (rich text): the first node is the standfirst (`lead`), the rest are body paragraphs. */
  body: RichTextDoc | null;
}

// Standfirst (Manrope 26/600, lh 1.65) + body (Manrope 20/400, lh 1.85), 28px apart. The standfirst
// is shown at once, body paragraphs fade up one after the other (`RichText` default stagger).
// Colours: closest existing tokens (design #17251c / #39473e).
export function ArticleIntro({ body }: ArticleIntroProps) {
  return (
    <div className="flex flex-col gap-5 font-site-manrope lg:gap-7">
      <RichText
        doc={body}
        leadClassName="text-lg leading-[1.65] font-semibold text-site-ink-strong sm:text-xl lg:text-[26px]"
        paragraphClassName="text-base leading-[1.85] text-site-ink-strong/85 lg:text-xl"
      />
    </div>
  );
}
