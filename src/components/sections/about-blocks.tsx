import { AboutBlock } from "@/components/our-path/about-block";
import { revealDelay } from "@/components/site/motion";
import { RichText } from "@/components/site/rich-text";
import { cn } from "@/lib/utils";

import type { AboutImageRatio, SectionComponentProps } from "./types";
import "@/components/our-path/our-path.css";

// Width / height of the photo frame at the 1728 design (doc/04 section 3.4.8: geometry is code).
export const ABOUT_IMAGE_RATIO: Record<AboutImageRatio, number> = {
  wide: 712 / 478,
  tall: 712 / 555,
  pair: 624 / 480,
};

// `about_blocks` (variants `soft` | `white`): alternating text + photo rows. `soft` = one
// continuous off-white band (each block brings its own vertical padding so they touch).
export function AboutBlocks({ domId, variant, footerBackdrop, items }: SectionComponentProps<"about_blocks">) {
  return (
    <div
      id={domId}
      data-footer-backdrop={footerBackdrop}
      className={cn("our-path-scope", variant === "white" ? "bg-white" : "bg-(--our-path-band)")}
    >
      {items.map((item, index) => {
        const inset = item.layout === "inset";
        const ratioKey: AboutImageRatio = item.imageRatio ?? (inset ? "pair" : "wide");
        return (
          <AboutBlock
            key={index}
            date={item.dateLabel}
            title={item.title}
            body={<RichText doc={item.body} delay={(i) => revealDelay(2 + i)} />}
            image={{ src: item.image.url, alt: item.image.alt }}
            ratio={ABOUT_IMAGE_RATIO[ratioKey]}
            imageSide={item.imageSide}
            inset={inset}
          />
        );
      })}
    </div>
  );
}
