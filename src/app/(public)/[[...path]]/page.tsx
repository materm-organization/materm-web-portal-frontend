import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { adaptPage } from "@/components/sections/adapt-page";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { PreviewBanner } from "@/components/site/preview-banner";
import { getRequestLocale } from "@/lib/cms/locale";
import { getPage, resolveRedirect } from "@/lib/cms/loaders";
import { isPermanentRedirect, type RedirectTarget } from "@/lib/cms/redirects";
import { getPreviewPage, readPreviewSession } from "@/lib/cms/preview";
import type { PageData } from "@/lib/cms/types";
import type { PreviewInfo } from "@/lib/preview/resolve";
import { statusLocation } from "@/lib/preview/handlers";
import { PREVIEW_ROBOTS, withPreviewRobots } from "@/lib/preview/metadata";
import { createPageMetadata } from "@/lib/site-metadata";

// ONE route for every CMS page (`/`, `/our-path`, `/blog`, `/gallery`, `/contact`, pages made later in the
// admin): the path is looked up with P-06 (`getPage`), its sections go through the registry adapters and the
// `SectionRenderer`. A path without a published page is a 404. More specific routes win over this one
// (`blog/[slug]`, `api/*`, `sitemap.xml`, `robots.txt`). doc/08 §3.4.
//
// PREVIEW (PF-10): a visitor with the `materm_preview` cookie, on the page the link was issued for, gets the page
// from `GET /preview/resolve` (`getPreviewPage`) instead of P-06 - the SAME `adaptPage` / `SectionRenderer`
// pipeline, plus the banner and `noindex`. On any other page the published content is shown (a small banner says
// the session is still open). A dead token (401/422) sends the browser through `/api/preview/exit?reason=expired`
// (a Server Component cannot delete a cookie), 429 / backend trouble go to `/preview-status`; never to the bundle.
//
// `cookies()` (locale, preview) makes the route dynamic, as the root layout already did: visitors' pages are not
// ISR today, their content is cached in Next's DATA cache (`force-cache` fetches in `src/lib/cms/client.ts`),
// which a preview request neither reads nor writes.
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

type Loaded =
  | { kind: "page"; page: PageData; locale: string; path: string; preview: PreviewInfo | null; elsewhereOf: string | null }
  | { kind: "preview-failed"; to: string }
  | { kind: "redirect"; redirect: RedirectTarget };

async function loadPage(segments: string[] | undefined): Promise<Loaded | null> {
  const path = toPagePath(segments);
  if (path === null) return null;
  const locale = await getRequestLocale();

  const session = await readPreviewSession(); // null without the cookie / in bundle mode
  if (session && session.path === path) {
    const outcome = await getPreviewPage(session.token, path, locale); // React cache(): shared by generateMetadata and the page
    // a post token never answers for a page path (the backend ties a token to ONE entity); if it ever did, show nothing
    if (outcome.kind === "ok" && outcome.data.kind === "page") {
      return { kind: "page", page: outcome.data.page, locale, path, preview: outcome.data.preview, elsewhereOf: null };
    }
    if (outcome.kind === "ok") return { kind: "preview-failed", to: statusLocation("unavailable") };
    if (outcome.kind === "invalid") return { kind: "preview-failed", to: "/api/preview/exit?reason=expired" };
    return { kind: "preview-failed", to: statusLocation(outcome.kind === "busy" ? "busy" : "unavailable") };
  }

  const page = await getPage(path, locale); // React cache(): shared by generateMetadata and the page
  if (page) return { kind: "page", page, locale, path, preview: null, elsewhereOf: session?.path ?? null };
  // nothing published here: a CMS redirect (P-17) may take over before the 404 (React cache(): one call per render)
  const found = await resolveRedirect(path, locale);
  return found ? { kind: "redirect", redirect: found } : null;
}

export async function generateMetadata({ params }: CatchAllProps): Promise<Metadata> {
  const loaded = await loadPage((await params).path);
  if (!loaded) return {};
  if (loaded.kind === "redirect") return {};
  if (loaded.kind === "preview-failed") return { robots: PREVIEW_ROBOTS };
  // drafts are never indexed; a published page seen from an open preview session is not indexed either
  return withPreviewRobots(createPageMetadata(loaded.page), loaded.preview !== null || loaded.elsewhereOf !== null);
}

export default async function CmsPage({ params, searchParams }: CatchAllProps) {
  const loaded = await loadPage((await params).path);
  if (!loaded) notFound();
  if (loaded.kind === "redirect") {
    // 301/308 -> HTTP 308, 302/307 -> HTTP 307 (src/lib/cms/redirects.ts); the lookup ran before streaming (no loading.tsx)
    if (isPermanentRedirect(loaded.redirect.statusCode)) permanentRedirect(loaded.redirect.target);
    redirect(loaded.redirect.target);
  }
  if (loaded.kind === "preview-failed") redirect(loaded.to);

  const { category } = await searchParams;
  const sections = await adaptPage(loaded.page, {
    locale: loaded.locale,
    category: Array.isArray(category) ? (category[0] ?? null) : (category ?? null),
    preview: loaded.preview !== null, // a draft: incomplete sections get a placeholder + hint instead of vanishing
  });
  // visitors without a preview session get exactly the tree they always had (no wrapper, same React ids)
  if (!loaded.preview && !loaded.elsewhereOf) return <SectionRenderer sections={sections} />;
  return (
    <>
      {loaded.preview && <PreviewBanner variant="preview" warnings={loaded.preview.warnings} path={loaded.path} />}
      {loaded.elsewhereOf && <PreviewBanner variant="elsewhere" path={loaded.elsewhereOf} />}
      <SectionRenderer sections={sections} />
    </>
  );
}
