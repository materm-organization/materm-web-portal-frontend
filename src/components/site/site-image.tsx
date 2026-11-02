"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";

import { servesAsIs } from "@/lib/cms/image-loader";

export type SiteImageProps = ImageProps & {
  /**
   * What to do when the image cannot be loaded (404, file service down, invalid URL). Default `"hide"`: the
   * `<img>` stays in the DOM but is `invisible` (no broken-image icon, no alt text), so its box / the parent's
   * aspect-ratio frame and background keep the layout. `"remove"` renders nothing at all (logos, emblems).
   */
  onFailure?: "hide" | "remove";
};

/**
 * `next/image` for the whole site. A src that is served as is (absolute file-service URL, SVG logo / icons) is
 * rendered `unoptimized`: the global loader (src/lib/cms/image-loader.ts) would return it unchanged, which makes
 * Next warn in development that the loader ignores `width`. Everything else keeps the optimizer.
 *
 * A CMS image that fails to load shows NOTHING (never a broken-image icon). The `error` event can fire before React
 * attaches `onError` (server-rendered `<img>`), so after hydration the element is also checked for
 * `complete && naturalWidth === 0`. A new `src` resets the failed state. An empty src renders nothing.
 */
export default function SiteImage({ onFailure = "hide", onError, className, ...props }: SiteImageProps) {
  const srcKey = typeof props.src === "string" ? props.src : ("default" in props.src ? props.src.default.src : props.src.src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement | null>(null);
  const failed = failedSrc === srcKey;

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailedSrc(srcKey);
  }, [srcKey]);

  if (!props.src || (typeof props.src === "string" && props.src.trim() === "")) return null;
  if (failed && onFailure === "remove") return null;

  const asIs = typeof props.src === "string" && servesAsIs(props.src);
  const handleError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    setFailedSrc(srcKey);
    onError?.(e);
  };

  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- alt is passed through props by every caller
    <Image
      {...props}
      ref={ref}
      unoptimized={props.unoptimized ?? asIs}
      onError={handleError}
      className={failed ? [className, "invisible"].filter(Boolean).join(" ") : className}
      aria-hidden={failed ? true : props["aria-hidden"]}
    />
  );
}
