import type { ResolvedImage } from "../types";

// Intrinsic pixel size of the bundled site photos (measured from the files in public/images/site).
// The CMS adapter (T1.2.9) gets `width`/`height` from the media map instead; unknown files are `null`.
const STATIC_SIZE: Record<string, readonly [number, number]> = {
  "/images/site/home/hero-bg.png": [2048, 1080],
  "/images/site/home/our-path-photo-1.jpg": [1024, 1024],
  "/images/site/home/our-path-photo-2.jpg": [848, 1264],
  "/images/site/home/our-path-photo-3.jpg": [1024, 1024],
  "/images/site/home/blog-card-1.jpg": [1264, 848],
  "/images/site/home/blog-card-2.jpg": [1264, 848],
  "/images/site/home/blog-card-3.jpg": [1264, 848],
  "/images/site/home/blog-card-4.jpg": [1376, 768],
  "/images/site/gallery-card-forest-stream.png": [1200, 896],
  "/images/site/our-path/hero-bg-forest.jpg": [2048, 1080],
  "/images/site/our-path/about-1-kayak.jpg": [1264, 848],
  "/images/site/our-path/about-2-glacier-climbers.jpg": [1024, 1024],
  "/images/site/our-path/about-3-rock-climber.jpg": [1024, 1024],
  "/images/site/our-path/gallery-jungle-stream.jpg": [1200, 896],
  "/images/site/hero-forest-stream.jpg": [3456, 1902],
  "/images/site/gallery/story-beneath-the-canopy.jpg": [1376, 768],
  "/images/site/gallery/story-light-comes-through.jpg": [1152, 928],
  "/images/site/gallery/story-small-unfolding-fern.jpg": [1024, 1024],
  "/images/site/gallery/story-softer-path.jpg": [1024, 1024],
  "/images/site/gallery/story-water-over-stone.jpg": [1200, 896],
  "/images/site/blog/blog-article-hero-mountains.jpg": [1264, 848],
  "/images/site/blog/blog-gallery-rainforest-stream.jpg": [1200, 896],
};

/** A bundled photo as a `ResolvedImage`. `alt: ""` = decorative. */
export function staticImage(url: string, alt = ""): ResolvedImage {
  const size = STATIC_SIZE[url];
  return { url, alt, width: size?.[0] ?? null, height: size?.[1] ?? null };
}
