import type { MetadataRoute } from "next";

import { getRobots } from "@/lib/cms/loaders";

// robots.txt reads NO database (FR-SEO-04): only the environment decides. SITE_ENV=production (or Netlify
// CONTEXT=production) allows crawling; every other deploy (preview, branch, local) disallows everything.
// `force-dynamic`: the env is read per request, not frozen at build time.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { allow, sitemap, disallow } = await getRobots();
  return {
    rules: allow ? { userAgent: "*", allow: "/", disallow } : { userAgent: "*", disallow },
    ...(allow ? { sitemap } : {}),
  };
}
