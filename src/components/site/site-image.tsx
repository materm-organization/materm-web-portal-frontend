import Image, { type ImageProps } from "next/image";

import { servesAsIs } from "@/lib/cms/image-loader";

/**
 * `next/image` for the whole site. A src that is served as is (absolute file-service URL, SVG logo / icons) is
 * rendered `unoptimized`: the global loader (src/lib/cms/image-loader.ts) would return it unchanged, which makes
 * Next warn in development that the loader ignores `width`. Everything else keeps the optimizer.
 * Server-component safe (no hooks).
 */
export default function SiteImage(props: ImageProps) {
  const asIs = typeof props.src === "string" && servesAsIs(props.src);
  // eslint-disable-next-line jsx-a11y/alt-text -- alt is passed through props by every caller
  return <Image {...props} unoptimized={props.unoptimized ?? asIs} />;
}
