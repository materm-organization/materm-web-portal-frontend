import type { StaticImageData } from "next/image";

/** Which side of the text column the photo sits on (desktop). */
export type AboutImageSide = "left" | "right";

export interface AboutBlockData {
  /**
   * Key under `ourPath.about.items.<id>` in i18n/site/our-path.*.json
   * (`date`, `title`, `paragraphs.p1..pN`, `imageAlt`).
   */
  id: string;
  /** Number of paragraphs stored under `paragraphs.p<n>`. */
  paragraphCount: number;
  image: {
    src: string | StaticImageData;
    /** Width / height of the photo frame at the 1728 design (e.g. 712 / 478). */
    ratio: number;
  };
  imageSide: AboutImageSide;
  /**
   * Narrower "pair" layout (text + photo are both 624 wide, 1280 total,
   * centred) used by the mirrored block in the design. Default: the photo
   * stretches to fill the 1368 column.
   */
  inset?: boolean;
}

// Add an entry here (and its `ourPath.about.items.<id>` strings) to add a block.
export const ABOUT_BLOCKS: readonly AboutBlockData[] = [
  {
    id: "kayak",
    paragraphCount: 2,
    image: { src: "/images/site/our-path/about-1-kayak.jpg", ratio: 712 / 478 },
    imageSide: "right",
  },
  {
    id: "glacier",
    paragraphCount: 2,
    image: { src: "/images/site/our-path/about-2-glacier-climbers.jpg", ratio: 624 / 480 },
    imageSide: "left",
    inset: true,
  },
  {
    id: "climber",
    paragraphCount: 2,
    image: { src: "/images/site/our-path/about-3-rock-climber.jpg", ratio: 712 / 555 },
    imageSide: "right",
  },
];

export const GALLERY_TEASER = {
  image: "/images/site/our-path/gallery-jungle-stream.jpg",
  /** Placeholder: the design repeats one photo three times. */
  count: 3,
  href: "/gallery",
} as const;
