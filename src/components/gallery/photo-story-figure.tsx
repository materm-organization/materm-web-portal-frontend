import Image from "@/components/site/site-image";

import { Reveal } from "@/components/site/motion";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import type { PhotoSlotSize, ResolvedImage } from "@/components/sections/types";
import { PHOTO_SLOT_RATIO, PHOTO_SLOT_SIZES } from "@/lib/site/gallery-data";
import { cn } from "@/lib/utils";

interface PhotoStoryFigureProps {
  image: ResolvedImage;
  title: string | null;
  description: string | null;
  size: PhotoSlotSize;
  /** Reveal stagger in seconds (use `revealDelay(columnIndex)`). */
  delay?: number;
  className?: string;
}

// Fallback intrinsic size when the media row has no dimensions (the box is a fixed
// aspect ratio with `object-cover`, so only the srcset arithmetic is affected).
const FALLBACK_SIZE = { width: 1200, height: 800 };

// One captioned photo: rounded cropped image (fixed aspect ratio, so it stays
// undistorted at every width) + title/description caption. The figure fades up
// as one unit (photo + caption) when it enters the viewport; the grid cell that
// holds it (placement / 72px offset) is a separate element and never moves.
export function PhotoStoryFigure({
  image,
  title,
  description,
  size,
  delay,
  className,
}: PhotoStoryFigureProps) {
  return (
    <Reveal as="figure" delay={delay} y={32} className={cn("flex flex-col gap-3.5", className)}>
      <AspectRatio
        ratio={PHOTO_SLOT_RATIO[size]}
        className="overflow-hidden rounded-site-photo bg-site-line"
      >
        <Image
          src={image.url}
          alt={image.alt}
          width={image.width ?? FALLBACK_SIZE.width}
          height={image.height ?? FALLBACK_SIZE.height}
          sizes={PHOTO_SLOT_SIZES[size]}
          className="size-full object-cover"
        />
      </AspectRatio>
      {title || description ? (
        <figcaption className="flex flex-col gap-[5px]">
          {title ? (
            <p className="text-sm leading-[1.65] font-bold text-site-ink-strong">{title}</p>
          ) : null}
          {description ? (
            <p className="text-[13px] leading-normal text-site-muted">{description}</p>
          ) : null}
        </figcaption>
      ) : null}
    </Reveal>
  );
}
