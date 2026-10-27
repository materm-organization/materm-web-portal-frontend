import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { adaptPage } from "@/components/sections/adapt-page";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { getRequestLocale } from "@/lib/cms/locale";
import { getPage } from "@/lib/cms/loaders";
import { createPageMetadata } from "@/lib/site-metadata";

// ONE route for every CMS page (`/`, `/our-path`, `/blog`, `/gallery`, `/contact`, pages made later in the
// admin): the path is looked up with P-06 (`getPage`), its sections go through the registry adapters and the
// `SectionRenderer`. A path without a published page is a 404. More specific routes win over this one
// (`blog/[slug]`, `api/*`, `sitemap.xml`, `robots.txt`). doc/08 §3.4.
//
// `cookies()` (locale) makes the route dynamic, as the root layout already did.
interface CatchAllProps {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ category?: string | string[] }>;
}

/** `["our-path"]` -> `/our-path`, `undefined` -> `/`. null = not a valid page path (-> 404). */
function toPagePath(segments: string[] | undefined): string | null {
  if (!segments || segments.length === 0) return "/";
  try {
    const decoded = segments.map((segment) => decodeURIComponent(segment));
    return decoded.some((segment) => segment === "" || segment.includes("/")) ? null : `/${decoded.join("/")}`;
  } catch {
    return null; // malformed %-escape
  }
}

async function loadPage(segments: string[] | undefined) {
  const path = toPagePath(segments);
  if (path === null) return null;
  const locale = await getRequestLocale();
  const page = await getPage(path, locale); // React cache(): shared by generateMetadata and the page
  return page ? { page, locale } : null;
}

export async function generateMetadata({ params }: CatchAllProps): Promise<Metadata> {
  const loaded = await loadPage((await params).path);
  return loaded ? createPageMetadata(loaded.page) : {};
}

export default async function CmsPage({ params, searchParams }: CatchAllProps) {
  const loaded = await loadPage((await params).path);
  if (!loaded) notFound();

  const { category } = await searchParams;
  const sections = await adaptPage(loaded.page, {
    locale: loaded.locale,
    category: Array.isArray(category) ? (category[0] ?? null) : (category ?? null),
  });
  return <SectionRenderer sections={sections} />;
}
