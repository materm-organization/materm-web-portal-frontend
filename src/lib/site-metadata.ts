import type { Metadata } from "next";

import { mediaItem } from "@/lib/cms/media";
import type { MediaMap, PageData, PostDetail, SeoData, SettingsGroups } from "@/lib/cms/types";

// Metadata of the public site (doc/08 §3.5). Everything comes from the CMS responses:
//  - layout: `metadataBase` (settings `site.base_url`), title template / default, default description;
//  - page / post: `seo.*` of P-06 / P-08. The backend already applied its fallbacks (§2.3.1).
// Titles render through the layout template (`%s | Materm`) unless `title_absolute` (Home = "Materm").
// There is no `alternates.languages`: the site has no hreflang (FR-SEO-08).

const FALLBACK_TEMPLATE = "%s | Materm";
const FALLBACK_NAME = "Materm";
const FALLBACK_DESCRIPTION = "Materm - treehouse and camping at Phou Khao Khouay, Laos.";

/** A string setting, or `undefined` when it is missing / blank / not a string. */
function setting(settings: SettingsGroups | undefined, group: string, key: string): string | undefined {
  const v = settings?.[group]?.[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/** `new URL(base_url)` for `metadataBase`; undefined (Next then warns at build) when it is not an http(s) URL. */
export function parseBaseUrl(raw: string | undefined): URL | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Layout-level metadata from P-05 `settings` (static fallbacks when a setting is missing). */
export function createLayoutMetadata(settings: SettingsGroups | undefined): Metadata {
  const template = setting(settings, "seo", "title_template");
  return {
    metadataBase: parseBaseUrl(setting(settings, "site", "base_url")),
    title: {
      default: setting(settings, "seo", "site_name") ?? FALLBACK_NAME,
      template: template && template.includes("%s") ? template : FALLBACK_TEMPLATE,
    },
    description: setting(settings, "seo", "default_description") ?? FALLBACK_DESCRIPTION,
  };
}

/** OG image URL for a media id, only when it is a relative path or an http(s) URL. */
function ogImage(media: MediaMap | undefined, ref: { media_id: number } | null | undefined): { url: string; width?: number; height?: number }[] | undefined {
  const item = ref ? mediaItem(media, ref.media_id) : null;
  if (!item || !/^(\/(?!\/)|https?:\/\/)/i.test(item.url)) return undefined;
  return [{ url: item.url, ...(item.width && item.height ? { width: item.width, height: item.height } : {}) }];
}

type SeoLike = Pick<SeoData, "title" | "description" | "og_image" | "canonical" | "noindex">;

function fromSeo(seo: SeoLike, media: MediaMap | undefined): Metadata {
  const images = ogImage(media, seo.og_image);
  return {
    description: seo.description ?? undefined,
    alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
    robots: seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: { title: seo.title, description: seo.description ?? undefined, ...(images ? { images } : {}) },
  };
}

/** Metadata of a CMS page (`page.seo`). */
export function createPageMetadata({ page, media }: Pick<PageData, "page" | "media">): Metadata {
  const { seo } = page;
  return {
    title: seo.title_absolute ? { absolute: seo.title } : seo.title,
    ...fromSeo(seo, media),
  };
}

/** Metadata of an article (`post.seo`, `openGraph.type = "article"`). */
export function createPostMetadata(post: PostDetail): Metadata {
  const base = fromSeo(post.seo, post.media);
  return {
    title: post.seo.title,
    ...base,
    openGraph: { ...base.openGraph, type: "article", publishedTime: post.date_time },
  };
}
