"use client";

import { useState } from "react";
import type { PointerEvent } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

export interface OurPathPhoto {
  src: string;
  alt: string;
}

export interface OurPathPhotos {
  glacier: OurPathPhoto;
  hiker: OurPathPhoto;
  climber: OurPathPhoto;
}

type CollageState = "default" | "glacier" | "hiker" | "climber";

// Figma set 161:11102 (664x499), states S1..S4 = Frame 17 / Frame 18 /
// Variant3 / Variant4. Values are flex-grow weights that equal the px size
// inside the 664x499 box (the 20px gaps are constant, so interpolating the
// weights equals interpolating the px):
//   [glacier width, right-column width, hiker height, climber height].
// S4 climber is 381 (Figma drew 387, 6px past the 499 root; normalised).
export const COLLAGE_STATES: Record<CollageState, readonly [number, number, number, number]> = {
  default: [373, 271, 239.5, 239.5], // S1 glacier large, two photos stacked right
  glacier: [546, 98, 239.5, 239.5], // S2 glacier wider, right column narrow
  hiker: [98, 546, 381, 98], // S3 glacier strip, hiker = big panel
  climber: [98, 546, 98, 381], // S4 glacier + hiker strips, climber = big panel
};

// Hover only on a real mouse/trackpad on a desktop-sized viewport; touch,
// pen-less tablets and small screens keep S1. Checked at event time, so SSR
// and the first render are always S1 and no effect/subscription is needed.
const HOVER_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

// Gap = 20/664 of the collage width (exactly 20px at 664), on both axes.
const GAP = "gap-[3.012cqw]";
const TILE =
  "relative min-h-0 min-w-0 basis-0 overflow-hidden transition-[flex-grow] duration-500 ease-(--ease-site-out) motion-reduce:transition-none";
const SIZES = "(min-width: 1024px) 546px, 100vw";

export function OurPathCollage({ photos }: { photos: OurPathPhotos }) {
  const [state, setState] = useState<CollageState>("default");
  const [glacier, column, hiker, climber] = COLLAGE_STATES[state];

  // State is driven by pointerenter on the tiles only (the hovered tile always
  // grows under the cursor, so there is no flicker) and reset when the pointer
  // leaves the whole collage.
  const enter = (next: CollageState) => (event: PointerEvent) => {
    if (event.pointerType === "touch" || !window.matchMedia(HOVER_QUERY).matches) return;
    setState(next);
  };

  return (
    <div className="@container w-full" onPointerLeave={() => setState("default")}>
      <div className={cn("flex aspect-[664/499] w-full", GAP)}>
        <div
          style={{ flexGrow: glacier }}
          className={TILE}
          onPointerEnter={enter("glacier")}
        >
          <Image
            src={photos.glacier.src}
            alt={photos.glacier.alt}
            fill
            sizes={SIZES}
            className="object-cover object-center"
          />
        </div>
        <div
          style={{ flexGrow: column }}
          className={cn(
            "flex min-w-0 basis-0 flex-col transition-[flex-grow] duration-500 ease-(--ease-site-out) motion-reduce:transition-none",
            GAP,
          )}
        >
          <div style={{ flexGrow: hiker }} className={TILE} onPointerEnter={enter("hiker")}>
            <Image
              src={photos.hiker.src}
              alt={photos.hiker.alt}
              fill
              sizes={SIZES}
              className="object-cover object-center"
            />
          </div>
          <div style={{ flexGrow: climber }} className={TILE} onPointerEnter={enter("climber")}>
            <Image
              src={photos.climber.src}
              alt={photos.climber.alt}
              fill
              sizes={SIZES}
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
