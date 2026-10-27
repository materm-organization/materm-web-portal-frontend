import type { MetadataRoute } from "next";

import { getSitemap } from "@/lib/cms/loaders";

// P-16 (doc/08 §3.6): canonical URLs of the default locale, `base_url + path`. API down -> the bundled
// sitemap (the loader falls back). Cached by Next; the `sitemap` tag / hourly revalidate refresh it.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { base_url: baseUrl, entries } = await getSitemap();
  return entries.map((entry) => ({ url: `${baseUrl}${entry.path}`, lastModified: entry.lastmod }));
}
