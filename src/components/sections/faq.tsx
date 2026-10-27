import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";
import { cn } from "@/lib/utils";

import { subId } from "./dom-id";
import { richTextParagraphs } from "./rich-text";
import type { FaqItemData, SectionComponentProps } from "./types";
import "@/components/contact/contact.css";

// A single-paragraph answer is bare text (as in the pre-CMS accordion); several paragraphs are
// stacked <p>s.
function FaqAnswer({ answer }: { answer: FaqItemData["answer"] }) {
  const paragraphs = richTextParagraphs(answer);
  if (paragraphs.length === 1) return paragraphs[0];
  return paragraphs.map((paragraph, i) => (
    <p key={i} className="[&:not(:first-child)]:mt-4">
      {paragraph}
    </p>
  ));
}

// `faq` (variants `soft` | `white`): heading left, accordion right from `lg`, mirroring the 5/12 +
// 7/12 grid of the contact section. `soft` = the off-white band; as the last section of a page
// its `data-footer-backdrop` (given by the renderer) tints the footer ridge.
export function Faq({
  domId,
  variant,
  footerBackdrop,
  eyebrow,
  title,
  openFirst = true,
  items,
}: SectionComponentProps<"faq">) {
  const titleId = subId(domId, "title");

  return (
    <section
      id={domId}
      aria-labelledby={titleId}
      data-footer-backdrop={footerBackdrop}
      className={cn(
        "contact-scope px-6 py-12 md:px-12 md:py-24 xl:px-[180px] xl:py-[168px]",
        variant === "white" ? "bg-white" : "bg-(--contact-band)",
      )}
    >
      <div className="mx-auto grid w-full max-w-[1368px] gap-10 lg:grid-cols-12 lg:gap-x-16 xl:gap-x-24">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
          <Reveal>
            <SectionHeading variant="tick" eyebrow={eyebrow} />
          </Reveal>
          <Reveal delay={revealDelay(1)}>
            <h2
              id={titleId}
              className="text-2xl leading-[1.4] font-bold text-site-ink-strong uppercase sm:text-3xl lg:text-[40px]"
            >
              {title}
            </h2>
          </Reveal>
        </div>
        <Accordion
          type="single"
          collapsible
          defaultValue={openFirst ? items[0]?.id : undefined}
          className="min-w-0 border-t border-site-line lg:col-span-7"
        >
          {items.map((item, index) => (
            <Reveal key={item.id} delay={revealDelay(index + 1)}>
              <AccordionItem value={item.id} className="border-site-line last:border-b">
                <AccordionTrigger className="py-5 text-lg leading-[1.4] font-semibold text-site-ink-strong hover:no-underline sm:text-xl lg:text-[22px]">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pr-8 text-base leading-[1.65] text-site-ink sm:text-lg">
                  <FaqAnswer answer={item.answer} />
                </AccordionContent>
              </AccordionItem>
            </Reveal>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
