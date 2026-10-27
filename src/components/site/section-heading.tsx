import { ScrollEyebrow } from "@/components/site/motion";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  /** Spaced uppercase label next to the green bar, e.g. "OUR PATH". */
  eyebrow: string;
  title?: string;
  description?: string;
  /**
   * `tick` (default look on every page) = short green tick + label that GROWS into a
   * long bar up to the label as the page scrolls (Figma prototype, see
   * `ScrollEyebrow`). `bar` = the same long bar, static (no scroll animation).
   */
  variant?: "bar" | "tick";
  /** Heading level of the title (default h2). */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

const LABEL_CLASS =
  "text-base font-medium tracking-[0.48em] whitespace-nowrap text-site-green-600 uppercase sm:text-xl";

export function SectionHeading({
  eyebrow,
  title,
  description,
  variant = "bar",
  as: Title = "h2",
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex w-full flex-col gap-5", className)}>
      {variant === "tick" ? (
        <ScrollEyebrow>
          <p className={LABEL_CLASS}>{eyebrow}</p>
        </ScrollEyebrow>
      ) : (
        <div className="flex items-center gap-4 sm:gap-6">
          <span
            aria-hidden="true"
            className="h-3 flex-1 self-stretch bg-site-green-600 sm:h-4"
          />
          <p className={LABEL_CLASS}>{eyebrow}</p>
        </div>
      )}
      {title ? (
        <Title className="text-2xl font-bold text-site-ink uppercase sm:text-3xl lg:text-[40px]">
          {title}
        </Title>
      ) : null}
      {description ? (
        <p className="text-base text-site-ink lowercase sm:text-xl lg:text-[22px]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
