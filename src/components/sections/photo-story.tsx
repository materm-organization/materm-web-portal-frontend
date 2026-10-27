import { PhotoStoryFigure } from "@/components/gallery/photo-story-figure";
import { revealDelay } from "@/components/site/motion";
import { cn } from "@/lib/utils";

import { subId } from "./dom-id";
import type { PhotoStoryLayout, SectionComponentProps } from "./types";

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

// `photo_story` (frame `page-column`): rows of captioned photos from an album.
export function PhotoStory({ domId, accessibleHeading, rows }: SectionComponentProps<"photo_story">) {
  const headingId = subId(domId, "heading");

  return (
    <section id={domId} aria-labelledby={headingId} className="flex flex-col gap-8 md:gap-[42px]">
      <h2 id={headingId} className="sr-only">
        {accessibleHeading}
      </h2>
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={cn("grid grid-cols-1 items-start gap-x-6 gap-y-8", ROW_GRID[row.layout])}
        >
          {row.slots.map((slot, index) => (
            // The cell keeps the grid placement and the 72px offset (padding);
            // only the figure inside it animates (transform/opacity), so layout
            // never shifts. Stagger by column so rows do not chain delays.
            <div
              key={index}
              className={cn(
                row.layout === "staggered-3" && index === 1 && STAGGERED_CENTER,
                slot.offset && "lg:pt-18",
              )}
            >
              <PhotoStoryFigure
                image={slot.image}
                title={slot.title}
                description={slot.description}
                size={slot.size}
                delay={revealDelay(index)}
              />
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
