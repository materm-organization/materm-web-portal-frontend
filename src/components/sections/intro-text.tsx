import { Reveal, revealDelay } from "@/components/site/motion";

import { richTextParagraphs } from "./rich-text";
import type { SectionComponentProps } from "./types";

// `intro_text` (frame `page-column`): one fading paragraph per rich-text paragraph. The wrapper
// carries the section id and the paragraph rhythm; with one paragraph it is invisible.
export function IntroText({ domId, text }: SectionComponentProps<"intro_text">) {
  const paragraphs = richTextParagraphs(text);
  if (paragraphs.length === 0) return null;

  return (
    <div id={domId} className="flex flex-col gap-4">
      {paragraphs.map((paragraph, index) => (
        <Reveal
          as="p"
          key={index}
          delay={revealDelay(index)}
          className="text-base leading-[1.6] text-site-muted sm:text-[17px]"
        >
          {paragraph}
        </Reveal>
      ))}
    </div>
  );
}
