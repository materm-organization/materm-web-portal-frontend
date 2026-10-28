// Preview only: WHAT is missing when an adapter found too little data to draw a section (`adapters.ts` returned null).
// Mirrors each adapter's `return null` conditions, in the vocabulary of the schema fields the editor knows
// (`doc/content-schemas`). Pure: no React, no server-only.
import { strOrNull, toDoc, toImage, type AdaptContext } from "./adapters";

/* eslint-disable @typescript-eslint/no-explicit-any -- the input is a draft: any shape may arrive */
type Any = { props?: Record<string, any>; resolved?: Record<string, any> };

const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** field names (schema property names) that keep the section from rendering; `["content"]` when nothing specific is known */
export function describeMissing(key: string, section: unknown, ctx: Pick<AdaptContext, "media">): string[] {
  const s = section as Any;
  const p = s?.props ?? {};
  const r = s?.resolved ?? {};
  const out: string[] = [];
  const need = (cond: boolean, field: string) => { if (!cond) out.push(field); };
  switch (key) {
    case "hero_brand":
    case "hero_article":
      need(strOrNull(p.title) !== null, "title");
      break;
    case "intro_heading":
      need(strOrNull(p.title) !== null, "title");
      break;
    case "intro_text":
      need(toDoc(p.text) !== null, "text");
      break;
    case "teaser_collage": {
      need(strOrNull(p.title) !== null, "title");
      const images = arr(p.images).map((ref) => toImage(ctx.media, ref));
      need(images.length === 3 && images.every((i) => i !== null), "images (3 usable photos)");
      break;
    }
    case "blog_strip":
      need(arr(r.posts).length > 0, "posts (none published or with an image)");
      break;
    case "gallery_cards":
      need(arr(r.cards).length > 0, "cards (none with an image)");
      break;
    case "about_blocks":
      need(arr(p.items).some((i) => toImage(ctx.media, i?.image) && toDoc(i?.body) && strOrNull(i?.title)), "items (image, title and body)");
      break;
    case "photo_story":
      need(arr(p.rows).length > 0, "rows");
      if (arr(p.rows).length > 0) out.push("slots (no photo of the album could be shown)");
      break;
    case "faq":
      need(arr(r.items).length > 0, "faq_group_key (no published questions)");
      break;
    default:
      break;
  }
  return out.length > 0 ? out : ["content"];
}
