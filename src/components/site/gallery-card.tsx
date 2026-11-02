import Image from "@/components/site/site-image";
import { type ImageProps } from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface GalleryCardProps {
  src: ImageProps["src"];
  alt: string;
  /** Render as a link. Mutually exclusive with `onClick`. */
  href?: string;
  /** Render as a button (e.g. open the gallery lightbox). */
  onClick?: () => void;
  /** Overlay content (e.g. a vertical title) rendered above the photo. */
  children?: React.ReactNode;
  /**
   * Hover / keyboard-focus caption (Figma card hover state): bottom gradient,
   * green tick + date, bold uppercase title. Omit for no caption overlay.
   */
  caption?: { date: string; title: string };
  /** Accessible name for the link / button (e.g. to tell identical cards apart). */
  ariaLabel?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

const CARD_CLASS =
  "group relative block aspect-[430/562] w-full overflow-hidden rounded-site-card bg-site-line text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-green-600";

// The tall rounded photo card (Figma Component 17/18/19: 430x562, 12px
// radius) used in the 3-up rows at the bottom of every page.
export function GalleryCard({
  src,
  alt,
  href,
  onClick,
  children,
  caption,
  ariaLabel,
  sizes = "(min-width: 1024px) 430px, (min-width: 640px) 33vw, 100vw",
  priority,
  className,
}: GalleryCardProps) {
  const content = (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      {children ? <div className="absolute inset-0">{children}</div> : null}
      {caption ? (
        // Figma 360:2965 (the card's hover state). Opacity + translate 0.3s ease-out,
        // no shadows. Where there is no hover (touch phones/tablets, and narrow
        // viewports below `md`) the caption is simply shown all the time, i.e. the
        // card rests in its hover state.
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent from-[66%] to-black opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
        >
          <div className="absolute inset-x-[6.71%] bottom-[4%] flex translate-y-3 flex-col items-start gap-2.5 transition-transform duration-300 ease-out group-hover:translate-y-0 group-focus-visible:translate-y-0 max-md:translate-y-0 motion-reduce:transition-none [@media(hover:none)]:translate-y-0">
            <div className="flex items-stretch gap-4 sm:gap-6">
              <span aria-hidden className="w-2 shrink-0 bg-site-neon" />
              <span className="text-base font-medium tracking-[0.48em] text-site-neon uppercase">
                {caption.date}
              </span>
            </div>
            <span className="text-xl leading-6 font-black text-white uppercase sm:text-2xl">
              {caption.title}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={cn(CARD_CLASS, className)}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(CARD_CLASS, "cursor-pointer", className)}>
        {content}
      </button>
    );
  }
  return <div className={cn(CARD_CLASS, className)}>{content}</div>;
}
