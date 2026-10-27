// Typed content for the public /gallery page. Text (titles, descriptions, alt)
// lives in `i18n/site/gallery.{en,la}.json` under `gallery.photos.<id>.*`;
// this file only holds ids, asset paths, intrinsic sizes and layout variants.

export type GalleryPhotoId =
  | "beneathTheCanopy"
  | "smallUnfolding"
  | "waterOverStone"
  | "softerPath"
  | "lightComesThrough";

export interface GalleryPhoto {
  /** Also the i18n key: `gallery.photos.<id>.{title,description,alt}`. */
  id: GalleryPhotoId;
  src: string;
  /** Intrinsic pixel size of the file. */
  width: number;
  height: number;
}

export const GALLERY_PHOTOS: Record<GalleryPhotoId, GalleryPhoto> = {
  beneathTheCanopy: {
    id: "beneathTheCanopy",
    src: "/images/site/gallery/story-beneath-the-canopy.jpg",
    width: 1376,
    height: 768,
  },
  smallUnfolding: {
    id: "smallUnfolding",
    src: "/images/site/gallery/story-small-unfolding-fern.jpg",
    width: 1024,
    height: 1024,
  },
  waterOverStone: {
    id: "waterOverStone",
    src: "/images/site/gallery/story-water-over-stone.jpg",
    width: 1200,
    height: 896,
  },
  softerPath: {
    id: "softerPath",
    src: "/images/site/gallery/story-softer-path.jpg",
    width: 1024,
    height: 1024,
  },
  lightComesThrough: {
    id: "lightComesThrough",
    src: "/images/site/gallery/story-light-comes-through.jpg",
    width: 1152,
    height: 928,
  },
};

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

export type PhotoStoryLayout = "wide-narrow" | "narrow-wide" | "staggered-3";

export interface PhotoStorySlot {
  photo: GalleryPhotoId;
  size: PhotoSlotSize;
  /** Pushes the slot down 72px on desktop (third column of the staggered row). */
  offset?: boolean;
}

export interface PhotoStoryRow {
  id: string;
  layout: PhotoStoryLayout;
  slots: readonly PhotoStorySlot[];
}

const STAGGERED_SLOTS: readonly PhotoStorySlot[] = [
  { photo: "waterOverStone", size: "short" },
  { photo: "softerPath", size: "tall" },
  { photo: "lightComesThrough", size: "medium", offset: true },
];

// Designed rhythm (rows A, B, C, D): 5 unique photos reused across 10 slots.
export const PHOTO_STORY_ROWS: readonly PhotoStoryRow[] = [
  {
    id: "a",
    layout: "wide-narrow",
    slots: [
      { photo: "beneathTheCanopy", size: "wide" },
      { photo: "smallUnfolding", size: "narrow" },
    ],
  },
  { id: "b", layout: "staggered-3", slots: STAGGERED_SLOTS },
  {
    id: "c",
    layout: "narrow-wide",
    slots: [
      { photo: "smallUnfolding", size: "narrow" },
      { photo: "beneathTheCanopy", size: "wide" },
    ],
  },
  { id: "d", layout: "staggered-3", slots: STAGGERED_SLOTS },
];

/** Shared flat asset (also used by other pages). */
export const GALLERY_CARD_IMAGE = "/images/site/gallery-card-forest-stream.png";

/** Number of cards in the "GALLERY" section (all use the same photo). */
export const GALLERY_CARD_COUNT = 3;
