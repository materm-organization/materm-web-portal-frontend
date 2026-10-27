import { useTranslations } from "next-intl";

import { PhotoStoryFigure } from "@/components/gallery/photo-story-figure";
import { revealDelay } from "@/components/site/motion";
import {
  PHOTO_STORY_ROWS,
  type PhotoStoryLayout,
  type PhotoStoryRow,
} from "@/lib/site/gallery-data";
import { cn } from "@/lib/utils";

// Each row is its own grid (a designed rhythm, not auto-flowing masonry).
// <640px: one column. 640-1023px: two columns. >=1024px: as designed at the
// 1368px column (928fr+416fr = 1344 = 1368 - 24 gap, so `fr` reproduces the
// Figma widths exactly).
const ROW_GRID: Record<PhotoStoryLayout, string> = {
  "wide-narrow": "sm:grid-cols-[928fr_416fr]",
  "narrow-wide": "sm:grid-cols-[416fr_928fr]",
  "staggered-3": "sm:grid-cols-2 lg:grid-cols-3",
};

// Middle (tall) photo of a staggered row: on tablet it spans both rows of the
// right column so the two other photos stack beside it; desktop = 3 columns.
const STAGGERED_CENTER =
  "sm:col-start-2 sm:row-span-2 sm:row-start-1 lg:col-start-auto lg:row-span-1 lg:row-start-auto";

function PhotoStoryRowView({ row }: { row: PhotoStoryRow }) {
  return (
    <div className={cn("grid grid-cols-1 items-start gap-x-6 gap-y-8", ROW_GRID[row.layout])}>
      {row.slots.map((slot, index) => (
        // The cell keeps the grid placement and the 72px offset (padding);
        // only the figure inside it animates (transform/opacity), so layout
        // never shifts. Stagger by column so rows do not chain delays.
        <div
          key={`${row.id}-${index}`}
          className={cn(
            row.layout === "staggered-3" && index === 1 && STAGGERED_CENTER,
            slot.offset && "lg:pt-18"
          )}
        >
          <PhotoStoryFigure slot={slot} delay={revealDelay(index)} />
        </div>
      ))}
    </div>
  );
}

export function PhotoStory({ className }: { className?: string }) {
  const t = useTranslations("gallery.story");

  return (
    <section aria-labelledby="gallery-photo-story" className={cn("flex flex-col gap-8 md:gap-[42px]", className)}>
      <h2 id="gallery-photo-story" className="sr-only">
        {t("heading")}
      </h2>
      {PHOTO_STORY_ROWS.map((row) => (
        <PhotoStoryRowView key={row.id} row={row} />
      ))}
    </section>
  );
}
