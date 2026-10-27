import Image from "next/image";
import { useTranslations } from "next-intl";

import { Reveal } from "@/components/site/motion";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  GALLERY_PHOTOS,
  PHOTO_SLOT_RATIO,
  PHOTO_SLOT_SIZES,
  type PhotoStorySlot,
} from "@/lib/site/gallery-data";
import { cn } from "@/lib/utils";

interface PhotoStoryFigureProps {
  slot: PhotoStorySlot;
  /** Reveal stagger in seconds (use `revealDelay(columnIndex)`). */
  delay?: number;
  className?: string;
}

// One captioned photo: rounded cropped image (fixed aspect ratio, so it stays
// undistorted at every width) + title/description caption. The figure fades up
// as one unit (photo + caption) when it enters the viewport; the grid cell that
// holds it (placement / 72px offset) is a separate element and never moves.
export function PhotoStoryFigure({ slot, delay, className }: PhotoStoryFigureProps) {
  const t = useTranslations("gallery.photos");
  const photo = GALLERY_PHOTOS[slot.photo];

  return (
    <Reveal as="figure" delay={delay} y={32} className={cn("flex flex-col gap-3.5", className)}>
      <AspectRatio
        ratio={PHOTO_SLOT_RATIO[slot.size]}
        className="overflow-hidden rounded-site-photo bg-site-line"
      >
        <Image
          src={photo.src}
          alt={t(`${photo.id}.alt`)}
          width={photo.width}
          height={photo.height}
          sizes={PHOTO_SLOT_SIZES[slot.size]}
          className="size-full object-cover"
        />
      </AspectRatio>
      <figcaption className="flex flex-col gap-[5px]">
        <p className="text-sm leading-[1.65] font-bold text-site-ink-strong">
          {t(`${photo.id}.title`)}
        </p>
        <p className="text-[13px] leading-normal text-site-muted">
          {t(`${photo.id}.description`)}
        </p>
      </figcaption>
    </Reveal>
  );
}
