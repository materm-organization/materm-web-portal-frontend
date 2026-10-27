// Media helpers for components/adapters (pure, usable from Server Components).
import { isRenderableImageUrl } from "./image-hosts";
import type { ImageRef, MediaItem, MediaMap } from "./types";

const warnedHosts = new Set<string>();
function warnUnrenderable(url: string): void {
  let host = "?";
  try {
    host = new URL(url, "http://relative.invalid").host;
  } catch {
    /* keep "?" */
  }
  if (warnedHosts.has(host)) return;
  warnedHosts.add(host);
  try {
    console.warn(JSON.stringify({ event: "media_host_not_allowed", host, hint: "set MEDIA_BASE_URL at build time" }));
  } catch {
    /* logging must never break a page */
  }
}

export function mediaItem(media: MediaMap | undefined, id: number | null | undefined): MediaItem | null {
  if (!media || id === null || id === undefined) return null;
  return media[String(id)] ?? null;
}

export interface ResolvedImage {
  src: string;
  width: number | null;
  height: number | null;
  /** "" for decorative images */
  alt: string;
}

/**
 * Placement alt wins; null -> media alt; decorative -> "". Missing media -> null (render `bg-site-line`).
 * A URL `next/image` cannot load (host not in MEDIA_BASE_URL) also counts as missing: the component would throw.
 */
export function resolveImage(
  media: MediaMap | undefined,
  ref: Pick<ImageRef, "media_id"> & { alt?: string | null; decorative?: boolean } | null | undefined,
): ResolvedImage | null {
  if (!ref) return null;
  const m = mediaItem(media, ref.media_id);
  if (!m) return null;
  if (!isRenderableImageUrl(m.url)) {
    warnUnrenderable(m.url);
    return null;
  }
  const alt = ref.decorative ? "" : (ref.alt ?? m.alt ?? "");
  return { src: m.url, width: m.width, height: m.height, alt };
}
