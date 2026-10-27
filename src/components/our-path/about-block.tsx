import Image from "next/image";

import { Reveal, revealDelay } from "@/components/site/motion";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";

import "./our-path.css";

interface AboutBlockProps {
  date: string | null;
  title: string;
  /** Paragraphs (`<RichText>` of the body: one fading `<p>` per paragraph). */
  body: React.ReactNode;
  image: { src: string; alt: string };
  /** Width / height of the photo frame at the 1728 design (e.g. 712 / 478). */
  ratio: number;
  imageSide: "left" | "right";
  inset?: boolean;
  className?: string;
}

// One alternating "about" row: date + serif title + paragraphs next to a
// photo. Stacks below `lg` with the photo above the text (every block, so the
// rhythm is consistent). The photo is top-aligned with the text, like the
// design (the text column is NOT vertically centred).
export function AboutBlock({
  date,
  title,
  body,
  image,
  ratio,
  imageSide,
  inset = false,
  className,
}: AboutBlockProps) {
  const photoLeft = imageSide === "left";

  return (
    <article
      className={cn(
        "mx-auto grid w-full items-start gap-8 px-4 py-12 md:px-8 md:py-20 lg:py-[120px]",
        inset
          ? "max-w-[calc(1280px+4rem)] lg:grid-cols-2"
          : "max-w-[calc(1368px+4rem)] lg:grid-cols-[minmax(0,7fr)_minmax(0,8fr)]",
        className
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-8",
          // Photo above the text on mobile/tablet; desktop follows `imageSide`.
          "order-last",
          photoLeft ? "lg:order-last" : "lg:order-first"
        )}
      >
        <div className="flex flex-col gap-4">
          {date ? (
            <Reveal
              as="p"
              className="font-site-manrope text-base font-medium tracking-[0.02em] text-site-nav-chip uppercase md:text-lg"
            >
              {date}
            </Reveal>
          ) : null}
          <Reveal
            as="h3"
            delay={revealDelay(1)}
            className="font-site-display text-3xl leading-[1.15] text-site-ink-strong uppercase md:text-4xl lg:text-[40px]"
          >
            {title}
          </Reveal>
        </div>
        <div className="flex flex-col gap-[1.6em] font-site-manrope text-base leading-[1.6] text-(--our-path-body)">
          {body}
        </div>
      </div>

      <Reveal
        delay={0.1}
        y={32}
        className={cn("order-first min-w-0", photoLeft ? "lg:order-first" : "lg:order-last")}
      >
        <AspectRatio ratio={ratio} className="overflow-hidden">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes={
              inset
                ? "(min-width: 1280px) 624px, (min-width: 1024px) 50vw, 100vw"
                : "(min-width: 1280px) 712px, (min-width: 1024px) 53vw, 100vw"
            }
            className="object-cover"
          />
        </AspectRatio>
      </Reveal>
    </article>
  );
}
