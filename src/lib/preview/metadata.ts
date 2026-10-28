import type { Metadata } from "next";

/** Drafts and pages seen inside an open preview session are never indexed (FR-PUB-10). PURE. */
export const PREVIEW_ROBOTS = { index: false, follow: false } as const;

export function withPreviewRobots(metadata: Metadata, previewing: boolean): Metadata {
  return previewing ? { ...metadata, robots: PREVIEW_ROBOTS } : metadata;
}
