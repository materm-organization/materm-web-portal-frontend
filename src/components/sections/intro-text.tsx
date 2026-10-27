import { RichText } from "@/components/site/rich-text";

import { richTextParagraphs } from "./rich-text";
import type { SectionComponentProps } from "./types";

// `intro_text` (frame `page-column`): one fading paragraph per rich-text paragraph (`RichText`, bold /
// italic / links allowed). The wrapper carries the section id and the paragraph rhythm; with one
// paragraph it is invisible.
export function IntroText({ domId, text }: SectionComponentProps<"intro_text">) {
  if (richTextParagraphs(text).length === 0) return null;

  return (
    <div id={domId} className="flex flex-col gap-4">
      <RichText doc={text} paragraphClassName="text-base leading-[1.6] text-site-muted sm:text-[17px]" />
    </div>
  );
}
