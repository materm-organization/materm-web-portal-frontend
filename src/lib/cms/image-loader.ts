// Global `next/image` loader (next.config.ts `images.loaderFile`): ONE place decides how an image is served.
//  - absolute http(s) URL (file-service media from the CMS): returned as is, NOT optimized. No host allow-list
//    (`images.remotePatterns`) is needed, and the browser loads it directly like the admin frontend's plain <img>.
//  - SVG (bundled logo / emblem): returned as is. Next's optimizer refuses SVG (400) unless `dangerouslyAllowSVG`
//    is set, and a vector needs no resizing; the default loader skips SVG for the same reason, a custom loader must too.
//  - other site-relative path (`/images/site/...`, bundled): through the Next optimizer, same URL shape as the default loader.
// Runs in the browser and on the server, so it imports nothing.
import type { ImageLoaderProps } from "next/image";

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (/^https?:\/\//i.test(src)) return src;
  if (/\.svg(?:[?#].*)?$/i.test(src)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`;
}
