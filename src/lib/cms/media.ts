// Media helpers for components/adapters (pure, usable from Server Components).
import type { ImageRef, MediaItem, MediaMap } from "./types";

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

/** Placement alt wins; null -> media alt; decorative -> "". Missing media -> null (render `bg-site-line`). */
export function resolveImage(
  media: MediaMap | undefined,
  ref: Pick<ImageRef, "media_id"> & { alt?: string | null; decorative?: boolean } | null | undefined,
): ResolvedImage | null {
  if (!ref) return null;
  const m = mediaItem(media, ref.media_id);
  if (!m) return null;
  const alt = ref.decorative ? "" : (ref.alt ?? m.alt ?? "");
  return { src: m.url, width: m.width, height: m.height, alt };
}
