import "server-only";

import { getPosts } from "@/lib/cms/loaders";
import type { PageData } from "@/lib/cms/types";

import type { AdaptContext } from "./adapters";
import { describeMissing } from "./preview-missing";
import { getSectionEntry } from "./registry";
import { PREVIEW_PLACEHOLDER_KEY, type SectionData } from "./types";

// Turns a P-06 page response into the `SectionData[]` the `SectionRenderer` draws (doc/08 §4.1, §4.5).
// Same code for bundle, mock and api. A section that cannot be drawn is dropped, the page still renders
// (§3.8: one broken section must not take the page down) and a structured line is logged.

const logged = new Set<string>();

function logOnce(event: "section_unknown" | "section_invalid", pageKey: string, key: string, version: number, extra?: string): void {
  const id = `${event}|${pageKey}|${key}|${version}`;
  if (logged.has(id)) return;
  logged.add(id);
  try {
    console.warn(JSON.stringify({ event, key, version, page_key: pageKey, ...(extra ? { reason: extra } : {}) }));
  } catch {
    /* logging must never break a page */
  }
}

export interface AdaptOptions {
  locale: string;
  /** `?category=` */
  category?: string | null;
  /**
   * true = the page is a PREVIEW of a draft (`getPreviewPage`). A section whose adapter finds too little data is then
   * replaced by a placeholder that says what is missing (publish would have refused it) instead of vanishing, and
   * the heroes carry the "no background image yet" hint. false (visitors) = the section is skipped, as always.
   */
  preview?: boolean;
}

function placeholder(section: PageData["sections"][number], ctx: AdaptContext): SectionData {
  return {
    id: section.id,
    key: PREVIEW_PLACEHOLDER_KEY,
    version: section.version,
    variant: null,
    anchorId: section.anchor_id,
    props: { sectionKey: section.key, missing: describeMissing(section.key, section, ctx) },
  };
}

export async function adaptPage(page: PageData, { locale, category = null, preview = false }: AdaptOptions): Promise<SectionData[]> {
  const ctx: AdaptContext = {
    locale,
    media: page.media ?? {},
    category,
    preview,
    getPosts: (query) => getPosts(locale, query),
  };
  const pageKey = page.page.key;

  const adapted = await Promise.all(
    page.sections.map(async (section): Promise<SectionData | null> => {
      const entry = getSectionEntry(section.key);
      if (section.unsupported || !entry || !entry.versions.includes(section.version)) {
        logOnce("section_unknown", pageKey, section.key, section.version);
        return null;
      }
      try {
        const props = await entry.adapter(section as never, ctx);
        if (props === null || props === undefined) {
          logOnce("section_invalid", pageKey, section.key, section.version, "not_enough_data");
          return preview ? placeholder(section, ctx) : null;
        }
        return {
          id: section.id,
          key: section.key,
          version: section.version,
          variant: section.variant,
          anchorId: section.anchor_id,
          props,
        } as SectionData;
      } catch (err) {
        logOnce("section_invalid", pageKey, section.key, section.version, err instanceof Error ? err.name : "error");
        return preview ? placeholder(section, ctx) : null;
      }
    }),
  );
  return adapted.filter((s): s is SectionData => s !== null);
}
