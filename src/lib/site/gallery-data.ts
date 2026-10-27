// Geometry of the Gallery photo story (code, not content: doc/04 section 3.1). Photos, captions and
// rows come from the CMS (`photo_story` section + album); only the display crops live here.

/** Display crop of a photo slot (Figma sizes at the 1368px column). */
export type PhotoSlotSize = "wide" | "narrow" | "short" | "tall" | "medium";

/** width / height of the display crop, used for the aspect ratio. */
export const PHOTO_SLOT_RATIO: Record<PhotoSlotSize, number> = {
  wide: 928 / 440,
  narrow: 416 / 440,
  short: 440 / 290,
  tall: 440 / 460,
  medium: 440 / 310,
};

/** `next/image` `sizes` per slot (column is capped at 1368px). */
export const PHOTO_SLOT_SIZES: Record<PhotoSlotSize, string> = {
  wide: "(min-width: 1536px) 928px, (min-width: 1024px) 68vw, (min-width: 640px) 66vw, 100vw",
  narrow: "(min-width: 1536px) 416px, (min-width: 640px) 31vw, 100vw",
  short: "(min-width: 1536px) 440px, (min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw",
  tall: "(min-width: 1536px) 440px, (min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw",
  medium: "(min-width: 1536px) 440px, (min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw",
};
