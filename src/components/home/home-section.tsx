import { cn } from "@/lib/utils";

interface HomeSectionProps {
  children: React.ReactNode;
  /** id of the element that names the region (a visible or sr-only h2). */
  labelledBy: string;
  className?: string;
  /** Extra classes for the 1368px content column. */
  columnClassName?: string;
}

// White teaser section: Figma pads every teaser 168px / 180px (content column
// 1368px at 1728). Fluid below that.
export function HomeSection({ children, labelledBy, className, columnClassName }: HomeSectionProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn("bg-white px-6 py-12 md:px-12 md:py-24 xl:px-[180px] xl:py-[168px]", className)}
    >
      <div className={cn("mx-auto w-full max-w-[1368px]", columnClassName)}>{children}</div>
    </section>
  );
}

// `SectionHeading variant="bar"` is 16px tall at most; the Home design stretches
// the bar to the label line (~33px) and uses the font's natural line height.
export const HOME_EYEBROW_CLASS = "[&_p]:leading-[1.65] [&_span]:h-auto";
