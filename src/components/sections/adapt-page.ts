import "server-only";

import { getPosts } from "@/lib/cms/loaders";
import type { PageData } from "@/lib/cms/types";

import type { AdaptContext } from "./adapters";
import { getSectionEntry } from "./registry";
import type { SectionData } from "./types";

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
}

export async function adaptPage(page: PageData, { locale, category = null }: AdaptOptions): Promise<SectionData[]> {
  const ctx: AdaptContext = {
    locale,
    media: page.media ?? {},
    category,
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
          return null;
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
        return null;
      }
    }),
  );
  return adapted.filter((s): s is SectionData => s !== null);
}
